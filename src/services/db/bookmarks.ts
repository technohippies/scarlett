import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';

console.log('[DB Bookmarks Service] Loaded.');

export interface BookmarkForContext {
  title: string | null;
  url: string;
  // selected_text?: string | null; // Optionally include later if useful for context
}

export async function getRecentBookmarks(limit: number = 3): Promise<BookmarkForContext[]> {
  console.log(`[DB Bookmarks] Fetching recent bookmarks (TEMPORARILY NO LIMIT).`);
  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    const query = `
      SELECT url, title
      FROM bookmarks
      ORDER BY saved_at DESC;
    `;
    console.log("[DB Bookmarks DEBUG] About to execute query (NO LIMIT):"); // LOG BEFORE QUERY
    const results = await db.query(query);
    console.log('[DB Bookmarks DEBUG] Raw results object from query (NO LIMIT):', JSON.stringify(results, null, 2)); // LOG RAW RESULTS
    console.log('[DB Bookmarks DEBUG] Raw results.rows from query (NO LIMIT):', JSON.stringify(results.rows, null, 2));
    
    const limitedRows = results.rows.slice(0, limit);

    return limitedRows.map((row: any) => ({
      url: row.url as string,
      title: row.title as string | null,
    }));
  } catch (error: any) {
    console.error('[DB Bookmarks] Error fetching recent bookmarks:', error);
    return []; // Return empty array on error
  }
}

// You can add other bookmark-related DB functions here in the future, e.g.:
// export async function addBookmark(url: string, title: string | null, selected_text: string | null, tags: string | null) { ... }
// export async function getAllBookmarks() { ... }
// export async function deleteBookmark(id: number) { ... }
// etc. 