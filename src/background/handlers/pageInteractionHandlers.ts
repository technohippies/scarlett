import { browser, type Browser } from 'wxt/browser';
// Assuming response types are defined and correct in shared types
import type { GetPageInfoResponse, GetSelectedTextResponse } from '../../shared/messaging-types';

console.log('[Page Interaction Handlers] Module loaded.');

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
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    console.log(`[handleGetPageInfo] Query result count: ${tabs.length}`);

    if (tabs.length > 0 && tabs[0]) {
      const currentTab = tabs[0];
      if (currentTab.url && currentTab.title) {
        console.log("[handleGetPageInfo] Returning page info:", { title: currentTab.title, url: currentTab.url });
        return { success: true, title: currentTab.title, url: currentTab.url };
      } else {
        console.warn("[handleGetPageInfo] Active tab found, but URL or Title missing?", currentTab);
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
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0 || !tabs[0]?.id) {
      console.warn('[handleGetSelectedText] No active tab found.');
      return { success: false, error: 'No active tab found to get selection from.', text: null };
    }
    const activeTabId = tabs[0].id;

    console.log(`[handleGetSelectedText] >>> Sending 'requestSelectedText' to tab ${activeTabId}`);
    // Define expected response type for clarity
    type ContentScriptResponse = { success: boolean; text?: string | null; error?: string };
    
    const responseFromContentScript = await browser.tabs.sendMessage(
      activeTabId,
      { type: 'requestSelectedText' } // Simple message object
    ) as ContentScriptResponse; // Assert the expected response type
    
    console.log(`[handleGetSelectedText] <<< Received response from content script:`, responseFromContentScript);

    if (responseFromContentScript?.success) {
      return { success: true, text: responseFromContentScript.text || null };
    } else {
      console.warn('[handleGetSelectedText] Content script failed to get selection.', responseFromContentScript?.error);
      return { success: false, error: responseFromContentScript?.error || 'Content script failed to get selection.', text: null };
    }

  } catch (error: any) {
    console.error("[handleGetSelectedText] Error sending message to content script or receiving response:", error);
    let errorMessage = 'Error communicating with content script.';
    // Improve error message for common connection issues
    if (error.message?.includes('Could not establish connection') || error.message?.includes('Receiving end does not exist')) {
      errorMessage = 'Could not connect to the page\'s content script. It might need a reload or may not support this feature.';
    }
    return { success: false, error: errorMessage, text: null };
  }
} 