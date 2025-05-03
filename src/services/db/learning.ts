import { getDbInstance } from './init'; // Assuming getDbInstance is correctly exported from init.ts

// Interface matching the expected LLM JSON output structure
interface LLMAnalysisResult {
  originalPhrase: string;
  translatedPhrase: string;
  wordMappings: {
    sourceWord: string;
    targetWord: string;
  }[];
}

// Interface for the data needed by the function
interface AddItemParams {
  llmResult: LLMAnalysisResult;
  sourceLang: string;
  targetLang: string;
  sourceUrl: string; // URL where the original phrase was encountered
}

/**
 * Adds or updates learned items (phrase and words) based on LLM analysis.
 * - Creates lexeme entries for the phrase and individual words.
 * - Creates translation entries for the phrase and individual words.
 * - Creates or updates the user_learning SRS record for the phrase and words.
 * - Creates an encounter record for the phrase.
 * Uses transactions for atomicity.
 */
export async function addOrUpdateLearnedItem({
  llmResult,
  sourceLang,
  targetLang,
  sourceUrl,
}: AddItemParams): Promise<void> {
  const db = await getDbInstance();
  const { originalPhrase, translatedPhrase, wordMappings } = llmResult;

  console.log('[DB learning] Starting transaction for:', originalPhrase);

  try {
    await db.transaction(async (tx) => {
      // --- 1. Handle Phrase Level ---
      console.log('[DB learning] Handling phrase level...');

      // Get/Create source phrase lexeme
      const sourcePhraseLexeme = await tx.query<{ lexeme_id: number }>(
        `INSERT INTO lexemes (text, language) VALUES ($1, $2)
         ON CONFLICT (text, language) DO UPDATE SET text = EXCLUDED.text RETURNING lexeme_id;`,
        [originalPhrase, sourceLang]
      );
      const sourcePhraseLexemeId = sourcePhraseLexeme.rows[0].lexeme_id;
      console.log(`[DB learning] Source phrase lexeme ID: ${sourcePhraseLexemeId} ('${originalPhrase}')`);

      // Get/Create target phrase lexeme
      const targetPhraseLexeme = await tx.query<{ lexeme_id: number }>(
         `INSERT INTO lexemes (text, language) VALUES ($1, $2)
          ON CONFLICT (text, language) DO UPDATE SET text = EXCLUDED.text RETURNING lexeme_id;`,
         [translatedPhrase, targetLang]
       );
      const targetPhraseLexemeId = targetPhraseLexeme.rows[0].lexeme_id;
      console.log(`[DB learning] Target phrase lexeme ID: ${targetPhraseLexemeId} ('${translatedPhrase.substring(0,20)}...')`);


      // Get/Create phrase translation link
      const phraseTranslation = await tx.query<{ translation_id: number }>(
        `INSERT INTO lexeme_translations (source_lexeme_id, target_lexeme_id) VALUES ($1, $2)
         ON CONFLICT (source_lexeme_id, target_lexeme_id) DO UPDATE SET source_lexeme_id = EXCLUDED.source_lexeme_id RETURNING translation_id;`,
        [sourcePhraseLexemeId, targetPhraseLexemeId]
      );
      const phraseTranslationId = phraseTranslation.rows[0].translation_id;
       console.log(`[DB learning] Phrase translation ID: ${phraseTranslationId}`);


      // Get/Create user learning record for the PHRASE
      // Initialize FSRS state: due now, state = new (0)
      // ON CONFLICT: If user encounters the same phrase again, maybe just update `updated_at`?
      // Or potentially reset SRS state? For now, just ensure the record exists.
      const phraseLearning = await tx.query<{ learning_id: number }>(
        `INSERT INTO user_learning (translation_id, due, state, stability, difficulty, reps, lapses, last_review, elapsed_days, scheduled_days)
         VALUES ($1, CURRENT_TIMESTAMP, 0, 0, 0, 0, 0, NULL, 0, 0)
         ON CONFLICT (translation_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING learning_id;`,
        [phraseTranslationId]
      );
      const phraseLearningId = phraseLearning.rows[0].learning_id;
      console.log(`[DB learning] Phrase learning ID: ${phraseLearningId}`);


      // Create encounter record for the phrase
       await tx.query(
         `INSERT INTO encounters (learning_id, url, source_highlight) VALUES ($1, $2, $3);`,
         [phraseLearningId, sourceUrl, originalPhrase] // Use originalPhrase as source_highlight for now
       );
       console.log(`[DB learning] Encounter created for learning ID ${phraseLearningId}`);


      // --- 2. Handle Word Level ---
      console.log(`[DB learning] Handling ${wordMappings.length} word mappings...`);

      for (const mapping of wordMappings) {
        const { sourceWord, targetWord } = mapping;

        // Skip empty strings if segmentation yields them
        if (!sourceWord || !targetWord) {
             console.warn('[DB learning] Skipping empty source/target word in mapping.');
             continue;
        }

        // Get/Create source word lexeme
        const sourceWordLexeme = await tx.query<{ lexeme_id: number }>(
          `INSERT INTO lexemes (text, language) VALUES ($1, $2)
           ON CONFLICT (text, language) DO UPDATE SET text = EXCLUDED.text RETURNING lexeme_id;`,
          [sourceWord, sourceLang]
        );
        const sourceWordLexemeId = sourceWordLexeme.rows[0].lexeme_id;

        // Get/Create target word lexeme
        const targetWordLexeme = await tx.query<{ lexeme_id: number }>(
          `INSERT INTO lexemes (text, language) VALUES ($1, $2)
           ON CONFLICT (text, language) DO UPDATE SET text = EXCLUDED.text RETURNING lexeme_id;`,
          [targetWord, targetLang]
        );
        const targetWordLexemeId = targetWordLexeme.rows[0].lexeme_id;

        // Get/Create word translation link
        const wordTranslation = await tx.query<{ translation_id: number }>(
          `INSERT INTO lexeme_translations (source_lexeme_id, target_lexeme_id) VALUES ($1, $2)
           ON CONFLICT (source_lexeme_id, target_lexeme_id) DO UPDATE SET source_lexeme_id = EXCLUDED.source_lexeme_id RETURNING translation_id;`,
          [sourceWordLexemeId, targetWordLexemeId]
        );
        const wordTranslationId = wordTranslation.rows[0].translation_id;

        // Get/Create user learning record for the WORD translation
        // Same initialization logic as the phrase
         await tx.query<{ learning_id: number }>(
          `INSERT INTO user_learning (translation_id, due, state, stability, difficulty, reps, lapses, last_review, elapsed_days, scheduled_days)
           VALUES ($1, CURRENT_TIMESTAMP, 0, 0, 0, 0, 0, NULL, 0, 0)
           ON CONFLICT (translation_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
           RETURNING learning_id;`,
          [wordTranslationId]
        );
        // We don't necessarily need the word learning ID right now
        console.log(`[DB learning] Processed word pair: '${sourceWord}' -> '${targetWord}'`);
      }
      console.log('[DB learning] Word mappings processed.');

    }); // End transaction
    console.log('[DB learning] Transaction committed successfully for:', originalPhrase);

  } catch (error) {
    console.error('[DB learning] Transaction failed:', error);
    // Re-throw the error so the caller (background script) knows something went wrong
    throw error;
  }
}

// TODO: Add functions later for:
// - Getting due learning items
// - Getting potential distractors for a target lexeme
// - Updating SRS state after a review 