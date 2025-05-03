import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import type { LLMConfig, LLMChatResponse, ChatMessage } from '../../services/llm/types';
import { addOrUpdateLexemeAndTranslation } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';
import compromise from 'compromise';
import { getLLMAnalysisPrompt } from '../../services/llm/prompts/analysis';
import { getDictionaryEntry } from '../setup/dictionary-setup';

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
    // We assume sourceLang is always English ('en') and targetLang is the native language here.
    const nativeLanguage = targetLang; // Use targetLang as nativeLanguage for clarity in this context

    let analysisResult: LLMAnalysisResult | null = null;
    let wordMappingsData: ProcessedMappingData[] = [];
    const isSingleWord = !selectedText.includes(' ') && selectedText.trim().length > 0;
    let sourceWordForLookup = selectedText.trim();

    // --- Stage 1: Translation & Distractors (Dictionary or LLM) ---
    if (isSingleWord) {
        const dictionaryEntry = getDictionaryEntry(nativeLanguage, sourceWordForLookup);
        if (dictionaryEntry) {
            console.log(`[Analysis Pipeline] Found '${sourceWordForLookup}' in '${nativeLanguage}' dictionary. Translation: ${dictionaryEntry.translation}`);
            wordMappingsData.push({
                sourceWord: sourceWordForLookup,
                sourcePos: null, // Filled later
                targetWord: dictionaryEntry.translation,
                targetPos: null,
                llmDistractors: null
            });
        }
    }

    // If not a single word, or not found in dictionary, use LLM
    if (wordMappingsData.length === 0) {
        console.log('[Analysis Pipeline] Word not found in dictionary or is a phrase. Requesting analysis from LLM...');
        try {
            // Use the imported prompt generator (ensure params match: sourceText, sourceLang (en), targetLang (native))
            const analysisPrompt = getLLMAnalysisPrompt(selectedText, sourceLang, nativeLanguage);
            const analysisMessages: ChatMessage[] = [{ role: 'user', content: analysisPrompt }];

            // Correct ollamaChat call signature, assuming non-streamed based on config
            const llmResponse = await ollamaChat(analysisMessages, llmConfig) as LLMChatResponse;

            // Basic check for response content - Use correct response structure
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
            // Basic validation (could use Zod later)
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
            }

        } catch (error) {
            console.error('[Analysis Pipeline] Error during LLM analysis or parsing:', error);
            // Re-throw or handle - throwing for now
            throw error;
        }
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
         console.warn('[Pipeline] No word mapping data generated. Skipping POS tagging.');
     }

    // --- Stage 3: Database Storage ---
    if (wordMappingsData.length > 0) {
        console.log('[Pipeline] Processing and storing results...');
        try {
            for (const mapping of wordMappingsData) {
                console.log(`[Pipeline] Saving to DB: '${mapping.sourceWord}' (${mapping.sourcePos || 'N/A'}) -> '${mapping.targetWord}' (Dist: ${mapping.llmDistractors?.length ?? 0})`);
                await addOrUpdateLexemeAndTranslation(
                    db,
                    mapping.sourceWord,
                    sourceLang,
                    mapping.sourcePos,
                    mapping.targetWord,
                    nativeLanguage,
                    mapping.targetPos,
                    null,
                    mapping.llmDistractors,
                    sourceUrl,
                    selectedText,
                    selectedText
                );
            }
            console.log(`[Analysis Pipeline] Database operations completed for: ${selectedText}`);
        } catch (dbError) {
            console.error('[Analysis Pipeline] Error saving word pair(s) to DB:', dbError);
            // Re-throw or handle - throwing for now
            throw dbError;
        }
    } else {
         console.warn('[Analysis Pipeline] No word mapping data generated. Nothing to save.');
         // Return an empty/default result if nothing was processed
         return { originalPhrase: selectedText, translatedPhrase: '', wordMappings: [] };
    }

    // --- Construct Final Result ---
    if (analysisResult) {
        // If LLM was used, return the full result from LLM
        return analysisResult;
    } else {
        // If only dictionary was used, construct a minimal result
        const singleMapping = wordMappingsData[0];
        return {
            originalPhrase: selectedText,
            translatedPhrase: singleMapping?.targetWord || '',
            wordMappings: wordMappingsData.map(m => ({
                 sourceWord: m.sourceWord,
                 targetWord: m.targetWord,
                 // No distractors or contextHint from dictionary-only path yet
            }))
        };
    }
} 