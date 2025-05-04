import type { AlignmentData } from "../features/translator/TranslatorWidget";
import type { Grade } from 'ts-fsrs';
import type { DueLearningItem } from "../services/srs/types";

/**
 * Payload sent from the background script to the content script
 * to display the translator widget with the translation result.
 */
export interface DisplayTranslationPayload {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  pronunciation?: string;
  contextText?: string; // Optional context from where the text was selected
}

/**
 * Payload sent from the content script (TranslatorWidget)
 * to the background script to request TTS audio generation.
 */
export interface GenerateTTSPayload {
  text: string;
  lang: string;
  speed: number;
}

/**
 * Payload sent from the background script to the content script
 * to update the widget with word alignment data after TTS generation.
 */
export interface UpdateAlignmentPayload {
  alignment: AlignmentData | null;
  // TODO: Consider adding an identifier if multiple widgets could exist
  // or if the request/response needs explicit linking.
  // widgetId?: string;
}

// --- New Tab / Review Communication --- 

// Get Due Items
export interface GetDueItemsRequest {
  limit: number;
}
export interface GetDueItemsResponse {
  dueItems: DueLearningItem[];
}

// Get Distractors
export interface GetDistractorsRequest {
  correctTargetLexemeId: number;
  targetLanguage: string;
  count: number;
}
export interface GetDistractorsResponse {
  distractors: string[];
}

// Submit Review Result
export interface SubmitReviewRequest {
  learningId: number;
  grade: Grade;
  incorrectChoiceText?: string | null;
}
export interface SubmitReviewResponse {
  success: boolean;
  error?: string;
}

// Cache Distractors
export interface CacheDistractorsRequest {
  translationId: number;
  distractors: string[];
}
export interface CacheDistractorsResponse {
  success: boolean;
  error?: string;
}

// Generate LLM Distractors (New)
export interface GenerateLLMDistractorsRequest {
  sourceText: string;
  targetText: string;
  targetLang: string;
  count: number;
  direction: 'EN_TO_NATIVE' | 'NATIVE_TO_EN';
}
export interface GenerateLLMDistractorsResponse {
  distractors: string[];
  error?: string;
}

// --- Content Script -> Background Communication --- 
// (Example - if content script needed to send data)
// ...