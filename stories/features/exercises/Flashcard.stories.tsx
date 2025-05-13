import FlashcardReviewer, { type FlashcardReviewerProps, type ReviewableCardData } from '../../../src/features/exercises/Flashcard';
// import { Rating } from 'ts-fsrs'; // Removed as per user diff, assuming not directly needed in story
import { action } from '@storybook/addon-actions';
import type { FlashcardStatus } from '../../../src/services/db/types'; // Ensure this path is correct

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

// Mock data for ReviewableCardData
const mockReviewableCardNew: ReviewableCardData = {
  id: 1,
  front: 'Front of Card (New)',
  back: 'Back of Card (New)',
};

const mockReviewableCardReview: ReviewableCardData = {
  id: 2,
  front: 'Front of Review Card',
  back: 'Back of Review Card',
};

export default {
  title: 'Features/Exercises/FlashcardReviewer',
  component: FlashcardReviewer,
  tags: ['autodocs'],
  argTypes: {
    card: { control: 'object' },
    status: { control: 'select', options: ['new', 'learning', 'review', 'relearning'] as FlashcardStatus[] },
    onFlashcardRated: { action: 'onFlashcardRatedTriggered' },
    initialIsAnswerShown: { control: 'boolean' },
  },
};

// Template for rendering
const Template = (args: FlashcardReviewerProps) => (
  <div class="h-screen w-full flex items-center justify-center p-4 bg-background">
    <FlashcardReviewer {...args} />
  </div>
);

export const DefaultNewCard = {
  render: Template,
  args: {
    card: mockReviewableCardNew,
    status: 'new' as FlashcardStatus,
    onFlashcardRated: action('onFlashcardRated'),
    initialIsAnswerShown: false,
  },
};

export const DefaultNewCardAnswerShown = {
  render: Template,
  args: {
    card: mockReviewableCardNew,
    status: 'new' as FlashcardStatus,
    onFlashcardRated: action('onFlashcardRated'),
    initialIsAnswerShown: true,
  },
};

export const ReviewCard = {
  render: Template,
  args: {
    card: mockReviewableCardReview,
    status: 'review' as FlashcardStatus,
    onFlashcardRated: action('onFlashcardRated'),
    initialIsAnswerShown: false,
  },
};

// MCQ and Cloze card stories would be removed or rethought at this component's level,
// as this component no longer handles those types directly.
// They become scenarios for the parent StudyPage. 