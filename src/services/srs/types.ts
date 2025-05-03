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
  // Include current SRS state if needed for UI or logic (optional for now)
  // currentState: number;
  // currentStability: number;
  // currentDifficulty: number;
}

// Add other SRS-related types here later (e.g., ReviewGrade, FSRSParameters) 