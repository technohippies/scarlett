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
    summary: () => ({ dueCount: 5, reviewCount: 12, newCount: 3 }),
    summaryLoading: () => false,
    // Ensure other relevant props for a "loaded" state are set if needed, e.g.:
    currentStreak: () => 10, 
    streakLoading: () => false,
    isPageReady: () => true,
    dailyGoalCompleted: () => false, // So the study panel is visible
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

// Story: Daily Goal Completed (Study Panel Hidden)
export const DailyGoalCompleted = {
  args: {
    summaryData: { dueCount: 5, reviewCount: 12, newCount: 3 }, // Provide some summary data for context
    dailyGoalCompleted: () => true,
    currentStreak: () => 7, // Example streak data
  },
}; 