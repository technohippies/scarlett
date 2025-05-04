/**
 * This is the main background script for the extension.
 * It orchestrates database initialization, context menu setup, and message handling.
 */
import { defineBackground } from '#imports';
import { ensureDbInitialized } from '../src/services/db/init';
import { seedInitialTags } from '../src/services/db/tags';
import { setupContextMenu } from '../src/background/setup/context-menu-setup';
import { registerMessageHandlers } from '../src/background/handlers/message-handlers';
// import { loadDictionaries } from '../src/background/setup/dictionary-setup'; // Removed

// Import handler registration functions
import { registerContextMenuHandlers } from '../src/background/handlers/context-menu-handler';

console.log('[Scarlett BG Entrypoint] Script loaded. Defining background...');

export default defineBackground({
  // The main function now lives inside the defineBackground config
  async main() {
    console.log('[Scarlett BG Entrypoint] Background main() function running.');

    try {
        // --- Initialize Database (Schema Only) --- 
        console.log('[Scarlett BG Entrypoint] Ensuring database schema is applied (awaiting ensureDbInitialized)...');
        await ensureDbInitialized();
        console.log('[Scarlett BG Entrypoint] DB schema check/application complete.'); 
        
        // --- Seed Initial Tags (AFTER schema is ready) --- 
        console.log('[Scarlett BG Entrypoint] Attempting to seed initial tags...');
        await seedInitialTags(); // Call seeding AFTER DB init
        console.log('[Scarlett BG Entrypoint] Initial tag seeding attempt complete.');

        // 2. Load Dictionaries into memory - REMOVED
        // await loadDictionaries();
        // console.log('[Scarlett BG Entrypoint] Dictionaries loaded.');

        // 3. Setup Context Menus (might only need onInstalled, but safe to run always)
        // Let's assume setupContextMenu handles idempotency or is fine to run multiple times
        console.log('[Scarlett BG Entrypoint] Setting up context menus...');
        await setupContextMenu();
        console.log('[Scarlett BG Entrypoint] Context menu setup complete.');

        // 4. Register message listeners
        console.log('[Scarlett BG Entrypoint] Registering message handlers...');
        registerMessageHandlers();
        console.log('[Scarlett BG Entrypoint] Message handlers registered.');

        // Register Context Menu Click Handler
        console.log('[Scarlett BG Entrypoint] Registering context menu handlers...');
        registerContextMenuHandlers();
        console.log('[Scarlett BG Entrypoint] Context menu handlers registered.');

        // --- Event-specific logic (like onInstalled) --- 
        // onInstalled listener might still be useful for one-time setup tasks 
        // if needed, but core setup runs above.
        chrome.runtime.onInstalled.addListener(async (details) => {
            console.log('[Scarlett BG Entrypoint] onInstalled event triggered:', details.reason);
            // Example: Maybe trigger a specific migration only on update
            // if (details.reason === 'update') { /* ... */ }
            // We could potentially move DB init/seeding here for 'install' reason
            // but doing it in main() ensures it runs on every worker start.
            console.log('[Scarlett BG Entrypoint] onInstalled specific tasks complete (if any).');
        });

        // --- Final Ready Log ---
        console.log('[Scarlett BG Entrypoint] Background setup complete. Ready.');

    } catch (error) {
        console.error('[Scarlett BG Entrypoint] CRITICAL ERROR during background setup:', error);
        // Consider notifying the user or logging to a more persistent store if possible
    }
  },

  // Include other background script options if needed, e.g.:
  // persistent: false, // for Manifest V3
  // type: 'module',   // Usually inferred by WXT
});
