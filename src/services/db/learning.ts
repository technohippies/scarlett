import type { PGlite } from '@electric-sql/pglite';
import { getDbInstance } from './init';
// Import necessary types from types.ts
import type { 
  Bookmark, 
  CreateBookmarkInput, 
  Flashcard, 
  CreateFlashcardInput,
  Tag
} from './types';
// --- NEW: Import types for Active Learning Words ---
import type { LearningWordData } from '../../shared/messaging-types';
// --- END NEW ---

console.log('[DB Learning] Service loaded.');

/**
 * Adds or updates lexemes and their translation link.
 * Creates or updates the user learning record for the translation.
 * Creates an encounter record.
 * Handles both word and phrase level data consistently.
 * Uses transactions for atomicity.
 *
 * @param db PGlite instance
 * @param sourceText The source language word/phrase
 * @param sourceLang The source language code (as string)
 * @param sourceLexemePOS Part of speech for the source lexeme (if applicable)
 * @param targetText The target language word/phrase
 * @param targetLang The target language code (as string)
 * @param targetLexemePOS Part of speech for the target lexeme (if applicable)
 * @param contextHint Optional context hint from LLM for the translation
 * @param llmDistractors Optional array of LLM-generated distractors for the target lexeme
 * @param variationType NEW: Type of variation (e.g., 'original', 'past_tense') or null
 * @param encounterUrl URL where the item was encountered
 * @param encounterHighlight The exact text highlighted by the user
 * @param encounterContext Optional broader context snippet
 * @param initialDueDate Optional initial due date for the learning record
 */
