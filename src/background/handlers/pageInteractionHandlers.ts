import { browser, type Browser } from 'wxt/browser';
import { defineExtensionMessaging } from '@webext-core/messaging';
// Assuming response types are defined and correct in shared types
import type { GetPageInfoResponse, GetSelectedTextResponse } from '../../shared/messaging-types';

console.log('[Page Interaction Handlers] Module loaded.');

// --- Temporary storage for last selection from context menu ---
interface LastSelection {
    text: string | null;
    timestamp: number; // When it was set
}
let lastContextMenuSelection: LastSelection = { text: null, timestamp: 0 };
const SELECTION_EXPIRY_MS = 5000; // How long to keep the selection (e.g., 5 seconds)

/**
 * Updates the last selected text captured by the context menu.
 */
export function setLastContextMenuSelection(text: string | null): void {
    if (text && text.trim()) {
        console.log(`[Page Interaction Handlers] Storing last context menu selection (length: ${text.length})`);
        lastContextMenuSelection = { text: text.trim(), timestamp: Date.now() };
    } else {
        lastContextMenuSelection = { text: null, timestamp: 0 }; // Clear if no text
    }
}
// --- End Temporary Storage ---

// Define messaging scoped to this module if needed, or use a shared one
const messaging = defineExtensionMessaging();

/**
 * Handles getting the title and URL of the active tab.
 */
export async function handleGetPageInfo(
  _payload: unknown, // Payload not used
  _sender: Browser.runtime.MessageSender
): Promise<GetPageInfoResponse> {
  console.log('[handleGetPageInfo] Request received.');
  try {
    console.log('[handleGetPageInfo] Querying for active tab...');
    const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    console.log(`[handleGetPageInfo] Query result count: ${tabs.length}`);

    if (tabs.length > 0 && tabs[0]) {
      const tab = tabs[0];
      if (tab.url && tab.title) {
        console.log("[handleGetPageInfo] Returning page info:", { title: tab.title, url: tab.url });
        return {
          success: true,
          title: tab.title,
          url: tab.url
        };
      } else {
        console.warn("[handleGetPageInfo] Active tab found, but URL or Title missing?", tab);
        return { success: false, error: 'Could not retrieve active tab details (URL or Title missing).' };
      }
    } else {
      console.warn("[handleGetPageInfo] tabs.query returned empty array. No active tab found?");
      return { success: false, error: 'Could not find active tab in current window.' };
    }
  } catch (error: any) {
    console.error("[handleGetPageInfo] Error getting page info:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error getting page info' };
  }
}

/**
 * Handles getting the selected text from the active tab's content script.
 */
export async function handleGetSelectedText(
  _payload: unknown, // Payload not used
  _sender: Browser.runtime.MessageSender
): Promise<GetSelectedTextResponse> {
  console.log('[handleGetSelectedText] Handler invoked.');

  // 1. Check temporarily stored selection first
  const now = Date.now();
  if (lastContextMenuSelection.text && (now - lastContextMenuSelection.timestamp < SELECTION_EXPIRY_MS)) {
    console.log('[handleGetSelectedText] Using recently stored context menu selection.');
    const recentText = lastContextMenuSelection.text;
    // Optional: Clear it after retrieving once? Or let it expire?
    // lastContextMenuSelection = { text: null, timestamp: 0 }; 
    return { success: true, text: recentText };
  }

  // 2. If no recent stored selection, ask the content script
  console.log('[handleGetSelectedText] No recent context menu selection found, querying content script...');
  try {
    const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs.length > 0 && tabs[0]?.id) {
      const tabId = tabs[0].id;
      console.log(`[handleGetSelectedText] >>> Sending 'requestSelectedText' to tab ${tabId}`);
      // Define expected response structure for type safety
      type ContentScriptResponse = { success: boolean; text?: string | null };
    
      const response = await messaging.sendMessage('requestSelectedText', {}, tabId) as ContentScriptResponse;
      console.log('[handleGetSelectedText] <<< Received response from content script:', response);

      if (response && response.success) {
        return { success: true, text: response.text }; // Pass along text or null/undefined
      } else {
        console.warn('[handleGetSelectedText] Content script failed to get selection.', response?.text); // Changed error to text
        // Return success:false but maybe include the CS error message if available?
        return { success: false, error: 'Content script failed to get selection.' };
      }
    } else {
      console.warn('[handleGetSelectedText] No active tab found to get selection from.');
      return { success: false, error: 'No active tab found to get selection from.' };
    }
  } catch (error: any) {
    console.error('[handleGetSelectedText] Error messaging content script:', error);
    return { success: false, error: error.message || 'Error getting selected text.' };
  }
} 