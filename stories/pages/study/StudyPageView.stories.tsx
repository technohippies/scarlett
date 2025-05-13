import { StudyPageView, type StudyPageViewProps } from '../../../src/pages/study/StudyPageView';
import { action } from '@storybook/addon-actions';
import type { ReviewableCardData } from '../../../src/features/exercises/Flashcard';
import type { FlashcardStatus } from '../../../src/services/db/types';
import type { MCQProps } from '../../../src/features/exercises/MCQ';
import { Rating } from 'ts-fsrs'; // For Rating enum

const mockBaseMcqProps: MCQProps = {
  instructionText: "Translate this word:",
  sentenceToTranslate: "Apple",
  options: [
    { id: 0, text: "Manzana (Correct)" },
    { id: 1, text: "Naranja" },
    { id: 2, text: "Plátano" },
    { id: 3, text: "Uva" }
  ],
  correctOptionId: 0,
  onComplete: action('mcqComplete'),
};

const mockReviewableCard: ReviewableCardData = {
  id: 'fc1',
  front: 'Hello',
  back: 'Hola',
};

export default {
  title: 'Pages/Study/StudyPageView',
  component: StudyPageView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    isLoadingItem: { control: 'boolean' },
    isLoadingDistractors: { control: 'boolean' },
    itemError: { control: 'text' },
    distractorError: { control: 'text' },
    onSkipClick: { action: 'skipClicked' },
    onNavigateBack: { action: 'navigateBack' },
    currentStudyStep: { control: 'select', options: ['flashcard', 'mcq', 'noItem'] },
    itemForFlashcardReviewer: { control: 'object' },
    flashcardStatus: { control: 'select', options: ['new', 'learning', 'review', 'relearning'] as FlashcardStatus[] },
    onFlashcardRated: { action: 'flashcardRated' },
    mcqProps: { control: 'object' },
  },
  // Base default args, individual stories will override
  args: {
    isLoadingItem: false,
    isLoadingDistractors: false,
    itemError: null,
    distractorError: null,
    onSkipClick: action('skipClicked'),
    onNavigateBack: action('navigateBack'),
    currentStudyStep: 'noItem',
    itemForFlashcardReviewer: null,
    flashcardStatus: 'new' as FlashcardStatus,
    onFlashcardRated: action('flashcardRated'),
    mcqProps: null,
  } satisfies StudyPageViewProps, // Ensure args satisfy the props type
};

// Story: Loading Item (initial state before any item is loaded)
export const LoadingInitialItem = {
  args: {
    isLoadingItem: true,
    currentStudyStep: 'noItem', // Explicitly noItem while loading initial
  },
};

// Story: Displaying Flashcard (item loaded, flashcard step)
export const DisplayingFlashcard = {
  args: {
    currentStudyStep: 'flashcard',
    itemForFlashcardReviewer: mockReviewableCard,
    flashcardStatus: 'review' as FlashcardStatus,
  },
};

// Story: Loading MCQ (after flashcard, before MCQ is ready)
export const LoadingMCQ = {
  args: {
    currentStudyStep: 'mcq',
    isLoadingItem: false, // Item is loaded
    isLoadingDistractors: true, // Distractors (for MCQ) are loading
    itemForFlashcardReviewer: mockReviewableCard, // Can still pass this, though view might not show it
    flashcardStatus: 'review' as FlashcardStatus, // Status from previous step
  },
};

// Story: Displaying MCQ (MCQ ready)
export const DisplayingMCQ = {
  args: {
    currentStudyStep: 'mcq',
    mcqProps: mockBaseMcqProps,
  },
};

// Story: Item Fetching Error
export const ItemFetchError = {
  args: {
    isLoadingItem: false,
    currentStudyStep: 'noItem', // Error occurred, so no active step
    itemError: 'Failed to load the next learning item. Please try again.',
  },
};

// Story: Distractor Generation Error (during MCQ step)
export const MCQDistractorError = {
  args: {
    currentStudyStep: 'mcq',
    isLoadingDistractors: false, // Loading finished, but resulted in error
    mcqProps: null, // mcqProps might be null or have placeholders if error occurred
    distractorError: 'Could not generate enough unique distractors for the MCQ.',
    // We might still have the flashcard item data from the previous step
    itemForFlashcardReviewer: mockReviewableCard, 
    flashcardStatus: 'good' as FlashcardStatus, // e.g. user rated flashcard 'Good'
  },
};

// Story: No Items Due (after loading finishes and no items are found)
export const NoItemsAvailable = {
  args: {
    isLoadingItem: false,
    currentStudyStep: 'noItem',
    itemError: null, // No error, just no items
  },
}; 