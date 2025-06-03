import { Component, createResource, createSignal } from 'solid-js';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { LoadBookmarksResponse } from '../../shared/messaging-types';
import { BookmarksPageView } from './BookmarksPageView';
import type { Messages } from '../../types/i18n';

// Define the protocol map for messages SENT TO the background
// Only include messages this component uses
interface BackgroundProtocol {
    loadBookmarks(): Promise<LoadBookmarksResponse>;
}

// Props for BookmarksPage
export interface BookmarksPageProps {
  onNavigateBack: () => void;
  messages?: Messages;
}

// Initialize messaging client
const messaging = defineExtensionMessaging<BackgroundProtocol>();

const BookmarksPage: Component<BookmarksPageProps> = (props) => {
  const [error, setError] = createSignal<string | null>(null);

  // Fetch bookmarks resource
  const [bookmarksResource] = createResource(async () => {
    console.log('[BookmarksPage] Fetching bookmarks...');
    setError(null);
    try {
      const response = await messaging.sendMessage('loadBookmarks', undefined);
      console.log('[BookmarksPage] Received loadBookmarks response:', response);
      if (response.success && response.bookmarks) {
        return response.bookmarks;
      } else {
        setError(response.error || 'Failed to load bookmarks.');
        return null;
      }
    } catch (err: any) {
      console.error('[BookmarksPage] Error fetching bookmarks:', err);
      setError(err.message || 'Unknown error fetching bookmarks.');
      return null;
    }
  });

  return (
    <BookmarksPageView
      bookmarks={bookmarksResource() ?? null}
      isLoading={bookmarksResource.loading}
      error={error()}
      onNavigateBack={props.onNavigateBack}
      messages={props.messages}
    />
  );
};

export default BookmarksPage; 