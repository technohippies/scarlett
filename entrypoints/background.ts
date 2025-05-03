import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';
import { ensureDbInitialized } from '../src/services/db/init';
import { setupContextMenu } from '../src/background/setup/context-menu-setup';
import { registerMessageHandlers } from '../src/background/handlers/message-handlers';
import { loadDictionaries } from '../src/background/setup/dictionary-setup';

// Import setup functions
import { setupDatabase } from '../src/background/setup/db-setup';

// Import handler registration functions
import { registerContextMenuHandlers } from '../src/background/handlers/context-menu-handler';

console.log('[Scarlett BG Entrypoint] Script loaded.');

// --- Background Script Logic ---
export default defineBackground(async () => {
  console.log('[Scarlett BG Entrypoint] Background defining function running.');

  // --- Core Initializations ---
  // Run these every time the background script starts

  // 1. Initialize Database (if not already)
  await ensureDbInitialized();
  console.log('[Scarlett BG Entrypoint] Database initialization checked/completed.');

  // 2. Load Dictionaries into memory
  await loadDictionaries();
  console.log('[Scarlett BG Entrypoint] Dictionaries loaded.');

  // 3. Setup Context Menus (might only need onInstalled, but safe to run always)
  // Let's assume setupContextMenu handles idempotency or is fine to run multiple times
  await setupContextMenu();
  console.log('[Scarlett BG Entrypoint] Context menu setup checked/completed.');

  // 4. Register message listeners
  registerMessageHandlers();
  console.log('[Scarlett BG Entrypoint] Message handlers registered.');

  // --- Event-specific logic (like onInstalled) --- 
  // onInstalled listener might still be useful for one-time setup tasks 
  // if needed, but core setup runs above.
  chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Scarlett BG Entrypoint] onInstalled event triggered:', details.reason);
    // Example: Maybe trigger a specific migration only on update
    // if (details.reason === 'update') { /* ... */ }
    console.log('[Scarlett BG Entrypoint] onInstalled specific tasks complete (if any).');
  });

  console.log('[Scarlett BG Entrypoint] Background setup complete. Ready.');
});
