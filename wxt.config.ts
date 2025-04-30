import { defineConfig } from 'wxt';
import { resolve } from 'node:path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-solid', '@wxt-dev/unocss'],
  alias: {
    '~': resolve(__dirname, 'src'),
  },
  // Add experimental setting if needed later for Storybook/HMR
  // experimental: {
  //   includeFastRefresh: true,
  // }
});