export async function addOrUpdateLexemeAndTranslation(
    db: PGlite,
    sourceText: string,
    sourceLang: string,
    sourceLexemePOS: string | null,
    targetText: string,
    targetLang: string,
    targetLexemePOS: string | null,
    contextHint: string | null,
    llmDistractors: string[] | null,
    variationType: string | null,
    encounterUrl: string,
    encounterHighlight: string,
    encounterContext: string | null,
    initialDueDate?: Date | null
): Promise<void> {

    if (!sourceText || !targetText) {
        console.warn('[DB learning] Skipping addOrUpdateLexemeAndTranslation due to empty source or target text.');
        return;
    }

    console.log(`[DB learning] Starting transaction for: '${sourceText}' (${sourceLexemePOS || 'N/A'}) -> '${targetText}' (${targetLexemePOS || 'N/A'}) (Variation: ${variationType || 'original'}, Distractors: ${llmDistractors?.length ?? 0})`);

    try {
        // Use db.transaction to ensure atomicity
        await db.transaction(async (tx) => {
            // --- 1. Find or Create Lexemes --- Use the transaction object 'tx' for queries
            console.log('[DB learning] Finding/creating lexemes...');

            // Source Lexeme
            const sourceLexemeResult = await tx.query<{ lexeme_id: number }>(
                `INSERT INTO lexemes (text, language, part_of_speech)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (text, language) DO UPDATE SET
                     -- Only update POS if the new value is provided and the existing one is NULL?
                     -- Let's keep it simple: Don't update POS on conflict for now.
                     part_of_speech = COALESCE(lexemes.part_of_speech, EXCLUDED.part_of_speech) -- Prefer existing if available
                 RETURNING lexeme_id;`,
                [sourceText, sourceLang, sourceLexemePOS] // Use source POS
            );
            const sourceLexemeId = sourceLexemeResult?.rows?.[0]?.lexeme_id;
            if (!sourceLexemeId) throw new Error(`Failed to get source lexeme ID for ${sourceText}`);
            console.log(`[DB learning] Source lexeme ID: ${sourceLexemeId}`);

            // Target Lexeme
            const targetLexemeResult = await tx.query<{ lexeme_id: number }>(
                `INSERT INTO lexemes (text, language, part_of_speech)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (text, language) DO UPDATE SET
                     part_of_speech = COALESCE(lexemes.part_of_speech, EXCLUDED.part_of_speech) -- Prefer existing if available
                 RETURNING lexeme_id;`,
                [targetText, targetLang, targetLexemePOS] // Use target POS
            );
            const targetLexemeId = targetLexemeResult?.rows?.[0]?.lexeme_id;
            if (!targetLexemeId) throw new Error(`Failed to get target lexeme ID for ${targetText}`);
            console.log(`[DB learning] Target lexeme ID: ${targetLexemeId}`);

            // --- 2. Find or Create Translation Link --- Now includes variation_type
            console.log('[DB learning] Finding/creating translation link...');
            // Prepare distractors for storage (null if empty or null)
            const distractorsJson = llmDistractors && llmDistractors.length > 0 ? JSON.stringify(llmDistractors) : null;
            const translationResult = await tx.query<{ translation_id: number }>(
                `INSERT INTO lexeme_translations (source_lexeme_id, target_lexeme_id, llm_context_hint, llm_distractors, variation_type)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (source_lexeme_id, target_lexeme_id) DO UPDATE SET
                    llm_context_hint = COALESCE(EXCLUDED.llm_context_hint, lexeme_translations.llm_context_hint),
                    llm_distractors = COALESCE(EXCLUDED.llm_distractors, lexeme_translations.llm_distractors),
                    variation_type = COALESCE(EXCLUDED.variation_type, lexeme_translations.variation_type),
                    updated_at = CURRENT_TIMESTAMP
                 RETURNING translation_id;`,
                [sourceLexemeId, targetLexemeId, contextHint, distractorsJson, variationType]
            );
            const translationId = translationResult?.rows?.[0]?.translation_id;
            if (!translationId) throw new Error(`Failed to get translation ID for ${sourceLexemeId} -> ${targetLexemeId}`);
             console.log(`[DB learning] Translation ID: ${translationId} (Variation: ${variationType || 'original'})`);

            // --- 3. Find or Create User Learning Record ---
            console.log('[DB learning] Finding/creating user learning record...');
            const learningCheckQuery = `
                SELECT learning_id FROM user_learning WHERE translation_id = $1;
            `;
            const learningCheckResult = await tx.query<{ learning_id: number }>(learningCheckQuery, [translationId]);

            let learningId: number;
            if (learningCheckResult.rows.length > 0) {
                learningId = learningCheckResult.rows[0].learning_id;
                // Existing record found - DO NOT update SRS state here.
                // SRS state is only updated upon review submission.
                // Just ensure an encounter is logged.
            } else {
                const insertLearningQuery = `
                    INSERT INTO user_learning (translation_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review)
                    VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 0, NULL) -- State is 0 for 'new'
                    RETURNING learning_id;
                `;
                // Use initialDueDate if provided, otherwise generate the current time as ISO string
                const initialDue = (initialDueDate instanceof Date ? initialDueDate : new Date()).toISOString();
                const insertResult = await tx.query<{ learning_id: number }>(insertLearningQuery, [
                    translationId, 
                    initialDue 
                ]); 
                if (!insertResult.rows[0]?.learning_id) {
                    throw new Error("Failed to insert user_learning record.");
                }
                learningId = insertResult.rows[0].learning_id;
            }
            console.log(`[DB learning] Learning ID: ${learningId}`);

            // --- 4. Create Encounter Record ---
            console.log('[DB learning] Creating encounter record...');
            await tx.query(
                `INSERT INTO encounters (learning_id, url, source_highlight, page_context_snippet)
                 VALUES ($1, $2, $3, $4);`,
                [learningId, encounterUrl, encounterHighlight, encounterContext]
            );
            console.log(`[DB learning] Encounter created for Learning ID: ${learningId}`);
        }); // End transaction

        console.log('[DB learning] Transaction committed successfully.');

    } catch (error) {
        console.error('[DB learning] Transaction failed in addOrUpdateLexemeAndTranslation:', error);
        throw error; // Re-throw the error for the pipeline to catch
    }
}

/**
 * Updates the cached distractors for a specific translation.
 */
export async function updateCachedDistractors(
    db: PGlite,
    translationId: number,
    distractors: string[]
): Promise<void> {
    console.log(`[DB Learning] Caching ${distractors.length} distractors for translation ID: ${translationId}`);
    try {
        // Convert the array to a JSON string before storing
        const distractorsJson = JSON.stringify(distractors);
        
        await db.query(
            `UPDATE lexeme_translations
             SET cached_distractors = $1 -- Store as JSON string
             WHERE translation_id = $2;`,
            [distractorsJson, translationId] // Pass the JSON string
        );
    } catch (error) {
        console.error(`[DB Learning] Error updating cached distractors for translation ID ${translationId}:`, error);
        throw error; // Re-throw
    }
}

// TODO: Add functions later for:
// - Getting due learning items
// - Getting potential distractors for a target lexeme
// - Updating SRS state after a review 

// --- NEW: Function to get active learning words ---
/**
 * Retrieves words that the user is actively learning.
 * Active learning states are typically 1 (Learning), 2 (Review), 3 (Relearning).
 */
