import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';

export interface SongPlayCount {
  track_name: string;
  artist_name: string;
  play_count: number;
}

/**
 * Records a song play event in the listening_history table.
 */
export async function recordSongPlay(data: { track_name: string; artist_name: string; album_name?: string | null; }) {
  const db = await getDbInstance();
  if (!db) return;
  try {
    await db.query(
      `INSERT INTO listening_history (track_name, artist_name, album_name) VALUES ($1, $2, $3);`,
      [data.track_name, data.artist_name, data.album_name || null]
    );
    console.log(`[DB Music] Recorded play for "${data.track_name}" by "${data.artist_name}"`);
  } catch (e) {
    console.warn('[DB Music] Error recording song play:', e);
  }
}

/**
 * Retrieves top played songs for today that meet or exceed a minimum play count.
 */
export async function getTopPlayedSongs(limit: number, minCount: number): Promise<SongPlayCount[]> {
  const db = await getDbInstance();
  if (!db) return [];
  const sql = `
    SELECT track_name, artist_name, COUNT(*) as play_count
    FROM listening_history
    WHERE listened_at >= date_trunc('day', CURRENT_TIMESTAMP)
    GROUP BY track_name, artist_name
    HAVING COUNT(*) >= $1
    ORDER BY play_count DESC
    LIMIT $2;
  `;
  try {
    const result = await db.query<{ track_name: string; artist_name: string; play_count: string }>(sql, [minCount, limit]);
    return result.rows.map(r => ({ track_name: r.track_name, artist_name: r.artist_name, play_count: Number(r.play_count) }));
  } catch (e) {
    console.warn('[DB Music] Error fetching top played songs:', e);
    return [];
  }
}

/**
 * Retrieves the most recent played songs, regardless of count.
 */
export async function getRecentPlayedSongs(limit: number): Promise<{ track_name: string; artist_name: string; }[]> {
  const db = await getDbInstance();
  if (!db) return [];
  const sql = `
    SELECT track_name, artist_name
    FROM listening_history
    ORDER BY listened_at DESC
    LIMIT $1;
  `;
  try {
    const result = await db.query<{ track_name: string; artist_name: string }>(sql, [limit]);
    return result.rows;
  } catch (e) {
    console.warn('[DB Music] Error fetching recent played songs:', e);
    return [];
  }
} 