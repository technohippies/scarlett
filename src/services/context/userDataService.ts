import { getDbInstance } from '../db/init'; // Assuming db init path

// Define MoodEntry type if not available from a shared types file
interface MoodEntry {
    mood: string;
    entry_date: string;
    timestamp: string; // Assuming timestamp is retrieved as string, adjust if it's Date
}

/**
 * Retrieves mood entries for the current day.
 */
export const getTodaysMoodHistory = async (): Promise<MoodEntry[]> => {
    const db = await getDbInstance();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    try {
        // Using a more generic query method, assuming `query` returns an array of objects
        // Adjust field names if your DB client camelCases them (e.g., entryDate)
        const result = await db.query<MoodEntry>(
            `SELECT mood, entry_date, timestamp FROM mood_entries WHERE entry_date = '${today}' ORDER BY timestamp ASC`
        );
        
        // The result structure might vary depending on the DB client (e.g., result.rows)
        // Assuming `result` itself is the array or has a `rows` property.
        const moods = Array.isArray(result) ? result : (result as any).rows || [];

        console.log(`[UserDataService] Fetched ${moods.length} mood entries for today (${today}).`);
        return moods;
    } catch (error) {
        console.error("[UserDataService] Error fetching today's mood history:", error);
        return [];
    }
};

interface PageVersionSummary {
    url: string;
    title?: string | null;
    summary_content?: string | null; 
    captured_at: string; // Assuming TIMESTAMPTZ comes as string
}

/**
 * Retrieves a summary of web pages visited or updated today.
 */
export const getTodaysVisitedPagesSummary = async (limit: number = 5): Promise<{ count: number; pages: PageVersionSummary[]; topicsSummary: string }> => {
    const db = await getDbInstance();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();

    try {
        // Query page_versions captured today, join with pages for title
        const result = await db.query<PageVersionSummary>(
            `SELECT pv.url, p.title, pv.summary_content, pv.captured_at 
             FROM page_versions pv
             JOIN pages p ON pv.url = p.url
             WHERE pv.captured_at >= '${todayStartISO}'
             ORDER BY pv.captured_at DESC
             LIMIT ${limit}`
        );
        const pages = Array.isArray(result) ? result : (result as any).rows || [];

        let topicsSummary = "No specific page topics identified for today.";
        if (pages.length > 0) {
            const titles = pages.map((p: PageVersionSummary) => p.title || p.url).join(', ');
            topicsSummary = `Visited pages today include: ${titles.substring(0, 150)}${titles.length > 150 ? '...' : ''}`;
            // More sophisticated summary could involve concatenating pv.summary_content and sending to LLM for a single summary
        }

        console.log(`[UserDataService] Fetched ${pages.length} page versions from today.`);
        return { count: pages.length, pages, topicsSummary };
    } catch (error) {
        console.error("[UserDataService] Error fetching today's visited pages summary:", error);
        return { count: 0, pages: [], topicsSummary: "Error fetching page data." };
    }
};

/**
 * Retrieves a summary of songs potentially listened to today.
 * NOTE: This is a placeholder as the current schema doesn't explicitly track song listening history.
 * It currently returns an empty summary.
 */
export const getTodaysSongsSummary = async (): Promise<{ count: number; songs: any[]; summary: string }> => {
    console.warn("[UserDataService] getTodaysSongsSummary: Current schema does not track daily song listening. Returning empty summary. Future implementation might infer from lyrics access or require schema changes.");
    // Potential future logic:
    // const db = await getDbInstance();
    // const todayStart = new Date();
    // todayStart.setHours(0, 0, 0, 0);
    // const todayStartISO = todayStart.toISOString();
    // Query a new table `song_listening_history` or `song_lyrics.last_accessed_at` if added.
    return { count: 0, songs: [], summary: "Song listening data for today is not available." };
};

interface FlashcardActivityInfo {
    source_text: string;
    target_text: string;
    source_lang: string;
    target_lang: string;
    last_review?: string | null; // Assuming TIMESTAMPTZ comes as string
    due?: string | null;         // Assuming TIMESTAMPTZ comes as string
    reps?: number;
    lapses?: number;
}

/**
 * Retrieves a summary of recent flashcard activity.
 */
export const getRecentFlashcardActivitySummary = async (limit: number = 10): Promise<{ count: number; flashcards: FlashcardActivityInfo[]; summary: string }> => {
    const db = await getDbInstance();
    try {
        const result = await db.query<FlashcardActivityInfo>(
            `SELECT 
                ls.text as source_text,
                ltarg.text as target_text,
                ls.language as source_lang,
                ltarg.language as target_lang,
                ul.last_review,
                ul.due,
                ul.reps,
                ul.lapses
             FROM user_learning ul
             JOIN lexeme_translations t ON ul.translation_id = t.translation_id
             JOIN lexemes ls ON t.source_lexeme_id = ls.lexeme_id
             JOIN lexemes ltarg ON t.target_lexeme_id = ltarg.lexeme_id
             ORDER BY ul.last_review DESC NULLS LAST, ul.due ASC NULLS LAST
             LIMIT ${limit}`
        );
        const flashcards = Array.isArray(result) ? result : (result as any).rows || [];

        let summary = "No recent flashcard activity found.";
        if (flashcards.length > 0) {
            const fewFlashcards = flashcards.slice(0, 3).map((f: FlashcardActivityInfo) => `'${f.source_text}' (${f.source_lang}) -> '${f.target_text}' (${f.target_lang})`).join('; ');
            summary = `Recent flashcards include: ${fewFlashcards}${flashcards.length > 3 ? ' and others...' : '.'}`;
        }
        
        console.log(`[UserDataService] Fetched ${flashcards.length} recent flashcard activities.`);
        return { count: flashcards.length, flashcards, summary };
    } catch (error) {
        console.error("[UserDataService] Error fetching recent flashcard activity:", error);
        return { count: 0, flashcards: [], summary: "Error fetching flashcard data." };
    }
};

