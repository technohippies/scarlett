import { createBookmark, getAllBookmarks } from '../../services/db/learning'; // Assuming functions are here
import type { CreateBookmarkInput } from '../../services/db/types'; // Added import
// import type { Bookmark } from '../../services/db/types'; // Removed unused type import
import type { Browser } from 'wxt/browser';
// Assuming response types are defined in messaging-types
import type { SaveBookmarkResponse, LoadBookmarksResponse } from '../../shared/messaging-types';
import { ensureDbInitialized } from '../../services/db/init'; // Import ensureDbInitialized

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
    // Ensure DB is ready before accessing it
    await ensureDbInitialized(); 
    console.log('[handleSaveBookmark] DB initialized. Saving bookmark...');

    // Prepare data for createBookmark
    // Note: createBookmark might need its own Input type
    const bookmarkData: CreateBookmarkInput = {
      url: payload.url,
      title: payload.title,
      tags: payload.tags, 
      selectedText: payload.selectedText,
      // embedding: undefined, // Handle embedding later if needed
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