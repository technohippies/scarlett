import { defineExtensionMessaging } from '@webext-core/messaging';
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import {
    defineContentScript,
    createShadowRootUi,
    type ShadowRootContentScriptUiOptions,
    type ShadowRootContentScriptUi,
} from '#imports'; // Use WXT's auto-imports

// --- Import Component and Types --- Use relative paths
import TranslatorWidget from '../src/features/translator/TranslatorWidget';
import type { TranslatorWidgetProps, AlignmentData } from '../src/features/translator/TranslatorWidget';
import { extractReadableMarkdown } from '../src/lib/html-processor'; // Import the extraction function
import type {
    DisplayTranslationPayload, // Expect payload from background for displaying
    GenerateTTSPayload,      // Payload sent TO background for TTS
    UpdateAlignmentPayload, // Payload from background with alignment
    ExtractMarkdownRequest, // Import new message type
    ExtractMarkdownResponse // Import new message type
} from '../src/shared/messaging-types.ts';
// --- Import Background Protocol --- 
import type { BackgroundProtocolMap } from '../src/background/handlers/message-handlers';

// --- Messaging Setup --- 

// Define messaging protocol for Content Script Handlers
// (Messages the content script LISTENS FOR from the background)
interface ContentScriptProtocolMap {
    displayTranslationWidget(data: DisplayTranslationPayload): void;
    updateWidgetAlignment(data: UpdateAlignmentPayload): void;
    hideTranslationWidget(): void;
    requestSelectedText(): { success: boolean; text?: string | null }; // Response sent back
    extractMarkdownFromHtml(data: ExtractMarkdownRequest): Promise<ExtractMarkdownResponse>; // Add new handler
}

// Instance for LISTENING to messages FROM background (typed with CS protocol)
const messageListener = defineExtensionMessaging<ContentScriptProtocolMap>();

// Instance for SENDING messages TO background (typed with Background protocol)
const messageSender = defineExtensionMessaging<BackgroundProtocolMap>();

