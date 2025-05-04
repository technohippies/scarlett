import { PGliteInterface } from "@electric-sql/pglite";
import { getDbInstance } from "../db/init";
import { ollamaChat, ollamaChatStream } from "./chat";
import { 
    extractJsonBlock, 
    validateAnalysisJson, 
    validateDistractorJson 
} from "./json-validation";
import { 
    AnalysisResult, 
    WordMapping, 
    PipelineStage, 
    DistractorGenerationResult 
} from "./types";
import { 
    addOrUpdateLexemeAndTranslation, 
    getCachedDistractors, 
    cacheDistractors, 
    getDistractorsFromDB
} from "../db/learning";
import nlp from 'compromise';
import 'compromise/three'; // Load plugins for compromise

// --- Constants ---
const ANALYSIS_MODEL = "gemma3:12b";
const DISTRACTOR_MODEL = "gemma3:12b";
const TARGET_LANGUAGE = "zh-CN"; // Hardcoded for now
const SOURCE_LANGUAGE = "en";

// Prefixes for common content word POS tags (Penn Treebank style)
const CONTENT_WORD_POS_PREFIXES = ['NN', 'VB', 'JJ', 'RB']; 

function isContentWord(posTag: string | null): boolean {
  if (!posTag) return false; // Treat words without POS tag as non-content for safety
  return CONTENT_WORD_POS_PREFIXES.some(prefix => posTag.startsWith(prefix));
}

// --- Helper Type --- 
// Intermediate structure holding all data needed after initial stages
interface WordMappingData {
    sourceWord: string;
    sourcePos: string | null;
    targetWord: string;
    targetPos: string | null;
    llmDistractors: string[] | null;
}


// --- Pipeline Stages Implementation ---

/**
 * Stage 1: LLM Analysis
 * Sends text to LLM for translation, segmentation, and mapping.
 */
