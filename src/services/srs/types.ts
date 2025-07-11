/**
 * Represents the data needed to display and review a learning item.
 */
export interface DueLearningItem {
  learningId: number;      // The ID of the user_learning record
  translationId: number;   // The ID of the lexeme_translation record
  sourceLexemeId: number;
  targetLexemeId: number;
  sourceText: string;      // The text of the source lexeme (e.g., English word)
  targetText: string;      // The text of the target lexeme (e.g., Chinese translation)
  targetLang: string;      // The language code of the target lexeme (e.g., 'zh')
  // Deprecated - Use cachedDistractors
  // llmDistractors: string[] | null;
  // Added fields for adaptive MCQ
  cachedDistractors: string[] | null; // Distractors generated during review (if any)
  lastIncorrectChoice: string | null; // Text of the last incorrect choice made (if any)
  // Include current SRS state if needed for UI or logic (optional for now)
  currentState: number; // UNCOMMENTED: Assuming this will hold the FSRS state (0:New, 1:Learning, 2:Review, 3:Relearning)
  // currentStability: number;
  // currentDifficulty: number;
}

/**
 * Represents a summary of the user's current study queue.
 */
export interface StudySummary {
  dueCount: number;    // Count of items currently due for review
  reviewCount: number; // Count of items scheduled for review (may include due)
  newCount: number;    // Count of new items not yet learned
}

// Add other SRS-related types here later (e.g., ReviewGrade, FSRSParameters) 