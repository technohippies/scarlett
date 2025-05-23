import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';
import type { EmbeddingResult } from '../llm/embedding'; // Import the result type

console.log('[DB VisitedPages Service] Loaded.');

// --- Helper function to calculate SHA-256 hash --- 
// --- EXPORT this function --- 
export async function calculateHash(text: string): Promise<string> {
    if (!text) return ''; // Handle empty string case
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        // Use Web Crypto API (available in Service Worker & modern browsers)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        // Convert buffer to hex string
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (error) {
        console.error('[DB VisitedPages Hash] Error calculating hash:', error);
        // Fallback or re-throw depending on desired behavior
        return 'error_calculating_hash'; // Or throw error
    }
}
// --- End Helper --- 

// --- NEW Interface for Summary Update --- 
export interface PageVersionSummaryUpdate {
    version_id: number;
    summary_content: string;
    summary_hash: string;
}
// --- End Interface --- 

// Interface for initial page data
interface PageVisitData {
  url: string;
  title?: string | null;
  markdown_content?: string | null;
  defuddle_metadata?: any; // Raw Defuddle metadata
}

/**
 * Records a new version of a visited page.
 * Ensures the main page record exists and inserts a new version snapshot.
 */
export async function recordPageVisitVersion(data: PageVisitData): Promise<void> {
  const { url, title, markdown_content, defuddle_metadata } = data;
  const currentTimestamp = new Date().toISOString(); // Consistent timestamp

  console.log(`[DB VisitedPages] recordPageVisitVersion for URL: ${url}`);

  if (!url) {
    console.error('[DB VisitedPages] URL is required for recordPageVisitVersion.');
    throw new Error('URL is required.');
  }

  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    console.log('[DB VisitedPages] Got DB instance for recordPageVisitVersion.');

    // 1. Ensure main page record exists and update last_visited_at
    const upsertPageSql = `
      INSERT INTO pages (url, title, last_visited_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (url) DO UPDATE SET
        title = COALESCE(EXCLUDED.title, pages.title),
        last_visited_at = EXCLUDED.last_visited_at
      WHERE pages.url = $1;
    `;
    const pageParams = [url, title, currentTimestamp];
    console.log(`[DB VisitedPages] Upserting page record for URL: ${url}`);
    await db.query(upsertPageSql, pageParams);
    console.log(`[DB VisitedPages] Page record upsert complete.`);

    // 2. Calculate markdown hash
    const markdownHash = markdown_content ? await calculateHash(markdown_content) : null;
    console.log(`[DB VisitedPages] Calculated markdown hash: ${markdownHash ? markdownHash.substring(0,10)+'...' : 'null'}`);

    // --- MODIFICATION START: Check for existing identical version ---
    if (markdownHash) { // Only check if we have a hash
      const findExistingSql = `
        SELECT version_id FROM page_versions
        WHERE url = $1 AND markdown_hash = $2
        ORDER BY captured_at DESC LIMIT 1;
      `;
      const existingResult = await db.query<{ version_id: number }>(findExistingSql, [url, markdownHash]);
      if (existingResult.rows.length > 0) {
        const existingVersionId = existingResult.rows[0].version_id;
        console.log(`[DB VisitedPages] Found existing identical page_version (id: ${existingVersionId}) for URL: ${url} with hash: ${markdownHash}. Incrementing count.`);
        await incrementPageVersionVisitCount(existingVersionId);
        // The main page record's last_visited_at was already updated, so we can return.
        return;
      }
    }
    // --- MODIFICATION END ---

    // 3. Insert new version into page_versions (if no identical version was found)
    // MODIFIED: Set visit_count to 1 for new versions
    const insertVersionSql = `
      INSERT INTO page_versions (
          url, markdown_content, markdown_hash, defuddle_metadata, captured_at,
          embedding_model_id, last_embedded_at, processed_for_embedding_at,
          visit_count 
      )
      VALUES ($1, $2, $3, $4, $5, NULL, NULL, NULL, 1); -- visit_count is now 1
    `;
    const versionParams = [
      url,                   // $1
      markdown_content,      // $2
      markdownHash,          // $3
      defuddle_metadata,     // $4
      currentTimestamp        // $5
    ];

    console.log(`[DB VisitedPages] Inserting new page_version for URL: ${url}`);
    await db.query(insertVersionSql, versionParams);
    console.log(`[DB VisitedPages] Successfully inserted new page_version for URL: ${url}`);

  } catch (error: any) {
    console.error('[DB VisitedPages] Error in recordPageVisitVersion:', error);
    console.error('[DB VisitedPages] Failed URL:', url); 
    throw error; 
  } 
}

