import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import type { LLMConfig, LLMChatResponse, ChatMessage } from '../../services/llm/types';
import { addOrUpdateLearnedItem } from '../../services/db/learning';

// Interface matching the expected LLM JSON output structure
// (Could potentially be moved to a shared types file later)
interface LLMAnalysisResult {
  originalPhrase: string;
  translatedPhrase: string;
  wordMappings: {
    sourceWord: string;
    targetWord: string;
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
 * parses the result, and updates the database.
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

    // 3. Add/Update data in the Database
    console.log('[Analysis Pipeline] Calling addOrUpdateLearnedItem...');
    await addOrUpdateLearnedItem({
      llmResult: analysisResult,
      sourceLang,
      targetLang,
      sourceUrl,
    });
    console.log('[Analysis Pipeline] Database operation completed for:', analysisResult.originalPhrase);

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