// --- Content Script Definition ---
export default defineContentScript({
    matches: ['<all_urls>'], // Run on all URLs
    runAt: 'document_idle',
    cssInjectionMode: 'ui', // Let WXT handle CSS injection

    async main(ctx) {
        console.log('[Scarlett CS] Main function started.');

        // --- Timer for Page Visit Processing ---
        let pageVisitTimerId: number | null = null;
        const PAGE_VISIT_DELAY = 3000; // 3 seconds

        const schedulePageProcessing = () => {
            if (pageVisitTimerId) {
                clearTimeout(pageVisitTimerId);
            }
            console.log(`[Scarlett CS] Scheduling page processing in ${PAGE_VISIT_DELAY / 1000}s...`);
            pageVisitTimerId = window.setTimeout(async () => {
                console.log('[Scarlett CS] Page visit timer fired. Processing page...');
                try {
                    const url = window.location.href;
                    const title = document.title;
                    const htmlContent = await extractMainContent(); // Use helper function
                    if (htmlContent) {
                        console.log(`[Scarlett CS] Sending processPageVisit for URL: ${url.substring(0, 100)}`);
                        // Use messageSender to send to background
                        messageSender.sendMessage('processPageVisit', { url, title, htmlContent });
                    } else {
                         console.warn('[Scarlett CS] No content extracted, skipping processPageVisit.');
                    }
                } catch (error) {
                     console.error('[Scarlett CS] Error during scheduled page processing:', error);
                }
            }, PAGE_VISIT_DELAY);
        };

        const cancelPageProcessing = () => {
            if (pageVisitTimerId) {
                console.log(`[Scarlett CS] Cancelling scheduled page processing (navigation).`);
                clearTimeout(pageVisitTimerId);
                pageVisitTimerId = null;
            }
        };
        
        // Helper function for content extraction (refactored from getPageContent handler)
        const extractMainContent = async (): Promise<string | null> => {
             try {
                 const selectors = [
                     '#bodyContent', // Specific to Wikipedia
                     'main',
                     'article',
                     '.main-content', 
                     '.post-body',
                     '.entry-content'
                 ];
                 let mainContentElement: HTMLElement | null = null;
                 for (const selector of selectors) {
                     mainContentElement = document.querySelector(selector);
                     if (mainContentElement) {
                         console.log(`[Scarlett CS Extract] Found main content with: ${selector}`);
                         break;
                     }
                 }
                 let htmlContent: string | null = null;
                 if (mainContentElement) {
                     htmlContent = mainContentElement.innerHTML;
                 } else {
                     console.warn('[Scarlett CS Extract] Could not find specific main content container. Falling back to document.body.innerHTML.');
                     htmlContent = document.body.innerHTML;
                 }
                 if (!htmlContent) {
                     console.warn('[Scarlett CS Extract] HTML content extraction resulted in empty content.');
                     return null;
                 }
                 console.log(`[Scarlett CS Extract] Extracted content length: ${htmlContent.length}`);
                 return htmlContent;
             } catch (error) {
                 console.error('[Scarlett CS Extract] Error extracting content:', error);
                 return null;
             }
        }

        // Schedule processing on initial load (or when script is injected)
        // Use requestIdleCallback or a small delay if DOMContentLoaded isn't reliable here
        window.setTimeout(schedulePageProcessing, 500); // Schedule slightly after load
        
        // Cancel processing if the user navigates away
        window.addEventListener('beforeunload', cancelPageProcessing);
        // TODO: Add more robust SPA navigation detection later if needed
        // --- End Timer Logic ---

        // --- State Signals for the Widget ---
        // Using signals allows Solid's reactivity to update the component when data changes.
        
        // This is the type for the DATA object held by the widgetProps signal
        interface WidgetData {
          textToTranslate: string;
          translatedText: string; 
          sourceLang: string; 
          targetLang: string;
          isLoading: boolean;
          pronunciation?: string; 
        }

        const [isVisible, setIsVisible] = createSignal(false);
        const [widgetProps, setWidgetProps] = createSignal<WidgetData>({
            textToTranslate: '',    
            translatedText: '',     
            sourceLang: 'en',
            targetLang: 'en',
            isLoading: false,       
            pronunciation: undefined, 
        });
        const [alignmentData, setAlignmentData] = createSignal<AlignmentData | null>(null);

        // --- Widget Management ---
        let currentWidgetUi: ShadowRootContentScriptUi<() => void | null> | null = null;
        let currentWidgetName: string | null = null;
        let globalClickListener: ((event: MouseEvent) => void) | null = null;
        let currentTranslationOriginalText: string | null = null; // Track original text of current widget

        const hideWidget = async (options: {isPartOfUpdate?: boolean} = {}) => {
            console.log('[Scarlett CS hideWidget] Attempting to hide. currentWidgetUi present:', !!currentWidgetUi, 'Options:', options);
            if (!currentWidgetUi) return;
            console.log('[Scarlett CS hideWidget] Hiding widget:', currentWidgetName);

            const uiToRemove = currentWidgetUi;
            const widgetNameToClear = currentWidgetName;

            // Reset tracking and Solid states
            currentWidgetUi = null;
            // Only reset these if it's not part of an update cycle that will immediately set them again
            if (!options.isPartOfUpdate) {
                currentWidgetName = null;
                currentTranslationOriginalText = null; 
                setIsVisible(false); 
                setAlignmentData(null); 
            }

            if (globalClickListener) {
                document.removeEventListener('click', globalClickListener, { capture: true });
                globalClickListener = null;
                console.log('[Scarlett CS hideWidget] Removed global click listener.');
            }
            try {
                console.log('[Scarlett CS hideWidget] Calling uiToRemove.remove() for', widgetNameToClear);
                uiToRemove.remove(); // This removes the shadow DOM host
                console.log(`[Scarlett CS hideWidget] Widget UI removed (${widgetNameToClear}).`);
            } catch (error) {
                console.error(`[Scarlett CS hideWidget] Error removing widget UI (${widgetNameToClear}):`, error);
            }
        };

        // --- TTS Request Handler (Called from Widget) ---
        const handleTTSRequest = async (text: string, lang: string, speed: number): Promise<{ audioDataUrl?: string; error?: string, alignment?: AlignmentData | null }> => {
            console.log(`[Scarlett CS TTS] Request to BG: Text='${text.substring(0,30)}...', Lang='${lang}', Speed=${speed}`);
            try {
                // The response type from this specific message might not include alignment directly.
                // Let's assume it's { success: boolean, audioDataUrl?: string, error?: string }
                const response = await messageSender.sendMessage('REQUEST_TTS_FROM_WIDGET', { text, lang, speed }) as { success: boolean, audioDataUrl?: string, error?: string };
                console.log('[Scarlett CS TTS] Response from BG:', response);
                if (response && response.success && response.audioDataUrl) {
                    // Do NOT return ttsResult.alignment here as it's not part of this specific message's contract yet.
                    // The widget will receive alignment via the updateWidgetAlignment message and props.alignment signal.
                    return { audioDataUrl: response.audioDataUrl, alignment: null }; // Return null for alignment for now
                } else {
                    return { error: response?.error || 'Unknown TTS error from BG.', alignment: null };
                }
            } catch (error) {
                console.error('[Scarlett CS TTS] Error sending/processing TTS request:', error);
                return { error: error instanceof Error ? error.message : 'Failed TTS request.', alignment: null };
            }
        };

        // --- Message Listener: Display Translation Widget ---
        messageListener.onMessage('displayTranslationWidget', async (message: { data: DisplayTranslationPayload }) => {
            const { originalText, translatedText, sourceLang, targetLang, pronunciation, isLoading } = message.data;
            console.log(`[Scarlett CS displayTranslationWidget] Received. isLoading: ${isLoading}, CurrentOrig: "${currentTranslationOriginalText ? currentTranslationOriginalText.substring(0,10): 'null'}", NewOrig: "${originalText ? originalText.substring(0,10): 'null'}"`);
            console.log(`[Scarlett CS displayTranslationWidget] currentWidgetUi present: ${!!currentWidgetUi}, isVisible(): ${isVisible()}`);

            // If this message is for a *new* original text, or if no widget is currently active or visible
            if (currentTranslationOriginalText !== originalText || !currentWidgetUi || !isVisible()) {
                console.log('[Scarlett CS displayTranslationWidget] New interaction or widget not fully active/different text. Will hide and recreate/show.');
                await hideWidget(); 
                currentTranslationOriginalText = originalText; 

                // Set initial props for the new interaction
                setWidgetProps({
                    textToTranslate: originalText || '',
                    translatedText: isLoading ? '' : (translatedText || ''),
                    sourceLang: sourceLang,
                    targetLang: targetLang,
                    pronunciation: isLoading ? undefined : (pronunciation || undefined),
                    isLoading: isLoading,
                });
                setAlignmentData(null); // Reset alignment for new widget
                setIsVisible(true);
                console.log(`[Scarlett CS displayTranslationWidget] isVisible signal set to true. widgetPropsisLoading: ${widgetProps().isLoading}`);

                console.log('[Scarlett CS displayTranslationWidget] Creating new ShadowRoot UI...');
                const widgetName = 'scarlett-translator-widget';
                currentWidgetName = widgetName;
                const options: ShadowRootContentScriptUiOptions<() => void> = {
                    name: widgetName,
                    position: 'inline', 
                    anchor: undefined,
                    onMount: (containerElement) => { 
                        console.log('[Scarlett CS onMount] CALLED. WXT Container tagName:', containerElement.tagName);
                        
                        if (currentWidgetUi?.shadowHost) {
                            const host = currentWidgetUi.shadowHost as HTMLElement;
                            host.style.position = 'fixed';
                            host.style.bottom = '0rem';
                            host.style.left = '1rem';
                            host.style.zIndex = '2147483647';
                            host.style.fontFamily = 'sans-serif';
                        }
                        console.log('[Scarlett CS onMount] Host styled. Rendering Solid component into SHADOW ROOT...');
                        
                        let unmountSolid: (() => void) | null = null;
                        // Important: currentWidgetUi is defined from the outer scope and should be the new UI instance here
                        if (currentWidgetUi?.shadow) { 
                            try {
                                unmountSolid = render(() => {
                                    // const currentProps = widgetProps(); // No longer need to get the whole object here for logging
                                    // console.log('[Scarlett CS onMount render] isLoading from currentProps:', currentProps.isLoading);
                                    return TranslatorWidget({
                                        // Pass accessors for reactive props
                                        textToTranslate: () => widgetProps().textToTranslate,
                                        translatedText: () => widgetProps().translatedText,
                                        isLoading: () => widgetProps().isLoading,
                                        pronunciation: () => widgetProps().pronunciation,
                                        sourceLang: () => widgetProps().sourceLang,
                                        targetLang: () => widgetProps().targetLang,
                                        alignment: () => alignmentData(), 
                                        onTTSRequest: handleTTSRequest,
                                        onCloseRequest: () => { console.log("[Scarlett CS onCloseRequest] User requested close."); hideWidget(); }
                                    });
                                }, currentWidgetUi.shadow 
                                );
                                console.log('[Scarlett CS onMount] Solid component RENDERED into shadowRoot.');
                            } catch (renderError) {
                                console.error('[Scarlett CS onMount] Error during Solid render into shadowRoot:', renderError);
                                if (currentWidgetUi?.shadow.firstChild) { 
                                     while(currentWidgetUi.shadow.firstChild) currentWidgetUi.shadow.removeChild(currentWidgetUi.shadow.firstChild);
                                }
                                currentWidgetUi.shadow.textContent = "Error displaying translation.";
                            }
                        } else {
                            console.error('[Scarlett CS onMount] currentWidgetUi.shadow is not available for rendering! currentWidgetUi:', currentWidgetUi);
                        }
                        return unmountSolid || (() => {});
                    },
                    onRemove: (unmountSolid) => {
                        console.log(`[Scarlett CS onRemove] CALLED for ${currentWidgetName}.`);
                        if (unmountSolid) unmountSolid();
                    }
                };
                console.log('[Scarlett CS displayTranslationWidget] Options prepared. Calling createShadowRootUi...');
                try {
                    // This creates the UI and currentWidgetUi will be set to this new instance
                    const ui = await createShadowRootUi(ctx, options);
                    console.log('[Scarlett CS displayTranslationWidget] createShadowRootUi SUCCEEDED. UI object:', ui);
                    currentWidgetUi = ui; // Assign the newly created UI to currentWidgetUi
                    
                    console.log('[Scarlett CS displayTranslationWidget] About to call ui.mount(). This will trigger onMount. Current currentWidgetUi:', currentWidgetUi);
                    ui.mount(); // This executes the onMount callback defined above
                    console.log(`[Scarlett CS displayTranslationWidget] Mounted ${widgetName}. currentWidgetUi after mount:`, currentWidgetUi);
                } catch (createUiError) {
                    console.error("[Scarlett CS displayTranslationWidget] FAILED to createShadowRootUi or mount:", createUiError);
                    currentWidgetUi = null; 
                    setIsVisible(false);
                    currentTranslationOriginalText = null;
                    return; 
                }

                // Setup global click listener for the new widget
                if (globalClickListener) document.removeEventListener('click', globalClickListener, { capture: true });
                globalClickListener = (event: MouseEvent) => {
                    const hostElement = currentWidgetUi?.shadowHost; 
                    if (isVisible() && hostElement && !event.composedPath().includes(hostElement)) {
                        console.log(`[Scarlett CS GlobalClick] Click outside ${currentWidgetName}. Hiding.`);
                        hideWidget(); 
                    }
                };
                document.addEventListener('click', globalClickListener, { capture: true });
                console.log('[Scarlett CS displayTranslationWidget] Global click listener ADDED.');
            } else {
                // This block handles updating an EXISTING widget if the original text is the same
                // and the widget is already visible and mounted.
                console.log('[Scarlett CS displayTranslationWidget] Updating EXISTING widget with new props.');
                setWidgetProps({
                    textToTranslate: originalText || '', 
                    translatedText: translatedText || '',
                    sourceLang: sourceLang, targetLang: targetLang,
                    pronunciation: pronunciation || undefined,
                    isLoading: isLoading, 
                });
                // Note: Alignment is updated via a separate 'updateWidgetAlignment' message and signal.
                console.log(`[Scarlett CS displayTranslationWidget] Props updated for existing widget. isVisible(): ${isVisible()}, widgetPropsisLoading: ${widgetProps().isLoading}`);
            }
        }); // End of displayTranslationWidget listener

        messageListener.onMessage('updateWidgetAlignment', (message: { data: UpdateAlignmentPayload }) => {
            console.log('[Scarlett CS updateWidgetAlignment] Received. isVisible():', isVisible(), "currentWidgetUi present:", !!currentWidgetUi);
            if (isVisible() && currentWidgetUi) {
                setAlignmentData(message.data.alignment);
                console.log('[Scarlett CS updateWidgetAlignment] Alignment data signal updated.');
            } else {
                console.warn('[Scarlett CS updateWidgetAlignment] Received alignment but widget not visible/mounted.');
            }
        });

        messageListener.onMessage('hideTranslationWidget', async () => {
             console.log('[Scarlett CS hideTranslationWidget] Received request from BG.');
             await hideWidget();
        });
        
        messageListener.onMessage('requestSelectedText', (_): { success: boolean; text?: string | null } => {
            console.log('[Scarlett CS requestSelectedText] Received.');
            try {
                const selection = window.getSelection();
                const selectedText = selection ? selection.toString().trim() : null;
                return { success: true, text: selectedText };
            } catch (error: any) {
                return { success: false, text: null };
            }
        });

        messageListener.onMessage('extractMarkdownFromHtml', async (message): Promise<ExtractMarkdownResponse> => {
            const { htmlContent, baseUrl } = message.data;
            console.log('[Scarlett CS extractMarkdown] Received.');
            try {
                const result = await extractReadableMarkdown(htmlContent, baseUrl || ''); 
                return { success: true, markdown: result.markdown, title: result.title };
            } catch (error: any) {
                return { success: false, error: error.message || 'Markdown extraction failed.'};
            }
        });

        console.log('[Scarlett CS] Main function setup complete. Listening for messages.');
    }, // End of main function
}); // End of defineContentScript