// --- Embedding Update Logic (Steps 2, 3, 4 below) ---

/** Interface for updating embedding data */
interface EmbeddingUpdateData {
    version_id: number; // Target the specific version
    embeddingInfo: EmbeddingResult; 
}

/**
 * Updates an existing page version record with embedding information.
 * @param data Object containing version_id and embeddingInfo.
 */
export async function finalizePageVersionEmbedding(data: EmbeddingUpdateData): Promise<void> {
    const { version_id, embeddingInfo } = data;
    console.log(`[DB VisitedPages] finalizeEmbedding for version_id: ${version_id}`);

    if (!version_id || !embeddingInfo) {
        console.error('[DB VisitedPages] version_id and embeddingInfo are required for finalizeEmbedding.');
        throw new Error('version_id and embeddingInfo are required.');
    }

    let db: PGlite | null = null;
    try {
        db = await getDbInstance();
        console.log('[DB VisitedPages] Got DB instance for finalizeEmbedding.');

        let embeddingCol: string;
        // Explicitly convert embedding array to PostgreSQL array string format
        let embeddingVal: string | null = embeddingInfo.embedding 
            ? `[${embeddingInfo.embedding.join(',')}]`
            : null;
        const dimension = embeddingInfo.dimension;

        switch(dimension) {
            case 384: embeddingCol = 'embedding_384'; break;
            case 512: embeddingCol = 'embedding_512'; break;
            case 768: embeddingCol = 'embedding_768'; break;
            case 1024: embeddingCol = 'embedding_1024'; break;
            default:
                console.warn(`[DB VisitedPages] Unsupported dimension ${dimension} for finalizeEmbedding. Aborting.`);
                throw new Error(`Unsupported embedding dimension: ${dimension}`);
        }
        
        // Use explicit parameters to avoid SQL injection risks with column names
        const sql = `
            UPDATE page_versions
            SET 
                ${embeddingCol} = $1::vector, -- Explicit cast to vector type
                active_embedding_dimension = $2,
                last_embedded_at = CURRENT_TIMESTAMP 
            WHERE version_id = $3;
        `;

        const params = [
            embeddingVal,    // $1 - The vector string '[...]', needs cast
            dimension,       // $2 - The active dimension
            version_id       // $3 - The target version ID
        ];

        console.log(`[DB VisitedPages] Executing UPDATE Embedding (Dim: ${dimension}) for version_id: ${version_id}`);
        await db.query(sql, params);
        console.log(`[DB VisitedPages] Successfully updated embedding for version_id: ${version_id}`);

    } catch (error: any) {
        console.error('[DB VisitedPages] Error in finalizePageVersionEmbedding:', error);
        console.error('[DB VisitedPages] Failed version_id:', version_id);
        throw error;
    }
}

/**
 * Deletes a specific page version.
 * @param version_id The ID of the page version to delete.
 */
export async function deletePageVersion(version_id: number): Promise<void> {
    console.log(`[DB VisitedPages] deletePageVersion for version_id: ${version_id}`);
    if (!version_id) {
        console.error('[DB VisitedPages] version_id is required for deletion.');
        throw new Error('version_id is required.');
    }
    let db: PGlite | null = null;
    try {
        db = await getDbInstance();
        const sql = `DELETE FROM page_versions WHERE version_id = $1;`;
        await db.query(sql, [version_id]);
        console.log(`[DB VisitedPages] Successfully deleted page_version: ${version_id}`);
    } catch (error: any) {
        console.error('[DB VisitedPages] Error deleting page_version:', error);
        throw error;
    }
}

