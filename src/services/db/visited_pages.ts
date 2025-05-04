import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';

console.log('[DB VisitedPages Service] Loaded.');

interface VisitedPageData {
  url: string;
  title?: string | null;
  markdown_content?: string | null;
  embedding?: number[] | null;
}

/**
 * Adds a new visited page record or updates an existing one based on the URL.
 * Increments the visit_count on update.
 * 
 * @param data Object containing url, title, markdown_content, and embedding.
 * @returns A Promise resolving when the operation is complete.
 * @throws Throws an error if the database operation fails.
 */
export async function addOrUpdateVisitedPage(data: VisitedPageData): Promise<void> {
  const { url, title, markdown_content, embedding } = data;
  console.log(`[DB VisitedPages] addOrUpdate for URL: ${url}`);

  if (!url) {
    console.error('[DB VisitedPages] URL is required to add or update.');
    throw new Error('URL is required.');
  }

  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    console.log('[DB VisitedPages] Got DB instance.');

    // Convert embedding array to the string format PGlite vector expects: '[1,2,3]'
    // Handle null/empty embedding explicitly
    const embeddingString = embedding && embedding.length > 0 
      ? `[${embedding.join(',')}]` 
      : null;

    const sql = `
      INSERT INTO visited_pages (url, title, markdown_content, embedding, last_visited_at, last_processed_at, visit_count)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
      ON CONFLICT (url) DO UPDATE SET
        title = COALESCE(EXCLUDED.title, visited_pages.title), -- Keep old title if new one is null
        markdown_content = EXCLUDED.markdown_content, 
        embedding = EXCLUDED.embedding,
        visit_count = visited_pages.visit_count + 1,
        last_visited_at = CURRENT_TIMESTAMP,
        last_processed_at = CURRENT_TIMESTAMP;
    `;

    const params = [
      url,
      title, // Allow null
      markdown_content, // Allow null
      embeddingString // Use the formatted string or null
    ];

    console.log('[DB VisitedPages] Executing INSERT ON CONFLICT...');
    // console.log('[DB VisitedPages] SQL:', sql); // DEBUG
    // console.log('[DB VisitedPages] Params:', params.slice(0, 2), '(markdown omitted)', params[3] ? '(embedding present)':'(embedding null)'); // DEBUG
    await db.query(sql, params);
    console.log(`[DB VisitedPages] Successfully inserted/updated URL: ${url}`);

  } catch (error: any) {
    console.error('[DB VisitedPages] Error adding or updating visited page:', error);
    console.error('[DB VisitedPages] Failed URL:', url); // Log the URL that failed
    throw error; // Re-throw the error
  } 
}

// TODO: Add functions to query visited pages later (e.g., for RAG) 