import { getDbInstance } from './init';
import type { Tag } from './types';

console.log('[DB Tags] Service loaded.');

/**
 * Retrieves all tags from the database.
 */
export async function getAllTags(): Promise<Tag[]> {
  console.log('[DB Tags] Fetching all tags...');
  try {
  const db = await getDbInstance();
    const result = await db.query<Tag>('SELECT tag_id, tag_name FROM tags ORDER BY tag_name;');
    console.log(`[DB Tags] Found ${result.rows.length} tags.`);
    return result.rows || [];
  } catch (error) {
    console.error('[DB Tags] Error fetching tags:', error);
    return []; // Return empty array on error
  }
}

// TODO: Add findOrCreateTag function here later for use by addOrUpdateBookmark 