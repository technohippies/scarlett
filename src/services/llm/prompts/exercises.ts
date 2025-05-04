// src/services/llm/prompts/exercises.ts

// Define an interface for the expected JSON structure
export interface MCQExerciseData {
  question: string;
  options: { id: number; text: string }[];
  correctOptionId: number;
}

export function getMCQGenerationPrompt(
  sourceText: string, // English text
  targetText: string, // Native translation
  sourceLang: string, // 'en'
  targetLang: string // Native language code
): string {
  // Instruct the LLM to output JSON. This improves reliability.
  return `You are an AI assistant creating language learning exercises. The user is learning ${targetLang} and their native language is ${sourceLang}.
  They have translated the ${sourceLang} word "${sourceText}" as "${targetText}" in ${targetLang}.

  Generate a multiple-choice question (MCQ) to test if the user knows the ${targetLang} translation of "${sourceText}".
  Include the correct answer ("${targetText}") and 3 plausible but incorrect options in ${targetLang}.
  The 'text' for each option should contain ONLY the characters of the ${targetLang} language, without any additional annotations like pinyin, pronunciation guides, or translations.

  Respond ONLY with a valid JSON object adhering to this exact structure (include the 'question' field formatted as shown):
  {
    "question": "Translate: ${sourceText}", // English prompt
    "options": [
      {"id": 0, "text": "Incorrect Option A in ${targetLang}"},
      {"id": 1, "text": "Incorrect Option B in ${targetLang}"},
      {"id": 2, "text": "${targetText}"}, // Correct Native Answer
      {"id": 3, "text": "Incorrect Option C in ${targetLang}"} // Ensure options are unique
    ],
    "correctOptionId": 2 // The 'id' number corresponding to the correct answer "${targetText}"
  }

  Do not include any text, explanations, or markdown formatting outside the JSON object.

  JSON response:`;
}

// NEW function for Native -> English direction
export function getMCQGenerationPromptNativeToEn(
    sourceText: string, // Native text (The prompt for the user)
    targetText: string, // English translation (The correct answer)
    sourceLang: string, // Native language code
    targetLang: string // 'en'
): string {

    // Basic validation
    if (!sourceText || !targetText || !sourceLang || targetLang !== 'en') {
        console.error("[getMCQGenerationPromptNativeToEn] Invalid arguments provided.");
        // Return a default error prompt or handle appropriately
        return "Error: Invalid parameters for Native-to-English prompt generation.";
    }

    return `You are an AI assistant creating language learning exercises. The user is learning ${targetLang} and their native language is ${sourceLang}.
  The user needs to translate the ${sourceLang} phrase "${sourceText}" into ${targetLang}.
  The correct ${targetLang} translation is "${targetText}".

  Generate a multiple-choice question (MCQ) to test if the user knows the ${targetLang} translation of "${sourceText}".
  Include the correct answer ("${targetText}") and 3 plausible but incorrect options in ${targetLang}.
  The incorrect options should be grammatically correct ${targetLang} phrases that are semantically similar or related to the correct answer, making them challenging distractors.
  The 'text' for each option should contain ONLY the characters of the ${targetLang} language.

  Respond ONLY with a valid JSON object adhering to this exact structure (include the 'question' field formatted as shown):
  {
    "question": "Translate: ${sourceText}", // Native prompt
    "options": [
      {"id": 0, "text": "Incorrect Option A in ${targetLang}"},
      {"id": 1, "text": "Incorrect Option B in ${targetLang}"},
      {"id": 2, "text": "${targetText}"}, // Correct English Answer
      {"id": 3, "text": "Incorrect Option C in ${targetLang}"} // Ensure options are unique
    ],
    "correctOptionId": 2 // The 'id' number corresponding to the correct answer "${targetText}"
  }

  Do not include any text, explanations, or markdown formatting outside the JSON object.

  JSON response:`;
}