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

  // Get language-specific example
  const languageExample = getLanguagePairExample(originalWordLanguageName, distractorsLanguageName);

  let basePrompt = `
Your task: Generate ${distractorCount} unique ${distractorsLanguageName} words/phrases.
These must be plausible but **incorrect** translations for the ${originalWordLanguageName} word: \"${wordToTranslate}\".
(Good distractors may be related by spelling, sound, or meaning, but must not be the correct translation.)

Output: A valid JSON array of ${distractorCount} ${distractorsLanguageName} strings. E.g., [\"val1\", \"val2\", \"val3\"].

${languageExample}

**Critical Rule:** You MUST NOT include the actual correct ${distractorsLanguageName} translation of \"${wordToTranslate}\".
(e.g., If \"CORRECT WORD\" is the right translation, it must NOT be in your list.)`;

  // Add language-specific instructions for script consistency and quality
  const distractorLangLower = distractorsLanguageName.toLowerCase();
  
  if (distractorLangLower === 'chinese') {
    basePrompt += `

**Important for Chinese distractors:**
- Provide ONLY Chinese characters (汉字). NO Pinyin, NO romanization.
- Use Simplified Chinese characters unless context suggests Traditional.
- Example: For "love", output [\"恨\", \"怕\", \"问\"], NOT [\"hèn\", \"pà\", \"wèn\"] or [\"恨 (hèn)\"].
- Make distractors plausible but clearly wrong (related concepts, similar meanings, or common words).`;
  
  } else if (distractorLangLower === 'japanese') {
    basePrompt += `

**Important for Japanese distractors:**
- Use appropriate Japanese scripts (hiragana, katakana, or kanji) as would be natural.
- NO romanization (romaji). Use actual Japanese characters only.
- Example: For "I", output [\"あなた\", \"彼\", \"彼女\"], NOT [\"anata\", \"kare\", \"kanojo\"].
- Consider using mix of scripts where appropriate (e.g., hiragana for particles, kanji for nouns).`;
  
  } else if (distractorLangLower === 'korean') {
    basePrompt += `

**Important for Korean distractors:**
- Use Hangul (Korean characters) only. NO romanization.
- Example: For "hello", output [\"안녕\", \"잘가\", \"고마워\"], NOT [\"annyeong\", \"jalga\", \"gomawo\"].
- Make distractors contextually plausible but incorrect.`;
  
  } else if (distractorLangLower === 'vietnamese') {
    basePrompt += `

**Important for Vietnamese distractors:**
- Include proper Vietnamese diacritical marks (à, á, ả, ã, ạ, etc.).
- Example: For "hello", output [\"tạm biệt\", \"cảm ơn\", \"xin lỗi\"], NOT [\"tam biet\", \"cam on\", \"xin loi\"].
- Ensure tonal marks are correct and natural.`;
  
  } else if (distractorLangLower === 'thai') {
    basePrompt += `

**Important for Thai distractors:**
- Use Thai script (ไทย) only. NO romanization.
- Example: For "hello", output [\"ลาก่อน\", \"ขอบคุณ\", \"ขอโทษ\"], NOT [\"laa gorn\", \"khop khun\", \"khor toht\"].
- Ensure proper Thai spelling and script usage.`;
  
  } else if (distractorLangLower === 'arabic') {
    basePrompt += `

**Important for Arabic distractors:**
- Use Arabic script (العربية) only. NO romanization.
- Write from right-to-left as natural in Arabic.
- Example: For "hello", output [\"وداعاً\", \"شكراً\", \"آسف\"], NOT [\"wadaan\", \"shukran\", \"aasif\"].
- Ensure proper Arabic spelling and diacritical marks where appropriate.`;
  
  } else if (distractorLangLower === 'english') {
    basePrompt += `

**Important for English distractors:**
- Use standard English words/phrases only.
- Make distractors plausible alternatives that could confuse a learner.
- Avoid overly obscure words; use common vocabulary that might be confused with the target.
- Consider words with similar sounds, spellings, or related meanings.`;
  
  } else {
    // Generic instruction for other languages
    basePrompt += `

**Important for ${distractorsLanguageName} distractors:**
- Use only the native script/alphabet of ${distractorsLanguageName}.
- NO romanization or transliteration into Latin alphabet.
- Ensure proper spelling and diacritical marks as natural in ${distractorsLanguageName}.
- Make distractors contextually plausible but clearly incorrect.`;
  }

  basePrompt += `

Return only the JSON array:
`;

  return basePrompt.trim();
}

/**
 * Validates that distractors are in the expected language/script
 * This helps catch cases where LLM might return mixed scripts or romanization
 */