export async function getActiveLearningWordsFromDb(
    // payload: RequestActiveLearningWordsPayload // Payload not used yet
): Promise<LearningWordData[]> {
    console.log("[DB Learning] Fetching active learning words...");
    const db = await getDbInstance();
    try {
        const query = `
            SELECT
                source_lexeme.text AS \"sourceText\",
                target_lexeme.text AS \"translatedText\",
                source_lexeme.language AS \"sourceLang\",
                target_lexeme.language AS \"targetLang\"
            FROM user_learning ul
            JOIN lexeme_translations lt ON ul.translation_id = lt.translation_id
            JOIN lexemes source_lexeme ON lt.source_lexeme_id = source_lexeme.lexeme_id
            JOIN lexemes target_lexeme ON lt.target_lexeme_id = target_lexeme.lexeme_id
            WHERE ul.state IN (1, 2, 3);  -- Active learning states
        `;
        const result = await db.query<LearningWordData>(query);
        console.log(`[DB Learning] Found ${result.rows.length} active learning words.`);
        return result.rows;
    } catch (error) {
        console.error("[DB Learning] Error fetching active learning words:", error);
        throw error;
    }
}
// --- END NEW Function ---

// --- Bookmark Functions ---

/**
 * Creates a new bookmark.
 */
export async function createBookmark(bookmarkData: CreateBookmarkInput): Promise<Bookmark> {
  // Log selected text snippet if present (truncated)
  const selectedTextSnippet = bookmarkData.selectedText ? bookmarkData.selectedText.substring(0, 100) + '...' : 'null';
  console.log(`[DB bookmarks] Creating bookmark with params: url=${bookmarkData.url}, title=${bookmarkData.title}, tags=${bookmarkData.tags}, selectedText=${selectedTextSnippet}`);
  const db = await getDbInstance();
  try {
    const result = await db.query<Bookmark>( 
      // Added selected_text to INSERT statement
      'INSERT INTO bookmarks (url, title, tags, embedding, selected_text) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
      [
        bookmarkData.url,
        bookmarkData.title || null,
        bookmarkData.tags || null,
        bookmarkData.embedding || null, 
        bookmarkData.selectedText || null // Added selectedText parameter
      ]
    );
    if (result.rows && result.rows.length > 0) {
      console.log("[DB bookmarks] Bookmark created successfully:", result.rows[0]);
      return result.rows[0];
    } else {
      // Check if it already exists due to UNIQUE constraint
      const existing = await db.query<Bookmark>('SELECT * FROM bookmarks WHERE url = $1', [bookmarkData.url]);
      if (existing.rows && existing.rows.length > 0) {
        console.log("[DB bookmarks] Bookmark already existed:", existing.rows[0]);
        return existing.rows[0]; // Return existing if found
      }
      throw new Error("Bookmark creation failed unexpectedly.");
    }
  } catch (error: any) {
    console.error("[DB bookmarks] Error creating bookmark:", error);
    // If it's a unique constraint violation, try to return the existing one
    if (error.message?.includes('UNIQUE constraint failed: bookmarks.url')) { 
      console.warn("[DB bookmarks] Unique constraint violation, fetching existing bookmark.");
      const existing = await db.query<Bookmark>('SELECT * FROM bookmarks WHERE url = $1', [bookmarkData.url]);
      if (existing.rows && existing.rows.length > 0) {
        return existing.rows[0];
      }
    }
    throw error; // Re-throw other errors
  }
}

/**
 * Retrieves all bookmarks.
 */
export async function getAllBookmarks(): Promise<Bookmark[]> {
  console.log("[DB bookmarks] Fetching all bookmarks...");
  const db = await getDbInstance();
  const result = await db.query<Bookmark>('SELECT * FROM bookmarks ORDER BY saved_at DESC');
  console.log(`[DB bookmarks] Found ${result.rows.length} bookmarks.`);
  return result.rows;
}

// --- Flashcard Functions (New) ---

/**
 * Creates a new flashcard.
 */
export async function createFlashcard(flashcardData: CreateFlashcardInput): Promise<Flashcard> {
  console.log("[DB flashcards] Creating flashcard with data:", flashcardData);
  const db = await getDbInstance();
  
  // Use type from input, default is handled by interface?
  const cardType = flashcardData.type; 

  try {
    const result = await db.query<Flashcard>( 
      // Added type to insert, ensuring all fields from Flashcard are returned
      'INSERT INTO flashcards (type, front, back, cloze_text, context, source_highlight, source_url, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, NULL, NULL, 0, 0, 0, 0, \'new\', NULL) RETURNING *', 
      [
        cardType,
        flashcardData.front, 
        flashcardData.back || null, 
        flashcardData.cloze_text || null,
        flashcardData.context || null,
        flashcardData.source_highlight || null,
        flashcardData.source_url || null
      ]
    );
    if (result.rows && result.rows.length > 0) {
      console.log("[DB flashcards] Flashcard created successfully:", result.rows[0]);
      return result.rows[0];
    } else {
      throw new Error("Flashcard creation failed, no row returned.");
    }
  } catch (error) {
    console.error("[DB flashcards] Error creating flashcard:", error);
    throw error; // Re-throw
  }
}

