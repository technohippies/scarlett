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
        console.log('[Scarlett CS] Content script loaded.');

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
                        console.log(`[Scarlett CS] Sending processPageVisit for URL: ${url}`);
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
                         console.log(`[Scarlett CS Extract] Found main content element with selector: ${selector}`);
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
        const [isVisible, setIsVisible] = createSignal(false);
        const [widgetProps, setWidgetProps] = createSignal<Omit<TranslatorWidgetProps, 'alignment' | 'onTTSRequest'>>({
            hoveredWord: '',
            originalWord: '',
            sourceLang: 'en',
            targetLang: 'en',
            // Initialize other necessary props
        });
        const [alignmentData, setAlignmentData] = createSignal<AlignmentData | null>(null);

        // --- Widget Management ---
        let currentWidgetUi: ShadowRootContentScriptUi<() => void | null> | null = null;
        let currentWidgetName: string | null = null;
        let globalClickListener: ((event: MouseEvent) => void) | null = null;

        const hideWidget = async () => {
            if (!currentWidgetUi) return;
            console.log('[Scarlett CS] Hiding widget:', currentWidgetName);

            const uiToRemove = currentWidgetUi;
            const widgetNameToClear = currentWidgetName;

            currentWidgetUi = null;
            currentWidgetName = null;
            setIsVisible(false); // Update visibility state
            setAlignmentData(null); // Clear alignment data on hide

            // Remove global click listener
            if (globalClickListener) {
                document.removeEventListener('click', globalClickListener, { capture: true });
                globalClickListener = null;
                console.log('[Scarlett CS] Removed global click listener.');
            }

            try {
                uiToRemove.remove();
                console.log(`[Scarlett CS] Widget UI removed (${widgetNameToClear}).`);
            } catch (error) {
                console.error(`[Scarlett CS] Error removing widget UI (${widgetNameToClear}):`, error);
            }
        };

        // --- TTS Request Handler (Called from Widget) ---
        const handleTTSRequest = async (text: string, lang: string, speed: number): Promise<{ audioDataUrl?: string; error?: string }> => {
            console.log(`[Scarlett CS] TTS Request to background: Text='${text}', Lang='${lang}', Speed=${speed}`);
            try {
                // Use messageSender to send to background and await the response
                const response = await messageSender.sendMessage(
                    'REQUEST_TTS_FROM_WIDGET', 
                    { text, lang, speed } // Payload remains the same
                );

                console.log('[Scarlett CS] Response from background for TTS request:', response);

                if (response && response.success && response.audioDataUrl) {
                    return { audioDataUrl: response.audioDataUrl };
                } else {
                    const errorMsg = response?.error || 'Unknown error receiving TTS data from background.';
                    console.error(`[Scarlett CS] TTS request failed: ${errorMsg}`);
                    return { error: errorMsg };
                }
            } catch (error) {
                console.error('[Scarlett CS] Error sending TTS request to background or processing response:', error);
                return { error: error instanceof Error ? error.message : 'Failed to request TTS from background.' };
            }
        };

        // --- Message Listener: Display Translation Widget ---
        messageListener.onMessage('displayTranslationWidget', async (message: { data: DisplayTranslationPayload }) => {
            console.log('[Scarlett CS] Received displayTranslationWidget:', message.data.translatedText);
            await hideWidget(); // Ensure any previous widget is removed

            const { originalText, translatedText, sourceLang, targetLang, pronunciation, contextText } = message.data;
            if (!translatedText) {
                console.warn('[Scarlett CS] Received displayTranslationWidget with no translated text.');
                return;
            }

            // Update state signals BEFORE creating the UI
            setWidgetProps({
                hoveredWord: translatedText,
                originalWord: originalText,
                translatedWord: translatedText,
                sourceLang: sourceLang,
                targetLang: targetLang,
                pronunciation: pronunciation || undefined,
                contextSentence: contextText || undefined,
            });
            setAlignmentData(null); // Reset alignment for new widget
            setIsVisible(true);     // Set visibility

            try {
                const widgetName = 'scarlett-translator-widget';
                currentWidgetName = widgetName;

                const options: ShadowRootContentScriptUiOptions<() => void> = {
                    name: widgetName,
                    position: 'inline',
                    anchor: undefined,
                    onMount: (container): (() => void) => {
                        
                        
                        // Apply fixed positioning styles to the container
                        container.style.position = 'fixed';
                        container.style.bottom = '0rem';
                        container.style.left = '1rem';
                        container.style.zIndex = '2147483647'; // High z-index
                        container.style.fontFamily = 'sans-serif'; // Add base font family
                        console.log('[Scarlett CS] Applied fixed styles to translator container.');

                        // Render TranslatorWidget using Solid's render
                        console.log('[Scarlett CS] Rendering TranslatorWidget component...');
                        let unmountSolid: (() => void) | null = null;
                        try {
                            // Pass state signals and the handler to the component
                            unmountSolid = render(() =>
                                TranslatorWidget({
                                    ...widgetProps(), // Spread properties from the signal
                                    alignment: alignmentData(), // Pass alignment signal value
                                    onTTSRequest: handleTTSRequest // Pass the handler function
                                }),
                                container
                            );
                            console.log('[Scarlett CS] TranslatorWidget component rendered.');
                            // Return the unmount function for cleanup
                            return unmountSolid || (() => {});
                        } catch (renderError) {
                            console.error('[Scarlett CS] Error during Solid render:', renderError);
                            container.textContent = "Error displaying translation.";
                            return () => {}; // Return empty cleanup function on error
                        }
                    },
                    onRemove: (unmountSolid) => {
                        console.log(`[Scarlett CS] Removing TranslatorWidget UI (${widgetName}) callback...`);
                        if (unmountSolid) {
                            try {
                                unmountSolid();
                                console.log('[Scarlett CS] Solid component unmounted.');
                            } catch (unmountError) {
                                console.error('[Scarlett CS] Error during Solid unmount:', unmountError);
                            }
                        }
                        // Reset state just in case onRemove is called directly
                        setIsVisible(false);
                        setAlignmentData(null);
                    }
                };

                const ui = await createShadowRootUi(ctx, options);
                currentWidgetUi = ui;
                ui.mount();
                console.log(`[Scarlett CS] Mounted ${widgetName}.`);

                // Add global click listener AFTER mount
                if (globalClickListener) document.removeEventListener('click', globalClickListener, { capture: true });
                globalClickListener = (event: MouseEvent) => {
                    // Check if the click is outside the currently mounted widget
                    const hostElement = document.querySelector(`[data-wxt-content-script-ui="${currentWidgetName}"]`);
                    if (isVisible() && hostElement && !event.composedPath().includes(hostElement)) {
                        console.log(`[Scarlett CS] Click outside ${currentWidgetName}. Hiding.`);
                        hideWidget(); // Use the hide function
                    }
                };
                document.addEventListener('click', globalClickListener, { capture: true });

            } catch (error) {
                console.error('[Scarlett CS] Error creating translation widget UI:', error);
                await hideWidget(); // Attempt cleanup on error
            }
        });

        // --- Message Listener: Update Alignment Data ---
        messageListener.onMessage('updateWidgetAlignment', (message: { data: UpdateAlignmentPayload }) => {
            console.log('[Scarlett CS] Received updateWidgetAlignment');
            if (isVisible() && currentWidgetUi) {
                setAlignmentData(message.data.alignment);
                console.log('[Scarlett CS] Alignment data signal updated.');
            } else {
                console.warn('[Scarlett CS] Received alignment data but widget is not visible or mounted.');
            }
        });

        // --- Message Listener: Hide request from background ---
        messageListener.onMessage('hideTranslationWidget', async () => {
             console.log('[Scarlett CS] Received hideTranslationWidget request.');
             await hideWidget();
        });

        // --- Message Listener: Get Page Content --- (Now simpler, uses helper)
        // This is likely deprecated now as processPageVisit sends content
        // messageListener.onMessage('getPageContent', async (_): Promise<GetPageContentResponse> => {
        //     console.log('[Scarlett CS] Received getPageContent request.');
        //     const htmlContent = await extractMainContent();
        //     if (htmlContent) {
        //         return { success: true, htmlContent };
        //     } else {
        //         return { success: false, error: 'Failed to extract page content.' };
        //     }
        // });
        
        // --- Message Listener: Get Selected Text (for background handler) ---
        messageListener.onMessage('requestSelectedText', (_): { success: boolean; text?: string | null } => {
            console.log('[Scarlett CS] Received requestSelectedText request.');
            try {
                const selection = window.getSelection();
                const selectedText = selection ? selection.toString().trim() : null;
                console.log(`[Scarlett CS] Responding with selected text: "${selectedText?.substring(0,50)}..."`);
                return { success: true, text: selectedText };
            } catch (error: any) {
                console.error('[Scarlett CS] Error getting selected text:', error);
                return { success: false, text: null };
            }
        });

        // --- Message Listener: Extract Markdown From HTML --- 
        messageListener.onMessage('extractMarkdownFromHtml', async (message): Promise<ExtractMarkdownResponse> => {
            const { htmlContent, baseUrl } = message.data;
            console.log('[Scarlett CS] Received extractMarkdownFromHtml request.');
            try {
                // Pass empty string if baseUrl is undefined
                const result = await extractReadableMarkdown(htmlContent, baseUrl || ''); 
                console.log(`[Scarlett CS] Markdown extraction complete. Title: ${result.title}, Length: ${result.markdown?.length}`);
                return { 
                    success: true, 
                    markdown: result.markdown, 
                    title: result.title 
                };
            } catch (error: any) {
                console.error('[Scarlett CS] Error during extractReadableMarkdown:', error);
                return { 
                    success: false, 
                    error: error.message || 'Markdown extraction failed in content script.'
                };
            }
        });

        console.log('[Scarlett CS] Content script setup complete. Listening for messages.');

    }, // End of main function
}); // End of defineContentScript
