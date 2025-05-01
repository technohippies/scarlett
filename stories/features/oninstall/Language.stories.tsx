import { Language } from '../../../src/features/oninstall/Language';

export default {
  title: 'Features/OnInstall/Language',
  component: Language,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {},
};

// Basic render story, similar structure to Card.stories.tsx
export const Default = {
  // Reverted: Removed render function and wrapper div.
  // The global background setting in preview.ts will handle the theme.
}; 