import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { DisplayTranslationPayload, GenerateTTSPayload, UpdateAlignmentPayload } from '../src/shared/messaging-types';
import type { AlignmentData } from '../src/features/translator/TranslatorWidget';

console.log('[Scarlett BG] Background script loaded.');

// --- Initialize Messaging ---
// Define message types for type safety
interface ProtocolMap {
  generateTTS(data: GenerateTTSPayload): Promise<{ success: boolean, error?: string }>;
  displayTranslationWidget(data: DisplayTranslationPayload): Promise<void>;
  updateWidgetAlignment(data: UpdateAlignmentPayload): Promise<void>;
  hideTranslationWidget(): Promise<void>;
  // Add other background-handled messages here
}

// Context is detected automatically, remove the option
const messaging = defineExtensionMessaging<ProtocolMap>();

// --- Constants ---
const CONTEXT_MENU_ID = 'show-scarlett-translator';

// --- Background Script Logic ---
export default defineBackground(() => {
  // --- Setup on Install/Update ---
  browser.runtime.onInstalled.addListener(details => {
    console.log('[Scarlett BG] Extension installed or updated:', details.reason);

    // Create Context Menu Item
    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Show Translator Widget (Test)",
      contexts: ["page", "selection"], // Show on page right-click and text selection
    }, () => {
      if (browser.runtime.lastError) {
        console.error('[Scarlett BG] Error creating context menu:', browser.runtime.lastError);
      } else {
        console.log('[Scarlett BG] Context menu created successfully.');
      }
    });

    // You might want to add logic here for setting default settings on first install,
    // or handling migrations on update.
  });

  // --- Context Menu Click Listener ---
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
      console.log(`[Scarlett BG] Context menu '${CONTEXT_MENU_ID}' clicked.`);

      if (tab && tab.id) {
        // Prepare mock data for the widget
        const mockPayload: DisplayTranslationPayload = {
          originalText: info.selectionText || "Word", // Use selected text or default
          translatedText: "你好 世界", // Mock translation
          sourceLang: "en",
          targetLang: "zh-CN",
          pronunciation: "nǐ hǎo shì jiè", // Mock pronunciation
          contextText: info.selectionText ? `Context around "${info.selectionText}"` : "Page context", // Mock context
        };

        console.log('[Scarlett BG] Sending mock displayTranslationWidget message to tab:', tab.id, mockPayload);

        try {
          // Now matches ProtocolMap definition
          const response = await messaging.sendMessage('displayTranslationWidget', mockPayload, tab.id);
          console.log('[Scarlett BG] Response from content script (displayTranslationWidget):', response);
        } catch (error) {
          console.error('[Scarlett BG] Error sending displayTranslationWidget message:', error);
          if (browser.runtime.lastError) {
            console.error('[Scarlett BG] browser.runtime.lastError:', browser.runtime.lastError);
          }
          // Potentially alert the user or log more details
          // It might fail if the content script hasn't loaded yet on that page/tab
        }
      } else {
        console.warn('[Scarlett BG] Context menu clicked but no valid tab found.');
      }
    }
  });

  // --- Message Listener for TTS Requests from Content Script ---
  messaging.onMessage('generateTTS', async (message) => {
    console.log('[Scarlett BG] Received generateTTS request:', message.data);
    const { text, lang, speed } = message.data;

    // --- Placeholder for Actual TTS Logic --- 
    // Replace this with your actual call to Kokoro, ElevenLabs, etc.
    console.log(`[Scarlett BG] Simulating TTS generation for: "${text}" (${lang}, ${speed}x)`);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay

    // --- Mock Alignment Data ---
    // Generate mock alignment based on the text length for demonstration
    const mockAlignment: AlignmentData = {
      characters: text.split(''),
      character_start_times_seconds: text.split('').map((_, i) => i * 0.15 / speed),
      character_end_times_seconds: text.split('').map((_, i) => (i + 1) * 0.15 / speed),
    };
    console.log('[Scarlett BG] Generated mock alignment data.');
    // --- End Placeholder --- 

    try {
        console.log('[Scarlett BG] Sending updateWidgetAlignment message back.');
        // Now matches ProtocolMap definition
        await messaging.sendMessage('updateWidgetAlignment', { alignment: mockAlignment }, message.sender.tabId);
        console.log('[Scarlett BG] updateWidgetAlignment message sent.');
        return { success: true };
    } catch (error) {
        console.error('[Scarlett BG] Error sending updateWidgetAlignment message:', error);
        return { success: false, error: String(error) };
    }
  });

  // Add listeners for other messages (e.g., actual translation lookup)

  console.log('[Scarlett BG] Background script setup complete.');
});
