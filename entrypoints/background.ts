export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  browser.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed:', details.reason);

    if (details.reason === 'install') {
      console.log('This is a first install! Opening onboarding page.');
      // Open the onboarding page in a new tab
      await browser.tabs.create({
        url: browser.runtime.getURL('oninstall.html' as any)
      });
      // Optionally set initial storage
      // await browser.storage.local.set({ onboardingComplete: false });
    } else if (details.reason === 'update') {
      console.log('Extension updated!');
      // Handle updates if needed
    }
  });
});
