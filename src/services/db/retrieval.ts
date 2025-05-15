import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';

console.log('[DB Retrieval Service] Loaded.');

export interface RetrievedPageContext {
  version_id: number;
  url: string;
  summary_content: string;
  // Potentially add other fields like title, original markdown_hash for reference
}

/**
 * Performs a vector similarity search on page_versions summaries.
 * @param embedding The query embedding vector.
 * @param dimension The dimension of the query embedding.
 * @param topK The number of top results to return.
 * @returns A promise resolving to an array of RetrievedPageContext objects.
 */
export async function searchPageSummariesByVector(
  embedding: number[],
  dimension: 512 | 768 | 1024,
  topK: number = 5
): Promise<RetrievedPageContext[]> {
  if (!embedding || embedding.length === 0) {
    console.warn('[DB Retrieval] Empty embedding provided for search.');
    return [];
  }
  if (![512, 768, 1024].includes(dimension)) {
    console.error(`[DB Retrieval] Unsupported embedding dimension: ${dimension}`);
    return [];
  }

  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    const vectorText = `[${embedding.join(',')}]`;
    const embeddingColumnName = `embedding_${dimension}` as const;

    // Ensure the query targets versions with summaries and successful embeddings
    const sql = `
      SELECT
        pv.version_id,
        pv.url,
        pv.summary_content
      FROM
        page_versions pv
      WHERE
        pv.summary_content IS NOT NULL
        AND pv.last_embedded_at IS NOT NULL 
        AND pv.active_embedding_dimension = $1 
      ORDER BY
        pv.${embeddingColumnName} <-> $2::vector
      LIMIT $3;
    `;

    console.log(`[DB Retrieval] Executing vector search on ${embeddingColumnName} with dimension ${dimension}, topK ${topK}.`);
    const result = await db.query<RetrievedPageContext>(sql, [dimension, vectorText, topK]);
    
    if (result.rows.length === 0) {
        console.log('[DB Retrieval] No similar page summaries found.');
    } else {
        console.log(`[DB Retrieval] Found ${result.rows.length} similar page summaries.`);
    }
    return result.rows;

  } catch (error: any) {
    console.error('[DB Retrieval] Error in searchPageSummariesByVector:', error);
    // Consider the implications of re-throwing vs. returning empty array
    // For RAG, an empty context might be better than a full crash
    return []; 
  }
} 