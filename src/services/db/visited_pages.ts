import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';
import type { EmbeddingResult } from '../llm/embedding'; // Import the result type

console.log('[DB VisitedPages Service] Loaded.');

// --- Helper function to calculate SHA-256 hash --- 
async function calculateHash(text: string): Promise<string> {
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

// Interface for initial page data
interface PageVisitData {
  url: string;
  title?: string | null;
  markdown_content?: string | null;
}

/**
 * Records a new version of a visited page.
 * Ensures the main page record exists and inserts a new version snapshot.
 */
export async function recordPageVisitVersion(data: PageVisitData): Promise<void> {
  const { url, title, markdown_content } = data;
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

    // 3. Insert new version into page_versions
    const insertVersionSql = `
      INSERT INTO page_versions (
          url, markdown_content, markdown_hash, captured_at, 
          embedding_512, embedding_768, embedding_1024, 
          active_embedding_dimension, last_embedded_at, visit_count
      )
      VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, NULL, 1);
    `;
    const versionParams = [
      url,              // $1
      markdown_content, // $2
      markdownHash,     // $3
      currentTimestamp  // $4
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

// --- Query Functions (Steps 5, 6, 7 below) ---

/** Represents a row from page_versions needing embedding */
export interface PageVersionToEmbed {
    version_id: number;
    url: string;
    markdown_content: string;
    markdown_hash: string | null; // Include hash
}

/** Represents the latest embedded version found for a URL */
export interface LatestEmbeddedVersion {
    version_id: number;
    url: string;
    markdown_hash: string | null;
    active_embedding_dimension: number;
    // Embedding value needs to be fetched based on dimension
    embedding_512?: number[];
    embedding_768?: number[];
    embedding_1024?: number[];
}

/**
 * Finds the most recent successfully embedded version for a given URL.
 * Also retrieves the specific embedding vector based on the active dimension.
 * @param url The URL to search for.
 * @returns A promise resolving to the latest embedded version data, or null if none found.
 */
export async function findLatestEmbeddedVersion(url: string): Promise<LatestEmbeddedVersion | null> {
    console.log(`[DB VisitedPages] findLatestEmbeddedVersion for URL: ${url}`);
    if (!url) return null;
    let db: PGlite | null = null;
    try {
        db = await getDbInstance();
        // Find the latest embedded version_id and its dimension
        const findLatestSql = `
            SELECT version_id, markdown_hash, active_embedding_dimension
            FROM page_versions
            WHERE url = $1 AND last_embedded_at IS NOT NULL
            ORDER BY last_embedded_at DESC
            LIMIT 1;
        `;
        const latestResult = await db.query<{ 
            version_id: number; 
            markdown_hash: string | null; 
            active_embedding_dimension: number 
        }>(findLatestSql, [url]);

        if (latestResult.rows.length === 0) {
            console.log(`[DB VisitedPages] No previously embedded version found for URL: ${url}`);
            return null;
        }

        const latestInfo = latestResult.rows[0];
        const { version_id, markdown_hash, active_embedding_dimension } = latestInfo;
        console.log(`[DB VisitedPages] Found latest embedded version_id: ${version_id}, dimension: ${active_embedding_dimension}`);

        // Determine the correct embedding column to select
        let embeddingCol: string;
        switch(active_embedding_dimension) {
            case 512: embeddingCol = 'embedding_512'; break;
            case 768: embeddingCol = 'embedding_768'; break;
            case 1024: embeddingCol = 'embedding_1024'; break;
            default: 
                console.error(`[DB VisitedPages] Invalid active_embedding_dimension ${active_embedding_dimension} found for version ${version_id}`);
                return null; // Or throw?
        }

        // Fetch the actual embedding vector for that version
        const fetchEmbeddingSql = `SELECT ${embeddingCol} FROM page_versions WHERE version_id = $1;`;
        // PGlite returns vectors as strings '[1,2,3]', need to parse
        const embeddingResult = await db.query<{ [key: string]: string }>(fetchEmbeddingSql, [version_id]); 

        if (!embeddingResult.rows[0] || !embeddingResult.rows[0][embeddingCol]) {
            console.error(`[DB VisitedPages] Could not fetch embedding vector for version ${version_id} from column ${embeddingCol}`);
            return null; // Embedding column was empty?
        }
        
        // Parse the string representation '[1,2,3]' into number[]
        let embeddingVector: number[] = [];
        try {
            const vectorString = embeddingResult.rows[0][embeddingCol];
            embeddingVector = JSON.parse(vectorString);
            if (!Array.isArray(embeddingVector) || !embeddingVector.every(n => typeof n === 'number')){
                throw new Error('Parsed result is not a number array');
            }
        } catch (parseError) {
             console.error(`[DB VisitedPages] Error parsing embedding vector string for version ${version_id}:`, parseError);
             console.error(`[DB VisitedPages] Raw vector string: ${embeddingResult.rows[0][embeddingCol]}`);
             return null; // Failed to parse
        }
        
        // Construct the result object
        const result: LatestEmbeddedVersion = {
            version_id,
            url,
            markdown_hash,
            active_embedding_dimension
        };

        // Assign the vector to the correct property based on dimension
        if (active_embedding_dimension === 512) {
            result.embedding_512 = embeddingVector;
        } else if (active_embedding_dimension === 768) {
            result.embedding_768 = embeddingVector;
        } else if (active_embedding_dimension === 1024) {
            result.embedding_1024 = embeddingVector;
        }
        
        console.log(`[DB VisitedPages] Successfully retrieved latest embedded version and vector for URL: ${url}`);
        return result;

    } catch (error: any) {
        console.error('[DB VisitedPages] Error in findLatestEmbeddedVersion:', error);
        throw error;
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
            SELECT version_id, url, markdown_content, markdown_hash
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