import { createBookmark, getAllBookmarks } from '../../services/db/learning'; // Assuming functions are here
import type { Bookmark } from '../../services/db/types'; // Assuming types are here
import type { Browser } from 'wxt/browser';
// Assuming response types are defined in messaging-types
import type { SaveBookmarkResponse, LoadBookmarksResponse } from '../../shared/messaging-types';

console.log('[Bookmark Handlers] Module loaded.');

/**
 * Handles saving a new bookmark.
 * Expects message.data with url, title?, tags?, selectedText?.
 */
interface SaveBookmarkPayload {
  url: string;
  title?: string | null;
  tags?: string | null; // Comma-separated tags
  selectedText?: string | null; // Add selected text if sent from popup
}

export async function handleSaveBookmark(
  payload: SaveBookmarkPayload,
  _sender: Browser.runtime.MessageSender
): Promise<SaveBookmarkResponse> { // Return type based on messaging-types
  console.log('[handleSaveBookmark] Received payload:', payload);
  if (!payload || !payload.url) {
    console.error('[handleSaveBookmark] Invalid payload:', payload);
    return { success: false, error: 'Invalid payload: URL is required.' };
  }

  try {
    // Prepare data for createBookmark
    // Note: createBookmark might need its own Input type
    const bookmarkData = {
      url: payload.url,
      title: payload.title,
      tags: payload.tags, 
      // embedding: undefined, // Handle embedding later if needed
      // Potentially add selectedText to the bookmark record if schema supports it
      // context: payload.selectedText // Example if schema had a context field
    };

    // We need to ensure createBookmark accepts this structure or adjust accordingly
    // Assuming createBookmark is defined in learning.ts and takes an object
    const newBookmark = await createBookmark(bookmarkData);
    console.log('[handleSaveBookmark] Bookmark saved successfully:', newBookmark);
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