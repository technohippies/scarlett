// src/services/llm/prompts/exercises.ts

// Define an interface for the expected JSON structure
export interface MCQExerciseData {
  question: string;
  options: { id: number; text: string }[];
  correctOptionId: number;
}

export function getMCQGenerationPrompt(
  sourceWord: string,
  translatedWord: string,
  sourceLang: string,
  targetLang: string,
  context?: string // Optional context sentence
): string {
  const contextInstruction = context
    ? ` The word appeared in this context: "${context}"`
    : "";

  // Instruct the LLM to output JSON. This improves reliability.
  return `You are an AI assistant creating language learning exercises. The user is learning ${targetLang} and their native language is ${sourceLang}.
  They have translated the ${sourceLang} word "${sourceWord}" as "${translatedWord}" in ${targetLang}.${contextInstruction}

  Generate a multiple-choice question (MCQ) to test if the user knows the ${targetLang} translation of "${sourceWord}".
  Include the correct answer ("${translatedWord}") and 3 plausible but incorrect options in ${targetLang}.
  The 'text' for each option should contain ONLY the characters of the ${targetLang} language, without any additional annotations like pinyin, pronunciation guides, or translations.

  Respond ONLY with a valid JSON object adhering to this exact structure (include the 'question' field formatted as shown):
  {
    "question": "Translate: ${sourceWord}",
    "options": [
      {"id": 0, "text": "Incorrect Option A in ${targetLang}"},
      {"id": 1, "text": "Incorrect Option B in ${targetLang}"},
      {"id": 2, "text": "${translatedWord}"},
      {"id": 3, "text": "Incorrect Option C in ${targetLang}"} // Ensure options are unique
    ],
    "correctOptionId": 2 // The 'id' number corresponding to the correct answer "${translatedWord}"
  }

  Do not include any text, explanations, or markdown formatting outside the JSON object.

  JSON response:`;
} 