export function validateDistractorLanguage(distractors: string[], expectedLanguage: string): {
  valid: string[];
  invalid: string[];
  warnings: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];
  
  const langLower = expectedLanguage.toLowerCase();
  
  for (const distractor of distractors) {
    let isValid = true;
    let warning = '';
    
    // Check for common issues based on language
    if (langLower === 'chinese') {
      // Should contain Chinese characters, not Latin alphabet
      const hasChineseChars = /[\u4e00-\u9fff]/.test(distractor);
      const hasLatinChars = /[a-zA-Z]/.test(distractor);
      
      if (!hasChineseChars || hasLatinChars) {
        isValid = false;
        warning = `Chinese distractor "${distractor}" contains Latin characters or lacks Chinese characters`;
      }
      
    } else if (langLower === 'japanese') {
      // Should contain Japanese characters (hiragana, katakana, or kanji)
      const hasJapaneseChars = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(distractor);
      const hasLatinChars = /[a-zA-Z]/.test(distractor);
      
      if (!hasJapaneseChars || hasLatinChars) {
        isValid = false;
        warning = `Japanese distractor "${distractor}" contains Latin characters or lacks Japanese characters`;
      }
      
    } else if (langLower === 'korean') {
      // Should contain Hangul characters
      const hasKoreanChars = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(distractor);
      const hasLatinChars = /[a-zA-Z]/.test(distractor);
      
      if (!hasKoreanChars || hasLatinChars) {
        isValid = false;
        warning = `Korean distractor "${distractor}" contains Latin characters or lacks Korean characters`;
      }
      
    } else if (langLower === 'arabic') {
      // Should contain Arabic characters
      const hasArabicChars = /[\u0600-\u06ff\u0750-\u077f]/.test(distractor);
      const hasLatinChars = /[a-zA-Z]/.test(distractor);
      
      if (!hasArabicChars || hasLatinChars) {
        isValid = false;
        warning = `Arabic distractor "${distractor}" contains Latin characters or lacks Arabic characters`;
      }
      
    } else if (langLower === 'thai') {
      // Should contain Thai characters
      const hasThaiChars = /[\u0e00-\u0e7f]/.test(distractor);
      const hasLatinChars = /[a-zA-Z]/.test(distractor);
      
      if (!hasThaiChars || hasLatinChars) {
        isValid = false;
        warning = `Thai distractor "${distractor}" contains Latin characters or lacks Thai characters`;
      }
      
    } else if (langLower === 'english') {
      // Should be primarily Latin alphabet
      const hasNonLatinChars = /[^\u0000-\u007f\u00a0-\u024f\u1e00-\u1eff]/.test(distractor);
      
      if (hasNonLatinChars) {
        isValid = false;
        warning = `English distractor "${distractor}" contains non-Latin characters`;
      }
    }
    
    // Additional checks for all languages
    if (distractor.trim().length === 0) {
      isValid = false;
      warning = 'Empty distractor';
    }
    
    if (isValid) {
      valid.push(distractor);
    } else {
      invalid.push(distractor);
      if (warning) warnings.push(warning);
    }
  }
  
  return { valid, invalid, warnings };
}

/**
 * Gets example distractors for the prompt based on language pair
 */
export function getLanguagePairExample(originalLang: string, distractorLang: string): string {
  const origLower = originalLang.toLowerCase();
  const distLower = distractorLang.toLowerCase();
  
  // Define good examples for different language pairs
  if (origLower === 'english' && distLower === 'chinese') {
    return 'Example: For "hello", output ["再见", "谢谢", "对不起"], NOT ["zaijian", "xiexie", "duibuqi"]';
  } else if (origLower === 'chinese' && distLower === 'english') {
    return 'Example: For "你好", output ["goodbye", "thanks", "sorry"], NOT ["nihao", "hello"]';
  } else if (origLower === 'english' && distLower === 'japanese') {
    return 'Example: For "hello", output ["さようなら", "ありがとう", "すみません"], NOT ["sayounara", "arigatou", "sumimasen"]';
  } else if (origLower === 'japanese' && distLower === 'english') {
    return 'Example: For "こんにちは", output ["goodbye", "thanks", "sorry"], NOT ["konnichiwa", "hello"]';
  } else if (origLower === 'english' && distLower === 'vietnamese') {
    return 'Example: For "hello", output ["tạm biệt", "cảm ơn", "xin lỗi"], NOT ["tam biet", "cam on", "xin loi"]';
  } else if (origLower === 'vietnamese' && distLower === 'english') {
    return 'Example: For "xin chào", output ["goodbye", "thanks", "sorry"], NOT ["xin chao", "hello"]';
  } else {
    // Generic example
    return `Example: Create ${distractorLang} words that could plausibly confuse a learner, but are clearly incorrect`;
  }
}