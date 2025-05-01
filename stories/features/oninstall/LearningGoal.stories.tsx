import { LearningGoal } from '../../../src/features/oninstall/LearningGoal';
// Import mock messages
import messagesEn from '../../../public/_locales/en/messages.json';

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
    targetLanguageLabel: '🇯🇵 Japanese', 
    questionPrefix: messagesEn.onboardingLearningGoalQuestionPrefix.message,
    questionSuffix: messagesEn.onboardingLearningGoalQuestionSuffix.message,
    fallbackLabel: messagesEn.onboardingTargetLanguageFallback.message,
    continueLabel: messagesEn.onboardingContinue.message,
    // Pass the messages object
    messages: messagesEn, 
  },
};

// Basic render story following the pattern of Language.stories.tsx
export const Default = {}; 