/**
 * Increments the visit count for a specific page version.
 * @param version_id The ID of the page version to update.
 */
export async function incrementPageVersionVisitCount(version_id: number): Promise<void> {
    console.log(`[DB VisitedPages] incrementVisitCount for version_id: ${version_id}`);
     if (!version_id) {
        console.error('[DB VisitedPages] version_id is required for incrementing count.');
        throw new Error('version_id is required.');
    }
    let db: PGlite | null = null;
    try {
        db = await getDbInstance();
        const sql = `
            UPDATE page_versions 
            SET visit_count = visit_count + 1 
            WHERE version_id = $1;
        `;
        await db.query(sql, [version_id]);
        console.log(`[DB VisitedPages] Successfully incremented visit count for page_version: ${version_id}`);
    } catch (error: any) {
        console.error('[DB VisitedPages] Error incrementing visit count:', error);
        throw error;
    }
}

/**
 * Updates a page version with its summary and hash, and nullifies the original markdown.
 * @param data Object containing version_id, summary_content, and summary_hash.
 */
export async function updatePageVersionSummaryAndCleanup(data: PageVersionSummaryUpdate): Promise<void> {
    const { version_id, summary_content, summary_hash } = data;
    console.log(`[DB VisitedPages] updateSummaryAndCleanup for version_id: ${version_id}`);
    if (!version_id || !summary_content || !summary_hash) {
        console.error('[DB VisitedPages] Missing required data for updateSummaryAndCleanup.');
        throw new Error('Missing data for summary update.');
    }
    let db: PGlite | null = null;
    try {
        db = await getDbInstance();
        const sql = `
            UPDATE page_versions
            SET 
                summary_content = $1,
                summary_hash = $2,
                markdown_content = NULL -- Clean up original markdown
            WHERE version_id = $3;
        `;
        await db.query(sql, [summary_content, summary_hash, version_id]);
        console.log(`[DB VisitedPages] Successfully updated summary and cleaned markdown for version_id: ${version_id}`);
    } catch (error: any) {
        console.error('[DB VisitedPages] Error in updatePageVersionSummaryAndCleanup:', error);
        throw error;
    }
}

/**
 * Retrieves the specific summary embedding vector for a given version ID.
 * @param version_id The ID of the page version.
 * @returns A promise resolving to the embedding vector array, or null if not found/error.
 */
export async function getSummaryEmbeddingForVersion(version_id: number): Promise<number[] | null> {
    console.log(`[DB VisitedPages] getSummaryEmbeddingForVersion for version_id: ${version_id}`);
    if (!version_id) return null;
    let db: PGlite | null = null;
    try {
        db = await getDbInstance();
        // First, get the active dimension for this version
        const dimResult = await db.query<{ active_embedding_dimension: number | null }>
            ('SELECT active_embedding_dimension FROM page_versions WHERE version_id = $1', [version_id]);
        
        const dimension = dimResult.rows[0]?.active_embedding_dimension;
        if (!dimension) {
            console.warn(`[DB VisitedPages] No active embedding dimension found for version_id: ${version_id}`);
            return null;
        }

        // Determine the correct embedding column
        let embeddingCol: string;
        switch(dimension) {
            case 384: embeddingCol = 'embedding_384'; break;
            case 512: embeddingCol = 'embedding_512'; break;
            case 768: embeddingCol = 'embedding_768'; break;
            case 1024: embeddingCol = 'embedding_1024'; break;
            default: 
                console.error(`[DB VisitedPages] Invalid active_embedding_dimension ${dimension} for version ${version_id}`);
                return null;
        }

        // Fetch the actual embedding vector
        const fetchEmbeddingSql = `SELECT ${embeddingCol} FROM page_versions WHERE version_id = $1;`;
        const embeddingResult = await db.query<{ [key: string]: string | null }>(fetchEmbeddingSql, [version_id]);
        const vectorString = embeddingResult.rows[0]?.[embeddingCol];

        if (!vectorString) {
            console.error(`[DB VisitedPages] Could not fetch embedding vector for version ${version_id} from column ${embeddingCol}`);
            return null;
        }
        
        // Parse the string representation '[1,2,3]' into number[]
        try {
            const embeddingVector = JSON.parse(vectorString);
            if (!Array.isArray(embeddingVector) || !embeddingVector.every(n => typeof n === 'number')){
                throw new Error('Parsed result is not a number array');
            }
            return embeddingVector;
        } catch (parseError) {
             console.error(`[DB VisitedPages] Error parsing embedding vector string for version ${version_id}:`, parseError);
             console.error(`[DB VisitedPages] Raw vector string: ${vectorString}`);
             return null; // Failed to parse
        }

    } catch (error: any) {
        console.error('[DB VisitedPages] Error in getSummaryEmbeddingForVersion:', error);
        throw error;
    }
}

