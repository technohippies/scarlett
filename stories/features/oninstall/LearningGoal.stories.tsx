import { LearningGoal } from '../../../src/features/oninstall/LearningGoal';

export default {
  title: 'Features/OnInstall/LearningGoal',
  component: LearningGoal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    // Provide a mock function for the required onComplete prop
    onComplete: () => console.log('Story: LearningGoal onComplete triggered'),
  },
};

// Basic render story following the pattern of Language.stories.tsx
export const Default = {}; 