async function runLlmAnalysis(text: string): Promise<AnalysisResult> {
  console.log('[Analysis Pipeline] Requesting analysis from LLM...');
  const prompt = `You are an advanced linguistic analysis AI. Process the following ${SOURCE_LANGUAGE} text for a user learning ${TARGET_LANGUAGE}.

Text: "${text}"

Perform the following tasks:
1. Translate the entire text accurately into ${TARGET_LANGUAGE}.
2. Segment the original ${SOURCE_LANGUAGE} text into individual words.
3. Segment the translated ${TARGET_LANGUAGE} text into individual words. Ensure segmentation is natural for the target language.
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

  try {
    const responseContent = await ollamaChat({ model: ANALYSIS_MODEL, prompt });
    console.log('[Analysis Pipeline] Raw LLM Response Content:', responseContent);

    if (!responseContent) {
      throw new Error("LLM returned empty content.");
    }

    const jsonBlock = extractJsonBlock(responseContent);
    if (!jsonBlock) {
      throw new Error("No valid JSON block found in LLM response.");
    }
    console.log('[Analysis Pipeline] Successfully parsed extracted JSON block.');

    const analysisResult: AnalysisResult = JSON.parse(jsonBlock);
    validateAnalysisJson(analysisResult);
    console.log('[Analysis Pipeline] LLM JSON structure validated.');

    return analysisResult;
  } catch (error: any) {
    console.error('[Analysis Pipeline] LLM analysis failed:', error);
    throw new Error(`LLM Analysis Error: ${error.message}`);
  }
}

/**
 * Stage 2: Grammatical Variation Generation (using compromise.js)
 * Generates variations (past, negative, future) of the original phrase.
 */
async function generateAndStoreVariations(
    db: PGliteInterface,
    analysisResult: AnalysisResult,
    sourceUrl: string | null,
    encounterHighlight: string | null,
    encounterContext: string | null
): Promise<void> {
    console.log('[Pipeline] Generating grammatical variations...');
    const originalPhrase = analysisResult.originalPhrase;
    let variations: { type: string, text: string }[] = [];

    try {
        const doc = nlp(originalPhrase);

        // Simple check for single word to avoid meaningless variations
        if (doc.terms().length <= 1) {
            console.log(`[Pipeline] Skipping Compromise variations for single word: ${originalPhrase}`);
            return;
        }

        // 1. Past Tense
        const pastTense = doc.verbs().toPastTense().text();
        if (pastTense && pastTense !== originalPhrase) {
            variations.push({ type: 'past_tense', text: pastTense });
        }

        // 2. Negative
        const negative = doc.verbs().toNegative().text(); // Be mindful of context changes
        if (negative && negative !== originalPhrase) {
            variations.push({ type: 'negative', text: negative });
        }

        // 3. Future Tense
        const futureTense = doc.verbs().toFutureTense().text();
        if (futureTense && futureTense !== originalPhrase) {
             variations.push({ type: 'future_tense', text: futureTense });
        }

        console.log('[Pipeline] Generated Variations:', variations);

        // Process and store each variation
        for (const variation of variations) {
            try {
                // Run LLM analysis AGAIN for the variation to get its translation
                const variationAnalysisResult = await runLlmAnalysis(variation.text);
                
                 // Calculate a very distant future date for initial scheduling
                 const distantFutureDate = new Date();
                 distantFutureDate.setFullYear(distantFutureDate.getFullYear() + 99);

                // Store the variation phrase and its translation
                await addOrUpdateLexemeAndTranslation(
                    db,
                    variationAnalysisResult.originalPhrase, // The variation text
                    SOURCE_LANGUAGE,
                    null, // POS tagging not strictly needed for phrase level
                    variationAnalysisResult.translatedPhrase,
                    TARGET_LANGUAGE,
                    null,
                    `Variation of: "${originalPhrase}"`, // Context hint
                    null, // No distractors needed at this stage
                    sourceUrl,
                    encounterHighlight, // Keep original encounter info
                    encounterContext,
                    variation.type, // Store the variation type ('past_tense', etc.)
                    distantFutureDate // Schedule for the distant future
                );
                console.log(`[Pipeline] Stored variation '${variation.type}': ${variation.text}`);
            } catch (variationError: any) {
                console.error(`[Pipeline] Error processing variation '${variation.type}' (${variation.text}):`, variationError);
                // Continue with other variations even if one fails
            }
        }

    } catch (error) {
        console.error('[Pipeline] Error during variation generation:', error);
        // Don't let variation errors stop the main pipeline flow
    }
}

/**
 * Stage 3: Process and Store Full Phrase
 * Takes the main analysis result and stores the original phrase and its translation.
 * This is now the *only* item scheduled for immediate review initially.
 */
async function processAndStorePhrase(
  db: PGliteInterface,
  analysisResult: AnalysisResult, // Result from Stage 1
  sourceUrl: string | null,
  encounterHighlight: string | null,
  encounterContext: string | null
): Promise<void> {
  console.log('[Pipeline] Processing and storing ORIGINAL PHRASE results...');

  try {
    await addOrUpdateLexemeAndTranslation(
      db,
      analysisResult.originalPhrase,
      SOURCE_LANGUAGE,
      null, // POS not needed for phrase level
      analysisResult.translatedPhrase,
      TARGET_LANGUAGE,
      null, // POS not needed for phrase level
      null, // No context hint needed for the main phrase
      null, // No distractors needed at this stage
      sourceUrl,
      encounterHighlight,
      encounterContext,
      'original_phrase', // Specific type for the main phrase
      null // Schedule immediately (default)
    );
    console.log(`[Pipeline] Stored ORIGINAL PHRASE: '${analysisResult.originalPhrase}' -> '${analysisResult.translatedPhrase}'`);

  } catch (error: any) {
    console.error(`[Pipeline] Error storing original phrase:`, error);
    // Decide if this error should halt the entire process
    throw new Error(`Failed to store original phrase: ${error.message}`);
  }
  
  // The loop processing individual wordMappingsData is intentionally removed here
  // based on the new pedagogical strategy.
}



// --- Main Pipeline Orchestration ---

export async function runAnalysisPipeline(
  text: string,
  sourceUrl: string | null,
  encounterHighlight: string | null,
  encounterContext: string | null
): Promise<AnalysisResult> {
  console.log(`[Analysis Pipeline] Starting for: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

  let currentStage: PipelineStage = 'llm_analysis';
  let analysisResult: AnalysisResult | null = null;
  let db: PGliteInterface | null = null; // Keep initial null for broader catch scope if needed

  try {
    // Get DB instance first thing
    db = await getDbInstance();
    // Added null check to satisfy TypeScript and ensure DB is ready
    if (!db) {
        throw new Error("Database instance could not be initialized.");
    }

    // --- Stage 1: LLM Analysis ---    
    currentStage = 'llm_analysis'; // Set stage before await
    analysisResult = await runLlmAnalysis(text);
    
    // Ensure analysisResult is available before proceeding
    if (!analysisResult) {
        throw new Error("LLM Analysis did not return a valid result.");
    }

    // --- Stage 2: Grammatical Variations (Run BEFORE storing original phrase) ---
    currentStage = 'variations';
    // We now know db is not null here
    generateAndStoreVariations(
        db, 
        analysisResult, 
        sourceUrl, 
        encounterHighlight, 
        encounterContext
    ).catch(err => {
        console.error('[Pipeline] Background variation processing failed:', err);
    }); // Fire and forget (with error handling)

    // --- Stage 3: Store Original Phrase (Immediate SRS) --- 
    currentStage = 'store_phrase';
    // We also know db is not null here
    await processAndStorePhrase(
        db, 
        analysisResult, 
        sourceUrl, 
        encounterHighlight, 
        encounterContext
    );

    console.log('[Analysis Pipeline] Pipeline completed successfully.');
    return analysisResult; // Return the main analysis result

  } catch (error: any) {
    console.error(`[Analysis Pipeline] Error during stage '${currentStage}':`, error);
    throw error; // Re-throw the error to be caught by the caller
  } 
}

// --- Distractor Generation Logic (Potentially called separately) ---

// ...(Keep existing distractor generation functions: generateLLMDistractors, etc.) 