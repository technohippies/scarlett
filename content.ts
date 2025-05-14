let currentWidgetName: string | null = null;
let globalClickListener: ((event: MouseEvent) => void) | null = null;
let currentTranslationOriginalText: string | null = null;

const hideWidget = async (options: {isPartOfUpdate?: boolean} = {}) => {
// ... existing code ...
};

const handleTTSRequest = async (text: string, lang: string, speed: number): Promise<{ audioDataUrl?: string; error?: string, alignment?: AlignmentData | null, browserTtsInitiated?: boolean }> => {
    console.log(`[Scarlett CS TTS] Request received: Text='${text.substring(0,30)}...', Lang='${lang}', Speed=${speed}`);
    try {
        const userConfig = await userConfigurationStorage.getValue();
        const selectedVendor = userConfig?.selectedTtsVendor || 'browser';
        console.log(`[Scarlett CS TTS] Selected TTS Vendor: ${selectedVendor}`);

        if (selectedVendor === 'browser') {
            console.log('[Scarlett CS TTS] Using browser.tts.speak() directly.');
            return new Promise((resolve, reject) => {
                browser.tts.speak(text, {
                    lang: lang,
                    rate: speed, // `rate` is the parameter for speech speed in browser.tts
                    onEvent: (event) => {
                        if (event.type === 'end' || event.type === 'interrupted' || event.type === 'cancelled' || event.type === 'error') {
                            // Resolve when speech ends or is interrupted/cancelled/errors
                            // The widget will need to manage its own isPlayingAudio state based on this.
                            if (event.type === 'error') {
                                console.error('[Scarlett CS TTS browser.tts.speak] Error event:', event.errorMessage);
                                reject({ error: event.errorMessage || 'Browser TTS failed', browserTtsInitiated: true });
                            } else {
                                console.log('[Scarlett CS TTS browser.tts.speak] Event:', event.type);
                                resolve({ success: true, browserTtsInitiated: true, alignment: null });
                            }
                        } else if (event.type === 'start') {
                            console.log('[Scarlett CS TTS browser.tts.speak] Event: start');
                            // Widget could be notified here if more granular control is needed
                        }
                    }
                // If browser.tts.speak itself throws an error (e.g., text too long), catch it.
                // Note: The actual .speak() call doesn't return a promise, errors are typically via onEvent.
                // This is a simplified direct call. For more robust error handling if speak() itself could fail synchronously:
                // try { browser.tts.speak(...); } catch (e) { reject ({error: e.message}); } 
                // However, the common pattern is errors via the 'error' event type.
                });
                // The browser.tts.speak function itself is void, the result comes via onEvent.
                // To satisfy the immediate promise return for the function signature:
                // We'll rely on the new Promise above to handle resolution/rejection.
            });

        } else {
            // For other vendors, use the existing background script messaging
            console.log(`[Scarlett CS TTS] Relaying to background for vendor: ${selectedVendor}`);
            const response = await messageSender.sendMessage('REQUEST_TTS_FROM_WIDGET', { text, lang, speed }) as { success: boolean, audioDataUrl?: string, error?: string, alignment?: AlignmentData | null };
            console.log('[Scarlett CS TTS] Response from BG:', response);
            if (response && response.success && response.audioDataUrl) {
                // Assuming background might send alignment data for supported vendors
                return { audioDataUrl: response.audioDataUrl, alignment: response.alignment || null };
            } else {
                return { error: response?.error || 'Unknown TTS error from BG.', alignment: null };
            }
        }
    } catch (error) {
        console.error('[Scarlett CS TTS] Error in handleTTSRequest:', error);
        return { error: error instanceof Error ? error.message : 'Failed TTS request.', alignment: null };
    }
};

messageListener.onMessage('displayTranslationWidget', async (message: { data: DisplayTranslationPayload }) => {
// ... existing code ...
}); 