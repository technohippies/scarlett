import { FlashcardStudyPanel } from '../../../src/features/srs/FlashcardStudyPanel';
import { action } from '@storybook/addon-actions';;

export default {
  title: 'Features/SRS/FlashcardStudyPanel',
  component: FlashcardStudyPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered', // Center the constrained component
  },
  argTypes: {
    dueCount: { control: 'number' },
    reviewCount: { control: 'number' },
    newCount: { control: 'number' },
    onStudyClick: { action: 'studyClicked' }, 
    class: { control: 'text' },
  },
  // Add a wrapper div directly in render functions if needed, or rely on layout parameter
};

// Story: Default state with counts
export const Default = {
  args: {
    dueCount: 5,
    reviewCount: 10,
    newCount: 2,
    onStudyClick: action('studyClicked'),
    class: "bg-card p-4 rounded-lg shadow-md max-w-xs w-full" // Apply width constraints here
  },
};

// Story: No counts visible (only button)
export const NoCounts = {
  args: {
    dueCount: 0,
    reviewCount: 0,
    newCount: 0,
    onStudyClick: action('studyClicked'),
    class: "bg-card p-4 rounded-lg shadow-md max-w-xs w-full"
  },
};

// Story: Only New cards
export const OnlyNew = {
  args: {
    dueCount: 0,
    reviewCount: 0,
    newCount: 8,
    onStudyClick: action('studyClicked'),
    class: "bg-card p-4 rounded-lg shadow-md max-w-xs w-full"
  },
};

// Story: Only Review cards
export const OnlyReview = {
  args: {
    dueCount: 0,
    reviewCount: 15,
    newCount: 0,
    onStudyClick: action('studyClicked'),
    class: "bg-card p-4 rounded-lg shadow-md max-w-xs w-full"
  },
};

// Story: Only Due cards
export const OnlyDue = {
  args: {
    dueCount: 3,
    reviewCount: 0,
    newCount: 0,
    onStudyClick: action('studyClicked'),
    class: "bg-card p-4 rounded-lg shadow-md max-w-xs w-full"
  },
};

// Story: With additional class (overrides the default example styling)
export const WithCustomClass = {
  args: {
    dueCount: 5,
    reviewCount: 10,
    newCount: 2,
    onStudyClick: action('studyClicked'),
    class: 'bg-yellow-100 p-6 rounded-xl max-w-xs w-full', // Added width constraints
  },
}; 