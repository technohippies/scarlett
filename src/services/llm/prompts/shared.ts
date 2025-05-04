// src/services/llm/prompts/shared.ts

/**
 * Generates a prompt for an LLM to convert HTML content to clean Markdown.
 * 
 * @param htmlContent The raw HTML content of the page body.
 * @param maxLength Optional maximum character length for the input HTML to keep prompts reasonable.
 * @returns A string containing the formatted prompt.
 */
export function getMarkdownPrompt(htmlContent: string, maxLength: number = 15000): string {
    // Truncate very long HTML to avoid exceeding context limits or excessive processing
    const truncatedHtml = htmlContent.length > maxLength 
      ? htmlContent.substring(0, maxLength) + '\\n... (HTML truncated)'
      : htmlContent;
  
    // Prompt focusing on main content extraction
    const prompt = `Please convert the following HTML content into clean, readable Markdown format. Focus on extracting the main textual content, headings, lists, and essential links. Ignore script tags, style tags, navigation menus, sidebars, footers, and other non-content elements.
  
  HTML CONTENT:
  \`\`\`html
  ${truncatedHtml}
  \`\`\`
  
  MARKDOWN OUTPUT (main content only):
  `;
    return prompt;
  }
  
  // Add other shared/general LLM prompts here later if needed.