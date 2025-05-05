import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

console.log('[HTML Processor] Module loaded.');

/**
 * Extracts the main content from HTML using Readability and converts it to Markdown using Turndown.
 * 
 * @param htmlContent The full HTML source string of the page.
 * @param documentUrl The original URL of the document, used as the base for Readability.
 * @returns A Promise resolving to an object containing the extracted markdown and title, or nulls if extraction failed.
 */
export async function extractReadableMarkdown(htmlContent: string, documentUrl: string): Promise<{ markdown: string | null; title: string | null }> {
  console.log(`[HTML Processor] Starting extraction for URL: ${documentUrl}`);
  if (!htmlContent) {
    console.warn('[HTML Processor] HTML content is empty.');
    return { markdown: null, title: null };
  }

  try {
    // 1. Parse the HTML string into a DOM Document
    const parser = new DOMParser();
    // Important: Use text/html to ensure proper parsing, including handling of potentially missing html/head/body tags
    const doc = parser.parseFromString(htmlContent, 'text/html'); 

    // 2. Use Readability to extract the main article content
    // Pass the document's URI for better relative path handling
    const reader = new Readability(doc, { 
      // Optional: Provide the URL to help resolve relative links/images
      // Note: Readability types might not explicitly list `url`, but it uses doc.baseURI or provided href internally.
      // It's good practice to ensure the base URL context is correct. The constructor uses doc.documentURI.
    });
    const article = reader.parse();

    if (!article || !article.content) {
      console.warn(`[HTML Processor] Readability could not extract main content for URL: ${documentUrl}`);
      // Still return the title if Readability found one, even if content extraction failed
      return { markdown: null, title: article?.title || null }; 
    }

    console.log(`[HTML Processor] Readability extracted content (length: ${article.content.length}), Title: ${article.title}`);

    // 3. Use Turndown to convert the extracted HTML content to Markdown
    const turndownService = new TurndownService({
        headingStyle: 'atx', // Use # style headings
        codeBlockStyle: 'fenced', // Use ``` for code blocks
        // Add other options as desired (e.g., bulletListMarker, emDelimiter)
    }); 
    const markdown = turndownService.turndown(article.content);

    if (!markdown) {
        console.warn(`[HTML Processor] Turndown conversion resulted in empty markdown for URL: ${documentUrl}`);
        return { markdown: null, title: article.title || null };
    }

    console.log(`[HTML Processor] Turndown conversion successful (markdown length: ${markdown.length}) for URL: ${documentUrl}`);
    return { markdown, title: article.title || null };

  } catch (error: any) {
    console.error(`[HTML Processor] Error extracting markdown for URL ${documentUrl}:`, error);
    return { markdown: null, title: null }; // Return nulls on error
  }
} 