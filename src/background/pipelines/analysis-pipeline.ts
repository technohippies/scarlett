import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import type { LLMConfig, ChatMessage } from '../../services/llm/types';
import { addOrUpdateLexemeAndTranslation } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';
import { userConfigurationStorage } from '../../services/storage/storage';

// Interface for the data needed by the pipeline function
interface ProcessTextParams {
  selectedText: string;
  sourceUrl: string;
  llmConfig: LLMConfig;
  translateToLang?: string; // Added: Optional parameter for target language
}

// Define the simplified result structure we expect now
interface SimpleAnalysisResult {
  originalPhrase: string;
  translatedPhrase: string;
  detectedSourceLang: string;
  retrievedTargetLang: string;
  pronunciation?: string; // Added: Optional pronunciation
}

/**
 * V2 Pipeline: Detects source, retrieves target lang, gets translation, stores.
 * Throws errors if any step fails.
 */
export async function processTextAnalysisPipeline({
    selectedText,
    sourceUrl,
    llmConfig,
    translateToLang 
}: ProcessTextParams): Promise<SimpleAnalysisResult> {
    console.log('--- RUNNING NEW analysis V2 Pipeline (Settings-Driven) ---');
    console.log(`[Analysis Pipeline V2] Starting for: "${selectedText}"`);

    // --- Stage 0a: Get User Languages from Storage --- 
    let userNativeLang = 'en'; // Default native
    let userTargetLang = 'und'; // Default target (undetermined)

    try {
        const userConfig = await userConfigurationStorage.getValue();
        if (userConfig?.nativeLanguage) {
            userNativeLang = userConfig.nativeLanguage;
        }
        if (userConfig?.targetLanguage) {
            userTargetLang = userConfig.targetLanguage;
        }
        console.log(`[Analysis Pipeline V2] User settings: Native='${userNativeLang}', Target Learning='${userTargetLang}'`);
    } catch (error) {
        console.error('[Analysis Pipeline V2] Error retrieving user languages from storage. Using defaults.', error);
    }

    // --- Stage 0b: Determine Final Translation Output Language --- 
    // This should ALWAYS be the user's native language.
    // Prioritize translateToLang if passed (e.g. from context menu which should be native lang), else use stored native lang.
    const finalTranslationOutputLang = translateToLang || userNativeLang || 'en';
    console.log(`[Analysis Pipeline V2] Final translation output language will be: ${finalTranslationOutputLang}`);

    // --- Stage 0c: Determine Detected Source Language (Based on User Settings) ---
    // Assumption: If the user selects text, it's most likely their target learning language.
    // If target language is not set, or same as native, this logic might need refinement for other contexts.
    let detectedSourceLang = userTargetLang;
    if (detectedSourceLang === 'und' || detectedSourceLang === userNativeLang) {
        // If target is undetermined, or same as native, we can't confidently assume source is target.
        // For now, let's mark it as 'und' and let the LLM try. 
        // A more advanced version might try to get page language here.
        console.warn(`[Analysis Pipeline V2] User's target learning language is '${userTargetLang}'. Cannot confidently assume selected text is target. Marking source as 'und'.`);
        detectedSourceLang = 'und'; 
    }
    console.log(`[Analysis Pipeline V2] Assumed source language (based on user target lang): ${detectedSourceLang}`);

    // --- Stage 0d: Prevent self-translation if source is confidently native language ---
    if (detectedSourceLang === finalTranslationOutputLang && detectedSourceLang !== 'und') {
        console.log(`[Analysis Pipeline V2] Assumed source language (${detectedSourceLang}) matches final translation output language (${finalTranslationOutputLang}). Skipping translation.`);
        return { originalPhrase: selectedText, translatedPhrase: selectedText, detectedSourceLang, retrievedTargetLang: finalTranslationOutputLang, pronunciation: undefined };
    }
    // A special check: if the detectedSourceLang ended up as 'und' because targetLang was 'und' or same as native,
    // AND the finalTranslationOutputLang IS the native language, it implies we might be trying to translate native to native.
    // However, the text could be a third language. If detectedSourceLang is 'und', let the LLM try.

    const db = await getDbInstance();

    // --- Stage 1: LLM Translation --- 
    console.log(`[Analysis Pipeline V2] Requesting LLM translation from assumed '${detectedSourceLang}' to '${finalTranslationOutputLang}'...`);
    let translatedPhrase = '';
    try {
        const translationPrompt = `Translate the following ${detectedSourceLang} text accurately into ${finalTranslationOutputLang}:
"${selectedText}"

Respond ONLY with the translated text, nothing else.`;
        const translationMessages: ChatMessage[] = [{ role: 'user', content: translationPrompt }];
        
        const llmResponse = await ollamaChat(translationMessages, {
            ...llmConfig, 
            stream: false 
        });

        if ('choices' in llmResponse && llmResponse.choices && llmResponse.choices.length > 0 && llmResponse.choices[0].message) {
            translatedPhrase = llmResponse.choices[0].message.content?.trim() || '';
            console.log(`[Analysis Pipeline V2] Raw LLM Translation: "${translatedPhrase}"`);
            if (!translatedPhrase) {
                throw new Error('LLM returned empty translation content.');
            }
        } else if (Symbol.asyncIterator in llmResponse) { // Check if it's an async iterable (stream)
             console.error('[Analysis Pipeline V2] Received unexpected streaming response from LLM when non-stream was expected.');
             // Consume the stream to avoid leaks if it was accidentally a stream
             // @ts-expect-error - llmResponse is an AsyncIterable here
             for await (const _part of llmResponse) { /* consume */ } 
             throw new Error("LLM translation expected non-streaming response but received a stream.");
        } 
        else {
            throw new Error('LLM response was not in the expected format (no choices or invalid structure).');
        }

    } catch (error: any) {
        console.error('[Analysis Pipeline V2] Error during LLM translation:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`LLM Translation Error: ${errorMessage}`);
    }

    // --- Stage 2: Database Storage --- 
    console.log('[Analysis Pipeline V2] Storing translated phrase...');
    try {
        const originalPhraseClean = selectedText.replace(/[.,;:!?]+$/, '').trim();
        const translatedPhraseClean = translatedPhrase.replace(/[。，；：！？]+$/, '').trim();

        if (!originalPhraseClean || !translatedPhraseClean) {
             console.warn('[Analysis Pipeline V2] Skipping DB storage due to empty text after cleaning:', { original: selectedText, translated: translatedPhrase });
             const finalTranslated = translatedPhraseClean || (originalPhraseClean ? selectedText : ''); 
             return { originalPhrase: selectedText, translatedPhrase: finalTranslated, detectedSourceLang, retrievedTargetLang: finalTranslationOutputLang, pronunciation: undefined };
        }

        console.log('--- RUNNING NEW processAndStorePhrase V2 (Inline) ---');
        await addOrUpdateLexemeAndTranslation(
            db,                         
            originalPhraseClean,        
            detectedSourceLang, 
            null,                       
            translatedPhraseClean,      
            finalTranslationOutputLang, // Use the determined final output language for storage
            null,                      
            null,                       
            null,                       
            'original',                 
            sourceUrl ?? '',            
            originalPhraseClean,        
            selectedText,               
            null                        
        );
        console.log(`[Analysis Pipeline V2] Stored translation: '${originalPhraseClean}' (${detectedSourceLang}) -> '${translatedPhraseClean}' (${finalTranslationOutputLang})`);

    } catch (error: any) {
        console.error('[Analysis Pipeline V2] Error during database storage:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Database Storage Error: ${errorMessage}`);
    }

    // TODO: Implement actual pronunciation fetching if needed
    return { originalPhrase: selectedText, translatedPhrase: translatedPhrase, detectedSourceLang, retrievedTargetLang: finalTranslationOutputLang, pronunciation: undefined };
} 