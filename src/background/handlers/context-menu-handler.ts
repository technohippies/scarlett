import { browser } from 'wxt/browser';
import { defineExtensionMessaging } from '@webext-core/messaging';
import { CONTEXT_MENU_ID } from '../setup/context-menu-setup'; // Import the ID
import { processTextAnalysisPipeline } from '../pipelines/analysis-pipeline';
import type { LLMConfig, LLMProviderId } from '../../services/llm/types';
import type { DisplayTranslationPayload } from '../../shared/messaging-types';
import { setLastContextMenuSelection } from './pageInteractionHandlers'; // Import the function
import { userConfigurationStorage } from '../../services/storage/storage'; // For LLM config

// Define messaging for sending results back to content script
// If other handlers need messaging, consider a shared messaging setup
interface ProtocolMap {
  displayTranslationWidget(data: DisplayTranslationPayload): Promise<void>;
}
const messaging = defineExtensionMessaging<ProtocolMap>();

/**
 * Handles clicks on the context menu item.
 */
async function handleContextMenuClick(info: browser.Menus.OnClickData, tab?: browser.Tabs.Tab): Promise<void> {
    if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText && tab?.id) {
      const selectedText = info.selectionText.trim();
      const sourceUrl = info.pageUrl || tab.url || 'unknown_url';
      const tabId = tab.id;

      if (!selectedText) {
          console.warn('[Context Menu Handler] Empty text selected after trimming.');
          return; 
      }

      console.log(`[Context Menu Handler] Processing text: "${selectedText.substring(0, 50)}..." from ${sourceUrl}`);

      // Store the selection before starting the potentially long pipeline
      setLastContextMenuSelection(selectedText);

      // --- Fetch LLM Config from storage --- (Still TODO: fully integrate, but prepare)
      let llmConfigToUse: LLMConfig;
      try {
        const userConfig = await userConfigurationStorage.getValue();
        const storedLlmConfig = userConfig?.llmConfig; // This is FunctionConfig | null

        if (storedLlmConfig && storedLlmConfig.providerId && storedLlmConfig.modelId) {
          // Map FunctionConfig to LLMConfig
          llmConfigToUse = {
            provider: storedLlmConfig.providerId as LLMProviderId,
            model: storedLlmConfig.modelId,
            baseUrl: storedLlmConfig.baseUrl || 'http://localhost:11434',
            apiKey: storedLlmConfig.apiKey || undefined,   // Ensure undefined if null/empty (apiKey is optional)
            stream: false, // Explicitly set stream as per pipeline expectation
          };
          console.log("[Context Menu Handler] Using LLM config from storage:", llmConfigToUse);
        } else {
          console.warn("[Context Menu Handler] LLM config not found or incomplete in storage. Using fallback mock config.");
          llmConfigToUse = {
            provider: 'ollama',
            model: 'gemma2:9b', 
            baseUrl: 'http://localhost:11434',
            stream: false, 
          };
        }
      } catch (error) {
        console.error("[Context Menu Handler] Error fetching/mapping LLM config. Using fallback mock config.", error);
        llmConfigToUse = { provider: 'ollama', model: 'gemma2:9b', baseUrl: 'http://localhost:11434', stream: false };
      }

      try {
        // Call the analysis pipeline without sourceLang and targetLang
        const analysisResult = await processTextAnalysisPipeline({
            selectedText,
            sourceUrl,
            llmConfig: llmConfigToUse // Use fetched or fallback config
        });
        console.log('[Context Menu Handler] Pipeline completed successfully. Result:', analysisResult);

        // Send data to Content Script to display the widget
        // Use detectedSourceLang and retrievedTargetLang from the result
        const displayPayload: DisplayTranslationPayload = {
          originalText: analysisResult.originalPhrase,
          translatedText: analysisResult.translatedPhrase,
          sourceLang: analysisResult.detectedSourceLang, // Use from result
          targetLang: analysisResult.retrievedTargetLang, // Use from result
        };
        console.log('[Context Menu Handler] Sending displayTranslationWidget to content script with payload:', displayPayload);
        try {
            // Ensure tabId is valid before sending message
            if (typeof tabId === 'number') {
                await messaging.sendMessage('displayTranslationWidget', displayPayload, tabId);
                console.log('[Context Menu Handler] displayTranslationWidget message sent successfully.');
            } else {
                console.error('[Context Menu Handler] Invalid tabId, cannot send message.', tabId);
            }
        } catch (msgError) {
             console.error('[Context Menu Handler] Error sending displayTranslationWidget message:', msgError);
        }

      } catch (error: any) {
        console.error('[Context Menu Handler] Error during analysis pipeline execution:', error);
        // Notify user of failure 
        try {
           // Use browser directly as this function isn't an entrypoint
           await browser.notifications.create({
              type: 'basic',
              iconUrl: browser.runtime.getURL('icon/128.png' as any),
              title: 'Processing Failed',
              message: `Error: ${error instanceof Error ? error.message : String(error)}`
           });
        } catch (notifyError) {
           console.error('[Context Menu Handler] Failed to send error notification:', notifyError);
        }
      }
    } else if (info.menuItemId === CONTEXT_MENU_ID) {
        console.warn('[Context Menu Handler] Context menu clicked but selectionText or tab ID missing.');
    }
}

/**
 * Registers the listener for context menu clicks.
 */
export function registerContextMenuHandlers(): void {
    // Check if the listener is already registered before adding
    if (browser.contextMenus && browser.contextMenus.onClicked && !browser.contextMenus.onClicked.hasListener(handleContextMenuClick)) {
        browser.contextMenus.onClicked.addListener(handleContextMenuClick);
        console.log('[Context Menu Handler] onClicked listener registered.');
    } else if (browser.contextMenus && browser.contextMenus.onClicked && browser.contextMenus.onClicked.hasListener(handleContextMenuClick)){
        console.log('[Context Menu Handler] onClicked listener already registered.');
    } else {
        console.warn('[Context Menu Handler] browser.contextMenus.onClicked not available. Cannot register listener.');
    }
} 