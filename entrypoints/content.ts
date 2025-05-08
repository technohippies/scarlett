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
import type { AlignmentData } from '../src/features/translator/TranslatorWidget';
import { extractReadableMarkdown } from '../src/lib/html-processor'; // Import the extraction function
import type {
    DisplayTranslationPayload, // Expect payload from background for displaying
    UpdateAlignmentPayload, // Payload from background with alignment
    ExtractMarkdownRequest, // Import new message type
    ExtractMarkdownResponse, // Import new message type
    LearningWordData, 
    RequestActiveLearningWordsResponse 
} from '../src/shared/messaging-types.ts';
// --- Import Background Protocol --- 
import type { BackgroundProtocolMap } from '../src/background/handlers/message-handlers';
// --- NEW: Import Learning Word Widget ---
import LearningWordWidget from '../src/features/learning/LearningWordWidget';
import type { LearningWordWidgetProps } from '../src/features/learning/LearningWordWidget';
// --- END NEW ---

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
        
        // --- CSS and Tooltip Setup for Learning Words (definitions remain the same) ---
        const LEARNING_HIGHLIGHT_STYLE_ID = "scarlett-learning-highlight-styles";
        const LEARNING_HIGHLIGHT_CSS = `
          .scarlett-learning-highlight {
            background-color: rgba(255, 235, 59, 0.3); /* Light yellow */
            border-bottom: 1px dashed rgba(255, 193, 7, 0.7); /* Amber dash */
            cursor: help;
            border-radius: 3px;
            padding: 0 0.1em;
            margin: 0 0.02em;
          }
        `;

        // --- NEW: State for Learning Word Widget ---
        let currentLearningWordWidgetUi: ShadowRootContentScriptUi<() => void | null> | null = null;
        let currentLearningWordWidgetData: LearningWordData | null = null; // Track which word is displayed
        let learningWidgetHideTimeoutId: number | null = null;
        const LEARNING_WIDGET_HIDE_DELAY = 300; // ms
        const LEARNING_WIDGET_NAME = 'scarlett-learning-word-widget';
        // --- END NEW State ---

        const injectHighlightStyles = () => {
            if (document.getElementById(LEARNING_HIGHLIGHT_STYLE_ID)) return;
            const styleElement = document.createElement('style');
            styleElement.id = LEARNING_HIGHLIGHT_STYLE_ID;
            styleElement.textContent = LEARNING_HIGHLIGHT_CSS;
            document.head.appendChild(styleElement);
        };

        // --- NEW: Learning Word Widget Management ---
        const hideLearningWordWidget = async () => {
            if (learningWidgetHideTimeoutId) {
                clearTimeout(learningWidgetHideTimeoutId);
                learningWidgetHideTimeoutId = null;
            }
            const uiToRemove = currentLearningWordWidgetUi;
            if (!uiToRemove) return;
            
            console.log('[Scarlett CS] Hiding LearningWordWidget for:', currentLearningWordWidgetData?.sourceText);
            currentLearningWordWidgetUi = null;
            currentLearningWordWidgetData = null;
            
            try {
                await uiToRemove.remove();
                console.log('[Scarlett CS] LearningWordWidget UI removed.');
            } catch (error) {
                console.error('[Scarlett CS] Error removing LearningWordWidget UI:', error);
            }
        };
        
        const handleLearningWordTTSRequest = async (text: string, lang: string): Promise<{ audioDataUrl?: string; error?: string }> => {
            console.log(`[Scarlett CS Learning TTS] Request to BG: Text='${text.substring(0,30)}...', Lang='${lang}'`);
            try {
                // Using same message as TranslatorWidget for now, assuming background handles it based on text/lang
                const response = await messageSender.sendMessage('REQUEST_TTS_FROM_WIDGET', { text, lang, speed: 1.0 }) as { success: boolean, audioDataUrl?: string, error?: string };
                console.log('[Scarlett CS Learning TTS] Response from BG:', response);
                if (response && response.success && response.audioDataUrl) {
                    return { audioDataUrl: response.audioDataUrl }; 
                } else {
                    return { error: response?.error || 'Unknown TTS error from BG.' };
                }
            } catch (error) {
                console.error('[Scarlett CS Learning TTS] Error sending/processing TTS request:', error);
                return { error: error instanceof Error ? error.message : 'Failed TTS request.' };
            }
        };

        const showLearningWordWidget = async (anchorElement: HTMLElement, wordData: LearningWordData) => {
            if (currentLearningWordWidgetUi && currentLearningWordWidgetData?.sourceText === wordData.sourceText) {
                return;
            }
            if (currentLearningWordWidgetUi) {
                await hideLearningWordWidget();
            }

            console.log('[Scarlett CS] Showing LearningWordWidget for:', wordData.sourceText);
            currentLearningWordWidgetData = wordData;

            const rect = anchorElement.getBoundingClientRect();
            const topPos = window.scrollY + rect.bottom + 5;
            const leftPos = window.scrollX + rect.left; 

            const options: ShadowRootContentScriptUiOptions<() => void> = {
                name: LEARNING_WIDGET_NAME,
                position: 'inline',
                onMount: (container: HTMLElement): (() => void) => {
                    container.style.position = 'absolute';
                    container.style.top = `${topPos}px`;
                    container.style.left = `${leftPos}px`;
                    container.style.zIndex = '2147483647';
                    container.style.width = '24rem';
                    container.style.height = 'auto';
                    container.style.maxHeight = 'max-content';
                    container.style.borderRadius = '0.5rem';
                    container.style.overflow = 'hidden';
                    
                    container.addEventListener('mouseenter', () => {
                        if (learningWidgetHideTimeoutId) {
                            clearTimeout(learningWidgetHideTimeoutId);
                            learningWidgetHideTimeoutId = null;
                        }
                    });
                    container.addEventListener('mouseleave', () => {
                         if (learningWidgetHideTimeoutId) clearTimeout(learningWidgetHideTimeoutId);
                         learningWidgetHideTimeoutId = window.setTimeout(hideLearningWordWidget, LEARNING_WIDGET_HIDE_DELAY);
                    });
                    
                    let unmountSolid: (() => void) | null = null;
                    try {
                        unmountSolid = render(() => 
                            LearningWordWidget({
                                originalWord: wordData.sourceText,
                                translatedWord: wordData.translatedText,
                                sourceLang: wordData.sourceLang,
                                targetLang: wordData.targetLang,
                                onTTSRequest: handleLearningWordTTSRequest,
                                onMouseEnter: () => {
                                    if (learningWidgetHideTimeoutId) clearTimeout(learningWidgetHideTimeoutId);
                                    learningWidgetHideTimeoutId = null;
                                },
                                onMouseLeave: () => {
                                    if (learningWidgetHideTimeoutId) clearTimeout(learningWidgetHideTimeoutId);
                                     learningWidgetHideTimeoutId = window.setTimeout(hideLearningWordWidget, LEARNING_WIDGET_HIDE_DELAY);
                                }
                            }), 
                            container
                        );
                        return unmountSolid || (() => {});
                    } catch (renderError) {
                        console.error('[Scarlett CS] Error rendering LearningWordWidget:', renderError);
                        container.textContent = "Error displaying word info.";
                        return () => {};
                    }
                },
                onRemove: (unmountSolid) => {
                    if (unmountSolid) {
                         try { unmountSolid(); } catch (e) { console.error('Error unmounting LW Widget:', e); }
                    }
                }
            };

            try {
                const ui = await createShadowRootUi(ctx, options);
                currentLearningWordWidgetUi = ui;
                ui.mount();
                console.log('[Scarlett CS] Mounted LearningWordWidget.');
            } catch (error) {
                console.error('[Scarlett CS] Error creating/mounting LearningWordWidget UI:', error);
                currentLearningWordWidgetUi = null;
                currentLearningWordWidgetData = null;
            }
        };
        // --- END NEW Widget Management ---

        const getHighlightTargetElement = (): HTMLElement => {
            const selectors = [
                'article',
                '.post-content',
                '.entry-content',
                '#main-content',
                '#content',
                'main',
            ];
            for (const selector of selectors) {
                const element = document.querySelector(selector) as HTMLElement | null;
                if (element && element.textContent && element.textContent.trim().length > 500) {
                    console.log(`[Scarlett CS Highlight] Using target element: ${selector}`);
                    return element;
                }
            }
            console.log('[Scarlett CS Highlight] No specific main content element found, falling back to document.body.');
            return document.body;
        };

        const highlightLearningWordsOnPage = (learningWords: LearningWordData[]) => {
            if (learningWords.length === 0) {
                console.log('[Scarlett CS] No learning words provided to replace/highlight.');
                return;
            }

            const singleLearningWordsMap = new Map<string, LearningWordData>();
            learningWords.forEach(wordData => {
                if (wordData.sourceText && !wordData.sourceText.includes(' ')) {
                    singleLearningWordsMap.set(wordData.sourceText.toLowerCase(), wordData);
                }
            });

            if (singleLearningWordsMap.size === 0) {
                console.log('[Scarlett CS] No single learning words to replace/highlight.');
                return;
            }
            console.log('[Scarlett CS] Starting to replace/highlight learning words on page (scoped)...');

            const targetElement = getHighlightTargetElement();
            
            const replacementCounts = new Map<string, number>();
            const MAX_REPLACEMENTS_PER_WORD = 1;

            const walker = document.createTreeWalker(targetElement, NodeFilter.SHOW_TEXT, {
                acceptNode: (node: Node) => {
                    const parent = node.parentElement;
                    if (parent) {
                        const tagName = parent.tagName.toUpperCase();
                        if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT' || parent.isContentEditable) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (parent.classList.contains('scarlett-learning-tooltip') || parent.classList.contains('scarlett-learning-highlight')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        let ancestor = parent;
                        while(ancestor && ancestor !== document.body && ancestor !== targetElement ){
                            if(ancestor.classList.contains('scarlett-learning-highlight')){
                                return NodeFilter.FILTER_REJECT;
                            }
                            ancestor = ancestor.parentElement as HTMLElement;
                        }
                    }
                    if (node.nodeValue && node.nodeValue.trim().length > 0) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            });

            const textNodesToModify: Text[] = [];
            let currentNode;
            while (currentNode = walker.nextNode()) {
                textNodesToModify.push(currentNode as Text);
            }

            for (const textNode of textNodesToModify) {
                const originalNodeText = textNode.nodeValue || '';
                if (!originalNodeText.trim()) continue;

                const parts = originalNodeText.split(/(\s+|[.,!?;:()"'\/<>[\]{}@#$%^&*~`+\-=|\\:]+)/g).filter(part => part.length > 0);
                const fragment = document.createDocumentFragment();
                let madeChangesToNode = false;

                for (const part of parts) {
                    const lowerCasePart = part.toLowerCase();
                    const learningWordInfo = singleLearningWordsMap.get(lowerCasePart);

                    if (learningWordInfo) {
                        const currentCount = replacementCounts.get(learningWordInfo.sourceText.toLowerCase()) || 0;

                        if (currentCount < MAX_REPLACEMENTS_PER_WORD) {
                            const span = document.createElement('span');
                            span.className = 'scarlett-learning-highlight';
                            span.textContent = learningWordInfo.translatedText; 
                            
                            span.dataset.originalWordDisplay = part;
                            span.dataset.translatedWord = learningWordInfo.translatedText;
                            span.dataset.sourceLang = learningWordInfo.sourceLang;
                            span.dataset.targetLang = learningWordInfo.targetLang;
                            span.dataset.originalWord = learningWordInfo.sourceText;
                            fragment.appendChild(span);
                            madeChangesToNode = true;
                            replacementCounts.set(learningWordInfo.sourceText.toLowerCase(), currentCount + 1);
                        } else {
                            fragment.appendChild(document.createTextNode(part));
                        }
                    } else {
                        fragment.appendChild(document.createTextNode(part));
                    }
                }

                if (madeChangesToNode && textNode.parentNode) {
                    textNode.parentNode.replaceChild(fragment, textNode);
                }
            }
            console.log('[Scarlett CS] Finished replacing/highlighting learning words.', replacementCounts);
        };

        const fetchAndHighlightLearningWords = async () => {
            console.log('[Scarlett CS] Requesting active learning words from background...');
            try {
                injectHighlightStyles(); 
                const response = await messageSender.sendMessage('REQUEST_ACTIVE_LEARNING_WORDS', {}) as RequestActiveLearningWordsResponse;
                if (response && response.success && response.words && response.words.length > 0) {
                    console.log(`[Scarlett CS] Received ${response.words.length} learning words. Starting highlighting...`);
                    highlightLearningWordsOnPage(response.words);
                } else if (response && !response.success) {
                    console.error('[Scarlett CS] Failed to fetch learning words:', response.error);
                } else {
                    console.log('[Scarlett CS] No active learning words to highlight or empty response.');
                }
            } catch (error) {
                console.error('[Scarlett CS] Error requesting/processing active learning words:', error);
            }
        };
        
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

        window.requestIdleCallback(fetchAndHighlightLearningWords, { timeout: 1000 });
        
        window.setTimeout(schedulePageProcessing, 500); 
        window.addEventListener('beforeunload', cancelPageProcessing);

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

        let currentWidgetUi: ShadowRootContentScriptUi<() => void | null> | null = null;
        let currentWidgetName: string | null = null;
        let globalClickListener: ((event: MouseEvent) => void) | null = null;
        let currentTranslationOriginalText: string | null = null;

        const hideWidget = async (options: {isPartOfUpdate?: boolean} = {}) => {
            console.log('[Scarlett CS hideWidget] Attempting to hide. currentWidgetUi present:', !!currentWidgetUi, 'Options:', options);
            if (!currentWidgetUi) return;
            console.log('[Scarlett CS hideWidget] Hiding widget:', currentWidgetName);

            const uiToRemove = currentWidgetUi;
            const widgetNameToClear = currentWidgetName;

            currentWidgetUi = null;
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
                uiToRemove.remove();
                console.log(`[Scarlett CS hideWidget] Widget UI removed (${widgetNameToClear}).`);
            } catch (error) {
                console.error(`[Scarlett CS hideWidget] Error removing widget UI (${widgetNameToClear}):`, error);
            }
        };

        const handleTTSRequest = async (text: string, lang: string, speed: number): Promise<{ audioDataUrl?: string; error?: string, alignment?: AlignmentData | null }> => {
            console.log(`[Scarlett CS TTS] Request to BG: Text='${text.substring(0,30)}...', Lang='${lang}', Speed=${speed}`);
            try {
                const response = await messageSender.sendMessage('REQUEST_TTS_FROM_WIDGET', { text, lang, speed }) as { success: boolean, audioDataUrl?: string, error?: string };
                console.log('[Scarlett CS TTS] Response from BG:', response);
                if (response && response.success && response.audioDataUrl) {
                    return { audioDataUrl: response.audioDataUrl, alignment: null };
                } else {
                    return { error: response?.error || 'Unknown TTS error from BG.', alignment: null };
                }
            } catch (error) {
                console.error('[Scarlett CS TTS] Error sending/processing TTS request:', error);
                return { error: error instanceof Error ? error.message : 'Failed TTS request.', alignment: null };
            }
        };

        messageListener.onMessage('displayTranslationWidget', async (message: { data: DisplayTranslationPayload }) => {
            const { originalText, translatedText, sourceLang, targetLang, pronunciation, isLoading } = message.data;
            console.log(`[Scarlett CS displayTranslationWidget] Received. isLoading: ${isLoading}, CurrentOrig: "${currentTranslationOriginalText ? currentTranslationOriginalText.substring(0,10): 'null'}", NewOrig: "${originalText ? originalText.substring(0,10): 'null'}"`);
            console.log(`[Scarlett CS displayTranslationWidget] currentWidgetUi present: ${!!currentWidgetUi}, isVisible(): ${isVisible()}`);

            if (currentTranslationOriginalText !== originalText || !currentWidgetUi || !isVisible()) {
                console.log('[Scarlett CS displayTranslationWidget] New interaction or widget not fully active/different text. Will hide and recreate/show.');
                await hideWidget(); 
                currentTranslationOriginalText = originalText; 

                setWidgetProps({
                    textToTranslate: originalText || '',
                    translatedText: isLoading ? '' : (translatedText || ''),
                    sourceLang: sourceLang,
                    targetLang: targetLang,
                    pronunciation: isLoading ? undefined : (pronunciation || undefined),
                    isLoading: isLoading,
                });
                setAlignmentData(null);
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
                        if (currentWidgetUi?.shadow) { 
                            try {
                                unmountSolid = render(() => {
                                    return TranslatorWidget({
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
                    const ui = await createShadowRootUi(ctx, options);
                    console.log('[Scarlett CS displayTranslationWidget] createShadowRootUi SUCCEEDED. UI object:', ui);
                    currentWidgetUi = ui;
                    
                    console.log('[Scarlett CS displayTranslationWidget] About to call ui.mount(). This will trigger onMount. Current currentWidgetUi:', currentWidgetUi);
                    ui.mount();
                    console.log(`[Scarlett CS displayTranslationWidget] Mounted ${widgetName}. currentWidgetUi after mount:`, currentWidgetUi);
                } catch (createUiError) {
                    console.error("[Scarlett CS displayTranslationWidget] FAILED to createShadowRootUi or mount:", createUiError);
                    currentWidgetUi = null; 
                    setIsVisible(false);
                    currentTranslationOriginalText = null;
                    return; 
                }

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
                console.log('[Scarlett CS displayTranslationWidget] Updating EXISTING widget with new props.');
                setWidgetProps({
                    textToTranslate: originalText || '', 
                    translatedText: translatedText || '',
                    sourceLang: sourceLang, targetLang: targetLang,
                    pronunciation: pronunciation || undefined,
                    isLoading: isLoading, 
                });
                console.log(`[Scarlett CS displayTranslationWidget] Props updated for existing widget. isVisible(): ${isVisible()}, widgetPropsisLoading: ${widgetProps().isLoading}`);
            }
        });

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

        document.body.addEventListener('mouseover', (event) => {
            const target = event.target as HTMLElement;
            if (target.classList.contains('scarlett-learning-highlight')) {
                if (learningWidgetHideTimeoutId) {
                    clearTimeout(learningWidgetHideTimeoutId);
                    learningWidgetHideTimeoutId = null;
                }
                
                const sourceTextFromDataset = target.dataset.originalWord || '';
                const wordData: LearningWordData = {
                    sourceText: sourceTextFromDataset,
                    translatedText: target.dataset.translatedWord || '',
                    sourceLang: target.dataset.sourceLang || '?',
                    targetLang: target.dataset.targetLang || '?'
                };

                if (wordData.sourceText && wordData.translatedText) {
                    showLearningWordWidget(target, wordData);
                }
            }
        });

        document.body.addEventListener('mouseout', (event) => {
            const target = event.target as HTMLElement;
            const relatedTarget = event.relatedTarget as Node | null;
            
            if (target.classList.contains('scarlett-learning-highlight')) {
                const widgetHost = currentLearningWordWidgetUi?.shadowHost;
                 if (!relatedTarget || (widgetHost && !widgetHost.contains(relatedTarget) && relatedTarget !== widgetHost)) {
                    if (learningWidgetHideTimeoutId) clearTimeout(learningWidgetHideTimeoutId);
                    learningWidgetHideTimeoutId = window.setTimeout(hideLearningWordWidget, LEARNING_WIDGET_HIDE_DELAY);
                 }
            }
        });

        console.log('[Scarlett CS] Main function setup complete. Listening for messages.');
    },
});