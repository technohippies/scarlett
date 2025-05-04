import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';
import type { EmbeddingResult } from '../llm/embedding'; // Import the result type

console.log('[DB VisitedPages Service] Loaded.');

// Updated interface to accept EmbeddingResult
interface VisitedPageData {
  url: string;
  title?: string | null;
  markdown_content?: string | null;
  embeddingInfo?: EmbeddingResult | null; 
}

/**
 * Adds/updates a visited page, storing the embedding in the dimension-specific column.
 */
export async function addOrUpdateVisitedPage(data: VisitedPageData): Promise<void> {
  const { url, title, markdown_content, embeddingInfo } = data;
  console.log(`[DB VisitedPages] addOrUpdate for URL: ${url}`);

  if (!url) {
    console.error('[DB VisitedPages] URL is required.');
    throw new Error('URL is required.');
  }

  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    console.log('[DB VisitedPages] Got DB instance.');

    // Prepare embedding data based on dimension
    let embedding512: string | null = null;
    let embedding768: string | null = null;
    let embedding1024: string | null = null;
    let activeDimension: number | null = null;

    if (embeddingInfo) {
      activeDimension = embeddingInfo.dimension;
      const embeddingString = `[${embeddingInfo.embedding.join(',')}]`; // Format for PGlite vector
      if (activeDimension === 512) {
        embedding512 = embeddingString;
      } else if (activeDimension === 768) {
        embedding768 = embeddingString;
      } else if (activeDimension === 1024) {
        embedding1024 = embeddingString;
      } else {
        console.warn(`[DB VisitedPages] Unsupported embedding dimension ${activeDimension} for URL ${url}. Embedding not stored.`);
        activeDimension = null; // Don't store if unsupported
      }
    }

    // Construct SQL dynamically? No, use parameters and CASE/logic in UPDATE if possible,
    // or just overwrite all columns in UPDATE clause.
    const sql = `
      INSERT INTO visited_pages (
          url, title, markdown_content, 
          embedding_512, embedding_768, embedding_1024, 
          active_embedding_dimension,
          last_visited_at, last_processed_at, visit_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
      ON CONFLICT (url) DO UPDATE SET
        title = COALESCE(EXCLUDED.title, visited_pages.title),
        markdown_content = EXCLUDED.markdown_content, 
        embedding_512 = EXCLUDED.embedding_512, -- Update all embedding columns on conflict
        embedding_768 = EXCLUDED.embedding_768,
        embedding_1024 = EXCLUDED.embedding_1024,
        active_embedding_dimension = EXCLUDED.active_embedding_dimension, -- Update active dimension
        visit_count = visited_pages.visit_count + 1,
        last_visited_at = CURRENT_TIMESTAMP,
        last_processed_at = CURRENT_TIMESTAMP;
    `;

    const params = [
      url,                // $1
      title,              // $2
      markdown_content,   // $3
      embedding512,       // $4
      embedding768,       // $5
      embedding1024,      // $6
      activeDimension     // $7
    ];

    console.log(`[DB VisitedPages] Executing INSERT ON CONFLICT for dimension ${activeDimension}...`);
    await db.query(sql, params);
    console.log(`[DB VisitedPages] Successfully inserted/updated URL: ${url}`);

  } catch (error: any) {
    console.error('[DB VisitedPages] Error adding or updating visited page:', error);
    console.error('[DB VisitedPages] Failed URL:', url); 
    throw error; 
  } 
}

// TODO: Add functions to query visited pages later (e.g., for RAG) 