// --- Query Functions (Steps 5, 6, 7 below) ---

/** Represents a row from page_versions needing embedding */
export interface PageVersionToEmbed {
    version_id: number;
    url: string;
    markdown_content: string;
    markdown_hash: string | null; // Include hash
    description?: string | null; // Defuddle-provided description
}

/** Represents the latest embedded version found for a URL */
export interface LatestEmbeddedVersion {
    version_id: number;
    url: string;
    markdown_hash: string | null; // Hash of original markdown
    summary_hash: string | null; // Hash of the summary
    embedding_model_id?: string | null; // Ensure this is present
    active_embedding_dimension?: number | null; // Add this field
    embedding_512?: number[];
    embedding_384?: number[]; // Added support for MiniLM-L6-v2
    embedding_768?: number[];
    embedding_1024?: number[];
}

/**
 * Finds the most recently successfully embedded version of a page, including its summary hash and specific embedding vectors.
 * @param url The URL of the page to search for.
 * @returns A Promise resolving to the latest embedded version data or null if not found.
 */
export async function findLatestEmbeddedVersion(url: string): Promise<LatestEmbeddedVersion | null> {
    console.log(`[DB VisitedPages] findLatestEmbeddedVersion for URL: ${url}`);
    if (!url) {
        console.error('[DB VisitedPages] URL is required for findLatestEmbeddedVersion.');
        return null;
    }

    let db: PGlite | null = null;
    try {
        db = await getDbInstance();
        // Corrected SQL: Removed active_embedding_dimension, select specific embedding columns.
        // The schema stores embeddings in dimension-specific columns (embedding_512, embedding_768, embedding_1024).
        // We also need embedding_model_id to know which model was used.
        // According to user-provided schema, active_embedding_dimension should also be selected.
        const sql = `
            SELECT 
                version_id,
                url,
                markdown_hash,
                summary_hash,
                embedding_model_id,
                active_embedding_dimension, -- Added this column
                embedding_512,
                embedding_384, -- Added support for MiniLM-L6-v2
                embedding_768,
                embedding_1024
            FROM page_versions
            WHERE url = $1 AND last_embedded_at IS NOT NULL
            ORDER BY last_embedded_at DESC
            LIMIT 1;
        `;
        // console.log(`[DB VisitedPages] Executing findLatestEmbeddedVersion SQL: ${sql} with URL: ${url}`);
        const result = await db.query<LatestEmbeddedVersion>(sql, [url]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log('[DB VisitedPages] Found latest embedded version:', row);
            // The row directly matches LatestEmbeddedVersion if types are aligned (pgLite might return strings for arrays)
            // We might need to parse stringified arrays if that's how pgLite returns them.
            // For now, assume direct compatibility or that higher layers handle parsing if necessary.
            return row;
        }
        console.log('[DB VisitedPages] No successfully embedded version found for URL:', url);
        return null;
    } catch (error: any) {
        console.error('[DB VisitedPages] Error in findLatestEmbeddedVersion:', error);
        throw error; // Re-throw to allow caller to handle
    }
}

/**
 * Retrieves page versions that need embedding.
 * @param limit Optional limit on the number of versions to fetch.
 * @returns A promise resolving to an array of PageVersionToEmbed objects.
 */
