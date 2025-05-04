import { getMarkdownPrompt } from './prompts/shared';
import { ollamaChat } from './providers/ollama/chat'; // Assuming Ollama for reader
import type { LLMConfig } from './types';

console.log('[LLM Reader Service] Module loaded.');

// Define a specific configuration for the reader model
// TODO: Make this configurable via settings later
const READER_MODEL_CONFIG: LLMConfig = {
  provider: 'ollama',
  model: 'gemma3:12b', // Or another suitable model like mixtral, gemma, etc.
  baseUrl: 'http://localhost:11434',
  stream: false, // Non-streaming is easier for full page conversion
};

/**
 * Uses an LLM to convert HTML content to Markdown, focusing on main content.
 * 
 * @param htmlContent The raw HTML content (typically document.body.innerHTML).
 * @returns A Promise resolving to the extracted Markdown content as a string, or null if failed.
 * @throws Throws an error if the LLM call fails or parsing fails.
 */
export async function getMarkdownFromHtml(htmlContent: string): Promise<string | null> {
  console.log(`[getMarkdownFromHtml] Request received (HTML length: ${htmlContent.length})`);
  if (!htmlContent) {
    console.warn('[getMarkdownFromHtml] HTML content is empty.');
    return null;
  }

  try {
    const prompt = getMarkdownPrompt(htmlContent); // Max length handled in prompt function
    
    console.log(`[getMarkdownFromHtml] Sending request to reader model: ${READER_MODEL_CONFIG.model}`);
    const llmResponse = await ollamaChat([{ role: 'user', content: prompt }], READER_MODEL_CONFIG);
    console.log('[getMarkdownFromHtml] Received response from reader model.');

    let markdownContent: string | undefined;
    if (typeof llmResponse === 'object' && llmResponse && 'choices' in llmResponse) {
      markdownContent = llmResponse.choices?.[0]?.message?.content?.trim();
    } else {
      console.warn('[getMarkdownFromHtml] Unexpected LLM response format:', llmResponse);
      throw new Error('Unexpected LLM response format from reader model.');
    }

    if (!markdownContent) {
      console.warn('[getMarkdownFromHtml] LLM returned empty markdown content.');
      return null; // Return null if LLM gives empty response
    }

    console.log(`[getMarkdownFromHtml] Successfully extracted markdown (length: ${markdownContent.length}).`);
    return markdownContent;

  } catch (error: any) {
    console.error('[getMarkdownFromHtml] Error getting markdown from HTML:', error);
    // Re-throw the error so the caller (e.g., tag handler) knows it failed
    throw new Error(`Failed to get Markdown from HTML: ${error.message}`); 
  }
} 