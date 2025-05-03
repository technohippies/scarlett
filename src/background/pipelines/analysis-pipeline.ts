import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import type { LLMConfig, LLMChatResponse, ChatMessage } from '../../services/llm/types';
import { addOrUpdateLexemeAndTranslation } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';
import compromise from 'compromise';

// Interface matching the expected LLM JSON output structure
// (Could potentially be moved to a shared types file later)
interface LLMAnalysisResult {
  originalPhrase: string;
  translatedPhrase: string;
  wordMappings: {
    sourceWord: string;
    targetWord: string;
    contextHint?: string; // Optional hint per word pair
  }[];
}

// Interface for the data needed by the pipeline function
interface ProcessTextParams {
  selectedText: string;
  sourceLang: string;
  targetLang: string;
  sourceUrl: string;
  llmConfig: LLMConfig; // Pass LLM config in
}

/**
 * Pipeline for analyzing selected text: gets translation/word mappings via LLM,
 * parses the result, and updates the database for EACH word pair.
 * Throws errors if any step fails.
 */
export async function processTextAnalysisPipeline({
    selectedText,
    sourceLang,
    targetLang,
    sourceUrl,
    llmConfig
}: ProcessTextParams): Promise<LLMAnalysisResult> { // Return the result for potential use
    console.log('[Analysis Pipeline] Starting for:', selectedText);

    // 1. Get Analysis from LLM
    console.log('[Analysis Pipeline] Requesting analysis from LLM...');
    const analysisPrompt = getLLMAnalysisPrompt(selectedText, sourceLang, targetLang);
    const analysisMessages: ChatMessage[] = [{ role: 'user', content: analysisPrompt }];

    const llmResponse = await ollamaChat(analysisMessages, llmConfig) as LLMChatResponse;
    const rawContent = llmResponse?.choices?.[0]?.message?.content?.trim();
    console.log('[Analysis Pipeline] Raw LLM Response Content:', rawContent);

    if (!rawContent) {
      throw new Error('[Analysis Pipeline] LLM returned empty content.');
    }

    // 2. Parse the LLM JSON Response
    let analysisResult: LLMAnalysisResult;
    try {
      const cleanedContent = rawContent.replace(/^```json\s*|\s*```$/g, '').trim();
      analysisResult = JSON.parse(cleanedContent);
      // TODO: Add validation (e.g., Zod)
      console.log('[Analysis Pipeline] Successfully parsed LLM analysis result.');
    } catch (parseError) {
      console.error('[Analysis Pipeline] Failed to parse LLM JSON response:', parseError);
      console.error('[Analysis Pipeline] Raw content was:', rawContent);
      throw new Error('[Analysis Pipeline] Failed to understand LLM response format.');
    }

    // 3. Process and Store Results for EACH Word Mapping
    console.log('[Pipeline] Processing and storing results for word mappings...');
    const db = await getDbInstance();

    for (const item of analysisResult.wordMappings) {
        // --- Prepare Lexeme Data with POS tagging ---
        let sourceLexemePOS: string | null = null;
        let targetLexemePOS: string | null = null;

        // Tag source word if it's English
        if (sourceLang.toLowerCase().startsWith('en')) {
            try {
                // Convert to lowercase before tagging
                const sourceWordLower = item.sourceWord.toLowerCase();
                const doc = compromise(sourceWordLower);
                const terms = doc.terms();
                if (terms.found) {
                    const firstTerm = terms.first();
                    const tagsResult = firstTerm.out('tags');

                    console.log(`[Pipeline] Raw tagsResult for source '${sourceWordLower}':`, JSON.stringify(tagsResult, null, 2));

                    // Revised logic to handle the object structure
                    let tags: string[] | null = null;
                    if (Array.isArray(tagsResult) && tagsResult.length > 0 && typeof tagsResult[0] === 'object' && tagsResult[0] !== null) {
                        const wordKey = Object.keys(tagsResult[0])[0]; // Get the word key (e.g., 'love')
                        const potentialTags = tagsResult[0][wordKey];
                        if (Array.isArray(potentialTags)) {
                            tags = potentialTags;
                        }
                    }

                    sourceLexemePOS = tags?.[0] ?? null; // Get the primary tag (e.g., 'Verb')
                    let rawTagsString = tags?.join(', ') ?? 'N/A';
                    console.log(`[Pipeline] POS for EN source '${item.sourceWord}' (tagged as '${sourceWordLower}'): ${sourceLexemePOS} (Raw: ${rawTagsString})`);
                } else {
                    console.log(`[Pipeline] No terms found for EN source '${item.sourceWord}' (tagged as '${sourceWordLower}')`);
                }
            } catch (tagError) {
                 console.error(`[Pipeline] Error during compromise tagging for source word '${item.sourceWord}':`, tagError);
                 sourceLexemePOS = null;
            }
        }

        // Tag target word if it's English
        if (targetLang.toLowerCase().startsWith('en')) {
             try {
                 // Convert to lowercase before tagging
                const targetWordLower = item.targetWord.toLowerCase();
                const doc = compromise(targetWordLower);
                const terms = doc.terms();
                if (terms.found) {
                    const firstTerm = terms.first();
                    const tagsResult = firstTerm.out('tags');

                    console.log(`[Pipeline] Raw tagsResult for target '${targetWordLower}':`, JSON.stringify(tagsResult, null, 2));

                    // Revised logic to handle the object structure
                    let tags: string[] | null = null;
                    if (Array.isArray(tagsResult) && tagsResult.length > 0 && typeof tagsResult[0] === 'object' && tagsResult[0] !== null) {
                        const wordKey = Object.keys(tagsResult[0])[0];
                        const potentialTags = tagsResult[0][wordKey];
                        if (Array.isArray(potentialTags)) {
                            tags = potentialTags;
                        }
                    }

                    targetLexemePOS = tags?.[0] ?? null; // Get the primary tag
                    let rawTagsString = tags?.join(', ') ?? 'N/A';
                    console.log(`[Pipeline] POS for EN target '${item.targetWord}' (tagged as '${targetWordLower}'): ${targetLexemePOS} (Raw: ${rawTagsString})`);
                } else {
                     console.log(`[Pipeline] No terms found for EN target '${item.targetWord}' (tagged as '${targetWordLower}')`);
                }
            } catch (tagError) {
                console.error(`[Pipeline] Error during compromise tagging for target word '${item.targetWord}':`, tagError);
                targetLexemePOS = null;
            }
        }

        // --- Add/Update Lexemes and Translation for this pair ---
        try {
            await addOrUpdateLexemeAndTranslation(
                db,
                item.sourceWord,
                sourceLang, 
                sourceLexemePOS, // Should now be correctly assigned (or null if error)
                item.targetWord,
                targetLang,
                targetLexemePOS, // Should now be correctly assigned (or null if error)
                item.contextHint || null,
                sourceUrl,
                selectedText,
                selectedText
            );
        } catch (dbError) {
             console.error(`[Pipeline] Error saving word pair to DB: '${item.sourceWord}' -> '${item.targetWord}'`, dbError);
        }
    }

    console.log('[Analysis Pipeline] Database operations completed for word mappings from:', analysisResult.originalPhrase);

    // TODO: Handle phrase-level saving separately if needed?
    // Currently, only word pairs are saved with POS.
    // If we need to save the originalPhrase -> translatedPhrase link,
    // we'd call addOrUpdateLexemeAndTranslation again here with null POS tags.

    return analysisResult; // Return the parsed result
}


