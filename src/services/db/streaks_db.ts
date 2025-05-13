import { getDbInstance } from './init';
import type { PGlite } from '@electric-sql/pglite';

export interface StudyStreakData {
  currentStreak: number;
  longestStreak: number;
  lastStreakIncrementDate: string | null; // YYYY-MM-DD
  lastActivityDate: string | null; // YYYY-MM-DD
}

// For DB row representation
interface DbStudyStreakRow {
  current_streak: number;
  longest_streak: number;
  last_streak_increment_date: string | null;
  last_activity_date: string | null;
}

const DEFAULT_STREAK_DATA: StudyStreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastStreakIncrementDate: null,
  lastActivityDate: null,
};

/**
 * Fetches the current study streak data from the database.
 * Returns default data if no record is found (should not happen due to schema init).
 * @returns {Promise<StudyStreakData>} The user's study streak data.
 */
export async function getStudyStreakData(): Promise<StudyStreakData> {
  const db = await getDbInstance();
  try {
    const result = await db.query<
      DbStudyStreakRow
    >('SELECT current_streak, longest_streak, last_streak_increment_date, last_activity_date FROM study_streak WHERE id = 1;');
    
    if (result && result.rows && result.rows.length > 0) {
      const data = result.rows[0];
      return {
        currentStreak: data.current_streak,
        longestStreak: data.longest_streak,
        lastStreakIncrementDate: data.last_streak_increment_date,
        lastActivityDate: data.last_activity_date,
      };
    }
    console.warn('[DB Streaks] No study_streak row found, returning default. Schema init might have failed.');
    return { ...DEFAULT_STREAK_DATA }; // Should be unreachable if schema init is correct
  } catch (error) {
    console.error('[DB Streaks] Error fetching study streak data:', error);
    return { ...DEFAULT_STREAK_DATA }; // Return default on error
  }
}

/**
 * Updates the study streak data in the database.
 * @param {Partial<StudyStreakData>} dataToUpdate - An object containing fields to update.
 * @returns {Promise<boolean>} True if update was successful, false otherwise.
 */
export async function updateStudyStreakData(dataToUpdate: Partial<StudyStreakData>): Promise<boolean> {
  const db = await getDbInstance();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let placeholderIndex = 1;

  if (dataToUpdate.currentStreak !== undefined) {
    fields.push(`current_streak = $${placeholderIndex++}`);
    values.push(dataToUpdate.currentStreak);
  }
  if (dataToUpdate.longestStreak !== undefined) {
    fields.push(`longest_streak = $${placeholderIndex++}`);
    values.push(dataToUpdate.longestStreak);
  }
  if (dataToUpdate.lastStreakIncrementDate !== undefined) {
    fields.push(`last_streak_increment_date = $${placeholderIndex++}`);
    values.push(dataToUpdate.lastStreakIncrementDate);
  }
  if (dataToUpdate.lastActivityDate !== undefined) {
    fields.push(`last_activity_date = $${placeholderIndex++}`);
    values.push(dataToUpdate.lastActivityDate);
  }

  if (fields.length === 0) {
    console.warn('[DB Streaks] updateStudyStreakData called with no fields to update.');
    return false;
  }

  const query = `UPDATE study_streak SET ${fields.join(', ')} WHERE id = 1;`;

  try {
    await db.query(query, values);
    console.log('[DB Streaks] Study streak data updated:', dataToUpdate);
    return true;
  } catch (error) {
    console.error('[DB Streaks] Error updating study streak data:', error, 'Query:', query, 'Values:', values);
    return false;
  }
}

/**
 * Helper to get yesterday's date string in YYYY-MM-DD format.
 * @param {string} todayStr - Today's date in YYYY-MM-DD format.
 * @returns {string} Yesterday's date string.
 */
function getYesterdayStr(todayStr: string): string {
  const todayDate = new Date(todayStr);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(todayDate.getDate() - 1);
  return yesterdayDate.toISOString().split('T')[0];
}

