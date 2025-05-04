import type { PGlite } from '@electric-sql/pglite';

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