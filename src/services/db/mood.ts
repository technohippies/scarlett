import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';

// Type for moods, ensure this matches MoodSelector.tsx if not already shared
export type Mood = 'happy' | 'slightly-happy' | 'neutral' | 'slightly-frowning' | 'sad';

console.log('[DB Mood] Service loaded.');

/**
 * Adds a mood entry to the database.
 * @param mood The selected mood.
 * @param entryDate The date of the entry in 'YYYY-MM-DD' format.
 */
export async function addMoodEntry(mood: Mood, entryDate: string): Promise<void> {
  console.log(`[DB Mood] Adding mood entry: ${mood} for date: ${entryDate}`);
  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    if (!db) {
      console.error('[DB Mood] Failed to get DB instance for addMoodEntry.');
      throw new Error('Database instance not available.');
    }

    const sql = `
      INSERT INTO mood_entries (mood, entry_date)
      VALUES ($1, $2);
    `;
    await db.query(sql, [mood, entryDate]);
    console.log(`[DB Mood] Successfully added mood entry: ${mood} for ${entryDate}`);
  } catch (error: any) {
    console.error('[DB Mood] Error adding mood entry:', error);
    // Re-throw the error so the caller can handle it (e.g., UI feedback)
    throw error;
  }
}

// Potential future function: Get mood for a specific date
/*
export async function getMoodForDate(entryDate: string): Promise<Mood | null> {
  console.log(`[DB Mood] Fetching mood for date: ${entryDate}`);
  let db: PGlite | null = null;
  try {
    db = await getDbInstance();
    if (!db) {
      console.error('[DB Mood] Failed to get DB instance for getMoodForDate.');
      return null;
    }
    const result = await db.query<{ mood: Mood }>(`SELECT mood FROM mood_entries WHERE entry_date = $1 ORDER BY timestamp DESC LIMIT 1;`, [entryDate]);
    if (result && result.rows && result.rows.length > 0) {
      return result.rows[0].mood;
    }
    return null;
  } catch (error) {
    console.error(`[DB Mood] Error fetching mood for date ${entryDate}:`, error);
    return null;
  }
}
*/

export interface MoodEntryForContext {
  mood: string;
}

/**
 * Fetches the mood entry for the current day.
 * @returns The mood string (e.g., 'happy') or null if no entry for today.
 */
export async function getTodaysMoodForContext(): Promise<string | null> {
  console.log('[DB Mood DEBUG] Entered getTodaysMoodForContext function.');
  const db = await getDbInstance();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  console.log(`[DB Mood] Fetching mood for today: ${today}`);

  try {
    const result = await db.query<{ mood: string }>(
      'SELECT mood FROM mood_entries WHERE entry_date = $1 ORDER BY timestamp DESC LIMIT 1',
      [today]
    );

    if (result.rows.length > 0) {
      console.log(`[DB Mood] Found mood for today: ${result.rows[0].mood}`);
      return result.rows[0].mood;
    } else {
      console.log('[DB Mood] No mood entry found for today.');
      return null;
    }
  } catch (error) {
    console.error('[DB Mood] Error fetching today\'s mood:', error);
    return null;
  }
} 