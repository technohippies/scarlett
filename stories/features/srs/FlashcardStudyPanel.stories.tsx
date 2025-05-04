import { FlashcardStudyPanel } from '../../../src/features/srs/FlashcardStudyPanel';

export default {
  title: 'Features/SRS/FlashcardStudyPanel',
  component: FlashcardStudyPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded', // Optional: Add padding around the component
  },
  argTypes: {
    dueCount: { control: 'number' },
    reviewCount: { control: 'number' },
    newCount: { control: 'number' },
    onStudyClick: { action: 'studyClicked' }, // Configure action directly
    class: { control: 'text' },
  },
  // No explicit render function needed here
};

// Story: Default state with counts
export const Default = {
  args: {
    dueCount: 5,
    reviewCount: 10,
    newCount: 2,
    // onStudyClick is implicitly handled by argTypes action
  },
};

// Story: No counts visible (only button)
export const NoCounts = {
  args: {
    dueCount: 0,
    reviewCount: 0,
    newCount: 0,
  },
};

// Story: Only New cards
export const OnlyNew = {
  args: {
    dueCount: 0,
    reviewCount: 0,
    newCount: 8,
  },
};

// Story: Only Review cards
export const OnlyReview = {
  args: {
    dueCount: 0,
    reviewCount: 15,
    newCount: 0,
  },
};

// Story: Only Due cards
export const OnlyDue = {
  args: {
    dueCount: 3,
    reviewCount: 0,
    newCount: 0,
  },
};

// Story: With additional class
export const WithCustomClass = {
  args: {
    dueCount: 5,
    reviewCount: 10,
    newCount: 2,
    class: 'bg-yellow-100 p-4 rounded', // Example custom class
  },
}; 