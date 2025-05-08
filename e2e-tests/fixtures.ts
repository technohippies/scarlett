import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pathToExtension = path.resolve(__dirname, '../.output/chrome-mv3'); // Adjusted path to be relative to this fixtures.ts file

// Define a new test type that includes our custom fixtures
export type ExtensionTestFixtures = {
  context: BrowserContext;
  extensionId: string;
  page: Page; // We'll re-use page from base, but ensure context is our extension context
};

export const test = base.extend<ExtensionTestFixtures>({
  // The 'context' fixture will be a browser context with the extension loaded.
  context: async ({ browser }, use) => {
    console.log(`Loading extension from: ${pathToExtension}`);
    const context = await chromium.launchPersistentContext(
      '', // userDataDir, use empty for a temporary profile
      {
        headless: true, // Or false if you want to see the browser during setup
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
          // Consider adding if you see service worker activation issues:
          // '--enable-features=NetworkService', 
          // '--disable-features=IsolateOrigins,site-per-process' // May help with speed/SW activation in some cases
        ],
      }
    );
    await use(context);
    console.log("Closing extension context");
    await context.close();
  },

  // The 'extensionId' fixture will derive the ID from the loaded context.
  extensionId: async ({ context }, use) => {
    // It can take a moment for the service worker to be registered, especially on first load.
    // Wait for the service worker to be available.
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      console.log("Waiting for service worker...");
      serviceWorker = await context.waitForEvent('serviceworker', {
        // Add a timeout specific to waiting for the service worker
        // This should be less than the global test timeout.
        timeout: 15000, // 15 seconds, adjust as needed
      });
    }
    
    if (!serviceWorker) {
      throw new Error("Service worker not found after waiting. Check extension loading and background script.");
    }
    console.log(`Service worker found: ${serviceWorker.url()}`);

    const extensionId = new URL(serviceWorker.url()).hostname;
    console.log(`Derived Extension ID: ${extensionId}`);
    await use(extensionId);
  },

  // Override 'page' to ensure it comes from our extension-loaded context
  page: async ({ context }, use) => {
    // If you need a fresh page for every test from this context:
    // const page = await context.newPage();
    // await use(page);
    // await page.close();
    // Or, if one page reused across tests in a file (becoming less common practice):
    await use(context.pages()[0] || await context.newPage());
  },
});

export { expect } from '@playwright/test'; 