// src/services/llm/prompts/translation.ts
export function getDirectTranslationPrompt(sourceWord: string, sourceLang: string, targetLang: string): string {
  // Instruct the LLM to be concise. Exact phrasing might need tuning.
  return `Translate the following word from ${sourceLang} to ${targetLang}. Respond with ONLY the single translated word, without any additional text, explanations, or formatting.

  Word: "${sourceWord}"

  Translation:`;
} 