import { getDbInstance } from '../db/init';
import type { DueLearningItem } from './types';
import { FSRS, Card, Grade, State, ReviewLog, createEmptyCard, generatorParameters, RecordLogItem } from 'ts-fsrs';

// Create a single FSRS instance (can be reused)
// Pass default parameters explicitly
const fsrs = new FSRS(generatorParameters()); 

/**
 * Fetches learning items that are due for review.
 * Queries the database joining user_learning, lexeme_translations, and lexemes.
 * 
 * @param limit Optional limit on the number of items to fetch.
 * @returns A promise that resolves to an array of DueLearningItem objects.
 */
export async function getDueLearningItems(limit?: number): Promise<DueLearningItem[]> {
    const db = await getDbInstance();
    console.log(`[SRS Scheduler] Fetching due learning items (Limit: ${limit ?? 'None'})...`);

    try {
        // Construct the SQL query
        // We join user_learning -> lexeme_translations -> lexemes (twice, for source and target)
        // Filter by due date <= now
        // Select necessary fields and map them to the DueLearningItem structure
        // Order by due date (oldest first)
        const query = `
            SELECT
                ul.learning_id AS "learningId",
                ul.translation_id AS "translationId",
                lt.source_lexeme_id AS "sourceLexemeId",
                lt.target_lexeme_id AS "targetLexemeId",
                src_lex.text AS "sourceText",
                tgt_lex.text AS "targetText"
            FROM
                user_learning ul
            JOIN
                lexeme_translations lt ON ul.translation_id = lt.translation_id
            JOIN
                lexemes src_lex ON lt.source_lexeme_id = src_lex.lexeme_id
            JOIN
                lexemes tgt_lex ON lt.target_lexeme_id = tgt_lex.lexeme_id
            WHERE
                ul.due <= CURRENT_TIMESTAMP
            ORDER BY
                ul.due ASC
            ${limit ? `LIMIT $1` : ''} 
        `;

        const params = limit ? [limit] : [];
        
        console.log('[SRS Scheduler] Executing query:', query.replace(/\s+/g, ' ').trim(), params);
        const result = await db.query<DueLearningItem>(query, params);
        
        console.log(`[SRS Scheduler] Found ${result.rows.length} due items.`);
        return result.rows;

    } catch (error) {
        console.error('[SRS Scheduler] Error fetching due learning items:', error);
        throw error; // Re-throw the error for the caller to handle
    }
}

/**
 * Fetches potential distractor words for a given target lexeme.
 * Finds other words the user is learning in the same language, excluding the correct answer.
 * 
 * @param correctTargetLexemeId The lexeme_id of the correct answer.
 * @param targetLanguage The language of the target word (e.g., 'zh-CN').
 * @param count The desired number of distractors.
 * @returns A promise that resolves to an array of distractor strings.
 */
export async function getDistractors(
    correctTargetLexemeId: number,
    targetLanguage: string,
    count: number
): Promise<string[]> {
    const db = await getDbInstance();
    console.log(`[SRS Scheduler] Fetching ${count} distractors for target lexeme ID ${correctTargetLexemeId} in ${targetLanguage}...`);

    if (count <= 0) {
        return [];
    }

    try {
        // Query Strategy:
        // 1. Find all target lexeme IDs the user is learning in the specified language,
        //    excluding the correct answer's lexeme ID.
        // 2. Join with the lexemes table to get the actual text.
        // 3. Use ORDER BY RANDOM() and LIMIT to get a random sample.
        //    (Note: ORDER BY RANDOM() can be slow on large tables, but likely fine for PGlite/user data size)
        //    Alternative: Fetch more than needed and shuffle in code, or use TABLESAMPLE (more complex).
        // 4. We select DISTINCT lexeme IDs first to avoid duplicates if a word is linked via multiple translations.

        const query = `
            SELECT DISTINCT
                tgt_lex.text
            FROM
                user_learning ul
            JOIN
                lexeme_translations lt ON ul.translation_id = lt.translation_id
            JOIN
                lexemes tgt_lex ON lt.target_lexeme_id = tgt_lex.lexeme_id
            WHERE
                tgt_lex.language = $1
                AND tgt_lex.lexeme_id != $2
                -- Optional: Add filters based on SRS state? e.g., ul.state != 0 (not New)
            ORDER BY
                RANDOM()
            LIMIT $3;
        `;

        const params = [targetLanguage, correctTargetLexemeId, count];
        
        console.log('[SRS Scheduler] Executing distractor query:', query.replace(/\s+/g, ' ').trim(), params);
        const result = await db.query<{ text: string }>(query, params);
        
        const distractors = result.rows.map(row => row.text);
        console.log(`[SRS Scheduler] Found ${distractors.length} distractors:`, distractors);

        // Optional: If fewer than 'count' distractors found, maybe fetch random words?
        // Or fallback to LLM-generated distractors if we stored them?
        // For now, just return what we found.
        return distractors;

    } catch (error) {
        console.error('[SRS Scheduler] Error fetching distractors:', error);
        throw error; // Re-throw the error
    }
}

