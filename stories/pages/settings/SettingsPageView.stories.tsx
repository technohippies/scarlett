import type { Component } from 'solid-js';
import SettingsPageView from '../../../src/pages/settings/SettingsPageView'; // Trying another relative path

// Basic story for SettingsPageView
export default {
  title: 'Pages/Settings/SettingsPageView',
  component: SettingsPageView,
  parameters: {
    layout: 'fullscreen', // Optional: Display story in full screen
  },
};

// Default story definition
export const Default: { render: Component } = {
  render: () => <SettingsPageView />,
}; 