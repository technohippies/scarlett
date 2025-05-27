import { createAnalytics } from '@wxt-dev/analytics';
import { storage } from '@wxt-dev/storage';
import { umami } from '@wxt-dev/analytics/providers/umami';

console.log('[Analytics] Creating manual analytics instance...');

// Create analytics instance manually to avoid config loading issues
export const analytics = createAnalytics({
  debug: true,
  enabled: storage.defineItem('local:analytics-enabled', { fallback: true }),
  providers: [
    umami({
      apiUrl: 'https://cloud.umami.is/api',
      websiteId: '170292c8-4ca4-4a11-8934-d935c81bc6b9',
      domain: 'scarlett-extension.local',
    }),
  ],
});

console.log('[Analytics] Manual analytics instance created:', analytics); 