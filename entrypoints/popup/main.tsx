import { render } from 'solid-js/web';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { Bookmark, Tag } from '../../src/services/db/types'; // Adjust path if needed
// Import necessary response types (assuming they exist)
import type {
  LoadBookmarksResponse, 
  GetSelectedTextResponse, 
  GetPageInfoResponse, 
  TagListResponse
} from '../../src/shared/messaging-types'; 
import App from './App';
import 'virtual:uno.css';

console.log('[Popup Main] Script starting...');

const messaging = defineExtensionMessaging();

// Type for the data fetched and passed to App
export interface InitialData {
  bookmarks: Bookmark[];
  pageTitle?: string;
  pageUrl?: string;
  selectedText?: string;
  availableTags: Tag[];
}

async function fetchInitialData(): Promise<InitialData> {
  console.log('[Popup Main Fetch] Starting...');
  try {
    // Use Promise.allSettled to fetch concurrently and handle individual failures gracefully
    const results = await Promise.allSettled([
      messaging.sendMessage('loadBookmarks', undefined), // Fetch Bookmarks
      messaging.sendMessage('getPageInfo', undefined),   // Fetch Page Info
      messaging.sendMessage('getSelectedText', undefined), // Fetch Selected Text
      messaging.sendMessage('tag:list', undefined)         // Fetch Available Tags
    ]);

    // Process results
    const bookmarksResponse = results[0].status === 'fulfilled' ? results[0].value as LoadBookmarksResponse : null;
    const infoResponse = results[1].status === 'fulfilled' ? results[1].value as GetPageInfoResponse : null;
    const selectionResponse = results[2].status === 'fulfilled' ? results[2].value as GetSelectedTextResponse : null;
    const tagsResponse = results[3].status === 'fulfilled' ? results[3].value as TagListResponse : null;

    // Extract data, providing defaults or handling errors
    const bookmarks = bookmarksResponse?.success ? bookmarksResponse.bookmarks ?? [] : [];
    if (!bookmarksResponse?.success) console.warn('[Popup Main Fetch] Failed to load bookmarks:', bookmarksResponse?.error);

    const pageTitle = infoResponse?.success ? infoResponse.title : undefined;
    const pageUrl = infoResponse?.success ? infoResponse.url : undefined;
    if (!infoResponse?.success) console.error('[Popup Main Fetch] Failed to get page info:', infoResponse?.error);

    const selectedText = selectionResponse?.success ? selectionResponse.text ?? undefined : undefined;
    if (!selectionResponse?.success) console.warn('[Popup Main Fetch] Failed to get selected text:', selectionResponse?.error);
    
    const availableTags = tagsResponse?.success ? tagsResponse.tags ?? [] : [];
     if (!tagsResponse?.success) console.warn('[Popup Main Fetch] Failed to get available tags:', tagsResponse?.error);

    console.log('[Popup Main Fetch] Completed successfully.');
    return {
      bookmarks,
      pageTitle,
      pageUrl,
      selectedText,
      availableTags
    };

  } catch (error) {
    console.error('[Popup Main Fetch] Unexpected error during fetch:', error);
    // Re-throw or return default structure with empty arrays/undefined
    // Depending on how you want App to handle a total failure
     return {
      bookmarks: [],
      pageTitle: undefined,
      pageUrl: undefined,
      selectedText: undefined,
      availableTags: []
    }; 
    // throw error; // Or re-throw if App should show a generic error
  }
}

// Fetch data and render App
fetchInitialData()
  .then(initialData => {
    console.log('[Popup Main] Initial data fetched, rendering App:', initialData);
    render(() => <App initialData={initialData} initialError={null} />, document.getElementById('root')!); 
  })
  .catch(error => {
    console.error('[Popup Main] Failed to fetch initial data before render:', error);
    // Render App with error state
    render(() => <App initialData={null} initialError={error instanceof Error ? error : new Error('Failed to load initial data')} />, document.getElementById('root')!); 
  });
