import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';

// Import setup functions
import { setupContextMenu } from '../src/background/setup/context-menu-setup';
import { setupDatabase } from '../src/background/setup/db-setup';

// Import handler registration functions
import { registerContextMenuHandlers } from '../src/background/handlers/context-menu-handler';
import { registerMessageHandlers } from '../src/background/handlers/message-handlers';

console.log('[Scarlett BG Entrypoint] Script loaded.');

// --- Background Script Logic ---
export default defineBackground(() => {
  console.log('[Scarlett BG Entrypoint] Background defining function running.');

  // --- Setup on Install/Update ---
  browser.runtime.onInstalled.addListener(async (details) => {
    console.log('[Scarlett BG Entrypoint] onInstalled event triggered:', details.reason);
    try {
        await setupDatabase();
        await setupContextMenu();
        console.log('[Scarlett BG Entrypoint] Initial setup complete.');
    } catch (error) {
        console.error('[Scarlett BG Entrypoint] Error during initial setup:', error);
    }
  });

  // --- Register Event Handlers ---
  // Call functions that attach listeners
  registerContextMenuHandlers();
  registerMessageHandlers();

  console.log('[Scarlett BG Entrypoint] Background setup complete. Handlers registered.');
});
