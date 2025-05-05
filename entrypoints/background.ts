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
// Import storage to check onboarding status
import { userConfigurationStorage } from '../src/services/storage/storage';

console.log('[Scarlett BG Entrypoint] Script loaded. Defining background...');

export default defineBackground({
  // The main function MUST be synchronous according to WXT warning
  main() {
    console.log('[Scarlett BG Entrypoint] Background main() function running (synchronous).');

    // --- Synchronous Setup ---
    // Register listeners immediately when the worker starts.
    try {
        // 1. Register message listeners
        console.log('[Scarlett BG Entrypoint] Registering message handlers...');
        registerMessageHandlers();
        console.log('[Scarlett BG Entrypoint] Message handlers registered.');

        // 2. Register Context Menu Click Handler
        console.log('[Scarlett BG Entrypoint] Registering context menu handlers...');
        registerContextMenuHandlers(); // Registers the onClicked listener
        console.log('[Scarlett BG Entrypoint] Context menu handlers registered.');

        // --- Defer Async Setup to onInstalled ---
        // The main setup logic is now primarily event-driven via onInstalled

    } catch (error) {
      console.error('[Scarlett BG Entrypoint] CRITICAL ERROR during synchronous background setup:', error);
    }

    // --- Event Listeners ---
    // Use browser namespace for cross-browser compatibility
    browser.runtime.onInstalled.addListener(async (details) => {
        console.log('[Scarlett BG Entrypoint] onInstalled event triggered:', details);

        // --- Perform Async Setup Tasks on Install/Update ---
        try {
            if (details.reason === 'install' || details.reason === 'update') {
                // Setup context menus (idempotent or recreate as needed)
                // Doing this here ensures they are set up after install/update.
                console.log(`[Scarlett BG Entrypoint] Setting up context menus (reason: ${details.reason})...`);
                await setupContextMenu();
                console.log('[Scarlett BG Entrypoint] Context menu setup complete.');
            }

            if (details.reason === 'install') {
                console.log('[Scarlett BG Entrypoint] Reason is "install". Performing first-time setup...');

                // Initialize DB Schema
                console.log('[Scarlett BG Entrypoint] Ensuring database schema is applied...');
                await ensureDbInitialized();
                console.log('[Scarlett BG Entrypoint] DB schema check/application complete.');

                // Seed Initial Tags
                console.log('[Scarlett BG Entrypoint] Attempting to seed initial tags...');
                await seedInitialTags();
                console.log('[Scarlett BG Entrypoint] Initial tag seeding attempt complete.');

                // Check and Open Onboarding page
                console.log('[Scarlett BG Entrypoint] Checking onboarding status...');
                const currentConfig = await userConfigurationStorage.getValue();
                console.log('[Scarlett BG Entrypoint] Current config:', currentConfig);
                console.log('[Scarlett BG Entrypoint] Onboarding complete:', currentConfig?.onboardingComplete);

                if (currentConfig?.onboardingComplete) {
                    console.log('[Scarlett BG Entrypoint] Onboarding already marked as complete. Skipping tab creation.');
                } else {
                    console.log('[Scarlett BG Entrypoint] Onboarding not complete. Opening onboarding tab...');
                    const onboardingUrl = browser.runtime.getURL('/oninstall.html');
                    await browser.tabs.create({ url: onboardingUrl });
                    console.log(`[Scarlett BG Entrypoint] Onboarding tab created at ${onboardingUrl}`);
                }
            } else if (details.reason === 'update') {
                // Optional: Add logic specifically for updates if needed
                console.log('[Scarlett BG Entrypoint] Extension updated from version:', details.previousVersion);
                // Maybe run migrations or re-check context menus here as well
            }

        } catch(error) {
             console.error(`[Scarlett BG Entrypoint] Error during onInstalled tasks (reason: ${details.reason}):`, error);
        } finally {
            console.log(`[Scarlett BG Entrypoint] onInstalled specific tasks complete (reason: ${details.reason}).`);
        }
    });

    // --- Final Ready Log (from synchronous main) ---
    console.log('[Scarlett BG Entrypoint] Synchronous background setup complete. Ready.');
  },

  // Include other background script options if needed, e.g.:
  // persistent: false, // for Manifest V3
  // type: 'module',   // Usually inferred by WXT
});
