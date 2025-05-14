import { browser, type Browser } from 'wxt/browser';
import { getAllTags } from '../../services/db/tags';
import { ensureDbInitialized } from '../../services/db/init';
// Assuming response types are defined
import type { 
    TagListResponse, 
    // GetPageContentResponse // Removed
} from '../../shared/messaging-types'; 
// Import LLM service and prompts
// import { defineExtensionMessaging } from '@webext-core/messaging'; // Removed as messaging is unused
// import { getMarkdownFromHtml } from '../../services/llm/reader'; // Removed
// import type { LLMConfig } from '../../services/llm/types'; // Removed

console.log('[Tag Handlers] Module loaded.');

// Define messaging for sending messages from background
// const messaging = defineExtensionMessaging(); // Removed

/**
 * Handles listing all available tags.
 */
export async function handleTagList(
  _payload: unknown,
  _sender: Browser.runtime.MessageSender
): Promise<TagListResponse> {
  console.log('[handleTagList] Request received.');
  try {
    // Ensure DB is ready before accessing it
    await ensureDbInitialized(); 
    console.log('[handleTagList] DB initialized. Fetching tags...');
    const tags = await getAllTags();
    console.log(`[handleTagList] Found ${tags.length} tags.`);
    return {
      success: true,
      tags: tags || []
    };
  } catch (error: any) {
    console.error('[handleTagList] Error loading tags:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error loading tags'
    };
  }
}