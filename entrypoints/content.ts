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
import type {
    DisplayTranslationPayload, // Expect payload from background for displaying
    GenerateTTSPayload,      // Payload sent TO background for TTS
    UpdateAlignmentPayload // Payload from background with alignment
} from '../src/shared/messaging-types.ts';

// Define messaging for the content script context
const messaging = defineExtensionMessaging();

// --- Constants ---
const GLOBAL_STYLE_ID = 'scarlett-global-styles'; // ID for checking if styles are injected

// --- Content Script Definition ---
export default defineContentScript({
    matches: ['<all_urls>'], // Run on all URLs
    runAt: 'document_idle',
    cssInjectionMode: 'ui', // Let WXT handle CSS injection

    async main(ctx) {
        console.log('[Scarlett CS] Content script loaded.');

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
                await uiToRemove.remove();
                console.log(`[Scarlett CS] Widget UI removed (${widgetNameToClear}).`);
            } catch (error) {
                console.error(`[Scarlett CS] Error removing widget UI (${widgetNameToClear}):`, error);
            }
        };

        // --- TTS Request Handler (Called from Widget) ---
        const handleTTSRequest = (text: string, lang: string, speed: number) => {
            console.log(`[Scarlett CS] TTS Request: Text='${text}', Lang='${lang}', Speed=${speed}`);
            const payload: GenerateTTSPayload = { text, lang, speed };
            messaging.sendMessage('generateTTS', payload)
                .then(response => {
                    console.log('[Scarlett CS] TTS generation requested. Response:', response);
                    // Background script should send 'updateWidgetAlignment' later
                })
                .catch(error => {
                    console.error('[Scarlett CS] Error sending TTS request:', error);
                });
        };

        // --- Message Listener: Display Translation Widget ---
        messaging.onMessage('displayTranslationWidget', async (message: { data: DisplayTranslationPayload }) => {
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
                sourceLang,
                targetLang,
                pronunciation,
                contextText,
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
                        
                        // --- Inject Global Styles into Main Page <head> ---
                        if (!document.getElementById(GLOBAL_STYLE_ID)) {
                            try {
                                const styleLink = document.createElement('link');
                                styleLink.rel = 'stylesheet';
                                styleLink.id = GLOBAL_STYLE_ID;
                                // Get the URL to the bundled CSS file
                                // @ts-ignore - Path is defined in web_accessible_resources
                                styleLink.href = browser.runtime.getURL('assets/uno-bundle.css'); 
                                document.head.prepend(styleLink); // Inject into main page head
                                console.log('[Scarlett CS] Injected global uno-bundle.css into document head.');
                            } catch (e) {
                                console.error("[Scarlett CS] Failed to inject global uno-bundle.css:", e);
                            }
                        } else {
                             console.log('[Scarlett CS] Global styles already injected.');
                        }
                        // -----------------------------------------------------
                        
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
        messaging.onMessage('updateWidgetAlignment', (message: { data: UpdateAlignmentPayload }) => {
            console.log('[Scarlett CS] Received updateWidgetAlignment');
            if (isVisible() && currentWidgetUi) {
                setAlignmentData(message.data.alignment);
                console.log('[Scarlett CS] Alignment data signal updated.');
            } else {
                console.warn('[Scarlett CS] Received alignment data but widget is not visible or mounted.');
            }
        });

        // --- Message Listener: Hide request from background ---
        messaging.onMessage('hideTranslationWidget', async () => {
             console.log('[Scarlett CS] Received hideTranslationWidget request.');
             await hideWidget();
        });

        console.log('[Scarlett CS] Content script setup complete. Listening for messages.');

    }, // End of main function
}); // End of defineContentScript
