/**
 * This is the main background script for the extension.
 * It orchestrates database initialization, context menu setup, and message handling.
 */
import { defineBackground } from '#imports';
import { analytics } from '../src/utils/analytics';
import { ensureDbInitialized } from '../src/services/db/init';
import { registerMessageHandlers } from '../src/background/handlers/message-handlers';
import type { BackgroundProtocolMap } from '../src/shared/messaging-types';
import { defineExtensionMessaging, Logger } from '@webext-core/messaging';
import { checkAndResetStreakIfNeeded } from '../src/services/db/streaks';

// Import handler registration functions
import { registerContextMenuHandlers } from '../src/background/handlers/context-menu-handler';
import { setupContextMenu } from '../src/background/setup/context-menu-setup';
// Import storage to check onboarding status
import { userConfigurationStorage } from '../src/services/storage/storage';
// Import DomainDetail for typing
import type { DomainDetail } from '../src/services/storage/types'; 
// Use WXT's browser namespace
import { browser } from 'wxt/browser';

import { REDIRECT_SERVICES } from '../src/shared/constants'; // Only need REDIRECT_SERVICES here now
import { seedInitialBlockedDomains } from '../src/services/db/domains';

console.log('[Scarlett BG Entrypoint] Script loaded. Defining background...');

// --- Redirect Logic ---

// Type alias for the details object from onBeforeNavigate listener
type OnBeforeNavigateDetails = Parameters<Parameters<typeof browser.webNavigation.onBeforeNavigate.addListener>[0]>[0];

// Define hostname checks (can be expanded)
const serviceHostChecks: { [key: string]: (host: string) => boolean } = {
    'GitHub': (host) => host.endsWith('github.com'),
    'ChatGPT': (host) => host.endsWith('chatgpt.com') || host.endsWith('chat.openai.com'), // Example, needs adjustment
    'X (Twitter)': (host) => host.endsWith('twitter.com') || host.endsWith('x.com'),
    'Reddit': (host) => host.endsWith('reddit.com') || host.endsWith('redd.it'),
    'Twitch': (host) => host.endsWith('twitch.tv'),
    'YouTube': (host) => host.endsWith('youtube.com') || host.endsWith('youtu.be'),
    'Medium': (host) => host.endsWith('medium.com'),
    'Bluesky': (host) => host.endsWith('bsky.app'),
    'Pixiv': (host) => host.endsWith('pixiv.net'),
    'Soundcloud': (host) => host.endsWith('soundcloud.com'),
    'Genius': (host) => host.endsWith('genius.com'),
    // Add more precise checks as needed
};