/**
 * Checks if the streak needs to be reset due to inactivity on the previous day.
 * This should be called once daily, typically when initializing daily stats.
 * @returns {Promise<void>}
 */
export async function checkAndResetStreakIfNeeded(): Promise<void> {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = getYesterdayStr(todayStr);
  const streakData = await getStudyStreakData();

  // lastActivityDate tracks *any* new item studied, even if goal wasn't met.
  // lastStreakIncrementDate tracks when the goal *was* met.

  // If the last recorded activity was before yesterday, the streak is broken.
  if (streakData.lastActivityDate && streakData.lastActivityDate < yesterdayStr) {
    console.log(`[DB Streaks] Streak broken. Last activity: ${streakData.lastActivityDate}, Yesterday: ${yesterdayStr}. Resetting current streak.`);
    await updateStudyStreakData({
      currentStreak: 0,
      // lastStreakIncrementDate is NOT reset here, it represents the last successful day.
      // lastActivityDate will be updated when a new item is studied today.
    });
  }
  // Also, if the current streak is > 0 but the last time it was incremented was before yesterday,
  // it implies the user was active but didn't meet the goal on 'yesterday'.
  // For a strict "goal met daily" streak, this also means reset.
  else if (streakData.currentStreak > 0 && streakData.lastStreakIncrementDate && streakData.lastStreakIncrementDate < yesterdayStr) {
     console.log(`[DB Streaks] Streak broken (goal not met yesterday). Last increment: ${streakData.lastStreakIncrementDate}, Yesterday: ${yesterdayStr}. Resetting current streak.`);
     await updateStudyStreakData({ currentStreak: 0 });
  }
}

/**
 * Processes the completion of the daily study goal (e.g., 20 new items).
 * Updates current and longest streaks.
 * @returns {Promise<StudyStreakData | null>} Updated streak data or null on error.
 */
export async function processDailyGoalCompletion(): Promise<StudyStreakData | null> {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = getYesterdayStr(todayStr);
  let streakData = await getStudyStreakData();

  if (streakData.lastStreakIncrementDate === todayStr) {
    console.log('[DB Streaks] Daily goal already processed for today. No change to streak.');
    return streakData; // Already processed today
  }

  let newCurrentStreak = streakData.currentStreak;

  if (streakData.lastStreakIncrementDate === yesterdayStr) {
    // Goal met yesterday, continue streak
    newCurrentStreak += 1;
    console.log(`[DB Streaks] Streak continued! New current streak: ${newCurrentStreak}`);
  } else {
    // Streak broken or first day of a new streak
    newCurrentStreak = 1;
    console.log(`[DB Streaks] New streak started / Restarted streak. Current streak: ${newCurrentStreak}`);
  }

  const newLongestStreak = Math.max(streakData.longestStreak, newCurrentStreak);

  const updateSuccess = await updateStudyStreakData({
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastStreakIncrementDate: todayStr,
    lastActivityDate: todayStr, // Goal met, so activity is also today
  });

  if (updateSuccess) {
    return { 
        currentStreak: newCurrentStreak, 
        longestStreak: newLongestStreak, 
        lastStreakIncrementDate: todayStr, 
        lastActivityDate: todayStr 
    };
  }
  return null;
}

/**
 * Records that user activity occurred today (a new item was studied).
 * This is important for checking if a streak should be reset even if the daily goal isn't met.
 * @returns {Promise<void>}
 */
export async function recordStudyActivityToday(): Promise<void> {
    const todayStr = new Date().toISOString().split('T')[0];
    const streakData = await getStudyStreakData();

    if (streakData.lastActivityDate !== todayStr) {
        await updateStudyStreakData({ lastActivityDate: todayStr });
        console.log(`[DB Streaks] Recorded study activity for today: ${todayStr}`);
    }
} 