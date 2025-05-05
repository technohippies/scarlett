/**
 * Generates a prompt for the LLM to perform translation, segmentation,
 * and word mapping, returning a structured JSON.
 */
export function getLLMAnalysisPrompt(sourceText: string, sourceLang: string, targetLang: string): string {
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

// Add any other analysis-related prompts here

/**
 * Creates a prompt to summarize the provided text concisely.
 * @param text The text to summarize.
 * @returns The summarization prompt string.
 */
export function getSummarizationPrompt(text: string): string {
  // Basic prompt, might need refinement based on LLM behavior
  return `Please provide a concise summary of the following text. Focus on the main points and key information. Aim for a summary that is significantly shorter than the original text but captures its essence.

Original Text:
---
${text}
---

Concise Summary:`;
} 