// Use inferred type from browser.webNavigation
async function handleNavigation(details: OnBeforeNavigateDetails): Promise<void> {
  // --- ADDED: Log entry and basic details --- 
  // console.log(`[Redirect & Focus] handleNavigation called for URL: ${details.url}, FrameId: ${details.frameId}`);

  // Ignore non-top-level frames and non-http(s) URLs
  if (details.frameId !== 0 || !details.url || !details.url.startsWith('http')) {
    // --- ADDED: Log exit reason --- 
    console.log(`[Redirect & Focus] Exiting: Not a top-level HTTP(S) frame.`);
    return;
  }

  try {
    let config = await userConfigurationStorage.getValue();
    // --- ADDED: Log loaded config BEFORE the check --- 
    // console.log('[Redirect & Focus] Loaded raw config from storage:', JSON.stringify(config, null, 2)); 

    // Perform a quick migration/normalization for focus mode keys directly after loading
    if (config) {
        if (config.hasOwnProperty('isFocusModeActive') && typeof (config as any).isFocusModeActive !== 'undefined') {
            config.enableFocusMode = (config as any).isFocusModeActive;
        }
        if (config.hasOwnProperty('userBlockedDomains') && typeof (config as any).userBlockedDomains !== 'undefined') {
            config.focusModeBlockedDomains = (config as any).userBlockedDomains;
        }
        // Log config after potential in-line migration
        // console.log('[Redirect & Focus] Config after potential in-line migration:', JSON.stringify(config, null, 2));
    }

    // --- FOCUS MODE BLOCKING LOGIC ---
    if (config?.enableFocusMode && config?.focusModeBlockedDomains && config.focusModeBlockedDomains.length > 0) {
      const currentUrlObj = new URL(details.url);
      const originalHost = currentUrlObj.hostname.toLowerCase();
      const extensionOrigin = new URL(browser.runtime.getURL('/' as any)).origin; // Cast to any if path is not recognized by type
      const blockPageUrl = browser.runtime.getURL('blockpage.html' as any); // Changed to blockpage.html

      // Don't block extension's own pages or the block page itself
      if (details.url.startsWith(extensionOrigin) || details.url === blockPageUrl) {
        console.log('[Focus Mode] Navigation to own extension page or block page, allowing.');
        // Allow normal processing for other extension pages, then proceed to redirect logic if any
      } else {
        const isDomainBlocked = config.focusModeBlockedDomains.some((d: DomainDetail) => d.name.toLowerCase() === originalHost);
        if (isDomainBlocked) {
          console.log(`[Focus Mode] Domain ${originalHost} is blocked. Redirecting to block page.`);
          try {
            await browser.tabs.update(details.tabId, { url: blockPageUrl });
            console.log(`[Focus Mode] Successfully redirected tab ${details.tabId} to ${blockPageUrl}`);
          } catch (updateError) {
            console.error(`[Focus Mode] Error updating tab ${details.tabId} to block page:`, updateError);
          }
          return; // Stop further processing, site is blocked.
        }
      }
    }
    // --- END FOCUS MODE BLOCKING LOGIC ---

    // Check for settings existence AND onboarding completion
    if (!config?.redirectSettings || !config.onboardingComplete) {
      // --- ADDED: Log specific exit reason --- 
      const reason = !config?.redirectSettings ? 'Redirect settings missing' : 'Onboarding incomplete';
      console.log(`[Redirect] Exiting: ${reason}. (Onboarding complete: ${config?.onboardingComplete})`);
      return;
    }

    const currentUrl = new URL(details.url);
    const originalHost = currentUrl.hostname;
    // --- ADDED: Log host being checked --- 
    console.log(`[Redirect] Checking host: ${originalHost}`);

    // Iterate through defined redirectable services
    for (const serviceName of REDIRECT_SERVICES) {
      const lowerCaseServiceName = serviceName.toLowerCase(); // Get lowercase version
      // Read settings using lowercase key
      const serviceSetting = config.redirectSettings[lowerCaseServiceName];
      // Assume serviceHostChecks uses the original casing from REDIRECT_SERVICES
      const hostCheckFn = serviceHostChecks[serviceName];
      // --- ADDED: Log service check --- 
      // console.log(`[Redirect] Checking service: "${serviceName}", Enabled: ${serviceSetting?.isEnabled}, Host matches: ${hostCheckFn ? hostCheckFn(originalHost) : 'N/A'}`);

      // Check if this service is enabled (using lowercase lookup), has a check function, and the host matches
      if (serviceSetting?.isEnabled && hostCheckFn && hostCheckFn(originalHost)) {
        // Use only the chosenInstance from settings. Default is set in storage.ts.
        let instanceUrlString = serviceSetting.chosenInstance;

        // If chosenInstance is somehow empty/nullish despite defaults, skip.
        if (!instanceUrlString) {
          console.warn(`[Redirect] Service "${serviceName}" is enabled but has no chosen instance URL in settings.`);
          continue; // Skip if no instance is available
        }

        // --- ADDED: Ensure scheme exists ---
        if (!instanceUrlString.startsWith('http://') && !instanceUrlString.startsWith('https://')) {
            console.warn(`[Redirect] Instance URL "${instanceUrlString}" for "${serviceName}" is missing a scheme. Prepending https://`);
            instanceUrlString = 'https://' + instanceUrlString;
        }
        // --- End Scheme Check ---

        // --- FIXED: Use URL constructor for robust joining ---
        let newRedirectUrl: string;
        try {
            const baseUrl = new URL(instanceUrlString); // Base URL of the instance (NOW should have scheme)
            const targetUrl = new URL(details.url);   // Original URL

            // Construct the new URL, preserving path, search, and hash
            baseUrl.pathname = targetUrl.pathname;
            baseUrl.search = targetUrl.search;
            baseUrl.hash = targetUrl.hash;

            newRedirectUrl = baseUrl.toString();

        } catch (urlError) {
             console.error(`[Redirect] Error constructing new URL with instance "${instanceUrlString}" and path from "${details.url}":`, urlError);
             continue; // Skip to next service if construction fails
        }
        // --- End Fix ---

        // --- Log the actual instanceUrlString used ---
        console.log(`[Redirect] Match found for "${serviceName}". Enabled: ${serviceSetting.isEnabled}. Instance URL: ${instanceUrlString}`);
        console.log(`[Redirect] Original URL: ${details.url}`);
        console.log(`[Redirect]   -> New URL: ${newRedirectUrl}`); // Log the final constructed URL

        // Prevent redirect loops (validation should work now)
        try {
            const newUrlHost = new URL(newRedirectUrl).hostname;
             // Don't redirect if the target is the same as the origin OR if the target instance host is the *same* as the original host
            if (details.url === newRedirectUrl || newUrlHost === originalHost) {
                console.warn(`[Redirect] Loop detected or target is same as source. Aborting redirect for ${details.url}`);
                return;
            }
        } catch (e) {
             // This catch block should ideally not be hit now, but keep for safety
             console.error(`[Redirect] Invalid new URL generated even after using URL constructor: ${newRedirectUrl}`, e);
             return;
        }

        // Perform the redirect
        try {
          await browser.tabs.update(details.tabId, { url: newRedirectUrl });
          console.log(`[Redirect] Successfully redirected tab ${details.tabId} to ${newRedirectUrl}`);
          
          return; // Stop processing further rules once a redirect occurs
        } catch (updateError) {
          console.error(`[Redirect] Error updating tab ${details.tabId}:`, updateError);
          return; // Stop on error
        }
      }
    }
     // --- ADDED: Log if no match found AFTER loop --- 
     console.log(`[Redirect] No matching enabled rule found for ${details.url}`);

  } catch (error) {
    console.error('[Redirect] Error in handleNavigation:', error);
  }
}

