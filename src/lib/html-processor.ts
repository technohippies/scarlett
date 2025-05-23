import Defuddle from 'defuddle';

console.log('[HTML Processor] Module loaded.');

export async function extractReadableMarkdown(htmlContent: string, documentUrl: string): Promise<{ markdown: string | null; title: string | null }> {
  console.log(`[HTML Processor] Defuddle-based extraction for URL: ${documentUrl}`);
  if (!htmlContent) {
    console.warn('[HTML Processor] HTML content is empty.');
    return { markdown: null, title: null };
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const defuddle = new Defuddle(doc, { markdown: true, url: documentUrl });
    const result = defuddle.parse();
    return {
      markdown: result.content ?? null,
      title: result.title ?? null
    };
  } catch (error: any) {
    console.error('[HTML Processor] Defuddle extraction error for URL:', documentUrl, error);
    return { markdown: null, title: null };
  }
} 