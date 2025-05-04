import { registerMessageHandlers } from './handlers/message-handlers';
import { setupContextMenu } from './setup/context-menu-setup';
// import { loadDictionaries } from './setup/dictionary-setup'; // Removed
import { ensureDbInitialized } from '../services/db/init';

export default defineBackground({
  // type: 'module', // Uncomment if using top-level await
  main() {
    console.log('[Scarlett BG Entrypoint] Background defining function running.');

    // Using Promise.allSettled to ensure all setup steps are attempted
    // even if one fails (though dependencies might cause issues).
    // Order: DB -> Dictionary -> Context Menu -> Handlers
    Promise.allSettled([
        ensureDbInitialized().then(() => console.log('[Scarlett BG Entrypoint] Database initialization checked/completed.')),
        // loadDictionaries().then(() => console.log('[Scarlett BG Entrypoint] Dictionaries loaded.')), // Removed
        setupContextMenu().then(() => console.log('[Scarlett BG Entrypoint] Context menu setup checked/completed.')),
        Promise.resolve().then(() => { // Wrap sync functions for consistency if needed
             registerMessageHandlers();
             console.log('[Scarlett BG Entrypoint] Message handlers registered.');
         }),
         // Register context menu click handler separately if it depends on others
         Promise.resolve().then(() => {
             registerContextMenuHandler();
             console.log('[Scarlett BG Entrypoint] Context menu handlers registered.');
         }),
    ]).then(results => {
         console.log('[Scarlett BG Entrypoint] Background setup promises settled.');
         results.forEach((result, index) => {
             if (result.status === 'rejected') {
                 console.error(`[Scarlett BG Entrypoint] Setup step ${index} failed:`, result.reason);
             }
         });
         console.log('[Scarlett BG Entrypoint] Background setup complete. Ready.');
     });

    // IMPORTANT: The main function MUST return synchronously.
    // Any async setup needs to happen within promises or async IIFEs.
    // Do NOT return a Promise from main().
  },
});

// Helper function (assuming registerContextMenuHandler exists)
function registerContextMenuHandler() {
    // Implementation from context-menu-handler.ts might need to be refactored or called here
    // For now, assuming it's implicitly handled or called elsewhere.
    // If context-menu-handler.ts exports an init function, call it here.
    // Example: import { initContextMenuHandlers } from './handlers/context-menu-handler'; initContextMenuHandlers(); 
    // Or ensure the handler registers itself upon import.
} 