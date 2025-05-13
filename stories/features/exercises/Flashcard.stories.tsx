import FlashcardReviewer, { type FlashcardReviewerProps } from '../../../src/features/exercises/Flashcard';
// import { Rating } from 'ts-fsrs'; // Removed as per user diff, assuming not directly needed in story
import { action } from '@storybook/addon-actions';

// Mocked types for Storybook context. 
// You'll need to ensure these align with your actual types in services/db/types.ts
export type MockFlashcardStatus = 'new' | 'learning' | 'review' | 'relearning';

export interface MockFlashcardDbType {
  id: number;
  front: string;
  back: string | null;
  type: 'front_back' | 'cloze'; // As used by the component
  exercise_type: 'mcq' | 'cloze' | string | null; // string for future types
  exercise_data: string | null; // JSON string for mcq/cloze data
  cloze_text: string | null;
  // Add any other fields your FlashcardDbType might have that the component might implicitly rely on
  // For example, if created_at, updated_at, etc. are part of the type, though not directly used by FlashcardReviewer UI.
  source_highlight?: string | null;
  source_url?: string | null;
  context?: string | null;
  due?: string | null; // Date string
  stability?: number | null;
  difficulty?: number | null;
  elapsed_days?: number;
  scheduled_days?: number;
  reps?: number;
  lapses?: number;
  state?: string | null; // from FSRS, e.g., 'new', 'learning'
  last_review?: string | null; // Date string
}

const mockFlashcardDbNew: MockFlashcardDbType = {
  id: 1,
  front: 'Front of Card (New)',
  back: 'Back of Card (New)',
  type: 'front_back',
  exercise_type: null, 
  exercise_data: null,
  cloze_text: null,
};

const mockFlashcardDbMcq: MockFlashcardDbType = {
  id: 2,
  front: 'Question context or front text for an MCQ card',
  back: 'Optional back text / answer reference',
  type: 'front_back', // or 'mcq' if you add that to the FlashcardDbType.type enum
  exercise_type: 'mcq',
  exercise_data: JSON.stringify({
    type: 'mcq',
    question: 'What is the capital of France?',
    options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
    correct_index: 2,
  }),
  cloze_text: null,
};

export default {
  title: 'Features/Exercises/FlashcardReviewer',
  component: FlashcardReviewer,
  tags: ['autodocs'],
  argTypes: {
    // Type casting because Storybook might not infer it correctly from mocked types
    card: { control: 'object' },
    status: { control: 'select', options: ['new', 'learning', 'review', 'relearning'] as MockFlashcardStatus[] },
    onReview: { action: 'onReviewTriggered' },
    initialIsAnswerShown: { control: 'boolean' },
  },
};

// Render function similar to your other stories for consistency
const Template = (args: FlashcardReviewerProps) => (
  <div class="h-screen w-full flex items-center justify-center p-4 bg-background">
    <FlashcardReviewer {...args} />
  </div>
);

export const DefaultNewCard = {
  render: Template,
  args: {
    card: mockFlashcardDbNew as any, // Cast to any if MockFlashcardDbType causes issues with props
    status: 'new' as MockFlashcardStatus,
    onReview: action('onReview'),
    initialIsAnswerShown: false,
  },
};

export const DefaultNewCardAnswerShown = {
  render: Template,
  args: {
    card: mockFlashcardDbNew as any,
    status: 'new' as MockFlashcardStatus,
    onReview: action('onReview'),
    initialIsAnswerShown: true,
  },
};

export const ReviewCard = {
  render: Template,
  args: {
    card: { ...mockFlashcardDbNew, id: 3, front: 'Front of Review Card', back: 'Back of Review Card' } as any,
    status: 'review' as MockFlashcardStatus,
    onReview: action('onReview'),
  },
};

export const McqCard = {
  render: Template,
  args: {
    card: mockFlashcardDbMcq as any,
    status: 'new' as MockFlashcardStatus,
    onReview: action('onReview'),
  },
};

export const ClozeCard = {
  render: Template,
  args: {
    card: {
      id: 4,
      front: 'This is a sentence with a [cloze].',
      back: 'cloze answer',
      type: 'cloze',
      exercise_type: 'cloze',
      exercise_data: null, 
      cloze_text: 'This is a sentence with a {{c1::cloze}}.',
    } as any,
    status: 'new' as MockFlashcardStatus,
    onReview: action('onReview'),
  },
}; 