// --- Helper: LLM Prompt Generation (Keep associated with the pipeline) ---
// NOTE: Consider moving prompts to a dedicated prompts service/module if they grow complex
function getLLMAnalysisPrompt(sourceText: string, sourceLang: string, targetLang: string): string {
    return `You are an advanced linguistic analysis AI. Process the following ${sourceLang} text for a user learning ${targetLang}.

Text: "${sourceText}"

Perform the following tasks:
1. Translate the entire text accurately into ${targetLang}.
2. Segment the original ${sourceLang} text into individual words.
3. Segment the translated ${targetLang} text into individual words. Ensure segmentation is natural for the target language.
4. Create a mapping between the segmented source words and the corresponding segmented target words. The mapping should represent the most likely translation alignment for each word within the context of the full phrase.

Respond ONLY with a single, valid JSON object adhering to this exact structure:

{
  "originalPhrase": "The original source text",
  "translatedPhrase": "The full target language translation",
  "wordMappings": [
    {
      "sourceWord": "Source_Word",
      "targetWord": "Corresponding_Target_Word"
    }
    // Repeat for all word pairs in sequence
  ]
}

Do not include any explanations, apologies, or text outside the JSON object. Ensure the word segmentation and mapping reflect the phrase's context.

JSON Response:`;
} 