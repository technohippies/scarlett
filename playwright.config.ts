import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the extension, assuming your WXT output directory
const pathToExtension = path.resolve(__dirname, '.output/chrome-mv3');

export default defineConfig({
  // Directory where your E2E tests are located
  testDir: './e2e-tests',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    // Headless mode for Playwright. Set to false to watch tests in a browser.
    headless: true, // You might want to set this to false during development
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Launch options specific to testing a Chrome extension
        launchOptions: {
          args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
          ],
        },
      },
    },

    // Example for Firefox - you'll need to adjust path and launch args for Firefox extensions
    // {
    //   name: 'firefox-extension',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     // launchOptions: {
    //     //   args: [/* Firefox specific args to load extension */],
    //     // },
    //   },
    // },
  ],

  /* Optional: Folder for test results such as screenshots, videos, traces, etc. */
  // outputDir: 'test-results/',

  /* Optional: Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  // },
}); 