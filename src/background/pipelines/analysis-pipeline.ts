import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import type { LLMConfig, ChatMessage } from '../../services/llm/types';
import { addOrUpdateLexemeAndTranslation } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';
import { browser } from 'wxt/browser';
import { userConfigurationStorage } from '../../services/storage/storage';

// Interface for the data needed by the pipeline function
interface ProcessTextParams {
  selectedText: string;
  sourceUrl: string;
  llmConfig: LLMConfig;
}

// Define the simplified result structure we expect now
interface SimpleAnalysisResult {
  originalPhrase: string;
  translatedPhrase: string;
  detectedSourceLang: string;
  retrievedTargetLang: string;
}

/**
 * V2 Pipeline: Detects source, retrieves target lang, gets translation, stores.
 * Throws errors if any step fails.
 */
export async function processTextAnalysisPipeline({
    selectedText,
    sourceUrl,
    llmConfig
}: ProcessTextParams): Promise<SimpleAnalysisResult> {
    console.log('--- RUNNING NEW analysis V2 Pipeline ---');
    console.log(`[Analysis Pipeline V2] Starting for: "${selectedText}"`);

    // --- Stage 0a: Retrieve Target Language from Storage ---
    let retrievedTargetLang = 'en'; // Default fallback
    try {
        const userConfig = await userConfigurationStorage.getValue();
        if (userConfig && userConfig.targetLanguage) {
            retrievedTargetLang = userConfig.targetLanguage;
            console.log(`[Analysis Pipeline V2] Retrieved target language from storage: ${retrievedTargetLang}`);
        } else {
            console.warn(`[Analysis Pipeline V2] Target language not found in storage or config is null. Falling back to '${retrievedTargetLang}'.`);
        }
    } catch (error) {
        console.error('[Analysis Pipeline V2] Error retrieving target language from storage:', error);
        console.warn(`[Analysis Pipeline V2] Proceeding with fallback target language '${retrievedTargetLang}'.`);
    }

    // --- Stage 0b: Language Detection for Source Text --- 
    let detectedSourceLang = 'und'; // Default to undetermined
    try {
        const detectionResult = await browser.i18n.detectLanguage(selectedText);
        if (detectionResult && detectionResult.languages && detectionResult.languages.length > 0) {
            // Sort by percentage (highest first) and pick the top one
            const sortedLanguages = detectionResult.languages.sort((a, b) => b.percentage - a.percentage);
            detectedSourceLang = sortedLanguages[0].language;
            const topPercentage = sortedLanguages[0].percentage;
            console.log(`[Analysis Pipeline V2] Detected source language: ${detectedSourceLang} (Confidence: ${topPercentage}%)`);
            if (topPercentage < 70) { // Arbitrary threshold for "reliable"
                 console.warn(`[Analysis Pipeline V2] Language detection confidence is low (${topPercentage}%) for "${selectedText}".`);
            }
        } else {
            console.warn(`[Analysis Pipeline V2] Language detection failed for "${selectedText}". Proceeding with 'und'.`);
        }
    } catch (error) {
        console.error('[Analysis Pipeline V2] Error during language detection:', error);
        // Continue with 'und', but log the error
    }
    
    // --- Prevent self-translation --- 
    if (detectedSourceLang === retrievedTargetLang && detectedSourceLang !== 'und') {
        console.log(`[Analysis Pipeline V2] Detected source language (${detectedSourceLang}) matches target language (${retrievedTargetLang}). Skipping translation.`);
        return { originalPhrase: selectedText, translatedPhrase: selectedText, detectedSourceLang, retrievedTargetLang };
    }

    const db = await getDbInstance();

    // --- Stage 1: LLM Translation --- 
    console.log(`[Analysis Pipeline V2] Requesting translation from ${detectedSourceLang} to ${retrievedTargetLang}...`);
    let translatedPhrase = '';
    try {
        const translationPrompt = `Translate the following ${detectedSourceLang} text accurately into ${retrievedTargetLang}:
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
             return { originalPhrase: selectedText, translatedPhrase: translatedPhrase, detectedSourceLang, retrievedTargetLang };
        }

        console.log('--- RUNNING NEW processAndStorePhrase V2 (Inline) ---');
        await addOrUpdateLexemeAndTranslation(
            db,                         
            originalPhraseClean,        
            detectedSourceLang, 
            null,                       
            translatedPhraseClean,      
            retrievedTargetLang, // Use retrieved target language
            null,                      
            null,                       
            null,                       
            'original',                 
            sourceUrl ?? '',            
            originalPhraseClean,        
            selectedText,               
            null                        
        );
        console.log(`[Analysis Pipeline V2] Stored translation: '${originalPhraseClean}' (${detectedSourceLang}) -> '${translatedPhraseClean}' (${retrievedTargetLang})`);

    } catch (error: any) {
        console.error('[Analysis Pipeline V2] Error during database storage:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Database Storage Error: ${errorMessage}`);
    }

    return { originalPhrase: selectedText, translatedPhrase: translatedPhrase, detectedSourceLang, retrievedTargetLang };
} 