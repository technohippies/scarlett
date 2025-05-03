import type { PGlite } from '@electric-sql/pglite';

/**
 * Inserts or updates a lexeme, returning its ID.
 * Handles conflicts by updating nothing (just returning the existing ID).
 */
async function findOrCreateLexeme(
    tx: PGlite,
    text: string,
    language: string,
    partOfSpeech: string | null // Added POS parameter
): Promise<number> {
    const result = await tx.query<{ lexeme_id: number }>(
        `INSERT INTO lexemes (text, language, part_of_speech)
         VALUES ($1, $2, $3)
         ON CONFLICT (text, language) DO UPDATE SET
             -- Update POS if the new value is not null and the existing one is null or different?
             -- Or maybe just update if the incoming value is not null?
             -- Simplest for now: If conflict, don't update POS. Rely on first encounter.
             -- If we want to update: part_of_speech = COALESCE(EXCLUDED.part_of_speech, lexemes.part_of_speech)
             text = EXCLUDED.text -- Needs a dummy update for RETURNING
         RETURNING lexeme_id;`,
        [text, language, partOfSpeech] // Pass POS value
    );
    if (!result?.rows?.[0]?.lexeme_id) {
        throw new Error(`[DB Learning] Failed to find or create lexeme for: ${text} (${language})`);
    }
    return result.rows[0].lexeme_id;
}

/**
 * Inserts or updates a translation link between two lexemes, returning its ID.
 */
async function findOrCreateTranslation(
    tx: PGlite,
    sourceLexemeId: number,
    targetLexemeId: number,
    contextHint: string | null
): Promise<number> {
    const result = await tx.query<{ translation_id: number }>(
        `INSERT INTO lexeme_translations (source_lexeme_id, target_lexeme_id, llm_context_hint)
         VALUES ($1, $2, $3)
         ON CONFLICT (source_lexeme_id, target_lexeme_id) DO UPDATE SET
            llm_context_hint = COALESCE(EXCLUDED.llm_context_hint, lexeme_translations.llm_context_hint)
         RETURNING translation_id;`,
        [sourceLexemeId, targetLexemeId, contextHint]
    );
     if (!result?.rows?.[0]?.translation_id) {
        throw new Error(`[DB Learning] Failed to find or create translation for: ${sourceLexemeId} -> ${targetLexemeId}`);
    }
    return result.rows[0].translation_id;
}

/**
 * Inserts or updates a user learning record for a translation, returning its ID.
 * Initializes FSRS state for new records.
 */
async function findOrCreateUserLearning(
    tx: PGlite,
    translationId: number
): Promise<number> {
     const result = await tx.query<{ learning_id: number }>(
        `INSERT INTO user_learning (translation_id, due, state, stability, difficulty, reps, lapses, last_review, elapsed_days, scheduled_days)
         VALUES ($1, CURRENT_TIMESTAMP, 0, 0, 0, 0, 0, NULL, 0, 0)
         ON CONFLICT (translation_id) DO UPDATE SET
             updated_at = CURRENT_TIMESTAMP -- Just update timestamp on conflict
         RETURNING learning_id;`,
        [translationId]
    );
    if (!result?.rows?.[0]?.learning_id) {
        throw new Error(`[DB Learning] Failed to find or create user learning record for translation ID: ${translationId}`);
    }
    return result.rows[0].learning_id;
}

/**
 * Creates an encounter record for a specific learning item.
 */
async function createEncounter(
    tx: PGlite,
    learningId: number,
    url: string,
    sourceHighlight: string,
    contextSnippet: string | null
): Promise<void> {
    await tx.query(
        `INSERT INTO encounters (learning_id, url, source_highlight, page_context_snippet) VALUES ($1, $2, $3, $4);`,
        [learningId, url, sourceHighlight, contextSnippet]
    );
}

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
 * @param encounterUrl URL where the item was encountered
 * @param encounterHighlight The exact text highlighted by the user
 * @param encounterContext Optional broader context snippet
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
    encounterUrl: string,
    encounterHighlight: string,
    encounterContext: string | null
): Promise<void> {

    if (!sourceText || !targetText) {
        console.warn('[DB learning] Skipping addOrUpdateLexemeAndTranslation due to empty source or target text.');
        return;
    }

    console.log(`[DB learning] Starting transaction for: '${sourceText}' (${sourceLexemePOS || 'N/A'}) -> '${targetText}' (${targetLexemePOS || 'N/A'}) (Distractors: ${llmDistractors?.length ?? 0})`);

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

            // --- 2. Find or Create Translation Link --- Now includes distractors
            console.log('[DB learning] Finding/creating translation link...');
            // Note: PGlite/Postgres expects arrays passed as parameters to be actual JS arrays
            const translationResult = await tx.query<{ translation_id: number }>(
                `INSERT INTO lexeme_translations (source_lexeme_id, target_lexeme_id, llm_context_hint, llm_distractors)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (source_lexeme_id, target_lexeme_id) DO UPDATE SET
                    llm_context_hint = COALESCE(EXCLUDED.llm_context_hint, lexeme_translations.llm_context_hint),
                    -- Overwrite distractors if new ones are provided, otherwise keep old ones
                    llm_distractors = COALESCE(EXCLUDED.llm_distractors, lexeme_translations.llm_distractors)
                 RETURNING translation_id;`,
                [sourceLexemeId, targetLexemeId, contextHint, llmDistractors] // Pass distractors array
            );
            const translationId = translationResult?.rows?.[0]?.translation_id;
            if (!translationId) throw new Error(`Failed to get translation ID for ${sourceLexemeId} -> ${targetLexemeId}`);
             console.log(`[DB learning] Translation ID: ${translationId}`);

            // --- 3. Find or Create User Learning Record ---
            console.log('[DB learning] Finding/creating user learning record...');
            const learningResult = await tx.query<{ learning_id: number }>(
                `INSERT INTO user_learning (translation_id, due, state, stability, difficulty, reps, lapses, last_review, elapsed_days, scheduled_days)
                 VALUES ($1, CURRENT_TIMESTAMP, 0, 0, 0, 0, 0, NULL, 0, 0)
                 ON CONFLICT (translation_id) DO UPDATE SET
                     updated_at = CURRENT_TIMESTAMP -- Just update timestamp
                 RETURNING learning_id;`,
                [translationId]
            );
            const learningId = learningResult?.rows?.[0]?.learning_id;
            if (!learningId) throw new Error(`Failed to get learning ID for translation ID ${translationId}`);
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

// TODO: Add functions later for:
// - Getting due learning items
// - Getting potential distractors for a target lexeme
// - Updating SRS state after a review 