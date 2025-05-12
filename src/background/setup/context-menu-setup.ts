import { browser } from 'wxt/browser';

// Define the ID constant centrally if used elsewhere, otherwise keep local
export const CONTEXT_MENU_ID = 'process-selected-text';

/**
 * Creates the context menu item for processing selected text.
 * Should be called during extension installation or startup.
 */
export async function setupContextMenu(): Promise<void> {
    // Use await for modern browsers, handle potential promise rejection
    try {
      // Remove existing menu first to avoid duplicates during development reloads
      await browser.contextMenus.removeAll(); // Add this for safety
      console.log('[Context Menu Setup] Removed existing context menus (if any).');

      await browser.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: "Translate with Scarlett", 
        contexts: ["selection"], 
      });
      console.log('[Context Menu Setup] Context menu created successfully.');
    } catch (menuError) {
       console.error('[Context Menu Setup] Error creating context menu:', menuError);
       // Consider how to handle this - maybe retry?
    }
} 