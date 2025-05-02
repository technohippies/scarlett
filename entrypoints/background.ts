import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { DisplayTranslationPayload, GenerateTTSPayload, UpdateAlignmentPayload } from '../src/shared/messaging-types';
import type { AlignmentData } from '../src/features/translator/TranslatorWidget';
import { getDirectTranslationPrompt } from '../src/services/llm/prompts/translation';
import { getMCQGenerationPrompt, type MCQExerciseData } from '../src/services/llm/prompts/exercises';
import { ollamaChat } from '../src/services/llm/providers/ollama/chat'; // Assuming Ollama for now
import type { LLMConfig, LLMChatResponse, ChatMessage } from '../src/services/llm/types'; // Use LLMChatResponse, add ChatMessage

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
    if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText && tab?.id) {
      const selectedText = info.selectionText;
      const tabId = tab.id;
      console.log(`[Scarlett BG] Context menu '${CONTEXT_MENU_ID}' clicked for text: "${selectedText.substring(0, 50)}..." on tab ${tabId}`);

      // --- Hardcoded LLM Config (REMOVE LATER and use storage) ---
      const mockLlmConfig: LLMConfig = {
        provider: 'ollama',
        model: 'gemma3:12b', // <<< Ensure this model is running in Ollama
        baseUrl: 'http://localhost:11434', // Default Ollama URL
        stream: false, // Ensure non-streaming response for simple await
      };
      const sourceLang = 'en'; // Assume English for now
      const targetLang = 'zh-CN'; // Assume Chinese for now
      // --- End Hardcoded Config ---

      let translatedText = '';

      try {
        // 1. Get Translation
        console.log('[Scarlett BG] Requesting translation from LLM...');
        const translationPrompt = getDirectTranslationPrompt(selectedText, sourceLang, targetLang);
        // Wrap prompt in ChatMessage array
        const translationMessages: ChatMessage[] = [{ role: 'user', content: translationPrompt }];
        const translationResponse = await ollamaChat(translationMessages, mockLlmConfig) as LLMChatResponse;

        translatedText = translationResponse?.choices?.[0]?.message?.content?.trim() || '';
        if (!translatedText) {
          throw new Error('LLM returned empty translation.');
        }
        console.log(`[Scarlett BG] Translation received: "${translatedText}"`);

        // 2. Display Translation Widget via Content Script
        const displayPayload: DisplayTranslationPayload = {
          originalText: selectedText,
          translatedText: translatedText,
          sourceLang: sourceLang,
          targetLang: targetLang,
          // Add mock pronunciation or leave undefined
        };
        console.log('[Scarlett BG] Sending displayTranslationWidget to content script...');
        await messaging.sendMessage('displayTranslationWidget', displayPayload, tabId);
        console.log('[Scarlett BG] displayTranslationWidget message sent.');

        // 3. Generate MCQ (async in background, don't block widget)
        // Run this part without blocking the main flow
        (async () => {
            try {
                console.log('[Scarlett BG] Requesting MCQ generation from LLM (background task)...');
                const mcqPrompt = getMCQGenerationPrompt(selectedText, translatedText, sourceLang, targetLang);
                // Wrap prompt in ChatMessage array
                const mcqMessages: ChatMessage[] = [{ role: 'user', content: mcqPrompt }];
                
                // Await the promise directly since stream is false
                const mcqResponse = await ollamaChat(mcqMessages, mockLlmConfig) as LLMChatResponse;
                const mcqContent = mcqResponse?.choices?.[0]?.message?.content?.trim();

                if (!mcqContent) {
                  console.error('[Scarlett BG] LLM returned empty content for MCQ.');
                  return;
                }

                console.log('[Scarlett BG] Raw MCQ Response:', mcqContent);
                try {
                    // Attempt to parse the JSON
                    const mcqData: MCQExerciseData = JSON.parse(mcqContent);
                    console.log('[Scarlett BG] Successfully parsed MCQ Data:', mcqData);
                    // ---> TODO: Save mcqData to DB using createFlashcard <---
                } catch (parseError) {
                    console.error('[Scarlett BG] Failed to parse MCQ JSON response:', parseError);
                    console.error('[Scarlett BG] Raw response was:', mcqContent);
                }
            } catch (mcqError: any) { // Add type annotation for error
                 console.error('[Scarlett BG] Error requesting MCQ generation:', mcqError);
            }
        })(); // Immediately invoke the async function
        
        console.log('[Scarlett BG] MCQ generation initiated in background.');

      } catch (error: any) { // Add type annotation for error
        console.error('[Scarlett BG] Error during context menu flow:', error);
        // Optionally send an error notification or message
        try {
           await browser.notifications.create({
              type: 'basic',
              // Use type assertion for icon path - ensure it's in public dir/web_accessible_resources
              iconUrl: browser.runtime.getURL('icon/128.png' as any), 
              title: 'Translation Failed',
              message: `Error: ${error instanceof Error ? error.message : String(error)}`
           });
        } catch (notifyError) {
           console.error('[Scarlett BG] Failed to send error notification:', notifyError);
        }
      }
    } else if (info.menuItemId === CONTEXT_MENU_ID) {
        console.warn('[Scarlett BG] Context menu clicked but selectionText or tab ID missing.');
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
