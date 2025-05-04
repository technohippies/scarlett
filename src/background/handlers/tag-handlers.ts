import { browser, type Browser } from 'wxt/browser';
import { getAllTags } from '../../services/db/learning';
// Assuming response types are defined
import type { 
    TagListResponse, 
    TagSuggestResponse, 
    GetPageContentResponse 
} from '../../shared/messaging-types'; 
// Import LLM service and prompts
import { defineExtensionMessaging } from '@webext-core/messaging';
import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import { getTagSuggestionPrompt } from '../../services/llm/prompts/tagging';
import { getMarkdownFromHtml } from '../../services/llm/reader';
import type { LLMConfig } from '../../services/llm/types';

console.log('[Tag Handlers] Module loaded.');

// Define messaging for sending messages from background
const messaging = defineExtensionMessaging(); 

/**
 * Handles listing all available tags.
 */
export async function handleTagList(
  _payload: unknown,
  _sender: Browser.runtime.MessageSender
): Promise<TagListResponse> {
  console.log('[handleTagList] Request received.');
  try {
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

/**
 * Handles suggesting tags based on page title, URL, and FULL PAGE CONTENT (converted to Markdown).
 */
interface TagSuggestPayload {
  title: string;
  url: string;
  // pageContent is no longer used directly for prompt, but might be useful for context later
  pageContent?: string | null; 
}

export async function handleTagSuggest(
  payload: TagSuggestPayload,
  _sender: Browser.runtime.MessageSender
): Promise<TagSuggestResponse> {
  console.log('[handleTagSuggest] Received payload:', payload);
  const { title, url } = payload;

  if (!title && !url) {
    // We might not need title/url if we have full markdown, but good initial check
    return { success: false, error: 'Title or URL required for context.' };
  }

  // --- Configuration for Tagging LLM --- 
  // TODO: Retrieve actual LLM config from storage
  const TAGGING_MODEL_CONFIG: LLMConfig = {
    provider: 'ollama',
    model: 'gemma3:12b', // Model specifically for tagging
    baseUrl: 'http://localhost:11434',
    stream: false,
  };

  let markdownContent: string | null = null;

  try {
    // --- Step 1: Get Page Content --- 
    console.log('[handleTagSuggest] Getting active tab...');
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0 || !tabs[0]?.id) {
      throw new Error('Could not find active tab to get page content.');
    }
    const activeTabId = tabs[0].id;
    console.log(`[handleTagSuggest] Found active tab: ${activeTabId}. Requesting page content...`);

    const contentResponse = await messaging.sendMessage('getPageContent', {}, activeTabId) as GetPageContentResponse;
    
    if (!contentResponse.success || !contentResponse.htmlContent) {
      throw new Error(contentResponse.error || 'Failed to get HTML content from content script.');
    }
    console.log(`[handleTagSuggest] Received HTML content (length: ${contentResponse.htmlContent.length})`);

    // --- Step 2: Convert HTML to Markdown using Reader Service --- 
    console.log('[handleTagSuggest] Converting HTML to Markdown via Reader Service...');
    markdownContent = await getMarkdownFromHtml(contentResponse.htmlContent);

    if (!markdownContent) {
      console.warn('[handleTagSuggest] Failed to get Markdown from reader service (returned null).');
      // Proceed without markdown? Or return error? Let's return error for now.
      throw new Error('Failed to convert page content to Markdown.'); 
    }
    console.log(`[handleTagSuggest] Markdown generated (length: ${markdownContent.length}).`);

    // --- Step 3: Generate Tag Suggestion Prompt (using Markdown) --- 
    const prompt = getTagSuggestionPrompt(title, url, markdownContent); // Pass Markdown here
    console.log('[handleTagSuggest] Generated tag suggestion prompt (using Markdown).'); 
    // Limit logging extremely long prompts
    // console.log('[handleTagSuggest] Prompt:', prompt.substring(0, 500) + '...');

    // --- Step 4: Call Tagging LLM --- 
    console.log(`[handleTagSuggest] Sending request to tagging model: ${TAGGING_MODEL_CONFIG.model}`);
    const llmResponse = await ollamaChat([{ role: 'user', content: prompt }], TAGGING_MODEL_CONFIG);
    console.log('[handleTagSuggest] Received response from tagging model.');

    let rawContent: string | undefined;
     if (typeof llmResponse === 'object' && llmResponse && 'choices' in llmResponse) {
      rawContent = llmResponse.choices?.[0]?.message?.content?.trim();
    } else {
      console.warn('[handleTagSuggest] Unexpected LLM response format for tagging:', llmResponse);
      throw new Error('Unexpected LLM response format from tagging model.');
    }

    if (!rawContent) {
      throw new Error('Tagging LLM returned empty content.');
    }

    console.log('[handleTagSuggest] Raw Tagging LLM content:', rawContent);

    // --- Step 5: Extract Hashtags --- 
    const hashtagRegex = /#([a-zA-Z0-9_\-\.]+)/g; // Allow hyphen and dot in tags
    const suggestions = Array.from(rawContent.matchAll(hashtagRegex), m => m[0]); 
    const uniqueSuggestions = [...new Set(suggestions)].filter(tag => tag.length > 1); 

    console.log('[handleTagSuggest] Extracted suggestions:', uniqueSuggestions);

    if (uniqueSuggestions.length === 0) {
       console.warn('[handleTagSuggest] Tagging LLM response did not contain any hashtags.');
       return { success: true, suggestions: [] };
    }

    return { success: true, suggestions: uniqueSuggestions };

  } catch (error: any) {
    console.error('[handleTagSuggest] Error during tag suggestion process:', error);
    // Provide more context in the error message
    let finalError = error.message || 'Unknown error suggesting tags';
    if (error.message?.includes('Failed to get HTML')) finalError = 'Could not retrieve page content for analysis.';
    if (error.message?.includes('Failed to get Markdown')) finalError = 'Could not process page content.';
    if (error.message?.includes('LLM returned empty content')) finalError = 'Tag analysis returned empty result.';

    return {
      success: false,
      error: finalError
    };
  }
} 