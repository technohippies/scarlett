import type { AlignmentData } from "../features/translator/TranslatorWidget";
import type { Grade } from 'ts-fsrs';
import type { DueLearningItem } from "../services/srs/types";
import type { Bookmark, Tag } from "../services/db/types";

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

// --- Study Summary ---

/** Request to get the counts of due/review/new items. */
export interface GetStudySummaryRequest {
  // Currently no parameters needed, but define interface for future use
}

/** Response containing the counts of due/review/new items. */
export interface GetStudySummaryResponse {
  dueCount: number;
  reviewCount: number;
  newCount: number;
  error?: string; // Optional error reporting
}

// --- Distractor Management ---

/** Request to cache generated distractors for a translation. */
export interface CacheDistractorsRequest {
  translationId: number;
  distractors: string[];
}

// --- Bookmark Related Message Types ---

/** Response for loading bookmarks */
export interface LoadBookmarksResponse {
  success: boolean;
  bookmarks?: Bookmark[];
  error?: string;
}

/** Response for saving a bookmark */
export interface SaveBookmarkResponse {
  success: boolean;
  bookmark?: Bookmark; // The newly created or updated bookmark
  error?: string;
}

/** Response for suggesting tags */
export interface TagSuggestResponse {
  success: boolean;
  suggestions?: string[];
  error?: string;
}

/** Response for listing tags */
export interface TagListResponse {
  success: boolean;
  tags?: Tag[]; // Assuming Tag type exists in db/types
  error?: string;
}

// --- Content Script -> Background Get Info Types ---
// (These were likely needed by popup/main.tsx)

export interface GetSelectedTextResponse {
  success: boolean;
  text?: string | null;
  error?: string;
}

export interface GetPageInfoResponse {
  success: boolean;
  title?: string;
  url?: string;
  error?: string;
}