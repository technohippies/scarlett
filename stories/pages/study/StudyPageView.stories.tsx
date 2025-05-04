import { StudyPageView, type StudyPageViewProps } from '../../../src/pages/study/StudyPageView';
import { action } from '@storybook/addon-actions';

// Mock MCQProps for stories that need it
const mockMcqProps = {
  instructionText: "Translate:",
  sentenceToTranslate: "Hello, world!",
  options: [
    { id: 0, text: "Bonjour le monde !" },
    { id: 1, text: "Au revoir le monde !" }, // Incorrect
    { id: 2, text: "Bonsoir le monde !" }, // Incorrect
    { id: 3, text: "Salut le monde !" }    // Incorrect (alternate correct-ish)
  ],
  correctOptionId: 0,
  onComplete: action('mcqComplete'), // Action for MCQ completion
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
    mcqProps: { control: 'object' }, // Use object control, provide data in stories
    itemError: { control: 'text' },
    distractorError: { control: 'text' },
    onSkipClick: { action: 'skipClicked' },
  },
  args: { // Default args
    isLoadingItem: false,
    isLoadingDistractors: false,
    mcqProps: null,
    itemError: null,
    distractorError: null,
    onSkipClick: action('skipClicked'),
  }
};

// Story: Loading Item
export const LoadingItem = {
  args: {
    isLoadingItem: true,
  },
};

// Story: Loading Distractors (after item has loaded)
export const LoadingDistractors = {
  args: {
    isLoadingItem: false,
    isLoadingDistractors: true,
  },
};

// Story: Item Fetching Error
export const ItemError = {
  args: {
    itemError: 'Network error fetching review item.',
  },
};

// Story: Distractor Generation Error/Warning
export const DistractorError = {
  args: {
    // Still might have placeholder MCQ props even with distractor error
    mcqProps: {
        ...mockMcqProps,
        options: [
            { id: 0, text: "Bonjour le monde !" },
            { id: 1, text: "Placeholder A" },
            { id: 2, text: "Placeholder B" },
            { id: 3, text: "Placeholder C" }
        ],
        correctOptionId: 0
    },
    distractorError: 'Could not generate enough unique distractors.',
  },
};

// Story: MCQ Ready
export const MCQReady = {
  args: {
    mcqProps: mockMcqProps,
  },
};

// Story: No Items Due (after loading finishes)
export const NoItemsDue = {
  args: {
    // Loading is false, no errors, mcqProps is null
    mcqProps: null,
  },
};

// Story: Both Loading (initial state, less common)
export const LoadingBoth = {
    args: {
        isLoadingItem: true,
        isLoadingDistractors: true, // Technically possible if logic allows parallel starts
    },
}; 