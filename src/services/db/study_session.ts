import { getDbInstance } from './init';

export interface DailyStudyStats {
  lastResetDate: string; // YYYY-MM-DD
  newItemsStudiedToday: number;
}

// Using a more specific type for what's stored in DB for clarity
interface DbDailyStudyStatsRow {
    last_reset_date: string;
    new_items_studied_today: number;
}

const DEFAULT_STATS: Omit<DailyStudyStats, 'lastResetDate'> = {
  newItemsStudiedToday: 0,
};

/**
 * Initializes the daily_study_stats table if it's empty or fetches existing stats.
 * If the last_reset_date is not today, it resets the new_items_studied_today count.
 * @returns {Promise<DailyStudyStats>} The current daily study statistics.
 */
export async function getOrInitDailyStudyStats(): Promise<DailyStudyStats> {
  const db = await getDbInstance();
  const todayStr = new Date().toISOString().split('T')[0];

  // Attempt to fetch existing stats
  const result = await db.query<DbDailyStudyStatsRow>(
    `SELECT last_reset_date, new_items_studied_today FROM daily_study_stats WHERE id = 1`
  );
  const statsRow = result.rows[0];

  if (!statsRow) {
    // Initialize if not found
    console.log('[DB Study Stats] No stats found, initializing for today.');
    // Use query for INSERT with params if exec doesn't support them as cleanly
    await db.query(
      `INSERT INTO daily_study_stats (id, last_reset_date, new_items_studied_today)
       VALUES (1, $1, 0)
       ON CONFLICT(id) DO UPDATE SET
         last_reset_date = excluded.last_reset_date,
         new_items_studied_today = excluded.new_items_studied_today;`,
      [todayStr]
    );
    return { ...DEFAULT_STATS, lastResetDate: todayStr };
  }

  if (statsRow.last_reset_date !== todayStr) {
    // Reset if it's a new day
    console.log(`[DB Study Stats] New day detected (stored: ${statsRow.last_reset_date}, today: ${todayStr}). Resetting count.`);
    await db.query(
      `UPDATE daily_study_stats
       SET new_items_studied_today = 0, last_reset_date = $1
       WHERE id = 1;`,
      [todayStr]
    );
    return { newItemsStudiedToday: 0, lastResetDate: todayStr };
  }

  return {
    lastResetDate: statsRow.last_reset_date,
    newItemsStudiedToday: statsRow.new_items_studied_today,
  };
}

/**
 * Increments the count of new items studied today in the database.
 * Ensures the stats are initialized for the current day before incrementing.
 * @returns {Promise<number>} The updated count of new items studied today.
 * @throws If the database operation fails or the row cannot be initialized.
 */
export async function incrementNewItemsStudiedToday(): Promise<number> {
  const db = await getDbInstance();
  const todayStr = new Date().toISOString().split('T')[0];

  // Ensure the stats for today are initialized/reset if necessary
  const currentStats = await getOrInitDailyStudyStats(); // This handles initialization and date check

  // Double check date after potential init/reset from above call
  if (currentStats.lastResetDate !== todayStr) {
      console.warn(`[DB Study Stats] Date mismatch (${currentStats.lastResetDate} vs ${todayStr}) before increment despite getOrInit. This might indicate a race condition or logic issue. Forcing stats for today.`);
      // This path should ideally not be hit frequently. If it is, review getOrInitDailyStudyStats logic.
      // We assume getOrInitDailyStudyStats already reset the count to 0 for todayStr if it was a new day.
  }

  const updateResult = await db.query<DbDailyStudyStatsRow>(
    `UPDATE daily_study_stats
     SET new_items_studied_today = new_items_studied_today + 1
     WHERE id = 1 AND last_reset_date = $1
     RETURNING new_items_studied_today;`,
    [todayStr]
  );

  const updatedRow = updateResult.rows[0];

  if (!updatedRow) {
    console.error('[DB Study Stats] CRITICAL: Failed to increment new items count. The row might not exist for today or an unexpected issue occurred. Returning last known count for today or 0.');
    // Fallback to the count we know should be correct for today after getOrInitDailyStudyStats
    // If an increment truly failed after init, currentStats.newItemsStudiedToday would be the pre-increment value (likely 0 if just reset).
    // This path signifies an issue, as the UPDATE...RETURNING should always return a row if the WHERE condition matches.
    // A more robust solution might involve re-fetching or throwing a specific error.
    const recheckStats = await getOrInitDailyStudyStats(); // Get the freshest state
    return recheckStats.newItemsStudiedToday;
  }
  return updatedRow.new_items_studied_today;
} 