export async function getPagesNeedingEmbedding(limit: number = 50): Promise<PageVersionToEmbed[]> {
    console.log(`[DB VisitedPages] Fetching page versions needing embedding (limit: ${limit})...`);
    let db: PGlite | null = null;
    try {
        db = await getDbInstance();
        const sql = `
            SELECT
                version_id,
                url,
                markdown_content,
                markdown_hash,
                defuddle_metadata->>'description' AS description
            FROM page_versions 
            WHERE last_embedded_at IS NULL 
            ORDER BY captured_at ASC -- Process oldest unembedded first?
            LIMIT $1;
        `;
        const results = await db.query<PageVersionToEmbed>(sql, [limit]);
        console.log(`[DB VisitedPages] Found ${results.rows.length} page versions needing embedding.`);
        return results.rows;
    } catch (error: any) {
        console.error('[DB VisitedPages] Error fetching page versions needing embedding:', error);
        throw error; 
    }
}

/**
 * Counts the number of page versions that need embedding.
 * @returns A promise resolving to the count.
 */
export async function countPagesNeedingEmbedding(): Promise<number> {
    console.log(`[DB VisitedPages] Counting page versions needing embedding...`);
    let db: PGlite | null = null;
    try {
        db = await getDbInstance();
        const sql = `
            SELECT COUNT(*) as count
            FROM page_versions 
            WHERE last_embedded_at IS NULL;
        `;
        const results = await db.query<{ count: string }>(sql);
        const count = parseInt(results.rows[0]?.count || '0', 10);
        console.log(`[DB VisitedPages] Found ${count} page versions needing embedding.`);
        return count;
    } catch (error: any) {
        console.error('[DB VisitedPages] Error counting page versions needing embedding:', error);
        throw error; 
    }
}

// --- NEW FUNCTION for fetching recent visited pages for context ---
export async function getRecentVisitedPages(limit: number = 5): Promise<{ title: string | null, url: string }[]> {
  console.log(`[DB VisitedPages] Fetching ${limit} recent visited pages.`);
  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    const query = `
      SELECT url, title
      FROM pages
      ORDER BY last_visited_at DESC
      LIMIT $1;
    `;
    const results = await db.query(query, [limit]);
    // Ensure rows are mapped correctly, title can be null
    return results.rows.map((row: any) => ({
      url: row.url as string,
      title: row.title as string | null
    }));
  } catch (error: any) {
    console.error('[DB VisitedPages] Error fetching recent visited pages:', error);
    return []; // Return empty array on error
  }
}

/**
 * Fetches the top N most visited pages based on the sum of visit_counts from page_versions.
 * @param limit The maximum number of top visited pages to return.
 * @returns A promise that resolves to an array of page objects with title and URL.
 */
export async function getTopVisitedPages(limit: number = 8): Promise<{ title: string | null, url: string }[]> {
  console.log(`[DB VisitedPages] Fetching top ${limit} visited pages by sum of version visit counts.`);
  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    // Ensure pv.visit_count is used here.
    const query = `
      SELECT p.url, p.title, SUM(pv.visit_count) AS total_visits
      FROM page_versions pv
      JOIN pages p ON pv.url = p.url
      GROUP BY p.url, p.title
      ORDER BY total_visits DESC
      LIMIT $1;
    `;
    const result = await db.query<{ url: string; title: string | null; total_visits: number }>(query, [limit]);
    
    if (result.rows.length === 0) {
      console.log('[DB VisitedPages] No top visited pages found.');
      return [];
    }
    
    console.log(`[DB VisitedPages] Found ${result.rows.length} top visited pages. Details:`);
    result.rows.forEach(row => {
      console.log(`  - URL: ${row.url}, Title: ${row.title || 'N/A'}, Total Visits: ${row.total_visits}`);
    });

    return result.rows.map(row => ({
      url: row.url,
      title: row.title
    }));

  } catch (error: any) {
    console.error('[DB VisitedPages] Error fetching top visited pages:', error);
    // It's often good to re-throw or return an empty array/error indicator
    // For now, returning empty on error to prevent cascading failures in context building.
    return []; 
  }
}
// --- END NEW FUNCTION --- 