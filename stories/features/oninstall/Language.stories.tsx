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
  // No specific args or render function needed if component handles its own state/defaults
}; 