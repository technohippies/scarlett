/** @type { import('@storybook/solidjs-vite').StorybookConfig } */
import UnoCSS from 'unocss/vite';
import { mergeConfig } from 'vite';
import path from 'path';

const config = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: 'storybook-solidjs-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      plugins: [UnoCSS()],
      resolve: {
        alias: {
          '~': path.resolve(__dirname, '../src'),
        },
      },
    });
  },
};
export default config; 