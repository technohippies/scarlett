import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import type { LLMConfig, LLMChatResponse, ChatMessage } from '../../services/llm/types';
import { addOrUpdateLexemeAndTranslation } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';
import compromise from 'compromise';
import { getLLMAnalysisPrompt } from '../../services/llm/prompts/analysis';

// Define LLMAnalysisResult locally (matching original structure)
interface LLMAnalysisResult {
  originalPhrase: string;
  translatedPhrase: string;
  wordMappings: {
    sourceWord: string;
    targetWord: string;
    targetWordDistractors?: string[];
    contextHint?: string; // Keep contextHint if needed
  }[];
}

// Interface for the data needed by the pipeline function
interface ProcessTextParams {
  selectedText: string;
  sourceLang: string;
  targetLang: string;
  sourceUrl: string;
  llmConfig: LLMConfig;
}

// Define a simple type for the mapping data used internally
interface ProcessedMappingData {
    sourceWord: string; // English word
    sourcePos: string | null;
    targetWord: string; // Native language translation
    targetPos: string | null; // Native language POS (not available yet)
    llmDistractors: string[] | null; // Native language distractors
}

/**
 * Pipeline for analyzing selected text: gets translation/word mappings via LLM or dictionary,
 * parses the result, adds POS tags, and updates the database for EACH word pair.
 * Throws errors if any step fails.
 */
