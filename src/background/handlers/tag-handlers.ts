import { getAllTags } from '../../services/db/learning';
import type { Tag } from '../../services/db/types';
import type { Browser } from 'wxt/browser';
// Assuming response types are defined
import type { TagListResponse, TagSuggestResponse } from '../../shared/messaging-types'; 
// Import LLM service and prompts
import { ollamaChat } from '../../services/llm/providers/ollama/chat'; // Assuming Ollama for now
import { getTagSuggestionPrompt } from '../../services/llm/prompts/tagging'; // We need to create this
import type { LLMConfig } from '../../services/llm/types'; // Assuming type exists

console.log('[Tag Handlers] Module loaded.');

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
 * Handles suggesting tags based on page title, URL, and content.
 */
interface TagSuggestPayload {
  title: string;
  url: string;
  pageContent?: string | null; // Selected text or other context
}

export async function handleTagSuggest(
  payload: TagSuggestPayload,
  _sender: Browser.runtime.MessageSender
): Promise<TagSuggestResponse> {
  console.log('[handleTagSuggest] Received payload:', payload);
  const { title, url, pageContent } = payload;

  if (!title && !url && !pageContent) {
    return { success: false, error: 'Insufficient information for tag suggestion.' };
  }

  // TODO: Retrieve actual LLM config from storage
  const mockLlmConfig: LLMConfig = {
    provider: 'ollama',
    model: 'gemma:2b', // Using a smaller model for potentially faster tagging
    baseUrl: 'http://localhost:11434',
    stream: false,
  };

  try {
    const prompt = getTagSuggestionPrompt(title, url, pageContent ?? undefined);
    console.log('[handleTagSuggest] Generated prompt:', prompt); // Log prompt for debugging

    const llmResponse = await ollamaChat([{ role: 'user', content: prompt }], mockLlmConfig);
    console.log('[handleTagSuggest] Received LLM response');

    let rawContent: string | undefined;
     if (typeof llmResponse === 'object' && llmResponse && 'choices' in llmResponse) {
      rawContent = llmResponse.choices?.[0]?.message?.content?.trim();
    } else {
      console.warn('[handleTagSuggest] Received unexpected LLM response type:', llmResponse);
      throw new Error('Unexpected LLM response format.');
    }

    if (!rawContent) {
      throw new Error('LLM returned empty content for tag suggestion.');
    }

    console.log('[handleTagSuggest] Raw LLM content:', rawContent);

    // --- Extract Hashtags --- 
    // Simple regex to find words starting with # (alphanumeric + underscore allowed after #)
    const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
    const suggestions = Array.from(rawContent.matchAll(hashtagRegex), m => m[0]); 
    // Ensure uniqueness and filter out just '#' if accidentally matched
    const uniqueSuggestions = [...new Set(suggestions)].filter(tag => tag.length > 1); 

    console.log('[handleTagSuggest] Extracted suggestions:', uniqueSuggestions);

    if (uniqueSuggestions.length === 0) {
       console.warn('[handleTagSuggest] LLM response did not contain any hashtags.');
       // Return success but empty suggestions, or indicate failure?
       // Let's return success with empty array for now.
       return { success: true, suggestions: [] };
    }

    return { success: true, suggestions: uniqueSuggestions };

  } catch (error: any) {
    console.error('[handleTagSuggest] Error generating tag suggestions:', error);
    return {
      success: false,
      error: error.message || 'Unknown error suggesting tags'
    };
  }
} 