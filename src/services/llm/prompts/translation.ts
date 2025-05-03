// src/services/llm/prompts/translation.ts
export function getDirectTranslationPrompt(sourceText: string, sourceLang: string, targetLang: string): string {
  // Instruct the LLM to be concise. Changed "word" to "text".
  return `Translate the following text from ${sourceLang} to ${targetLang}. Respond with ONLY the translation, without any additional text, explanations, or formatting.

  Text: "${sourceText}"

  Translation:`;
} 