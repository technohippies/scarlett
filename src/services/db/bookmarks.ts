import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';

console.log('[DB Bookmarks Service] Loaded.');

export interface BookmarkForContext {
  title: string | null;
  url: string;
  // selected_text?: string | null; // Optionally include later if useful for context
}

export async function getRecentBookmarks(limit: number = 3): Promise<BookmarkForContext[]> {
  console.log(`[DB Bookmarks] Fetching ${limit} recent bookmarks.`);
  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    const query = `
      SELECT url, title
      FROM bookmarks
      ORDER BY saved_at DESC
      LIMIT $1;
    `;
    const results = await db.query(query, [limit]);
    return results.rows.map((row: any) => ({
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