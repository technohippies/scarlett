import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import type { LLMConfig, ChatMessage } from '../../services/llm/types';
import { addOrUpdateLexemeAndTranslation } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';

// Interface for the data needed by the pipeline function
interface ProcessTextParams {
  selectedText: string;
  sourceLang: string;
  targetLang: string;
  sourceUrl: string;
  llmConfig: LLMConfig;
}

// Define the simplified result structure we expect now
interface SimpleAnalysisResult {
  originalPhrase: string;
  translatedPhrase: string;
}

/**
 * V2 Pipeline: Gets full translation via LLM and stores the phrase.
 * Throws errors if any step fails.
 */
export async function processTextAnalysisPipeline({
    selectedText,
    sourceLang,
    targetLang,
    sourceUrl,
    llmConfig
}: ProcessTextParams): Promise<SimpleAnalysisResult> {
    console.log('--- RUNNING NEW analysis V2 Pipeline ---');
    console.log(`[Analysis Pipeline V2] Starting for: "${selectedText}"`);

    const db = await getDbInstance();

    // --- Stage 1: LLM Translation --- 
    console.log('[Analysis Pipeline V2] Requesting translation from LLM...');
    let translatedPhrase = '';
    try {
        // Simplified prompt asking only for translation
        const translationPrompt = `Translate the following ${sourceLang} text accurately into ${targetLang}:
"${selectedText}"

Respond ONLY with the translated text, nothing else.`;

        const translationMessages: ChatMessage[] = [{ role: 'user', content: translationPrompt }];
        
        // Ensure we get a non-streaming response
        const llmResponse = await ollamaChat(translationMessages, {
            ...llmConfig, 
            stream: false // Explicitly set stream to false
        });

        // Type guard for non-streaming response
        if ('choices' in llmResponse) {
            translatedPhrase = llmResponse?.choices?.[0]?.message?.content?.trim() || '';
            console.log(`[Analysis Pipeline V2] Raw LLM Translation: "${translatedPhrase}"`);
            if (!translatedPhrase) {
                throw new Error('LLM returned empty translation content.');
            }
        } else {
             // Handle unexpected stream response
             console.error('[Analysis Pipeline V2] Received unexpected streaming response from LLM.');
             // Consume the stream to avoid leaks
             for await (const _part of llmResponse) { /* consume */ } 
             throw new Error("LLM translation expected non-streaming response but received a stream.");
        }

    } catch (error: any) {
        console.error('[Analysis Pipeline V2] Error during LLM translation:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`LLM Translation Error: ${errorMessage}`); // Re-throw with context
    }

    // --- Stage 2: Database Storage --- 
    console.log('[Analysis Pipeline V2] Storing translated phrase...');
    try {
        // Trim punctuation before storing
        const originalPhraseClean = selectedText.replace(/[.,;:!?]+$/, '').trim();
        const translatedPhraseClean = translatedPhrase.replace(/[。，；：！？]+$/, '').trim();

        if (!originalPhraseClean || !translatedPhraseClean) {
            console.warn('[Analysis Pipeline V2] Skipping DB storage due to empty text after cleaning:', 
                         { original: selectedText, translated: translatedPhrase });
            // Still return the result, just don't store if clean text is empty
            return { originalPhrase: selectedText, translatedPhrase: translatedPhrase };
        }

        console.log('--- RUNNING NEW processAndStorePhrase V2 (Inline) ---');
        await addOrUpdateLexemeAndTranslation(
            db,                         // 1: PGlite instance
            originalPhraseClean,        // 2: sourceText
            sourceLang,                 // 3: sourceLang
            null,                       // 4: sourceLexemePOS (null for phrase)
            translatedPhraseClean,      // 5: targetText
            targetLang,                 // 6: targetLang
            null,                       // 7: targetLexemePOS (null for phrase)
            null,                       // 8: contextHint (none)
            null,                       // 9: llmDistractors (none)
            'original',                 // 10: variationType 
            sourceUrl ?? '',             // 11: encounterUrl (provide default)
            originalPhraseClean,        // 12: encounterHighlight (use cleaned phrase)
            selectedText,               // 13: encounterContext (original selected text)
            null                        // 14: initialDueDate (null for immediate)
        );
        console.log(`[Analysis Pipeline V2] Stored translation: '${originalPhraseClean}' -> '${translatedPhraseClean}'`);

    } catch (error: any) {
        console.error('[Analysis Pipeline V2] Error during database storage:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Database Storage Error: ${errorMessage}`); // Re-throw with context
    }

    // Return the simplified result
    return { originalPhrase: selectedText, translatedPhrase: translatedPhrase };
} 