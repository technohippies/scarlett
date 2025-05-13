import NewTabPageView from '../../../src/pages/newtab/NewTabPageView';
import { action } from '@storybook/addon-actions';

export default {
  title: 'Pages/NewTab/NewTabPageView',
  component: NewTabPageView,
  tags: ['autodocs'],
  parameters: {
    // Use fullscreen layout for page-level components
    layout: 'fullscreen',
  },
  argTypes: {
    isLoading: { control: 'boolean' },
    summaryData: { control: 'object' }, // Basic object control
    error: { control: 'text' },
    onStudyClick: { action: 'studyClicked' },
  },
  args: { // Default args for all stories unless overridden
    onStudyClick: action('studyClicked'),
    isLoading: false,
    error: null,
    summaryData: null, // Default to no data
    isPageReady: () => true,
    // Add default mock accessors for streak data and loading state
    currentStreak: () => 0,
    longestStreak: () => 0,
    streakLoading: () => false,
    // Add default mock for other new props if not already present
    summary: () => null,
    summaryLoading: () => false,
    pendingEmbeddingCount: () => 0,
    isEmbedding: () => false,
    embedStatusMessage: () => null,
    onEmbedClick: action('embedClicked'),
    onNavigateToBookmarks: action('navigateToBookmarks'),
    onNavigateToStudy: action('navigateToStudy'),
    onNavigateToSettings: action('navigateToSettings'),
    messages: undefined, // Or mock messages if needed
    isFocusModeActive: () => false,
    onToggleFocusMode: action('toggleFocusMode'),
    showMoodSelector: () => false,
    onMoodSelect: action('moodSelected'),
    dailyGoalCompleted: () => false,
  }
};

// Story: Loading State
export const Loading = {
  args: {
    isLoading: true,
  },
};

// Story: Error State
export const Error = {
  args: {
    error: 'Failed to connect to the background service.',
  },
};

// Story: Loaded with Data
export const LoadedWithData = {
  args: {
    summaryData: { dueCount: 5, reviewCount: 12, newCount: 3 },
  },
};

// Story: Loaded with Zero Counts
export const LoadedZeroCounts = {
  args: {
    summaryData: { dueCount: 0, reviewCount: 0, newCount: 0 },
  },
};

// Story: Loaded but Summary is Null (e.g., unexpected backend state)
export const LoadedNoSummaryData = {
  args: {
    summaryData: null, // Explicitly null after loading
  },
}; 