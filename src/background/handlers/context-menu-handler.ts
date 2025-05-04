import { browser, type Browser } from 'wxt/browser';
import type { OnClickData } from '@webext-core/context-menus';
import { analysisPipelineV2 } from './analysis-pipeline';
import { defineExtensionMessaging } from '@webext-core/messaging';
import { CONTEXT_MENU_ID } from '../setup/context-menu-setup'; // Import the ID
import { processTextAnalysisPipeline } from '../pipelines/analysis-pipeline';
import type { LLMConfig } from '../../services/llm/types';
import type { DisplayTranslationPayload } from '../../shared/messaging-types'; 
import { setLastContextMenuSelection } from './pageInteractionHandlers'; // Import the function

// Define messaging for sending results back to content script
// If other handlers need messaging, consider a shared messaging setup
interface ProtocolMap {
  displayTranslationWidget(data: DisplayTranslationPayload): Promise<void>;
}
const messaging = defineExtensionMessaging<ProtocolMap>();

/**
 * Handles clicks on the context menu item.
 */
async function handleContextMenuClick(info: OnClickData, tab?: browser.tabs.Tab): Promise<void> {
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

      // --- Hardcoded Config (TODO: Move to storage/settings) ---
      const mockLlmConfig: LLMConfig = {
        provider: 'ollama',
        model: 'gemma3:12b', 
        baseUrl: 'http://localhost:11434',
        stream: false,
      };
      const sourceLang = 'en'; 
      const targetLang = 'zh-CN';
      // --- End Config ---

      try {
        // Call the analysis pipeline
        const analysisResult = await processTextAnalysisPipeline({
            selectedText,
            sourceLang,
            targetLang,
            sourceUrl,
            llmConfig: mockLlmConfig
        });
        console.log('[Context Menu Handler] Pipeline completed successfully.');

        // Send data to Content Script to display the widget
        const displayPayload: DisplayTranslationPayload = {
          originalText: analysisResult.originalPhrase,
          translatedText: analysisResult.translatedPhrase,
          sourceLang: sourceLang,
          targetLang: targetLang,
        };
        console.log('[Context Menu Handler] Sending displayTranslationWidget to content script...');
        try {
            await messaging.sendMessage('displayTranslationWidget', displayPayload, tabId);
            console.log('[Context Menu Handler] displayTranslationWidget message sent successfully.');
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
    if (!browser.contextMenus?.onClicked.hasListener(handleContextMenuClick)) {
        browser.contextMenus.onClicked.addListener(handleContextMenuClick);
        console.log('[Context Menu Handler] onClicked listener registered.');
    } else {
        console.log('[Context Menu Handler] onClicked listener already registered.');
    }
} 