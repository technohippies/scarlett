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
// @ts-ignore
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

      // --- Fetch User Configuration (including native language) ---
      let userNativeLanguage = 'en'; // Default to English
      let llmConfigToUse: LLMConfig;

      try {
        const userConfig = await userConfigurationStorage.getValue();
        if (userConfig?.nativeLanguage) {
          userNativeLanguage = userConfig.nativeLanguage;
        }
        console.log(`[Context Menu Handler] User native language: ${userNativeLanguage}`);

        const storedLlmConfig = userConfig?.llmConfig; 

        if (storedLlmConfig && storedLlmConfig.providerId && storedLlmConfig.modelId) {
          llmConfigToUse = {
            provider: storedLlmConfig.providerId as LLMProviderId,
            model: storedLlmConfig.modelId,
            baseUrl: storedLlmConfig.baseUrl || 'http://localhost:11434',
            apiKey: storedLlmConfig.apiKey || undefined,
            stream: false,
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
        console.error("[Context Menu Handler] Error fetching user/LLM config. Using fallbacks.", error);
        userNativeLanguage = 'en'; // Fallback native language
        llmConfigToUse = { provider: 'ollama', model: 'gemma2:9b', baseUrl: 'http://localhost:11434', stream: false };
      }

      // --- Send Initial Message to Display Widget with Loading State ---
      const initialPayload: DisplayTranslationPayload = {
        originalText: selectedText,
        isLoading: true,
        sourceLang: 'auto', // Will be detected by the pipeline
        targetLang: userNativeLanguage, // Use fetched native language
      };

      if (typeof tabId === 'number') {
        try {
          await messaging.sendMessage('displayTranslationWidget', initialPayload, tabId);
          console.log('[Context Menu Handler] Sent initial displayTranslationWidget with loading state.');
        } catch (msgError) {
          console.error('[Context Menu Handler] Error sending initial displayTranslationWidget message:', msgError);
          // Optionally, could decide not to proceed if the initial display fails, or log and continue.
        }
      }

      // Store the selection before starting the potentially long pipeline
      setLastContextMenuSelection(selectedText);

      try {
        // Call the analysis pipeline, now passing the user's native language
        // The pipeline should be updated to accept and use this for translation.
        const analysisResult = await processTextAnalysisPipeline({
            selectedText,
            sourceUrl,
            llmConfig: llmConfigToUse, // Use fetched or fallback config
            translateToLang: userNativeLanguage // Pass native language to pipeline
        });
        console.log('[Context Menu Handler] Pipeline completed successfully. Result:', analysisResult);

        // --- Send Final Message with Translation Results ---
        // Ensure targetLang is the user's native language.
        // analysisResult.translatedPhrase should be in this language.
        // analysisResult.retrievedTargetLang from pipeline should also match userNativeLanguage.
        const finalPayload: DisplayTranslationPayload = {
          originalText: selectedText,
          translatedText: analysisResult.translatedPhrase,
          sourceLang: analysisResult.detectedSourceLang, 
          targetLang: userNativeLanguage, // Explicitly use native language
          isLoading: false, 
          pronunciation: analysisResult.pronunciation, // Assuming pipeline provides this
        };
        console.log('[Context Menu Handler] Sending final displayTranslationWidget to content script with payload:', finalPayload);
        
        if (typeof tabId === 'number') {
            await messaging.sendMessage('displayTranslationWidget', finalPayload, tabId);
            console.log('[Context Menu Handler] Final displayTranslationWidget message sent successfully.');
        } else {
            console.error('[Context Menu Handler] Invalid tabId, cannot send final message.', tabId);
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