/**
 * Represents the fields required to reconstruct a Card object from the database.
 */
interface UserLearningState {
    due: Date;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: State; // Use the State enum from ts-fsrs
    last_review?: Date | null; // DB might return null
}

/**
 * Updates the SRS state of a learning item based on a review grade.
 * 
 * @param learningId The ID of the user_learning record to update.
 * @param grade The user's grade for the review (0-4, corresponding to FSRS grades).
 * @param reviewTime The time the review occurred (defaults to now).
 * @returns A promise that resolves when the update is complete.
 * @throws If the learning item is not found or if the DB update fails.
 */
export async function updateSRSState(
    learningId: number,
    grade: Grade,
    reviewTime: Date = new Date() 
): Promise<void> {
    const db = await getDbInstance();
    console.log(`[SRS Scheduler] Updating state for learningId ${learningId} with grade ${grade} at ${reviewTime.toISOString()}`);

    try {
        // Start transaction
        await db.transaction(async (tx) => {
            // 1. Fetch the current state of the learning item
            const currentStateResult = await tx.query<UserLearningState>(
                `SELECT due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review
                 FROM user_learning
                 WHERE learning_id = $1;`,
                [learningId]
            );

            if (currentStateResult.rows.length === 0) {
                throw new Error(`Learning item with ID ${learningId} not found.`);
            }

            const currentState = currentStateResult.rows[0];

            // 2. Reconstruct the Card object for ts-fsrs
            const currentCard: Card = {
                ...currentState,
                due: new Date(currentState.due),
                last_review: currentState.last_review ? new Date(currentState.last_review) : undefined,
                state: currentState.state as State // Cast number from DB to State enum if necessary
            };
            console.log('[SRS Scheduler] Current card state:', currentCard);

            // 3. Calculate the new state using FSRS (using f.next with Grade)
            const nextStateInfo: RecordLogItem = fsrs.next(currentCard, reviewTime, grade);
            
            if (!nextStateInfo) {
                 throw new Error(`FSRS next() failed to calculate state for grade ${grade}`);
            }

            const newCardState = nextStateInfo.card;
            console.log(`[SRS Scheduler] New card state for grade ${grade}:`, newCardState);


            // 4. Update the database record
            // We don't check rowCount, rely on transaction/query errors
            await tx.query(
                `UPDATE user_learning
                 SET 
                    due = $1,
                    stability = $2,
                    difficulty = $3,
                    elapsed_days = $4,
                    scheduled_days = $5,
                    reps = $6,
                    lapses = $7,
                    state = $8,
                    last_review = $9
                    -- updated_at is handled by trigger
                 WHERE learning_id = $10;`,
                [
                    newCardState.due,
                    newCardState.stability,
                    newCardState.difficulty,
                    newCardState.elapsed_days,
                    newCardState.scheduled_days,
                    newCardState.reps,
                    newCardState.lapses,
                    newCardState.state,
                    reviewTime, // Set last_review to the current review time
                    learningId
                ]
            );
            
             console.log(`[SRS Scheduler] Successfully updated learningId ${learningId}`);
        }); // Commit transaction

    } catch (error) {
        console.error(`[SRS Scheduler] Error updating SRS state for learningId ${learningId}:`, error);
        throw error; // Re-throw error
    }
}

// TODO:
// - Implement updateSRSState function (requires FSRS logic integration) 