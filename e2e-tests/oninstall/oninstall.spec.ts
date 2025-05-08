import { test, expect } from '../fixtures'; // Adjusted path to fixtures.ts

test.describe('Oninstall Flow', () => {
  test('should load the oninstall page and display initial content', async ({ page, extensionId }) => {
    // The 'page' and 'extensionId' are now automatically provided by our custom fixture.
    // The context fixture has already loaded the extension and waited for the service worker.

    console.log(`Navigating to oninstall page with Extension ID: ${extensionId}`);
    await page.goto(`chrome-extension://${extensionId}/oninstall.html`);

    // Check the title of the page
    await expect(page).toHaveTitle(/Scarlett Setup/); // Adjust regex if your title is different

    // Check for a known element on the first step (Language selection)
    const speakLabel = page.getByText(RegExp('I speak', 'i'));
    await expect(speakLabel).toBeVisible();
    
    const wantToLearnLabel = page.getByText(RegExp('and I want to learn...','i'));
    await expect(wantToLearnLabel).toBeVisible();

    const continueButton = page.getByRole('button', { name: /Continue/i });
    await expect(continueButton).toBeVisible();
    // Depending on your app's initial state for the oninstall page:
    // await expect(continueButton).toBeDisabled(); 
  });

  // TODO: Add more tests for each step of the oninstall flow:
  // 1. Selecting native and target languages, clicking Continue.
  // 2. Selecting a learning goal, clicking Continue.
  // 3. Selecting decks, clicking Continue.
  // 4. Configuring LLM provider and model, testing connection, clicking Continue.
  // 5. Configuring Embedding provider and model, testing connection, clicking Continue.
  // 6. Configuring TTS provider, testing, clicking Continue (or Skip).
  // 7. Configuring Redirects, clicking Finish Setup.
  // 8. Verifying that after finishing, the user is redirected (e.g., to newtab.html) and onboardingComplete is true in storage.
}); 