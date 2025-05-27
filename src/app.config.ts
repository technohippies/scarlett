console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
console.log("--- MINIMAL SRC/APP.CONFIG.TS IS RUNNING ---");
console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

// For a more aggressive test if console logs are missed, uncomment the alert:
// try { alert("--- MINIMAL SRC/APP.CONFIG.TS IS RUNNING ---"); } catch(e) { console.error("Alert failed:", e); }

import { defineAppConfig } from 'wxt/utils/define-app-config';
import { storage } from '@wxt-dev/storage';
import { umami } from '@wxt-dev/analytics/providers/umami';

export default defineAppConfig({
  analytics: {
    debug: true,
    enabled: storage.defineItem('local:analytics-enabled', { fallback: true }),
    providers: [
      umami({
        apiUrl: 'https://cloud.umami.is/api',
        websiteId: '170292c8-4ca4-4a11-8934-d935c81bc6b9',
        domain: 'scarlett-extension.local',
      }),
    ],
  },
}); 