export async function processTextAnalysisPipeline({
    selectedText,
    sourceLang,
    targetLang,
    sourceUrl,
    llmConfig
}: ProcessTextParams): Promise<LLMAnalysisResult> {
    console.log('[Analysis Pipeline] Starting for:', selectedText);

    const db = await getDbInstance();
    const nativeLanguage = targetLang; 

    let analysisResult: LLMAnalysisResult | null = null;
    let wordMappingsData: ProcessedMappingData[] = [];

    // --- Stage 1: Translation & Distractors (LLM Only) ---
    console.log('[Analysis Pipeline] Requesting analysis from LLM...');
    try {
        const analysisPrompt = getLLMAnalysisPrompt(selectedText, sourceLang, nativeLanguage);
        const analysisMessages: ChatMessage[] = [{ role: 'user', content: analysisPrompt }];
        const llmResponse = await ollamaChat(analysisMessages, llmConfig) as LLMChatResponse;
        const rawContent = llmResponse?.choices?.[0]?.message?.content?.trim();
        console.log('[Analysis Pipeline] Raw LLM Response Content:', rawContent);

        if (!rawContent) {
            throw new Error('LLM returned empty or invalid content structure.');
        }
        
        // Attempt to parse the JSON response (Keep existing regex approach)
        // Ensure JSON parsing handles potential errors gracefully
        const jsonRegex = /```json\n([\s\S]*?)\n```/;
        const match = rawContent.match(jsonRegex);
        let parsedJson: any;

        if (match && match[1]) {
             try {
                parsedJson = JSON.parse(match[1]);
                console.log('[Analysis Pipeline] Successfully parsed extracted JSON block.');
            } catch (parseError) {
                console.error('[Analysis Pipeline] Failed to parse extracted JSON:', parseError);
                console.error('[Analysis Pipeline] Extracted content was:', match[1]);
                throw new Error('Failed to parse JSON from LLM response');
            }
        } else {
            console.log('[Analysis Pipeline] Could not extract JSON block (```json ... ```) from LLM response. Attempting fallback parse.');
            // Attempt to parse the whole string if no block found, as a fallback
            try {
                const cleanedContent = rawContent.replace(/^```json\s*|\s*```$/g, '').trim();
                parsedJson = JSON.parse(cleanedContent);
                console.log('[Analysis Pipeline] Successfully parsed entire LLM response fallback.');
            } catch (fallbackParseError) {
                 console.error('[Analysis Pipeline] Fallback parsing of entire LLM response also failed:', fallbackParseError);
                 throw new Error('Failed to extract or parse JSON from LLM response');
            }
        }

        // Validate and assign the parsed JSON to analysisResult
        if (parsedJson && typeof parsedJson.originalPhrase === 'string' && typeof parsedJson.translatedPhrase === 'string' && Array.isArray(parsedJson.wordMappings)) {
            analysisResult = parsedJson as LLMAnalysisResult;
            console.log('[Analysis Pipeline] LLM JSON structure validated.');
        } else {
            console.error('[Analysis Pipeline] Parsed JSON missing required fields or invalid structure:', parsedJson);
            throw new Error('Parsed LLM response has invalid structure.');
        }

        // Convert LLM result structure to WordMappingData structure
         if (analysisResult.wordMappings && analysisResult.wordMappings.length > 0) {
            wordMappingsData = analysisResult.wordMappings.map((mapping: any) => ({
                sourceWord: mapping.sourceWord,
                sourcePos: null, // Filled later
                targetWord: mapping.targetWord,
                targetPos: null,
                llmDistractors: mapping.targetWordDistractors || null
            }));
        } else {
             console.warn('[Analysis Pipeline] LLM result parsed but has no word mappings.');
             // If analysisResult is valid but has no mappings (e.g., for a single word response format)
             // We might need to construct wordMappingsData from analysisResult.originalPhrase and analysisResult.translatedPhrase
             if (analysisResult && wordMappingsData.length === 0 && !selectedText.includes(' ')) {
                 console.log('[Analysis Pipeline] Constructing mapping data for single word from top-level translation.');
                 wordMappingsData.push({
                     sourceWord: analysisResult.originalPhrase, // Assume LLM returns the word here
                     sourcePos: null,
                     targetWord: analysisResult.translatedPhrase, // Assume LLM returns translation here
                     targetPos: null,
                     llmDistractors: null // LLM might not provide distractors at this level
                 });
             } else if (wordMappingsData.length === 0) {
                 console.warn('[Analysis Pipeline] LLM analysis successful but resulted in no processable word mappings.');
                 // Consider throwing an error or returning a specific state if mappings are essential
             }
        }

    } catch (error) {
        console.error('[Analysis Pipeline] Error during LLM analysis or parsing:', error);
        throw error; // Re-throw
    }

    // --- Stage 2: POS Tagging (Compromise) ---
    // Only run POS tagging if we have word mappings to update
    if (wordMappingsData.length > 0) {
        console.log('[Pipeline] Running POS tagging on source text (English)... ');
        try {
             const doc = compromise(selectedText);
             const terms = doc.terms().json();
             const posMap = new Map<string, string | null>();

             terms.forEach((term: any) => {
                 const wordText = term.text?.toLowerCase();
                 if (wordText && !posMap.has(wordText)) {
                     const tags = term.tags || [];
                     // Prioritize Noun, Verb, Adjective, Adverb
                     let primaryTag = tags.find((t: string) => ['Noun', 'Verb', 'Adjective', 'Adverb'].includes(t)) || tags[0] || null;
                     posMap.set(wordText, primaryTag);
                 }
             });
            // Update wordMappingsData with POS tags
             wordMappingsData = wordMappingsData.map(mapping => {
                const sourcePos = posMap.get(mapping.sourceWord.toLowerCase()) || null;
                 if (sourcePos && !mapping.sourcePos) {
                     return { ...mapping, sourcePos };
                 }
                 return mapping;
             });
             console.log('[Pipeline] POS tagging complete.');
         } catch (tagError) {
             console.error('[Pipeline] Error during compromise POS tagging:', tagError);
             // Continue without POS tags if compromise fails
         }
     } else {
         console.warn('[Pipeline] No word mapping data generated from LLM/POS tagging. Nothing to store.');
         // Consider if this should be an error case - did the LLM fail to provide useful output?
         if (!analysisResult) {
             throw new Error("Analysis pipeline failed to produce a result from the LLM.");
         }
     }

    // --- NEW: Stage 2.5: Generate Compromise Variations & Translate/Store --- 
    if (wordMappingsData.length > 0 && selectedText && selectedText.includes(' ')) { 
        console.log('[Pipeline] Generating & Translating English variations for:', selectedText);
        try {
            const doc = compromise(selectedText);
            const variationsToProcess: { type: string, text: string | null }[] = [];

            // --- Generate Variations --- 
            // NOTE: Suppressing TS errors due to potential issues with @types/compromise
            try { // Inner try-catch for generation part
                // Past Tense
                let pastDoc = doc.clone(); 
                // @ts-ignore 
                pastDoc.verbs().toPastTense(); 
                const pastTenseVariant = pastDoc.text();
                if (pastTenseVariant && pastTenseVariant !== selectedText) {
                    variationsToProcess.push({ type: 'Past Tense', text: pastTenseVariant });
                }

                // Negation
                let negDoc = doc.clone();
                // @ts-ignore 
                negDoc.sentences().toNegative(); 
                const negativeVariant = negDoc.text();
                if (negativeVariant && negativeVariant !== selectedText) {
                    variationsToProcess.push({ type: 'Negative', text: negativeVariant });
                }

                // Future Tense
                let futureDoc = doc.clone();
                // @ts-ignore 
                futureDoc.verbs().toFutureTense();
                const futureTenseVariant = futureDoc.text();
                if (futureTenseVariant && futureTenseVariant !== selectedText) {
                    variationsToProcess.push({ type: 'Future Tense', text: futureTenseVariant });
                }
            } catch (compromiseError) {
                 console.error('[Pipeline] Error during Compromise generation part:', compromiseError);
                 // Continue without variations if generation fails
                 variationsToProcess.length = 0; // Clear any partial results
            }

            // --- Translate and Store Each Variation --- 
            if (variationsToProcess.length > 0) {
                console.log(`[Pipeline] Found ${variationsToProcess.length} variations to translate and store.`);
                for (const variant of variationsToProcess) {
                    if (!variant.text) continue; 
                    
                    const variantEnglish = variant.text;
                    console.log(`[Pipeline] Processing Variant [${variant.type}]: ${variantEnglish}`);
                    
                    try { // Inner try-catch for each variant's LLM call + DB store
                        // 1. Get Translation via LLM
                        // Simple prompt just for translation
                        const translationPrompt = `Translate the following English text accurately into ${nativeLanguage}:
"${variantEnglish}"

Respond ONLY with the translated text, nothing else.`;
                        const translationMessages: ChatMessage[] = [{ role: 'user', content: translationPrompt }];
                        
                        const llmResponse = await ollamaChat(translationMessages, llmConfig) as LLMChatResponse;
                        const variantNativeTranslation = llmResponse?.choices?.[0]?.message?.content?.trim();

                        if (!variantNativeTranslation) {
                            console.warn(`[Pipeline] LLM failed to provide translation for variant: ${variantEnglish}`);
                            continue; // Skip this variant if translation fails
                        }
                         console.log(`[Pipeline]   - LLM Translation: ${variantNativeTranslation}`);

                        // 2. Store in Database (Variant)
                        await addOrUpdateLexemeAndTranslation(
                            db,                         // 1
                            variantEnglish,             // 2 
                            sourceLang,                 // 3
                            null,                       // 4 
                            variantNativeTranslation,   // 5 
                            nativeLanguage,             // 6 
                            null,                       // 7 
                            null,                       // 8 
                            null,                       // 9 
                            variant.type,               // 10 << VARIATION TYPE for variants
                            sourceUrl,                  // 11
                            variantEnglish,             // 12 
                            selectedText                // 13 
                        );
                        console.log(`[Pipeline]   - Stored variant: '${variantEnglish}' -> '${variantNativeTranslation}' (Type: ${variant.type})`);

                    } catch(variantError) {
                         console.error(`[Pipeline] Error processing variant '${variantEnglish}':`, variantError);
                         // Continue to next variant even if one fails
                    }
                }
            } else {
                console.log('[Pipeline] No valid variations generated by Compromise.');
            }

        } catch (outerError) { // Catch errors in the main try block (less likely now)
            console.error('[Pipeline] Error during overall variation processing stage:', outerError);
        }
    } else if (wordMappingsData.length > 0 && selectedText && !selectedText.includes(' ')) {
         console.log('[Pipeline] Skipping Compromise variations for single word:', selectedText);
    }
    // --- End Variations Processing Stage ---

    // ---- DEBUGGING ----
    console.log(`[Pipeline DEBUG] Before Stage 3 check. wordMappingsData length: ${wordMappingsData?.length}`);
    try {
        console.log(`[Pipeline DEBUG] wordMappingsData content: ${JSON.stringify(wordMappingsData)}`);
    } catch (e) {
        console.error("[Pipeline DEBUG] Failed to stringify wordMappingsData", e);
        console.log("[Pipeline DEBUG] wordMappingsData raw:", wordMappingsData);
    }
    // ---- END DEBUGGING ----

    // --- Stage 3: Database Storage (Original) ---
    if (wordMappingsData.length > 0) { 
        console.log('[Pipeline] Processing and storing ORIGINAL results (LLM based)...');
        try {
            for (const mapping of wordMappingsData) {
                // Find the original contextHint for this specific sourceWord from the LLM result
                const originalMapping = analysisResult?.wordMappings.find(m => m.sourceWord === mapping.sourceWord);
                const contextHint = originalMapping?.contextHint || null;

                // Use sourceWord as highlight for now
                const encounterHighlight = mapping.sourceWord; 
                // Use original selected text as broader context
                const encounterContext = selectedText; 

                // ---- DEBUGGING: Log arguments before DB call ----
                console.log(`[Pipeline DEBUG] Inside loop for '${mapping.sourceWord}'. Calling addOrUpdateLexemeAndTranslation with arguments:`);
                console.log(`[Pipeline DEBUG]   db: ${db ? '[PGlite instance]' : 'null'}`);
                console.log(`[Pipeline DEBUG]   sourceWord: ${mapping.sourceWord}`);
                console.log(`[Pipeline DEBUG]   sourceLang: ${sourceLang}`);
                console.log(`[Pipeline DEBUG]   sourcePos: ${mapping.sourcePos}`);
                console.log(`[Pipeline DEBUG]   targetWord: ${mapping.targetWord}`);
                console.log(`[Pipeline DEBUG]   targetLang: ${nativeLanguage}`);
                console.log(`[Pipeline DEBUG]   targetPos: ${mapping.targetPos}`);
                console.log(`[Pipeline DEBUG]   contextHint: ${contextHint}`);
                console.log(`[Pipeline DEBUG]   llmDistractors: ${JSON.stringify(mapping.llmDistractors)}`);
                console.log(`[Pipeline DEBUG]   sourceUrl: ${sourceUrl}`);
                console.log(`[Pipeline DEBUG]   encounterHighlight: ${encounterHighlight}`);
                console.log(`[Pipeline DEBUG]   encounterContext: ${encounterContext}`);
                console.log(`[Pipeline DEBUG]   variationType: original`); // Add log for variation type
                // ---- END DEBUGGING ----

                // Call with 13 positional arguments (Original)
                await addOrUpdateLexemeAndTranslation(
                    db,                         // 1
                    mapping.sourceWord,         // 2 
                    sourceLang,                 // 3 
                    mapping.sourcePos,          // 4 
                    mapping.targetWord,         // 5 
                    nativeLanguage,             // 6 
                    mapping.targetPos,          // 7 
                    contextHint,                // 8 
                    mapping.llmDistractors,     // 9 
                    "original",                 // 10 << VARIATION TYPE for original
                    sourceUrl,                  // 11
                    encounterHighlight,         // 12 
                    encounterContext            // 13
                );
                console.log(`[Pipeline] Stored/Updated ORIGINAL lexeme/translation for '${mapping.sourceWord}' -> '${mapping.targetWord}'`);
            }
        } catch (storageError) {
            console.error('[Pipeline] Error during ORIGINAL database storage:', storageError);
            throw storageError;
        }
    }

    // Ensure we return a valid LLMAnalysisResult structure, even if mappings are empty
    return analysisResult || { 
        originalPhrase: selectedText, 
        translatedPhrase: '', // Indicate LLM failed to provide translation?
        wordMappings: [] 
    }; 
} 