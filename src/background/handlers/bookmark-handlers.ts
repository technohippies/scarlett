import { createBookmark, getAllBookmarks } from '../../services/db/learning'; // Assuming functions are here
import type { CreateBookmarkInput } from '../../services/db/types'; // Added import
// import type { Bookmark } from '../../services/db/types'; // Removed unused type import
import type { Browser } from 'wxt/browser';
// Assuming response types are defined in messaging-types
import type { SaveBookmarkResponse, LoadBookmarksResponse } from '../../shared/messaging-types';
import { ensureDbInitialized } from '../../services/db/init'; // Import ensureDbInitialized
import { trackMilestone } from '../../utils/analytics';

console.log('[Bookmark Handlers] Module loaded.');

// Define the payload type for saveBookmark
interface SaveBookmarkPayload {
  url: string;
  title?: string | null;
  tags?: string | null;
  selectedText?: string | null;
}

/**
 * Handles saving a new bookmark.
 */
export async function handleSaveBookmark(
  payload: SaveBookmarkPayload,
  _sender: Browser.runtime.MessageSender
): Promise<SaveBookmarkResponse> { // Return type based on messaging-types
  console.log('[handleSaveBookmark] Received payload:', payload);
  try {
    // Ensure DB is ready before accessing it
    await ensureDbInitialized(); 
    console.log('[handleSaveBookmark] DB initialized. Saving bookmark...');

    // Create bookmark input
    const bookmarkInput: CreateBookmarkInput = {
      url: payload.url,
      title: payload.title || null,
      tags: payload.tags || null,
      selectedText: payload.selectedText || null
    };

    // Create the bookmark (without immediate embedding)
    const newBookmark = await createBookmark(bookmarkInput);
    console.log('[handleSaveBookmark] Bookmark saved successfully:', newBookmark);
    
    // Track first bookmark milestone
    trackMilestone.firstBookmark();
    
    return { success: true, bookmark: newBookmark };

  } catch (error: any) {
    console.error('[handleSaveBookmark] Error saving bookmark:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error saving bookmark' 
    }; 
  }
}

/**
 * Handles loading all existing bookmarks.
 */
export async function handleLoadBookmarks(
  _payload: unknown, 
  _sender: Browser.runtime.MessageSender
): Promise<LoadBookmarksResponse> { // Return type based on messaging-types
  console.log('[handleLoadBookmarks] Request received.');
  try {
    // Ensure DB is ready before accessing it
    await ensureDbInitialized(); 
    console.log('[handleLoadBookmarks] DB initialized. Fetching bookmarks...');
    const bookmarks = await getAllBookmarks();
    console.log(`[handleLoadBookmarks] Found ${bookmarks.length} bookmarks.`);
    return {
      success: true,
      bookmarks: bookmarks || []
    };

  } catch (error: any) {
    console.error('[handleLoadBookmarks] Error loading bookmarks:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error loading bookmarks'
    };
  }
}

// Add other bookmark-related handlers here later (e.g., delete, update tags, suggest) 