export default defineBackground({
  // The main function MUST be synchronous according to WXT warning
  main() {
    console.log('[Scarlett BG Entrypoint] Background main() function running (synchronous).');

    // Track background script startup (fire and forget)
    (async () => {
      try {
        console.log('[Analytics] Background script started');
      } catch (error) {
        console.warn('[Analytics] Background script startup logged');
      }
    })();

    // --- Explicitly ensure storage is touched early ---
    userConfigurationStorage.getValue().then(() => {
        console.log('[Scarlett BG Entrypoint] userConfigurationStorage potentially initialized.');
    }).catch(err => {
        console.error('[Scarlett BG Entrypoint] Error during early storage access:', err);
    });

    // --- Synchronous Setup ---
    // Register listeners immediately when the worker starts.
    try {
        // Define a custom logger
        const customLogger: Logger = {
          debug: (...args: any[]) => console.debug('[Messaging DEBUG]', ...args),
          log: (...args: any[]) => console.log('[Messaging LOG]', ...args),
          warn: (...args: any[]) => console.warn('[Messaging WARN]', ...args),
          error: (...args: any[]) => console.error('[Messaging ERROR]', ...args),
        };

        // Initialize messaging with the custom logger
        const messaging = defineExtensionMessaging<BackgroundProtocolMap>({ logger: customLogger });

        // 1. Register message listeners
        console.log('[Scarlett BG Entrypoint] Registering message handlers...');
        registerMessageHandlers(messaging);
        console.log('[Scarlett BG Entrypoint] Message handlers registered.');

        // 2. Register Context Menu Click Handler
        console.log('[Scarlett BG Entrypoint] Registering context menu handlers...');
        registerContextMenuHandlers(); // Registers the onClicked listener
        console.log('[Scarlett BG Entrypoint] Context menu handlers registered.');

        // 3. Setup Context Menu Item (called on every SW startup)
        //    This ensures the menu is present even if the SW restarts without a full install/update.
        //    setupContextMenu internally calls removeAll first.
        console.log('[Scarlett BG Entrypoint] Attempting to set up context menu in main()...');
        setupContextMenu().then(() => {
          console.log('[Scarlett BG Entrypoint] Context menu setup attempt in main() completed.');
        }).catch(err => {
          console.error('[Scarlett BG Entrypoint] Error setting up context menu in main():', err);
        });

    } catch (error) {
      console.error('[Scarlett BG Entrypoint] CRITICAL ERROR during synchronous background setup:', error);
    }

    // --- Event Listeners ---
    // Use browser namespace for cross-browser compatibility
    browser.runtime.onInstalled.addListener(async (details) => {
        console.log('[Scarlett BG Entrypoint] onInstalled event triggered:', details);

        // Track extension installation/update
        try {
          console.log('[Analytics] Tracking extension install/update...');
          console.log('[Analytics] Analytics object:', analytics);
          
          const result = await analytics.track('extension-installed', {
            reason: details.reason,
            version: browser.runtime.getManifest().version
          });
          
          console.log('[Analytics] Extension install/update tracked successfully, result:', result);
        } catch (error) {
          console.warn('[Analytics] Failed to track extension install/update:', error);
        }

        // --- Perform Async Setup Tasks on Install/Update ---
        try {
            // 1. Ensure DB is initialized (idempotent)
            console.log('[Scarlett BG Entrypoint] Ensuring database is initialized...');
            await ensureDbInitialized();
            console.log('[Scarlett BG Entrypoint] Database initialization check complete.');

            // 1.1 Check and reset streak (after DB init)
            console.log('[Scarlett BG Entrypoint] Checking and resetting study streak if needed...');
            await checkAndResetStreakIfNeeded();
            console.log('[Scarlett BG Entrypoint] Study streak check complete.');

            // --- Context Menu Setup (on install/update) ---
            console.log('[Scarlett BG Entrypoint] Setting up context menu in onInstalled...');
            await setupContextMenu(); 
            console.log('[Scarlett BG Entrypoint] Context menu setup attempt in onInstalled complete.');

            if (details.reason === 'install') {
                console.log('[Scarlett BG Entrypoint] Reason is "install". Performing first-time setup...');

                // Seed Initial Blocked Domains
                console.log('[Scarlett BG Entrypoint] Attempting to seed initial blocked domains...');
                await seedInitialBlockedDomains();
                console.log('[Scarlett BG Entrypoint] Initial blocked domain seeding attempt complete.');

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

    // --- Add Navigation Listener ---
    if (!browser.webNavigation.onBeforeNavigate.hasListener(handleNavigation)) {
        browser.webNavigation.onBeforeNavigate.addListener(handleNavigation);
        console.log('[Redirect] Added webNavigation listener.');
    } else {
         console.log('[Redirect] webNavigation listener already exists.');
    }

    // --- Final Ready Log (from synchronous main) ---
    console.log('[Scarlett BG Entrypoint] Synchronous background setup complete. Ready.');
  },

  // Include other background script options if needed, e.g.:
  // persistent: false, // for Manifest V3
  // type: 'module',   // Usually inferred by WXT
});
