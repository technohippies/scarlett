import { LearningGoal } from '../../../src/features/oninstall/LearningGoal';

export default {
  title: 'Features/OnInstall/LearningGoal',
  component: LearningGoal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    // Use actual English messages from public/_locales/en/messages.json
    onComplete: () => console.log('Story: LearningGoal onComplete triggered'),
    // Include the emoji in the mock label, like the real component expects
    targetLanguageLabel: 'Japanese 🇯🇵 ', 
    questionPrefix: 'Why are you learning',
    questionSuffix: '?',
    fallbackLabel: 'your selected language',
    continueLabel: 'Continue',
  },
};

// Basic render story following the pattern of Language.stories.tsx
export const Default = {}; 