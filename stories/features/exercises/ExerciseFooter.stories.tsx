import { ExerciseFooter } from '../../../src/features/exercises/ExerciseFooter';
import { Rating } from 'ts-fsrs'; // For Rating enum
import { action } from '@storybook/addon-actions';

export default {
  title: 'Features/Exercises/ExerciseFooter',
  component: ExerciseFooter,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen', // To see the fixed positioning correctly
  },
  argTypes: {
    mode: {
      control: 'select',
      options: ['check', 'feedback', 'flashcardShowAnswer', 'flashcardRate'],
    },
    isCorrect: { control: 'boolean' },
    correctAnswerText: { control: 'text' },
    onContinue: { action: 'onContinue' },
    title: { control: 'text' },
    continueLabel: { control: 'text' },
    isCheckDisabled: { control: 'boolean' },
    onCheck: { action: 'onCheck' },
    checkLabel: { control: 'text' },
    onShowAnswer: { action: 'onShowAnswer' },
    showAnswerLabel: { control: 'text' },
    onRate: { action: 'onRate' },
    ratingLabels: { control: 'object' },
  },
};

// Wrapper to simulate content above the footer, similar to a Template function
const StoryWrapper = (args: any) => (
  <div class="h-screen bg-background text-foreground p-4">
    <div class="mb-80"> {/* Pushes content down, making space for footer */} 
      <p>Some content above the footer to demonstrate fixed positioning.</p>
      <p>Scroll down if necessary to see the footer.</p>
    </div>
    <ExerciseFooter {...args} />
  </div>
);

export const CheckMode = {
  args: {
    mode: 'check',
    isCheckDisabled: false,
    checkLabel: 'Check',
    onCheck: action('onCheck'),
  },
  render: StoryWrapper,
};

export const CheckModeDisabled = {
  args: {
    mode: 'check',
    isCheckDisabled: true,
    checkLabel: 'Check',
    onCheck: action('onCheck'),
  },
  render: StoryWrapper,
};

export const FeedbackModeCorrect = {
  args: {
    mode: 'feedback',
    isCorrect: true,
    title: 'Excellent!',
    onContinue: action('onContinue'),
  },
  render: StoryWrapper,
};

export const FeedbackModeIncorrect = {
  args: {
    mode: 'feedback',
    isCorrect: false,
    correctAnswerText: 'The correct answer was apple.',
    title: 'Oops, not quite!', // Custom title for incorrect
    onContinue: action('onContinue'),
  },
  render: StoryWrapper,
};

export const FlashcardShowAnswerMode = {
  args: {
    mode: 'flashcardShowAnswer',
    onShowAnswer: action('onShowAnswer'),
  },
  render: StoryWrapper,
};

export const FlashcardRateMode = {
  args: {
    mode: 'flashcardRate',
    onRate: (rating: Rating) => action('onRate')(rating),
  },
  render: StoryWrapper,
};