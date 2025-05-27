import type { AlignmentData } from "../features/translator/TranslatorWidget";
import type { Rating } from 'ts-fsrs';
import type { DueLearningItem } from "../services/srs/types";
import type { Bookmark, Tag } from "../services/db/types";
import type { Thread, ChatMessage } from '../features/chat/types';
import type { EmbeddingResult } from '../services/llm/embedding';
import type { FunctionConfig } from '../services/storage/types';
import type { PersonalityEmbeddingResult } from '../services/llm/personalityService';

/**
 * Payload sent from the background script to the content script
 * to display the translator widget with the translation result.
 */
export interface DisplayTranslationPayload {
  originalText: string;       // The text that was originally selected
  translatedText?: string;    // The translation result (optional during loading)
  sourceLang: string;
  targetLang: string;
  pronunciation?: string;
  isLoading: boolean;         // To indicate the loading state
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
  excludeNewIfLimitReached?: boolean; // Optional: Hint to scheduler
  newItemsStudiedToday?: number;      // Optional: Current count of new items studied
  dailyNewItemLimit?: number;         // Optional: The daily limit for new items
}
export interface GetDueItemsResponse {
  success: boolean;
  dueItems?: DueLearningItem[];
  error?: string;
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
  grade: Rating;
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
  correctAnswerForFiltering: string;
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

// --- Page Content Extraction ---

/** Request from background to content script to get page HTML */
export interface GetPageContentRequest {}

/** Response from content script with page HTML */
export interface GetPageContentResponse {
  success: boolean;
  htmlContent?: string; // The innerHTML of the body
  error?: string;
}

// --- NEW Message Type for Content Script Markdown Extraction ---
export interface ExtractMarkdownRequest {
  htmlContent: string;
  baseUrl?: string; // Optional: Base URL for resolving relative links
}

export interface ExtractMarkdownResponse {
  success: boolean;
  markdown?: string | null;
  title?: string | null;
  error?: string;
}

// --- END NEW Message Type ---

// AlignmentData is imported from "../features/translator/TranslatorWidget.tsx"
// The local re-definition below is removed to avoid conflict and use the canonical version.
/*
export interface AlignmentData {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
}
*/

// --- NEW: Active Learning Words Highlighting ---

/**
 * Data structure for a word the user is actively learning,
 * including its text and primary translation.
 */
export interface LearningWordData {
  sourceText: string;      // The word/phrase in the source language
  translatedText: string;  // The primary translation in the target language
  sourceLang: string;      // Source language code (e.g., 'en')
  targetLang: string;      // Target language code (e.g., 'zh-CN')
}

/**
 * Payload for the content script to request the list of active learning words
 * from the background script.
 */
export interface RequestActiveLearningWordsPayload {
  // No parameters needed for now
  sourceLanguage: string;
  targetLanguage: string;
}

/**
 * Response from the background script containing the list of active learning words.
 */
export interface RequestActiveLearningWordsResponse {
  success: boolean;
  words?: LearningWordData[];
  error?: string;
}

// --- END NEW: Active Learning Words Highlighting ---

// --- Daily Study Stats --- 
export interface GetDailyStudyStatsRequest {
  // No params needed for now
}
export interface GetDailyStudyStatsResponse {
  success: boolean;
  lastResetDate?: string; // YYYY-MM-DD
  newItemsStudiedToday?: number;
  error?: string;
}

export interface IncrementDailyNewItemsStudiedRequest {
  // No params needed, action implies intent
}
export interface IncrementDailyNewItemsStudiedResponse {
  success: boolean;
  updatedNewItemsStudiedToday?: number;
  error?: string;
}
// --- END Daily Study Stats ---

// --- Study Streak Data ---
export interface GetStudyStreakDataRequest {
  // No params needed
}
export interface GetStudyStreakDataResponse {
  success: boolean;
  currentStreak?: number;
  longestStreak?: number;
  lastStreakIncrementDate?: string | null; // YYYY-MM-DD
  lastActivityDate?: string | null; // YYYY-MM-DD
  error?: string;
}

export interface NotifyDailyGoalCompleteRequest {
  // No params needed, action implies intent
}
export interface NotifyDailyGoalCompleteResponse {
  success: boolean;
  updatedStreakData?: {
    currentStreak: number;
    longestStreak: number;
    lastStreakIncrementDate: string | null;
    lastActivityDate: string | null;
  };
  error?: string;
}

export interface RecordStudyActivityTodayRequest {
    // No params needed
}
export interface RecordStudyActivityTodayResponse {
    success: boolean;
    error?: string;
}
// --- END Study Streak Data ---

// ---- START: BackgroundProtocolMap Definition ----
// Ensure all request/response types used in this map are defined above or imported.

export interface DeckInfoForFiltering {
    id: string; 
    name: string;
    description?: string;
    cardCount: number;
    sourceLanguage: string | null;
    targetLanguage: string | null;
    pathIdentifier: string;
}

export interface PageVersionToEmbed {
  versionId: number;
  url: string;
  markdownContent: string;
  description?: string | null;
  markdownHash: string;
}

// Add bookmark embedding types
export interface BookmarkToEmbed {
  bookmarkId: number;
  url: string;
  content: string; // Combined title + selected_text
  title?: string | null;
  selectedText?: string | null;
}

// Unified embedding item type
export interface EmbeddingItem {
  type: 'page' | 'bookmark';
  id: number; // versionId for pages, bookmarkId for bookmarks
  url: string;
  content: string; // markdownContent for pages, combined content for bookmarks
  metadata?: {
    title?: string | null;
    selectedText?: string | null;
    description?: string | null;
    markdownHash?: string;
  };
}

export interface BackgroundProtocolMap {
    /** Return pages needing embedding for UI-driven in-browser pipeline */
    getPagesNeedingEmbedding(): Promise<{ success: boolean; pages: PageVersionToEmbed[] }>;
    /** Return items (pages + bookmarks) needing embedding for unified pipeline */
    getItemsNeedingEmbedding(): Promise<{ success: boolean; items: EmbeddingItem[] }>;
    /** Finalize a single page version embedding from UI-driven pipeline */
    finalizePageVersionEmbedding(data: {
      versionId: number;
      embeddingInfo: EmbeddingResult;
      summaryContent?: string;
      summaryHash?: string;
    }): Promise<{ success: boolean; error?: string }>;
    /** Finalize embedding for any item (page or bookmark) */
    finalizeItemEmbedding(data: {
      type: 'page' | 'bookmark';
      id: number;
      embeddingInfo: EmbeddingResult;
      summaryContent?: string;
      summaryHash?: string;
    }): Promise<{ success: boolean; error?: string }>;
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    getDistractorsForItem(data: GetDistractorsRequest): Promise<GetDistractorsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
    cacheDistractors(data: CacheDistractorsRequest): Promise<CacheDistractorsResponse>;
    generateLLMDistractors(data: GenerateLLMDistractorsRequest): Promise<GenerateLLMDistractorsResponse>;
    getStudySummary(data: GetStudySummaryRequest): Promise<GetStudySummaryResponse>;
    saveBookmark(data: { url: string; title?: string | null; tags?: string | null; selectedText?: string | null }): 
        Promise<SaveBookmarkResponse>;
    loadBookmarks(): Promise<LoadBookmarksResponse>;
    'tag:list': () => Promise<TagListResponse>;
    'tag:suggest': (data: { title: string; url: string; pageContent?: string | null }) => 
        Promise<TagSuggestResponse>;
    getPageInfo: () => Promise<GetPageInfoResponse>;
    getSelectedText: () => Promise<GetSelectedTextResponse>;
    processPageVisit: (data: { url: string; title: string; markdownContent: string; defuddleMetadata: any }) => Promise<void>;
    triggerBatchEmbedding(): Promise<{ 
        success: boolean; 
        finalizedCount?: number; 
        duplicateCount?: number; 
        errorCount?: number;
        error?: string;
    }>;
    getPendingEmbeddingCount(): Promise<{ count: number }>;
    generateTTS(data: GenerateTTSPayload): Promise<void>;
    extractMarkdownFromHtml(data: ExtractMarkdownRequest): Promise<ExtractMarkdownResponse>;
    REQUEST_TTS_FROM_WIDGET(data: { text: string; lang: string; speed?: number }): 
        Promise<{ success: boolean; audioDataUrl?: string; error?: string }>;
    REQUEST_ACTIVE_LEARNING_WORDS(data: RequestActiveLearningWordsPayload): Promise<RequestActiveLearningWordsResponse>;
    addLearningDeck(data: { deckIdentifier: string }): Promise<{ success: boolean, error?: string }>;
    GET_LEARNING_WORDS_BY_TRANSLATION_IDS(data: { translationIds: number[] }): Promise<{ success: boolean; words?: any[]; error?: string }>;
    REQUEST_LEARNING_WORDS_FOR_HIGHLIGHTING(): Promise<{ success: boolean; words?: any[]; error?: string }>;
    fetchAvailableDeckFiles(): Promise<{ success: boolean; decks?: DeckInfoForFiltering[]; error?: string }>;
    getDailyStudyStats(data: GetDailyStudyStatsRequest): Promise<GetDailyStudyStatsResponse>;
    incrementDailyNewItemsStudied(data: IncrementDailyNewItemsStudiedRequest): Promise<IncrementDailyNewItemsStudiedResponse>;
    getStudyStreakData(data: GetStudyStreakDataRequest): Promise<GetStudyStreakDataResponse>;
    notifyDailyGoalComplete(data: NotifyDailyGoalCompleteRequest): Promise<NotifyDailyGoalCompleteResponse>;
    recordStudyActivityToday(data: RecordStudyActivityTodayRequest): Promise<RecordStudyActivityTodayResponse>;
    songDetected(data: SongDetectedMessagePayload): Promise<void>;
    
