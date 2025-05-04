/**
 * Generates a prompt for an LLM to suggest relevant hashtags for given content.
 * 
 * @param title The title of the webpage.
 * @param url The URL of the webpage.
 * @param contentSnippet Optional snippet of text content from the page.
 * @param maxTags The desired number of tags (default 5).
 * @returns A string containing the formatted prompt.
 */
export function getTagSuggestionPrompt(
  title: string,
  url: string,
  contentSnippet?: string,
  maxTags: number = 5
): string {
  let prompt = `Analyze the following information about a webpage and suggest ${maxTags} relevant category hashtags (starting with #):

`;

  if (title) {
    prompt += `Title: ${title}\n`;
  }
  if (url) {
    prompt += `URL: ${url}\n`;
  }
  if (contentSnippet) {
    // Truncate long snippets to keep prompt concise
    const snippetLimit = 500;
    const truncatedSnippet = contentSnippet.length > snippetLimit 
      ? contentSnippet.substring(0, snippetLimit) + '...' 
      : contentSnippet;
    prompt += `Content Snippet: ${truncatedSnippet}\n`;
  }

  prompt += `\nPlease provide exactly ${maxTags} relevant hashtags, each starting with #, separated by spaces. Examples: #technology #solidjs #webdev #ai #news`;

  return prompt;
} 