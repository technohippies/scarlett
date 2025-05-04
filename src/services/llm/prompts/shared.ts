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
  
    // Updated Prompt: More explicit instructions
    const prompt = `Analyze the following HTML content from a webpage. Your goal is to extract ONLY the core main article or primary content body and convert it into clean, readable Markdown.\n\n    **Instructions:**\n    1.  **Identify the Main Content:** Look for the central article, blog post, or primary information section of the page.\n    2.  **Ignore Chrome/Template Elements:** Explicitly EXCLUDE all common website elements such as:\n        *   Headers, footers, navigation bars (top, side, or bottom)\n        *   Sidebars containing related links, ads, or metadata\n        *   Cookie banners, subscription popups\n        *   User interface elements (like search bars, buttons, menus, settings/customization options)\n        *   Script and style tags (and their content)\n        *   Meta-information sections (like author boxes, categories, tags if they are outside the main flow)\n    3.  **Convert to Markdown:** Format the extracted main content accurately using Markdown syntax (headings, paragraphs, lists, bold/italic, links).\n    4.  **Preserve Links:** Keep essential hyperlinks within the main content.\n    5.  **Be Concise:** If the main content is very long, provide a thorough summary, but prioritize accuracy.\n\n    **HTML CONTENT:**\n    \`\`\`html\n    ${truncatedHtml}\n    \`\`\`\n\n    **MARKDOWN OUTPUT (main content ONLY):**\n  `;
    return prompt;
  }
  
  // Add other shared/general LLM prompts here later if needed.