    // Chat Operations
    getAllChatThreads(): Promise<Thread[]>;
    getChatMessages(data: { threadId: string }): Promise<ChatMessage[]>;
    addChatThread(data: NewChatThreadDataForRpc): Promise<Thread>;
    addChatMessage(data: NewChatMessageDataForRpc): Promise<ChatMessage>;
    updateChatThreadTitle(data: { threadId: string; newTitle: string }): Promise<void>;
    deleteChatThread(data: { threadId: string }): Promise<{ success: boolean; error?: string }>;
    
    // Personality Operations
    embedPersonality(data: EmbedPersonalityRequest): Promise<EmbedPersonalityResponse>;
}
// ---- END: BackgroundProtocolMap Definition ----

/**
 * Defines the structure for messages related to song detection.
 */
export interface SongDetectedMessagePayload {
  trackName: string;
  artistName: string;
  albumName: string | null; // Album name can sometimes be null
}

export interface SongDetectedMessage {
  type: 'songDetected';
  payload: SongDetectedMessagePayload;
}

/**
 * Defines the structure for lyrics data fetched from lrclib.
 */
export interface LyricsInfo {
  lrclibId: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration?: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null; // JSON string of synced lyrics, or null
  hasSyncedLyrics: boolean;
}

// You can expand this union type as you add more message types
export type BackgroundMessage = SongDetectedMessage;

// Example of how you might define messages sent *from* background *to* content scripts or UI
// export interface LyricsStoredMessage {
//   type: 'lyricsStored';
//   payload: { lrclibId: number; success: boolean };
// }
// export type UIMessage = LyricsStoredMessage;

// --- START NEW CHAT RPC DEFINITIONS ---
export interface NewChatThreadDataForRpc {
  id: string;
  title: string;
  systemPrompt?: string;
  scenarioDescription?: string;
}

export interface NewChatMessageDataForRpc {
  id: string;
  thread_id: string;
  sender: 'user' | 'ai';
  text_content: string;
  tts_lang?: string;
  tts_alignment_data?: any;
}

export interface BackgroundProtocolMap {
    /** Return pages needing embedding for UI-driven in-browser pipeline */
    getPagesNeedingEmbedding(): Promise<{ success: boolean; pages: PageVersionToEmbed[] }>;
    /** Return items (pages + bookmarks) needing embedding for unified pipeline */
    getItemsNeedingEmbedding(): Promise<{ success: boolean; items: EmbeddingItem[] }>;
    /** Finalize a single page version embedding from UI-driven pipeline */
    finalizePageVersionEmbedding(data: {
      versionId: number;
      embeddingInfo: EmbeddingResult;
      summaryContent?: string;
      summaryHash?: string;
    }): Promise<{ success: boolean; error?: string }>;
    /** Finalize embedding for any item (page or bookmark) */
    finalizeItemEmbedding(data: {
      type: 'page' | 'bookmark';
      id: number;
      embeddingInfo: EmbeddingResult;
      summaryContent?: string;
      summaryHash?: string;
    }): Promise<{ success: boolean; error?: string }>;
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    getDistractorsForItem(data: GetDistractorsRequest): Promise<GetDistractorsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
    cacheDistractors(data: CacheDistractorsRequest): Promise<CacheDistractorsResponse>;
    generateLLMDistractors(data: GenerateLLMDistractorsRequest): Promise<GenerateLLMDistractorsResponse>;
    getStudySummary(data: GetStudySummaryRequest): Promise<GetStudySummaryResponse>;
    saveBookmark(data: { url: string; title?: string | null; tags?: string | null; selectedText?: string | null }): 
        Promise<SaveBookmarkResponse>;
    loadBookmarks(): Promise<LoadBookmarksResponse>;
    'tag:list': () => Promise<TagListResponse>;
    'tag:suggest': (data: { title: string; url: string; pageContent?: string | null }) => 
        Promise<TagSuggestResponse>;
    getPageInfo: () => Promise<GetPageInfoResponse>;
    getSelectedText: () => Promise<GetSelectedTextResponse>;
    processPageVisit: (data: { url: string; title: string; markdownContent: string; defuddleMetadata: any }) => Promise<void>;
    triggerBatchEmbedding(): Promise<{ 
        success: boolean; 
        finalizedCount?: number; 
        duplicateCount?: number; 
        errorCount?: number;
        error?: string;
    }>;
    getPendingEmbeddingCount(): Promise<{ count: number }>;
    generateTTS(data: GenerateTTSPayload): Promise<void>;
    extractMarkdownFromHtml(data: ExtractMarkdownRequest): Promise<ExtractMarkdownResponse>;
    REQUEST_TTS_FROM_WIDGET(data: { text: string; lang: string; speed?: number }): 
        Promise<{ success: boolean; audioDataUrl?: string; error?: string }>;
    REQUEST_ACTIVE_LEARNING_WORDS(data: RequestActiveLearningWordsPayload): Promise<RequestActiveLearningWordsResponse>;
    addLearningDeck(data: { deckIdentifier: string }): Promise<{ success: boolean, error?: string }>;
    GET_LEARNING_WORDS_BY_TRANSLATION_IDS(data: { translationIds: number[] }): Promise<{ success: boolean; words?: any[]; error?: string }>;
    REQUEST_LEARNING_WORDS_FOR_HIGHLIGHTING(): Promise<{ success: boolean; words?: any[]; error?: string }>;
    fetchAvailableDeckFiles(): Promise<{ success: boolean; decks?: DeckInfoForFiltering[]; error?: string }>;
    getDailyStudyStats(data: GetDailyStudyStatsRequest): Promise<GetDailyStudyStatsResponse>;
    incrementDailyNewItemsStudied(data: IncrementDailyNewItemsStudiedRequest): Promise<IncrementDailyNewItemsStudiedResponse>;
    getStudyStreakData(data: GetStudyStreakDataRequest): Promise<GetStudyStreakDataResponse>;
    notifyDailyGoalComplete(data: NotifyDailyGoalCompleteRequest): Promise<NotifyDailyGoalCompleteResponse>;
    recordStudyActivityToday(data: RecordStudyActivityTodayRequest): Promise<RecordStudyActivityTodayResponse>;
    songDetected(data: SongDetectedMessagePayload): Promise<void>;
    
    // Chat Operations
    getAllChatThreads(): Promise<Thread[]>;
    getChatMessages(data: { threadId: string }): Promise<ChatMessage[]>;
    addChatThread(data: NewChatThreadDataForRpc): Promise<Thread>;
    addChatMessage(data: NewChatMessageDataForRpc): Promise<ChatMessage>;
    updateChatThreadTitle(data: { threadId: string; newTitle: string }): Promise<void>;
    deleteChatThread(data: { threadId: string }): Promise<{ success: boolean; error?: string }>;
    
    // Personality Operations
    embedPersonality(data: EmbedPersonalityRequest): Promise<EmbedPersonalityResponse>;
}
// --- END NEW CHAT RPC DEFINITIONS ---

// --- Personality Embedding ---

/** Request to embed personality chunks in background context */
export interface EmbedPersonalityRequest {
  embeddingConfig: FunctionConfig;
}

/** Response from personality embedding */
export interface EmbedPersonalityResponse {
  success: boolean;
  chunksEmbedded?: number;
  error?: string;
}