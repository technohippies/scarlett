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
    onFlashcardRated: { action: 'onFlashcardRated' },
    initialIsAnswerShown: { control: 'boolean' },
  },
  parameters: {
    // Using fullscreen layout as the component now has a fixed footer internally
    layout: 'fullscreen', 
  },
};

// Template for rendering - SIMPLIFIED
const Template = (args: FlashcardReviewerProps) => (
  // Outermost takes full screen and uses flex column to manage height
  <div class="h-screen w-screen flex flex-col items-center justify-center bg-background p-4">
    {/* FlashcardReviewer now directly manages its width and takes available height */}
    {/* It already has h-full internally, so it should expand within this flex child container */}
    {/* The parent items-center/justify-center will center it if it's not h-full itself */}
    <div class="w-full max-w-md flex-grow flex flex-col"> {/* Use flex-grow to take available space, and flex-col for internal h-full */} 
      <FlashcardReviewer {...args} /> {/* FlashcardReviewer has h-full internally */} 
    </div>
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