interface StudyStats {
    current_streak?: number;
    longest_streak?: number;
    last_streak_increment_date?: string | null;
    last_activity_date?: string | null;
    new_items_studied_today?: number;
    last_reset_date?: string | null;
}

/**
 * Retrieves a summary of the user's study streak and daily stats.
 */
export const getStudyStatsSummary = async (): Promise<{ stats: StudyStats | null; summary: string }> => {
    const db = await getDbInstance();
    try {
        const streakResult = await db.query<StudyStats>("SELECT current_streak, longest_streak, last_streak_increment_date, last_activity_date FROM study_streak WHERE id = 1");
        const dailyStatsResult = await db.query<StudyStats>("SELECT new_items_studied_today, last_reset_date FROM daily_study_stats WHERE id = 1");

        const streakData = (Array.isArray(streakResult) ? streakResult[0] : (streakResult as any).rows?.[0]) || {};
        const dailyData = (Array.isArray(dailyStatsResult) ? dailyStatsResult[0] : (dailyStatsResult as any).rows?.[0]) || {};
        
        const combinedStats: StudyStats = { ...streakData, ...dailyData };

        if (Object.keys(combinedStats).length === 0) {
            return { stats: null, summary: "No study statistics found." };
        }

        let summary = "Study Stats: ";
        if (combinedStats.current_streak !== undefined) summary += `Current streak: ${combinedStats.current_streak} days. `;
        if (combinedStats.new_items_studied_today !== undefined) summary += `New items today: ${combinedStats.new_items_studied_today}. `;
        if (combinedStats.last_activity_date) summary += `Last active: ${combinedStats.last_activity_date}.`;
        
        console.log("[UserDataService] Fetched study stats summary.", combinedStats);
        return { stats: combinedStats, summary: summary.trim() };
    } catch (error) {
        console.error("[UserDataService] Error fetching study stats summary:", error);
        return { stats: null, summary: "Error fetching study statistics." };
    }
};

interface BookmarkSummary {
    url: string;
    title?: string | null;
    tags?: string | null;
    saved_at: string; // Assuming TIMESTAMP comes as string
}

/**
 * Retrieves a summary of recent bookmarks.
 */
export const getBookmarksSummary = async (limit: number = 5): Promise<{ count: number; bookmarks: BookmarkSummary[]; summary: string}> => {
    const db = await getDbInstance();
    try {
        const result = await db.query<BookmarkSummary>(
            `SELECT url, title, tags, saved_at FROM bookmarks ORDER BY saved_at DESC LIMIT ${limit}`
        );
        const bookmarks = Array.isArray(result) ? result : (result as any).rows || [];

        let summary = "No recent bookmarks found.";
        if (bookmarks.length > 0) {
            const titles = bookmarks.map((b: BookmarkSummary) => b.title || b.url).join('; ');
            summary = `Recent bookmarks include: ${titles.substring(0, 150)}${titles.length > 150 ? '...' : '.'}`;
        }
        
        console.log(`[UserDataService] Fetched ${bookmarks.length} recent bookmarks.`);
        return { count: bookmarks.length, bookmarks, summary };
    } catch (error) {
        console.error("[UserDataService] Error fetching bookmarks summary:", error);
        return { count: 0, bookmarks: [], summary: "Error fetching bookmarks." };
    }
};

/**
 * Retrieves a summary of all unique lexemes the user has learned or is learning.
 */
export const getAllUserLexemesSummary = async (): Promise<{ unique_source_lexemes: number; unique_target_lexemes: number; summary: string}> => {
    const db = await getDbInstance();
    try {
        const result = await db.query<{
            unique_source_lexemes: number;
            unique_target_lexemes: number;
        }>(
            `SELECT 
                COUNT(DISTINCT t.source_lexeme_id) as unique_source_lexemes,
                COUNT(DISTINCT t.target_lexeme_id) as unique_target_lexemes
             FROM user_learning ul
             JOIN lexeme_translations t ON ul.translation_id = t.translation_id`
        );
        
        const counts = (Array.isArray(result) ? result[0] : (result as any).rows?.[0]) || { unique_source_lexemes: 0, unique_target_lexemes: 0 };

        let summary = "User vocabulary data: ";
        summary += `Source words/phrases: ${counts.unique_source_lexemes}. `;
        summary += `Target words/phrases: ${counts.unique_target_lexemes}.`;
        
        console.log("[UserDataService] Fetched user lexemes summary.", counts);
        return { ...counts, summary };
    } catch (error) {
        console.error("[UserDataService] Error fetching all user lexemes summary:", error);
        return { unique_source_lexemes: 0, unique_target_lexemes: 0, summary: "Error fetching vocabulary data." };
    }
}; 