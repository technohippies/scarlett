import { BookmarksPageView } from '../../../src/pages/bookmarks/BookmarksPageView';
import type { Bookmark } from '../../../src/services/db/types'; // Import Bookmark type
import { action } from '@storybook/addon-actions'; // Import action if needed for future interactions

// Mock Bookmark data
const mockBookmarks: Bookmark[] = [
  {
    id: 1,
    url: 'https://example.com/article1',
    title: 'Interesting Article Title',
    selected_text: 'This is the specific text snippet that was highlighted and saved.',
    saved_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    tags: 'tech, solidjs, webdev',
    embedding: null, // Assume no embedding for now
  },
  {
    id: 2,
    url: 'https://another-site.org/page?query=test',
    title: 'Another Site Page',
    selected_text: null, // No selected text
    saved_at: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
    tags: 'research, data',
    embedding: null,
  },
  {
    id: 3,
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    title: 'MDN Web Docs: JavaScript',
    selected_text: 'JavaScript (JS) is a lightweight, interpreted, or just-in-time compiled programming language with first-class functions.',
    saved_at: new Date(Date.now() - 1209600000).toISOString(), // 2 weeks ago
    tags: 'javascript, documentation, mdn',
    embedding: null,
  },
  {
    id: 4,
    url: 'http://localhost:3000/long/path/that/might/overflow/or/need/truncation',
    title: null, // No title provided
    selected_text: 'A very long piece of selected text that might wrap or need to be handled appropriately within the card layout to avoid breaking the UI design and ensure readability for the user when they are browsing their saved bookmarks.',
    saved_at: new Date().toISOString(), // Now
    tags: 'testing, layout',
    embedding: null,
  }
];

export default {
  title: 'Pages/BookmarkManager/BookmarksPageView',
  component: BookmarksPageView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen', // Use fullscreen for page-level components
  },
  argTypes: {
    bookmarks: { control: 'object' }, // Control as object in Storybook UI
    isLoading: { control: 'boolean' },
    error: { control: 'text' },
    onNavigateBack: { action: 'navigateBack' }, // Add action for the new prop
  },
  args: { // Default args applied to all stories unless overridden
    isLoading: false,
    error: null,
    bookmarks: null, // Default to null (might represent initial state before loading)
    onNavigateBack: action('navigateBack'), // Add default action
  },
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
    error: 'Failed to load bookmarks from the database. Please try again later.',
  },
};

// Story: Empty State (Loaded, no bookmarks)
export const Empty = {
  args: {
    bookmarks: [], // Explicitly empty array
  },
};

// Story: With Data
export const WithData = {
  args: {
    bookmarks: mockBookmarks,
  },
};

// Story: With Only One Bookmark
export const SingleBookmark = {
    args: {
        bookmarks: [mockBookmarks[0]],
    },
}; 