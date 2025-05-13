// src/services/llm/prompts/exercises.ts

// Define an interface for the expected JSON structure
export interface MCQExerciseData {
  question: string;
  options: { id: number; text: string }[];
  correctOptionId: number;
}

export function getMCQGenerationPrompt(
  exerciseSourceText: string, 
  exerciseTargetText: string, 
  exerciseSourceLanguageFullName: string, 
  exerciseTargetLanguageFullName: string, 
  userActualNativeLanguageFullName: string,
  userActualTargetLanguageFullName: string
): string {
  return `You are an AI assistant creating language learning exercises. The user is learning ${userActualTargetLanguageFullName} and their native language is ${userActualNativeLanguageFullName}.
  They have translated the ${exerciseSourceLanguageFullName} word "${exerciseSourceText}" as "${exerciseTargetText}" in ${exerciseTargetLanguageFullName}.

  Generate a multiple-choice question (MCQ) to test if the user knows the ${exerciseTargetLanguageFullName} translation of "${exerciseSourceText}".
  Include the correct answer ("${exerciseTargetText}") and 3 plausible but incorrect options in ${exerciseTargetLanguageFullName}.
  The 'text' for each option should contain ONLY the characters of the ${exerciseTargetLanguageFullName} language, without any additional annotations like pinyin, pronunciation guides, or translations.

  Respond ONLY with a valid JSON object adhering to this exact structure (include the 'question' field formatted as shown):
  {
    "question": "Translate: ${exerciseSourceText}",
    "options": [
      {"id": 0, "text": "A plausible incorrect ${exerciseTargetLanguageFullName} option"},
      {"id": 1, "text": "Another different incorrect ${exerciseTargetLanguageFullName} option"},
      {"id": 2, "text": "${exerciseTargetText}"},
      {"id": 3, "text": "A third varied incorrect ${exerciseTargetLanguageFullName} option"}
    ],
    "correctOptionId": 2
  }

  Do not include any text, explanations, or markdown formatting outside the JSON object.

  JSON response:`;
}

// NEW function for Native -> English direction
export function getMCQGenerationPromptNativeToEn(
  exerciseSourceText: string, 
  exerciseTargetText: string, 
  exerciseSourceLanguageFullName: string, 
  exerciseTargetLanguageFullName: string, 
  userActualNativeLanguageFullName: string,
  userActualTargetLanguageFullName: string
): string {
  return `You are an AI assistant creating language learning exercises. The user is learning ${userActualTargetLanguageFullName} and their native language is ${userActualNativeLanguageFullName}.
  The user needs to translate the ${exerciseSourceLanguageFullName} phrase "${exerciseSourceText}" into ${exerciseTargetLanguageFullName}.
  The correct ${exerciseTargetLanguageFullName} translation is "${exerciseTargetText}".

  Generate a multiple-choice question (MCQ) to test if the user knows the ${exerciseTargetLanguageFullName} translation of "${exerciseSourceText}".
  Include the correct answer ("${exerciseTargetText}") and 3 plausible but incorrect options in ${exerciseTargetLanguageFullName}.
  The 'text' for each option should contain ONLY the characters of the ${exerciseTargetLanguageFullName} language.

  Respond ONLY with a valid JSON object adhering to this exact structure (include the 'question' field formatted as shown):
  {
    "question": "Translate: ${exerciseSourceText}",
    "options": [
      {"id": 0, "text": "A plausible incorrect ${exerciseTargetLanguageFullName} option"},
      {"id": 1, "text": "Another different incorrect ${exerciseTargetLanguageFullName} option"},
      {"id": 2, "text": "${exerciseTargetText}"},
      {"id": 3, "text": "A third varied incorrect ${exerciseTargetLanguageFullName} option"}
    ],
    "correctOptionId": 2
  }

  Do not include any text, explanations, or markdown formatting outside the JSON object.

  JSON response:`;
}

export function getLLMDistractorsPrompt(
  wordToTranslate: string,        // e.g., "class"
  originalWordLanguageName: string, // e.g., "English"
  distractorsLanguageName: string,  // e.g., "Vietnamese"
  distractorCount: number = 3
): string {
  // More direct prompt, focusing on NOT providing the correct translation.
  // It also gives a clear bad example of what NOT to do.

  let basePrompt = `
Your task: Generate ${distractorCount} unique ${distractorsLanguageName} words/phrases.
These must be plausible but **incorrect** translations for the ${originalWordLanguageName} word: \"${wordToTranslate}\".
(Good distractors may be related by spelling, sound, or meaning, but must not be the correct translation.)

Output: A valid JSON array of ${distractorCount} ${distractorsLanguageName} strings. E.g., [\"val1\", \"val2\", \"val3\"].

Example of good distractors (if creating English distractors for French \"chat\" [cat]):
[\"chatting\", \"hat\", \"dog\"]

**Critical Rule:** You MUST NOT include the actual correct ${distractorsLanguageName} translation of \"${wordToTranslate}\".
(e.g., If \"CORRECT WORD\" is the right translation, it must NOT be in your list.)`;

  // Add specific instruction for Chinese to exclude Pinyin
  if (distractorsLanguageName.toLowerCase() === 'chinese') {
    basePrompt += `

**Important:** For Chinese distractors, provide ONLY the characters. DO NOT include Pinyin (romanization). E.g., for "爱", output [\"恨\", \"怕\", \"问\"], NOT [\"hèn\", \"pà\", \"wèn\"] or [\"恨 (hèn)\"].`;
  }

  basePrompt += `

Return only the JSON array:
`;

  return basePrompt.trim();
}