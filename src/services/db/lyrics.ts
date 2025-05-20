import { getDbInstance } from './init';
// import type { LyricsInfo } from '../../shared/messaging-types'; // Removed unused import
// import type { PGlite } from '@electric-sql/pglite'; // Removed unused import

// const TABLE_NAME = 'lyrics_cache'; // Removed unused variable

/**
 * Represents the structure of a song lyrics record in the database.
 * This is similar to LyricsInfo but specific to DB schema.
 */
export interface SongLyricsRecord {
  id?: number; // Auto-incremented by DB
  lrclib_id: number | null; // Can be null if not found on lrclib or instrumental
  track_name: string;
  artist_name: string;
  album_name: string | null;
  duration: number | null;
  instrumental: boolean;
  plain_lyrics: string | null;
  synced_lyrics: string | null; // Storing as JSON string or TEXT
  has_synced_lyrics: boolean;
  created_at?: string; // Handled by DB
  updated_at?: string; // Handled by DB
}

/**
 * Saves song lyrics information to the database.
 * It will try to update if a record with the same lrclib_id exists, otherwise inserts a new record.
 * If lrclib_id is null (e.g., for instrumental tracks not found via API, or if API doesn't return one),
 * it will try to find a match based on track_name and artist_name to avoid duplicates.
 *
 * @param lyricsData - The lyrics information to save.
 * @returns The ID of the inserted or updated record.
 */
export async function saveLyrics(lyricsData: Omit<SongLyricsRecord, 'id' | 'created_at' | 'updated_at'>): Promise<number | undefined> {
  const db = await getDbInstance();
  if (!db) {
    console.error('[DB Lyrics] Database instance not available.');
    return undefined;
  }

  console.log('[DB Lyrics] Attempting to save lyrics for:', lyricsData.track_name, 'by', lyricsData.artist_name);

  try {
    let existingRecord: SongLyricsRecord | undefined;

    if (lyricsData.lrclib_id !== null && lyricsData.lrclib_id !== undefined) {
      const result = await db.query<SongLyricsRecord>(
        'SELECT * FROM song_lyrics WHERE lrclib_id = $1',
        [lyricsData.lrclib_id]
      );
      existingRecord = result.rows?.[0];
    }

    if (!existingRecord) {
      const result = await db.query<SongLyricsRecord>(
        'SELECT * FROM song_lyrics WHERE track_name = $1 AND artist_name = $2',
        [lyricsData.track_name, lyricsData.artist_name]
      );
      existingRecord = result.rows?.[0];
    }

    if (existingRecord?.id) {
      console.log('[DB Lyrics] Updating existing lyrics record ID:', existingRecord.id);
      // PGlite's query for UPDATE doesn't typically return the ID directly in the same way as some other libraries' lastID.
      // We assume success if no error is thrown.
      await db.query(
        `UPDATE song_lyrics SET
          lrclib_id = $1,
          track_name = $2,
          artist_name = $3,
          album_name = $4,
          duration = $5,
          instrumental = $6,
          plain_lyrics = $7,
          synced_lyrics = $8,
          has_synced_lyrics = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $10`,
        [
          lyricsData.lrclib_id ?? existingRecord.lrclib_id,
          lyricsData.track_name,
          lyricsData.artist_name,
          lyricsData.album_name ?? existingRecord.album_name,
          lyricsData.duration ?? existingRecord.duration,
          lyricsData.instrumental,
          lyricsData.plain_lyrics ?? existingRecord.plain_lyrics,
          lyricsData.synced_lyrics ?? existingRecord.synced_lyrics,
          lyricsData.has_synced_lyrics,
          existingRecord.id
        ]
      );
      return existingRecord.id; // Return the known existing ID
    } else {
      console.log('[DB Lyrics] Inserting new lyrics record.');
      // For PGlite, to get the inserted ID, you might need to use RETURNING id or a subsequent query if not directly supported.
      // For simplicity, we'll execute the insert. If an ID is crucial, further adaptation for PGlite might be needed.
      const insertResult = await db.query<{ id: number }>(
        `INSERT INTO song_lyrics (
          lrclib_id, track_name, artist_name, album_name, duration,
          instrumental, plain_lyrics, synced_lyrics, has_synced_lyrics
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          lyricsData.lrclib_id,
          lyricsData.track_name,
          lyricsData.artist_name,
          lyricsData.album_name,
          lyricsData.duration,
          lyricsData.instrumental,
          lyricsData.plain_lyrics,
          lyricsData.synced_lyrics,
          lyricsData.has_synced_lyrics
        ]
      );
      return insertResult.rows?.[0]?.id;
    }
  } catch (error) {
    console.error('[DB Lyrics] Error saving lyrics:', error);
    return undefined;
  }
}

/**
 * Retrieves lyrics information by track name and artist name.
 *
 * @param trackName - The name of the track.
 * @param artistName - The name of the artist.
 * @returns The lyrics record if found, otherwise undefined.
 */
export async function getLyricsByTrackAndArtist(trackName: string, artistName: string): Promise<SongLyricsRecord | undefined> {
  const db = await getDbInstance();
  if (!db) return undefined;

  try {
    const result = await db.query<SongLyricsRecord>(
      'SELECT * FROM song_lyrics WHERE track_name = $1 AND artist_name = $2',
      [trackName, artistName]
    );
    return result.rows?.[0];
  } catch (error) {
    console.error('[DB Lyrics] Error fetching lyrics by track and artist:', error);
    return undefined;
  }
}

/**
 * Retrieves lyrics information by lrclib_id.
 *
 * @param lrclibId - The lrclib.net ID of the song.
 * @returns The lyrics record if found, otherwise undefined.
 */
export async function getLyricsByLrclibId(lrclibId: number): Promise<SongLyricsRecord | undefined> {
  const db = await getDbInstance();
  if (!db) return undefined;

  try {
    const result = await db.query<SongLyricsRecord>(
      'SELECT * FROM song_lyrics WHERE lrclib_id = $1',
      [lrclibId]
    );
    return result.rows?.[0];
  } catch (error) {
    console.error('[DB Lyrics] Error fetching lyrics by lrclib_id:', error);
    return undefined;
  }
} 