// Optional: Add functions to get/update/delete flashcards later if needed
// Ensure other potentially needed functions are also exported

// --- Tag Functions (from earlier code dump) ---

/**
 * Retrieves all tags from the database.
 * @returns A promise that resolves to an array of Tag objects.
 */
export async function getAllTags(): Promise<Tag[]> {
    console.log('[DB getAllTags] Fetching all tags...');
    const db = await getDbInstance();
    try {
        // Ensure columns match the Tag interface (tag_id, tag_name, created_at, updated_at)
        const result = await db.query<Tag>('SELECT tag_id, tag_name, created_at, updated_at FROM tags ORDER BY tag_name ASC');
        console.log(`[DB getAllTags] Fetched ${result.rows.length} tags.`);
        return result.rows;
    } catch (error) {
        console.error('[DB getAllTags] Error fetching tags:', error);
        throw error; // Re-throw error for the caller to handle
    }
}

/**
 * Adds a new tag to the database.
 * Ensures tag name starts with '#' if it doesn't already.
 * @param tagName - The name of the tag to add (e.g., "tech" or "#tech").
 * @returns A promise that resolves to the newly added Tag object or the existing one.
 */
export async function addTag(tagName: string): Promise<Tag | null> {
    let formattedTagName = tagName.trim();
    if (!formattedTagName) {
        console.warn('[DB addTag] Invalid tag name provided (empty or whitespace).');
        throw new Error('Invalid tag name provided.');
    }
    if (!formattedTagName.startsWith('#')) {
        formattedTagName = `#${formattedTagName}`;
    }

    console.log(`[DB addTag] Attempting to add tag: ${formattedTagName}`);
    const db = await getDbInstance();
    try {
        // Use query with RETURNING for INSERT
        // Schema uses tag_name, no is_predefined column based on latest schema
        const insertSql = `
            INSERT INTO tags (tag_name) 
            VALUES ($1)
            ON CONFLICT (tag_name) DO NOTHING
            RETURNING tag_id, tag_name, created_at, updated_at;
        `;
        const result = await db.query<Tag>(insertSql, [formattedTagName]);

        if (result.rows.length > 0) {
            console.log(`[DB addTag] Tag '${formattedTagName}' added successfully.`);
            return result.rows[0];
        } else {
            console.log(`[DB addTag] Tag '${formattedTagName}' already exists. Fetching existing.`);
            // Fetch the existing tag as ON CONFLICT DO NOTHING doesn't return it
            const existing = await db.query<Tag>('SELECT tag_id, tag_name, created_at, updated_at FROM tags WHERE tag_name = $1', [formattedTagName]);
            if (existing.rows.length > 0) {
              return existing.rows[0];
            } else {
              // Should not happen if conflict occurred, but handle defensively
              console.error(`[DB addTag] Conflict occurred but failed to fetch existing tag: ${formattedTagName}`);
              return null;
            } 
        }
    } catch (error) {
        console.error(`[DB addTag] Error adding tag '${formattedTagName}':`, error);
        throw error;
    }
}

/**
 * Removes a tag from the database by its ID.
 * Note: Schema no longer has `is_predefined`. Add checks if needed elsewhere.
 * @param tagId - The ID of the tag to remove.
 * @returns A promise that resolves to true if removal was successful, false otherwise.
 */
export async function removeTag(tagId: number): Promise<boolean> {
    console.log(`[DB removeTag] Attempting to remove tag with ID: ${tagId}`);
    const db = await getDbInstance();
    try {
        // Check if tag exists first (optional, DELETE won't error if not found)
        const checkResult = await db.query<{ tag_id: number }>('SELECT tag_id FROM tags WHERE tag_id = $1', [tagId]);
        if (checkResult.rows.length === 0) {
            console.warn(`[DB removeTag] Tag with ID ${tagId} not found.`);
            return false; // Tag doesn't exist
        }
        
        // Removed is_predefined check as it's not in current schema

        // Perform the delete
        await db.query('DELETE FROM tags WHERE tag_id = $1', [tagId]);
        
        // If the query above didn't throw an error, assume success
        console.log(`[DB removeTag] Tag with ID ${tagId} removed successfully.`);
        return true;
        
        // Removed check for deleteResult.rowsAffected as it's not standard in pglite query results

    } catch (error) {
        console.error(`[DB removeTag] Error removing tag with ID ${tagId}:`, error);
        // Rethrow the error for the caller to handle more specific cases if needed
        throw error; 
        // return false; // Or just return false on error
    }
} 