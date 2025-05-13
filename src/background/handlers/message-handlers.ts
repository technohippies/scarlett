import { defineExtensionMessaging } from '@webext-core/messaging';
import type {
    GetDueItemsRequest,
    GetDueItemsResponse,
    GetDistractorsRequest,
    GetDistractorsResponse,
    SubmitReviewRequest,
    SubmitReviewResponse,
    CacheDistractorsRequest,
    CacheDistractorsResponse,
    GenerateLLMDistractorsRequest,
    GenerateLLMDistractorsResponse,
    GetStudySummaryRequest,
    GetStudySummaryResponse,
    SaveBookmarkResponse,
    LoadBookmarksResponse, 
    TagListResponse, 
    TagSuggestResponse,
    GetPageInfoResponse,
    GetSelectedTextResponse,
    GenerateTTSPayload,
    ExtractMarkdownRequest,
    ExtractMarkdownResponse,
    RequestActiveLearningWordsPayload,
    RequestActiveLearningWordsResponse,
    GetDailyStudyStatsRequest,
    GetDailyStudyStatsResponse,
    IncrementDailyNewItemsStudiedRequest,
    IncrementDailyNewItemsStudiedResponse
} from '../../shared/messaging-types';
import {
    getDueLearningItems,
    getDistractors,
    updateSRSState,
    getStudySummaryCounts
} from '../../services/srs/scheduler';
import { getActiveLearningWordsFromDb, updateCachedDistractors } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';
import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import { getLLMDistractorsPrompt } from '../../services/llm/prompts/exercises';
import type { LLMConfig, LLMChatResponse, LLMProviderId, ChatMessage } from '../../services/llm/types';
import { handleSaveBookmark, handleLoadBookmarks } from './bookmark-handlers';
import { handleTagList } from './tag-handlers';
import { 
    handleGetPageInfo, 
    handleGetSelectedText, 
} from './pageInteractionHandlers';
import { getEmbedding } from '../../services/llm/embedding';
import { 
    recordPageVisitVersion,
    getPagesNeedingEmbedding, 
    findLatestEmbeddedVersion, 
    finalizePageVersionEmbedding, 
    deletePageVersion, 
    incrementPageVersionVisitCount,
    countPagesNeedingEmbedding, 
    calculateHash,
    updatePageVersionSummaryAndCleanup,
    getSummaryEmbeddingForVersion
} from '../../services/db/visited_pages';
import type { PageVersionToEmbed } from '../../services/db/visited_pages';
import { pageInfoProcessingTimestamps } from '../../services/storage/storage';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { getSummarizationPrompt } from '../../services/llm/prompts/analysis';
import { userConfigurationStorage } from '../../services/storage/storage';
import type { FunctionConfig } from '../../services/storage/types';
import { generateElevenLabsSpeechStream } from '../../services/tts/elevenLabsService';
import { DEFAULT_ELEVENLABS_MODEL_ID, DEFAULT_ELEVENLABS_VOICE_ID } from '../../shared/constants';
import {
    getOrInitDailyStudyStats,
    incrementNewItemsStudiedToday
} from '../../services/db/study_session_db';
// import type { LearningDirection, StudyItem } from '../../types/study';
// import type { ITask } from 'pg-promise';

// Define the threshold for reprocessing (e.g., 1 hour in milliseconds)
const REPROCESS_INFO_THRESHOLD_MS = 1000;

// Define a similarity threshold (Cosine Distance)
const EMBEDDING_SIMILARITY_THRESHOLD = 0.1;

// --- Tableland Constants ---
const TABLELAND_BASE_URL = 'https://testnets.tableland.network/api/v1/query?statement=';
const TABLELAND_FLASHCARDS_TABLE_NAME = 'supercoach_flashcards_84532_111';
// IMPORTANT: Replace this placeholder with the actual full name of your decks metadata table on Tableland
const SUPERCOACH_DECKS_METADATA_TABLE_NAME = 'supercoach_deck_84532_110'; // e.g., 'yourprefix_decks_84532_yourdeckstableid'
// --- End Tableland Constants ---

// Utility function to get full language name from code
function getFullLanguageName(code: string): string {
    switch (code.toLowerCase()) {
        case 'en': return 'English';
        case 'vi': return 'Vietnamese';
        // Add other common languages as needed:
        // case 'es': return 'Spanish';
        // case 'fr': return 'French';
        // case 'de': return 'German';
        // case 'ja': return 'Japanese';
        case 'ko': return 'Korean';
        case 'zh': return 'Chinese';
        default: return code; // Fallback to the code itself if no mapping is present
    }
}

// Dynamic Chat Helper (Simplified to only handle confirmed non-streaming)
async function dynamicChat(messages: ChatMessage[], config: FunctionConfig): Promise<LLMChatResponse | null> {
    const { providerId, modelId, baseUrl, apiKey } = config;
    if (!providerId || !modelId || !baseUrl) {
        console.error('[dynamicChat] Incomplete LLM configuration:', config);
        throw new Error('Incomplete LLM configuration for chat.');
    }

    const chatConfig: LLMConfig = {
        provider: providerId as LLMProviderId,
        model: modelId,
        baseUrl: baseUrl!,
        apiKey: apiKey ?? undefined,
        stream: false,
        options: { temperature: 0 } 
    };

    console.log(`[dynamicChat] Calling provider: ${providerId}, Model: ${modelId}`);

    switch (providerId) {
        case 'ollama':
            return ollamaChat(messages, chatConfig);
        default:
            console.error(`[dynamicChat] Unsupported or unverified non-streaming chat provider: ${providerId}`);
            throw new Error(`Unsupported or unverified non-streaming chat provider: ${providerId}`);
    }
}

// --- Tableland Query Helper ---
async function queryTableland(sql: string): Promise<any[]> {
    const encodedSql = encodeURIComponent(sql);
    const fetchUrl = `${TABLELAND_BASE_URL}${encodedSql}`;
    console.log(`[queryTableland] Fetching from: ${fetchUrl}`);
    try {
        const response = await fetch(fetchUrl, {
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[queryTableland] Tableland query failed (status: ${response.status}) for SQL: ${sql}. Error: ${errorText}`);
            throw new Error(`Tableland query failed: ${response.statusText} - ${errorText}`);
        }
        const data = await response.json();
        console.log(`[queryTableland] Received ${data?.length ?? 0} items from Tableland for SQL: ${sql.substring(0,100)}...`);
        return data;
    } catch (error) {
        console.error(`[queryTableland] Network or parsing error for SQL: ${sql}. Error:`, error);
        throw error; // Re-throw to be caught by caller
    }
}
// --- End Tableland Query Helper ---

// Define and EXPORT DeckInfoForFiltering
export interface DeckInfoForFiltering {
  id: string; 
  name: string;
  description?: string;
  cardCount: number;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  pathIdentifier: string;
}

// Define and EXPORT BackgroundProtocolMap
export interface BackgroundProtocolMap {
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
    processPageVisit: (data: { url: string; title: string; htmlContent: string }) => Promise<void>;
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
}

/**
 * Registers message listeners for background script operations (SRS, etc.).
 * @param messaging The messaging instance from the main background script.
 */
export function registerMessageHandlers(messaging: ReturnType<typeof defineExtensionMessaging<BackgroundProtocolMap>>): void {
    console.log('[Message Handlers] Registering background message listeners using passed instance...');

    async function getSummaryFromLLM(text: string): Promise<string | null> {
        if (!text) return null;
        console.log('[Message Handlers getSummaryFromLLM] Requesting summary from LLM...');
        
        let userLlmConfig: FunctionConfig | null = null; 
        try {
            const settings = await userConfigurationStorage.getValue(); 
            if (!settings || !settings.llmConfig) {
                console.error('[Message Handlers getSummaryFromLLM] LLM configuration not found in user settings. Cannot generate summary.');
                return null; 
            }
            userLlmConfig = settings.llmConfig;

            if (!userLlmConfig.providerId || !userLlmConfig.modelId || !userLlmConfig.baseUrl) {
                 console.error('[Message Handlers getSummaryFromLLM] LLM configuration is incomplete:', userLlmConfig);
                 return null;
            }

            const prompt = getSummarizationPrompt(text);
            console.log(`[Message Handlers getSummaryFromLLM] Using LLM config: Provider=${userLlmConfig.providerId}, Model=${userLlmConfig.modelId}, BaseUrl=${userLlmConfig.baseUrl}`);
            
            const response = await dynamicChat([{ role: 'user', content: prompt }], userLlmConfig);
            
            const summary = response?.choices?.[0]?.message?.content?.trim();
            if (!summary) {
                console.warn('[Message Handlers getSummaryFromLLM] LLM returned empty summary.');
                return null;
            }
            console.log(`[Message Handlers getSummaryFromLLM] Received summary (length: ${summary.length}): ${summary.substring(0, 100)}...`);
            return summary;
        } catch (error) {
            console.error('[Message Handlers getSummaryFromLLM] Error getting summary from LLM:', error);
            if (userLlmConfig) {
                 console.error(`[Message Handlers getSummaryFromLLM] Failed using config: Provider=${userLlmConfig.providerId}, Model=${userLlmConfig.modelId}, BaseUrl=${userLlmConfig.baseUrl}`);
            }
            return null;
        }
    }

    messaging.onMessage('getDueItems', async (message) => {
        console.log('[Message Handlers] Received getDueItems request:', message.data);
        try {
            // Explicitly destructure all potential options from message.data
            const { 
                limit, 
                excludeNewIfLimitReached, 
                newItemsStudiedToday, 
                dailyNewItemLimit 
            } = message.data as GetDueItemsRequest; // Type assertion for clarity

            // Construct the options object to pass to getDueLearningItems
            // This ensures that even if some optional fields are undefined in message.data,
            // they are passed as undefined, allowing getDueLearningItems to use its defaults only when truly not provided.
            const schedulerOptions = {
                excludeNewIfLimitReached,
                newItemsStudiedToday,
                dailyNewItemLimit
            };

            const dueItems = await getDueLearningItems(limit, schedulerOptions);

            console.log(`[Message Handlers] getDueLearningItems returned ${dueItems.length} item(s). Returning to StudyPage.`);
            return { success: true, dueItems };
        } catch (error) {
            console.error('[Message Handlers] Error in getDueItems handler:', error);
            return { success: false, error: String(error) };
        }
    });

    messaging.onMessage('getDistractorsForItem', async (message) => {
        console.log('[Message Handlers] Received getDistractorsForItem request:', message.data);
        try {
            const distractors = await getDistractors(
                message.data.correctTargetLexemeId,
                message.data.targetLanguage,
                message.data.count
            );
            return { distractors };
        } catch (error) {
            console.error('[Message Handlers] Error handling getDistractorsForItem:', error);
            return { distractors: [] };
        }
    });

    messaging.onMessage('submitReviewResult', async (message) => {
        console.log('[Message Handlers] Received submitReviewResult request:', message.data);
        const { learningId, grade, incorrectChoiceText } = message.data;
        try {
            let variationType: string | null = 'unknown';
            try {
                const db = await getDbInstance();
                const result = await db.query<{ variation_type: string | null }>(
                   `SELECT lt.variation_type 
                    FROM lexeme_translations lt
                    JOIN user_learning ul ON lt.translation_id = ul.translation_id
                    WHERE ul.learning_id = $1;`,
                   [learningId]
                );
                if (result.rows && result.rows.length > 0) {
                    variationType = result.rows[0].variation_type ?? 'original';
                }
                 console.log(`[Message Handlers] Fetched variation type for learningId ${learningId}: ${variationType}`);
            } catch (fetchError) {
                 console.error(`[Message Handlers] Error fetching variation type for learningId ${learningId}:`, fetchError);
            }
             console.log(`[Message Handlers] Submitting review grade ${grade} for variation type: ${variationType}`);
             
            await updateSRSState(learningId, grade, new Date(), incorrectChoiceText);
            return { success: true };
        } catch (error: any) {
            console.error('[Message Handlers] Error handling submitReviewResult:', error);
            return { success: false, error: error.message || 'Failed to update SRS state.' };
        }
    });

    messaging.onMessage('cacheDistractors', async (message) => {
        console.log('[Message Handlers] Received cacheDistractors request:', message.data);
        const { translationId, distractors } = message.data;
        try {
            const db = await getDbInstance();
            await updateCachedDistractors(db, translationId, distractors);
            return { success: true };
        } catch (error: any) {
            console.error('[Message Handlers] Error handling cacheDistractors:', error);
            return { success: false, error: error.message || 'Failed to cache distractors.' };
        }
    });

    messaging.onMessage('generateLLMDistractors', async (message) => {
        console.log('[Message Handlers] Received generateLLMDistractors request:', message.data);
        const { sourceText, targetText, count, direction, correctAnswerForFiltering } = message.data;
        
        const safeDirection: string = direction || 'EN_TO_NATIVE'; // Default direction

        let userLlmConfig: FunctionConfig | null = null;
        try {
            const userSettings = await userConfigurationStorage.getValue();
            if (!userSettings.llmConfig?.providerId || !userSettings.llmConfig.modelId) {
                throw new Error("LLM provider or model not configured by user.");
            }
            userLlmConfig = userSettings.llmConfig;

            const userActualNativeLang = userSettings.nativeLanguage || 'en'; // Default to 'en' if not set
            const userActualTargetLang = userSettings.targetLanguage || 'vi'; // Default to 'vi' if not set

            let wordToTranslate: string;
            let originalWordLanguageName: string;
            let distractorsLanguageName: string;

            if (safeDirection === 'EN_TO_NATIVE') {
                wordToTranslate = targetText; // English word (from card's back_text)
                originalWordLanguageName = getFullLanguageName(userActualTargetLang); // Should be 'English'
                distractorsLanguageName = getFullLanguageName(userActualNativeLang);  // e.g., 'Vietnamese'
                console.log(`[Message Handlers] EN_TO_NATIVE Prep: Word to translate: "${wordToTranslate}" (${originalWordLanguageName}). Distractors in: ${distractorsLanguageName}. Correct answer (for filtering): "${correctAnswerForFiltering}"`);
            } else { // NATIVE_TO_EN
                wordToTranslate = sourceText; // Native word (from card's front_text)
                originalWordLanguageName = getFullLanguageName(userActualNativeLang);  // e.g., 'Vietnamese'
                distractorsLanguageName = getFullLanguageName(userActualTargetLang); // Should be 'English'
                console.log(`[Message Handlers] NATIVE_TO_EN Prep: Word to translate: "${wordToTranslate}" (${originalWordLanguageName}). Distractors in: ${distractorsLanguageName}. Correct answer (for filtering): "${correctAnswerForFiltering}"`);
            }

            const prompt = getLLMDistractorsPrompt(wordToTranslate, originalWordLanguageName, distractorsLanguageName, count);

            // LLM Call
            const llmResponse = await dynamicChat([{ role: 'user', content: prompt }], userLlmConfig);

            // Safely access content, assuming dynamicChat returns a structure like { choices: [{ message: { content: string } }] }
            const rawContentFromLlm = llmResponse?.choices?.[0]?.message?.content?.trim();

            if (rawContentFromLlm) {
                let rawContent = rawContentFromLlm;
                console.log("[Message Handlers] Raw LLM content for distractors:", rawContent);

                // Strip markdown fences if present
                if (rawContent.startsWith('```json')) { // More general check for ```json
                    rawContent = rawContent.substring(rawContent.indexOf('\n') + 1); // Skip the ```json line
                    if (rawContent.endsWith('```')) {
                        rawContent = rawContent.substring(0, rawContent.lastIndexOf('```')).trim();
                    }
                } else if (rawContent.startsWith('```')) { // Simpler ``` check
                     rawContent = rawContent.substring(3, rawContent.length - 3).trim();
                }

                try {
                    const parsedJson = JSON.parse(rawContent);
                    if (Array.isArray(parsedJson) && parsedJson.every(item => typeof item === 'string')) {
                        console.log("[Message Handlers] Extracted distractors:", parsedJson);
                        const finalDistractors = parsedJson.filter(d => d.toLowerCase() !== correctAnswerForFiltering.toLowerCase());
                        return { distractors: finalDistractors.slice(0, count) }; 
                    } else {
                        throw new Error("LLM response is not a JSON array of strings.");
                    }
                } catch (e: any) {
                    console.error("[Message Handlers] Failed to parse JSON array from LLM content:", rawContent, "Error:", e.message);
                    throw new Error(`Failed to parse JSON array from LLM response: ${e.message}`);
                }
            } else {
                console.error("[Message Handlers] LLM returned no content for distractors.");
                throw new Error("LLM returned no content.");
            }

        } catch (error: any) {
            console.error('[Message Handlers] Error handling generateLLMDistractors:', error);
            if (userLlmConfig) {
                console.error(`[Message Handlers generateLLMDistractors] Failed using config: Provider=${userLlmConfig.providerId}, Model=${userLlmConfig.modelId}, BaseUrl=${userLlmConfig.baseUrl}`);
           }
            return { distractors: [], error: error.message || 'Failed to generate distractors.' };
        }
    });

    messaging.onMessage('getStudySummary', async (message) => {
        console.log('[Message Handlers] Received getStudySummary request:', message.data);
        try {
            const counts = await getStudySummaryCounts(); 
            console.log('[Message Handlers] Retrieved summary counts from scheduler:', counts);

            const dueCount = typeof counts.due === 'number' ? counts.due : 0;
            const reviewCount = typeof counts.review === 'number' ? counts.review : 0;
            const newCount = typeof counts.new === 'number' ? counts.new : 0;

            return { dueCount, reviewCount, newCount };
        } catch (error: any) {
            console.error('[Message Handlers] Error handling getStudySummary:', error);
            return { 
                dueCount: 0, 
                reviewCount: 0, 
                newCount: 0, 
                error: error.message || 'Failed to get study summary counts.' 
            };
        }
    });

    messaging.onMessage('saveBookmark', ({ data, sender }) => {
        console.log('[Message Handlers] Received saveBookmark');
        return handleSaveBookmark(data, sender);
    });

    messaging.onMessage('loadBookmarks', ({ data, sender }) => {
        console.log('[Message Handlers] Received loadBookmarks');
        return handleLoadBookmarks(data, sender);
    });

    messaging.onMessage('tag:list', ({ data, sender }) => {
        console.log('[Message Handlers] Received tag:list');
        return handleTagList(data, sender);
    });

    messaging.onMessage('getPageInfo', ({ data, sender }) => {
        console.log('[Message Handlers] Received getPageInfo');
        return handleGetPageInfo(data, sender);
    });
    
    messaging.onMessage('getSelectedText', ({ data, sender }) => {
        console.log('[Message Handlers] Received getSelectedText');
        return handleGetSelectedText(data, sender);
    });

    messaging.onMessage('processPageVisit', async ({ data, sender }) => {
        const { url, title: originalTitle, htmlContent } = data;
        console.log(`[Message Handlers] Received processPageVisit for URL: ${url}`);
        
        if (!sender || !sender.tab || !sender.tab.id) {
             console.error(`[Message Handlers processPageVisit] Missing sender information for URL: ${url}. Cannot request markdown.`);
             return;
        }
        const senderTabId = sender.tab.id;
        try {
            const timestamps = await pageInfoProcessingTimestamps.getValue();
            const lastProcessed = timestamps[url];
            if (lastProcessed && (Date.now() - lastProcessed < REPROCESS_INFO_THRESHOLD_MS)) {
                console.log(`[Message Handlers processPageVisit] URL ${url} info processed recently (${new Date(lastProcessed).toISOString()}). Skipping info re-processing.`);
                return;
            }
            console.log(`[Message Handlers processPageVisit] URL ${url} info not processed recently or not found. Proceeding.`);

            console.log(`[Message Handlers processPageVisit] Requesting markdown extraction from content script (Tab ID: ${senderTabId}) for URL: ${url}...`);
            const markdownResponse = await messaging.sendMessage(
                'extractMarkdownFromHtml', 
                { htmlContent, baseUrl: url },
                { tabId: senderTabId, frameId: sender.frameId }
            );

            if (!markdownResponse || !markdownResponse.success || !markdownResponse.markdown) {
                console.warn(`[Message Handlers processPageVisit] Markdown extraction failed in content script for URL ${url}. Error: ${markdownResponse?.error}. Aborting save.`);
                return;
            }
            const { markdown, title: extractedTitle } = markdownResponse;
            
            const finalTitle = extractedTitle || originalTitle;
            console.log(`[Message Handlers processPageVisit] Markdown received from CS (length: ${markdown.length}), Title: ${finalTitle}`);

            await recordPageVisitVersion({ 
                url,
                title: finalTitle, 
                markdown_content: markdown, 
            });
            console.log(`[Message Handlers processPageVisit] DB info operation complete for URL: ${url}`);

            try {
                 const currentTimestamps = await pageInfoProcessingTimestamps.getValue();
                 await pageInfoProcessingTimestamps.setValue({ 
                     ...currentTimestamps, 
                     [url]: Date.now() 
                 });
                 console.log(`[Message Handlers processPageVisit] Updated processing timestamp for URL: ${url}`);
            } catch (tsError) {
                 console.error(`[Message Handlers processPageVisit] Failed to update processing timestamp for URL ${url}:`, tsError);
            }

        } catch (error) {
            console.error(`[Message Handlers] Error handling processPageVisit for URL ${url}:`, error);
        }
    });

    messaging.onMessage('triggerBatchEmbedding', async () => {
        console.log('[Message Handlers] Received triggerBatchEmbedding request (with dynamic embedding).');
        let finalizedCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;
        let db: PGlite | null = null;
        let candidates: PageVersionToEmbed[] = [];
        let userEmbeddingConfig: FunctionConfig | null = null;

        try {
            const settings = await userConfigurationStorage.getValue(); 
            if (!settings || !settings.embeddingConfig) {
                console.error('[Message Handlers triggerBatchEmbedding] Embedding configuration not found in user settings. Aborting batch.');
                return { success: false, finalizedCount, duplicateCount, errorCount: 0, error: 'Embedding configuration not found.' }; 
            }
            userEmbeddingConfig = settings.embeddingConfig;
            if (!userEmbeddingConfig.providerId || !userEmbeddingConfig.modelId || !userEmbeddingConfig.baseUrl) {
                 console.error('[Message Handlers triggerBatchEmbedding] Embedding configuration is incomplete:', userEmbeddingConfig);
                 return { success: false, finalizedCount, duplicateCount, errorCount: 0, error: 'Embedding configuration incomplete.' }; 
            }
            console.log('[Message Handlers triggerBatchEmbedding] Using embedding config:', userEmbeddingConfig);

            db = await getDbInstance(); 
            candidates = await getPagesNeedingEmbedding(20); 

            if (candidates.length === 0) {
                console.log('[Message Handlers triggerBatchEmbedding] No page versions found needing embedding.');
                return { success: true, finalizedCount: 0, duplicateCount: 0, errorCount: 0 };
            }

            console.log(`[Message Handlers triggerBatchEmbedding] Found ${candidates.length} candidate versions to process.`);

            for (const candidate of candidates) {
                console.log(`[Message Handlers triggerBatchEmbedding] Processing candidate version_id: ${candidate.version_id} for URL: ${candidate.url}`);
                try {
                    const latestEmbedded = await findLatestEmbeddedVersion(candidate.url);

                    if (latestEmbedded && candidate.markdown_hash && latestEmbedded.markdown_hash && candidate.markdown_hash === latestEmbedded.markdown_hash) {
                        console.log(`[Message Handlers triggerBatchEmbedding] Exact ORIGINAL markdown hash match found... Handling as duplicate.`);
                        await incrementPageVersionVisitCount(latestEmbedded.version_id);
                        await deletePageVersion(candidate.version_id); 
                        duplicateCount++;
                        continue; 
                    }

                    console.log(`[Message Handlers triggerBatchEmbedding] Original markdown hashes differ or no previous embedded version. Proceeding with summarization for version_id: ${candidate.version_id}.`);
                    
                    const summary = await getSummaryFromLLM(candidate.markdown_content);
                    if (!summary) {
                        console.warn(`[Message Handlers triggerBatchEmbedding] Summarization failed for version_id: ${candidate.version_id}. Skipping.`);
                        errorCount++;
                        continue;
                    }
                    const summaryHash = await calculateHash(summary);

                    const summaryEmbeddingResult = await getEmbedding(summary, userEmbeddingConfig);

                    if (!summaryEmbeddingResult) {
                        console.warn(`[Message Handlers triggerBatchEmbedding] SUMMARY embedding generation failed for version_id: ${candidate.version_id}. Skipping.`);
                        errorCount++;
                        continue; 
                    }
                    
                    await updatePageVersionSummaryAndCleanup({ 
                        version_id: candidate.version_id, 
                        summary_content: summary, 
                        summary_hash: summaryHash 
                    });

                    if (latestEmbedded) {
                        if (summaryHash && latestEmbedded.summary_hash && summaryHash === latestEmbedded.summary_hash) {
                            console.log(`[Message Handlers triggerBatchEmbedding] Exact SUMMARY hash match found... Handling as duplicate.`);
                            await incrementPageVersionVisitCount(latestEmbedded.version_id);
                            await deletePageVersion(candidate.version_id);
                            duplicateCount++;
                            continue;
                        }

                        if (summaryEmbeddingResult.dimension !== latestEmbedded.active_embedding_dimension) {
                            console.warn(`[Message Handlers triggerBatchEmbedding] SUMMARY Embedding dimension mismatch... Skipping comparison, finalizing new version.`);
                             await finalizePageVersionEmbedding({ version_id: candidate.version_id, embeddingInfo: summaryEmbeddingResult });
                             finalizedCount++;
                             continue;
                        }
                        
                        const latestSummaryVector = await getSummaryEmbeddingForVersion(latestEmbedded.version_id);
                        const candidateSummaryVector = summaryEmbeddingResult.embedding;

                        if (!latestSummaryVector || !candidateSummaryVector) {
                            console.error(`[Message Handlers triggerBatchEmbedding] Could not retrieve SUMMARY vectors for comparison... Finalizing candidate.`);
                            await finalizePageVersionEmbedding({ version_id: candidate.version_id, embeddingInfo: summaryEmbeddingResult });
                            finalizedCount++;
                            errorCount++;
                            continue;
                        }

                        const vectorCompareSql = `SELECT $1::vector <=> $2::vector as distance;`;
                        const latestVectorString = `[${latestSummaryVector.join(',')}]`;
                        const candidateVectorString = `[${candidateSummaryVector.join(',')}]`;
                        
                        const distanceResult = await db.query<{ distance: number }>(vectorCompareSql, [latestVectorString, candidateVectorString]);
                        const distance = distanceResult.rows[0]?.distance;

                        if (typeof distance !== 'number') {
                             console.error(`[Message Handlers triggerBatchEmbedding] Failed to calculate SUMMARY vector distance... Finalizing candidate.`);
                             await finalizePageVersionEmbedding({ version_id: candidate.version_id, embeddingInfo: summaryEmbeddingResult });
                             finalizedCount++;
                             errorCount++;
                             continue;
                        }

                        console.log(`[Message Handlers triggerBatchEmbedding] SUMMARY Cosine distance between ${candidate.version_id} and ${latestEmbedded.version_id}: ${distance.toFixed(4)}`);

                        if (distance < EMBEDDING_SIMILARITY_THRESHOLD) {
                            console.log(`[Message Handlers triggerBatchEmbedding] SUMMARY semantically similar... Handling as duplicate.`);
                            await incrementPageVersionVisitCount(latestEmbedded.version_id);
                            await deletePageVersion(candidate.version_id);
                            duplicateCount++;
                        } else {
                            console.log(`[Message Handlers triggerBatchEmbedding] SUMMARY semantically different. Finalizing embedding.`);
                            await finalizePageVersionEmbedding({ version_id: candidate.version_id, embeddingInfo: summaryEmbeddingResult });
                            finalizedCount++;
                        }

                    } else {
                        console.log(`[Message Handlers triggerBatchEmbedding] No previous embedded version found... Finalizing SUMMARY embedding.`);
                        await finalizePageVersionEmbedding({ version_id: candidate.version_id, embeddingInfo: summaryEmbeddingResult });
                        finalizedCount++;
                    }

                } catch (processingError) {
                    console.error(`[Message Handlers triggerBatchEmbedding] Error processing candidate version_id ${candidate.version_id}:`, processingError);
                    errorCount++;
                }
            }

            console.log(`[Message Handlers triggerBatchEmbedding] Batch embedding complete. Finalized: ${finalizedCount}, Duplicates (Deleted): ${duplicateCount}, Errors: ${errorCount}.`);
            return { success: true, finalizedCount, duplicateCount, errorCount };

        } catch (error: any) {
            console.error('[Message Handlers triggerBatchEmbedding] Unexpected error during batch embedding:', error);
            if (userEmbeddingConfig) {
                 console.error(`[Message Handlers triggerBatchEmbedding] Failed using embedding config: Provider=${userEmbeddingConfig.providerId}, Model=${userEmbeddingConfig.modelId}, BaseUrl=${userEmbeddingConfig.baseUrl}`);
            }
            return { success: false, finalizedCount, duplicateCount, errorCount: candidates.length, error: error.message || 'Batch embedding failed.' };
        }
    });

    messaging.onMessage('getPendingEmbeddingCount', async () => {
        console.log('[Message Handlers] Received getPendingEmbeddingCount request.');
        try {
            const count = await countPagesNeedingEmbedding();
            return { count };
        } catch (error: any) {
            console.error('[Message Handlers getPendingEmbeddingCount] Error:', error);
            return { count: 0 };
        }
    });

    messaging.onMessage('REQUEST_TTS_FROM_WIDGET', async (message) => {
        console.log('[Message Handlers] Received REQUEST_TTS_FROM_WIDGET:', message.data);
        const { text, lang, speed } = message.data; 

        console.log(`[Message Handlers REQUEST_TTS_FROM_WIDGET] Processing parameters - Text: "${text.substring(0,10)}...", Lang: "${lang}", Speed: ${speed}`);

        try {
            const userConfig = await userConfigurationStorage.getValue();
            const ttsConfig = userConfig?.ttsConfig;

            if (!ttsConfig || ttsConfig.providerId !== 'elevenlabs' || !ttsConfig.apiKey) {
                console.warn('[Message Handlers REQUEST_TTS_FROM_WIDGET] ElevenLabs TTS not configured or API key missing.');
                return { success: false, error: 'ElevenLabs TTS not configured or API key missing.' };
            }

            const apiKey = ttsConfig.apiKey;
            // Determine model based on language
            let effectiveModelId = DEFAULT_ELEVENLABS_MODEL_ID; // Default model
            if (lang && lang.toLowerCase().startsWith('zh')) { // Or any other condition for Flash
                effectiveModelId = 'eleven_flash_v2.5';
                console.log(`[Message Handlers REQUEST_TTS_FROM_WIDGET] Using Flash model for lang: ${lang}`);
            }
            
            const effectiveVoiceId = DEFAULT_ELEVENLABS_VOICE_ID;

            console.log(`[Message Handlers REQUEST_TTS_FROM_WIDGET] Generating audio via ElevenLabs. Text: "${text.substring(0,30)}...", Lang: ${lang}, Model: ${effectiveModelId}, Voice: ${effectiveVoiceId}, Speed: ${speed ?? 'default'}`);

            const audioBlob = await generateElevenLabsSpeechStream(
                apiKey,
                text,
                effectiveModelId,
                effectiveVoiceId,
                undefined, // voiceSettings
                speed,
                lang // Pass the lang parameter
            );

            if (audioBlob) {
                const audioDataUrl = await blobToDataURL(audioBlob);
                console.log('[Message Handlers REQUEST_TTS_FROM_WIDGET] Audio generated, returning data URL.');
                return { success: true, audioDataUrl };
            } else {
                console.error('[Message Handlers REQUEST_TTS_FROM_WIDGET] Failed to generate audio blob.');
                return { success: false, error: 'Failed to generate audio from ElevenLabs.' };
            }
        } catch (error) {
            console.error('[Message Handlers REQUEST_TTS_FROM_WIDGET] Error generating TTS:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error generating TTS.' };
        }
    });

    messaging.onMessage('generateTTS', async (message) => {
        console.log('[Message Handlers] Received OLD generateTTS request:', message.data);
        return;
    });

    messaging.onMessage('REQUEST_ACTIVE_LEARNING_WORDS', async (message) => {
        const { sourceLanguage, targetLanguage } = message.data;
        console.log(`[Message Handlers] Received REQUEST_ACTIVE_LEARNING_WORDS request:`, message.data);
        try {
            const words = await getActiveLearningWordsFromDb(sourceLanguage, targetLanguage);
            console.log(`[Message Handlers] REQUEST_ACTIVE_LEARNING_WORDS: Found ${words.length} words.`);
            return { success: true, words: words };
        } catch (error: any) {
            console.error('[Message Handlers] Error fetching active learning words:', error);
            return { success: false, error: error.message || 'Failed to fetch active learning words.', words: [] };
        }
    });

    // Register the new handler
    messaging.onMessage('addLearningDeck', handleAddLearningDeck);

    // --- fetchAvailableDeckFiles Implementation ---
    console.log('[Message Handlers Register] >>> BEFORE registering fetchAvailableDeckFiles handler.');
    messaging.onMessage('fetchAvailableDeckFiles', async () => {
        console.log('[Message Handlers] fetchAvailableDeckFiles HANDLER EXECUTED (Tableland version)');
        try {
            const config = await userConfigurationStorage.getValue();
            const nativeLang = config?.nativeLanguage;
            const targetLang = config?.targetLanguage;

            console.log(`[Message Handlers fetchAvailableDeckFiles] User languages - Native: ${nativeLang}, Target: ${targetLang}`);

            if (!nativeLang || !targetLang) {
                console.warn('[Message Handlers fetchAvailableDeckFiles] Native or target language missing in config.');
                return { success: false, error: 'User languages not configured.', decks: [] };
            }

            // Query 1: Get deck metadata matching user languages
            // IMPORTANT: Ensure SUPERCOACH_DECKS_METADATA_TABLE_NAME_PLACEHOLDER is correctly set.
            // Assuming 'id' is the primary key of the decks table, and 'deck_slug' is the unique human-readable ID.
            const decksMetadataSql = `
                SELECT
                    id as tableland_deck_pk,
                    deck_slug,
                    name,
                    description,
                    front_language,
                    back_language
                FROM
                    ${SUPERCOACH_DECKS_METADATA_TABLE_NAME}
                WHERE
                    (front_language = '${nativeLang}' AND back_language = '${targetLang}')
                    OR (front_language = '${targetLang}' AND back_language = '${nativeLang}')
            `;
            const decksMetadata = await queryTableland(decksMetadataSql);

            if (!decksMetadata || decksMetadata.length === 0) {
                console.log('[Message Handlers fetchAvailableDeckFiles] No decks found matching language criteria from Tableland.');
                return { success: true, decks: [] };
            }
            console.log(`[Message Handlers fetchAvailableDeckFiles] Found ${decksMetadata.length} deck(s) metadata from Tableland.`);

            // Query 2: Get card counts for all decks
            // deck_row_id in flashcards table should correspond to tableland_deck_pk (id) from decks metadata table
            const cardCountsSql = `
                SELECT
                    deck_row_id,
                    COUNT(*) as card_count
                FROM
                    ${TABLELAND_FLASHCARDS_TABLE_NAME}
                GROUP BY
                    deck_row_id
            `;
            const cardCountsData = await queryTableland(cardCountsSql);
            const cardCountsMap = new Map<number, number>();
            for (const row of cardCountsData) {
                // Ensure deck_row_id and card_count are treated as numbers if they come as strings
                cardCountsMap.set(Number(row.deck_row_id), Number(row.card_count));
            }
            console.log(`[Message Handlers fetchAvailableDeckFiles] Processed card counts for ${cardCountsMap.size} deck(s).`);


            const availableDecks: DeckInfoForFiltering[] = decksMetadata.map(deck => {
                const count = cardCountsMap.get(deck.tableland_deck_pk) || 0;
                console.log(`[Message Handlers fetchAvailableDeckFiles] Deck: ${deck.deck_slug}, PK: ${deck.tableland_deck_pk}, Mapped Card Count: ${count}`);
                return {
                    id: deck.deck_slug, // Use deck_slug as the primary identifier for UI/internal logic
                    name: deck.name,
                    description: deck.description,
                    cardCount: count,
                    sourceLanguage: deck.front_language,
                    targetLanguage: deck.back_language,
                    pathIdentifier: deck.deck_slug // deck_slug is also the pathIdentifier
                };
            }).filter(deck => { // Additional filter if some decks somehow had 0 cards after join
                if (deck.cardCount > 0) {
                    return true;
                }
                console.warn(`[Message Handlers fetchAvailableDeckFiles] Filtering out deck ${deck.id} due to 0 card count post-processing.`);
                return false;
            });
            
            console.log(`[Message Handlers fetchAvailableDeckFiles] Returning ${availableDecks.length} decks after processing and filtering.`);
            return { success: true, decks: availableDecks };

        } catch (error) {
            console.error('[Message Handlers fetchAvailableDeckFiles] Unexpected error:', error);
            return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred', decks: [] };
        }
    });
    console.log('[Message Handlers Register] <<< AFTER registering fetchAvailableDeckFiles handler.');

    // Add handler for getDailyStudyStats
    messaging.onMessage('getDailyStudyStats', async (message) => {
        console.log('[Message Handlers] Received getDailyStudyStats request.');
        try {
            const stats = await getOrInitDailyStudyStats();
            return { 
                success: true, 
                lastResetDate: stats.lastResetDate,
                newItemsStudiedToday: stats.newItemsStudiedToday
            };
        } catch (error: any) {
            console.error('[Message Handlers] Error in getDailyStudyStats:', error);
            return { success: false, error: error.message || 'Failed to get daily study stats' };
        }
    });

    // Add handler for incrementDailyNewItemsStudied
    messaging.onMessage('incrementDailyNewItemsStudied', async (message) => {
        console.log('[Message Handlers] Received incrementDailyNewItemsStudied request.');
        try {
            const updatedCount = await incrementNewItemsStudiedToday();
            return { success: true, updatedNewItemsStudiedToday: updatedCount };
        } catch (error: any) {
            console.error('[Message Handlers] Error in incrementDailyNewItemsStudied:', error);
            return { success: false, error: error.message || 'Failed to increment daily new items studied' };
        }
    });

    console.log('[Message Handlers] Background message listeners registered using passed instance.');
}

async function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Helper to parse deck identifier for path construction (simple example)
/* COMMENTING OUT - Replaced by Tableland fetching
function getDeckPathFromIdentifier(identifier: string): string | null {
    const knownDeck = KNOWN_DECK_FILES.find(df => df.identifier === identifier);
    if (knownDeck) {
        return knownDeck.path;
    }
    console.warn(`[getDeckPathFromIdentifier] Identifier ${identifier} not found in KNOWN_DECK_FILES.`);
    // Fallback logic (original, might be removed if not needed)
    const parts = identifier.split('_');
    if (parts.length < 2) { 
        console.warn(`[getDeckPathFromIdentifier] Could not parse source language from identifier via fallback: ${identifier}`);
        return null; 
    }
    const sourceLang = parts[parts.length - 2]; 
    return `decks/${sourceLang}/${identifier}.json`; // This fallback is likely incorrect for current structure
}
*/

// --- Add Deck Handler ---
async function handleAddLearningDeck(message: { data: { deckIdentifier: string } }): Promise<{ success: boolean, error?: string }> {
    const { deckIdentifier } = message.data; // This is the deck_slug (e.g., kaishi-1-5k-en-ja-1)
    console.log(`[Message Handlers addLearningDeck] Received request for deck_slug: ${deckIdentifier} (Tableland version)`);

    try {
        const db = await getDbInstance();
        if (!db) {
            console.error('[Message Handlers addLearningDeck] Database instance is null.');
            return { success: false, error: 'Database not initialized.' };
        }

        // 1. Fetch Deck Metadata from Tableland using deck_slug
        // IMPORTANT: Ensure SUPERCOACH_DECKS_METADATA_TABLE_NAME_PLACEHOLDER is correctly set.
        const deckMetadataSql = `
            SELECT
                id as tableland_deck_pk,
                name,
                description,
                front_language,
                back_language
            FROM
                ${SUPERCOACH_DECKS_METADATA_TABLE_NAME}
            WHERE
                deck_slug = '${deckIdentifier}'
            LIMIT 1;
        `;
        const deckMetadataResult = await queryTableland(deckMetadataSql);

        if (!deckMetadataResult || deckMetadataResult.length === 0) {
            console.error(`[Message Handlers addLearningDeck] Could not find metadata for deck_slug: ${deckIdentifier} in Tableland.`);
            return { success: false, error: `Deck with slug ${deckIdentifier} not found in Tableland.` };
        }
        const deckMetadata = deckMetadataResult[0];
        const tablelandDeckPk = deckMetadata.tableland_deck_pk; // This is the 'id' from the decks metadata table
        console.log(`[Message Handlers addLearningDeck] Fetched metadata for ${deckIdentifier}, Tableland PK: ${tablelandDeckPk}`);

        // 2. Fetch Deck Terms (Flashcards) from Tableland
        // deck_row_id in flashcards table should correspond to tableland_deck_pk (id) from decks metadata table
        const deckTermsSql = `
            SELECT
                front_text,
                back_text,
                front_phonetic_guide,
                back_phonetic_guide
            FROM
                ${TABLELAND_FLASHCARDS_TABLE_NAME}
            WHERE
                deck_row_id = ${tablelandDeckPk};
        `;
        const fetchedTerms = await queryTableland(deckTermsSql);

        if (!fetchedTerms || fetchedTerms.length === 0) {
            console.warn(`[Message Handlers addLearningDeck] No terms found in Tableland for deck_slug: ${deckIdentifier} (Tableland PK: ${tablelandDeckPk}). Proceeding to add deck info if not already present.`);
            // Still might want to add the deck to the local 'decks' table even if it has no terms yet.
        }
        console.log(`[Message Handlers addLearningDeck] Fetched ${fetchedTerms.length} terms for ${deckIdentifier} from Tableland.`);
        
        // Prepare deckData structure similar to what was loaded from JSON
        const deckData = {
            deckId: deckIdentifier, // Using deck_slug as the primary identifier for local 'decks' table
            name: deckMetadata.name,
            description: deckMetadata.description,
            deckSourceLanguage: deckMetadata.front_language,
            deckTargetLanguage: deckMetadata.back_language,
            terms: fetchedTerms.map((term: any) => ({
                source: term.front_text,
                target: term.back_text,
                source_phonetic: term.front_phonetic_guide, // Assuming local schema might use these
                target_phonetic: term.back_phonetic_guide
                // Map other fields like 'notes', 'attributes' if needed
            }))
        };

        // Now, use the parsed deckData to populate DB tables (existing logic)
        await (db as PGlite).transaction(async (t: Transaction) => {
            // 2a. Insert/Update Deck Information in 'decks' table
            const deckUpsertQuery = `
                INSERT INTO decks (deck_identifier, name, description, source_language, target_language)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (deck_identifier) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    source_language = EXCLUDED.source_language,
                    target_language = EXCLUDED.target_language
                RETURNING deck_id;
            `;
            const deckResult = await t.query<{ deck_id: number }>(deckUpsertQuery, [
                deckData.deckId, // This is the deck_slug
                deckData.name,
                deckData.description,
                deckData.deckSourceLanguage,
                deckData.deckTargetLanguage
            ]);
            const deckId = deckResult.rows[0]?.deck_id;

            if (!deckId) {
                console.error(`[Message Handlers addLearningDeck] Failed to insert/update deck and get deck_id for: ${deckData.deckId}`);
                throw new Error(`Failed to process deck: ${deckData.deckId}`);
            }
            console.log(`[Message Handlers addLearningDeck] Upserted deck '${deckData.deckId}', DB deck_id: ${deckId}`);

            const deckSourceLang = deckData.deckSourceLanguage;
            const deckTargetLang = deckData.deckTargetLanguage;
            const translationIdsToLearn: number[] = [];

            // Revised logic for steps 2b, 2c, according to existing schema (lexemes, lexeme_translations)
            for (const term of deckData.terms) {
                // 1. Upsert Source Lexeme
                const sourceLexemeQuery = `
                    INSERT INTO lexemes (text, language)
                    VALUES ($1, $2)
                    ON CONFLICT (text, language) DO UPDATE SET language = EXCLUDED.language -- বা No-op if language shouldn't change
                    RETURNING lexeme_id;
                `;
                const sourceLexemeResult = await t.query<{ lexeme_id: number }>(sourceLexemeQuery, [term.source, deckSourceLang]);
                const sourceLexemeId = sourceLexemeResult.rows[0]?.lexeme_id;

                // 2. Upsert Target Lexeme
                const targetLexemeQuery = `
                    INSERT INTO lexemes (text, language)
                    VALUES ($1, $2)
                    ON CONFLICT (text, language) DO UPDATE SET language = EXCLUDED.language -- বা No-op
                    RETURNING lexeme_id;
                `;
                const targetLexemeResult = await t.query<{ lexeme_id: number }>(targetLexemeQuery, [term.target, deckTargetLang]);
                const targetLexemeId = targetLexemeResult.rows[0]?.lexeme_id;

                if (!sourceLexemeId || !targetLexemeId) {
                    console.warn(`[Message Handlers addLearningDeck] Failed to upsert source or target lexeme for term:`, term);
                    continue; // Skip to next term
                }

                // 3. Upsert Lexeme Translation
                // Your schema for lexeme_translations has UNIQUE (source_lexeme_id, target_lexeme_id)
                // and a trigger for updated_at. variation_type can be set.
                const lexemeTranslationUpsertQuery = `
                    INSERT INTO lexeme_translations (source_lexeme_id, target_lexeme_id, variation_type)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (source_lexeme_id, target_lexeme_id) DO UPDATE SET
                        variation_type = EXCLUDED.variation_type -- Or some other update logic if needed
                        -- updated_at is handled by trigger
                    RETURNING translation_id;
                `;
                const translationResult = await t.query<{ translation_id: number }>(lexemeTranslationUpsertQuery, [
                    sourceLexemeId,
                    targetLexemeId,
                    'original' // Assuming these are original terms from the deck
                ]);
                const translationId = translationResult.rows[0]?.translation_id;

                if (!translationId) {
                    console.warn(`[Message Handlers addLearningDeck] Failed to upsert lexeme_translation for term:`, term);
                    continue; // Skip to next term
                }
                translationIdsToLearn.push(translationId);

                // 4. Link translation to deck in translation_decks
                const linkQuery = `
                    INSERT INTO translation_decks (deck_id, translation_id)
                    VALUES ($1, $2)
                    ON CONFLICT (deck_id, translation_id) DO NOTHING;
                `;
                await t.query(linkQuery, [deckId, translationId]);
            }
            console.log(`[Message Handlers addLearningDeck] Processed ${deckData.terms.length} terms, obtained ${translationIdsToLearn.length} valid translation_ids for deck_id: ${deckId}.`);

            // 2d. Add to User's Learning Queue (using collected valid translation_ids)
            if (translationIdsToLearn.length > 0) {
                const insertUserLearningQuery = `
                    INSERT INTO user_learning (translation_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review)
                    VALUES ($1, CURRENT_TIMESTAMP, 0, 0, 0, 0, 0, 0, 0, NULL)
                    ON CONFLICT (translation_id) DO NOTHING;
                `;
                for (const tId of translationIdsToLearn) {
                    await t.query(insertUserLearningQuery, [tId]);
                }
                console.log(`[Message Handlers addLearningDeck] Ensured ${translationIdsToLearn.length} translations are in user_learning for deck ${deckIdentifier}.`);
            } else {
                console.warn(`[Message Handlers addLearningDeck] No valid translation_ids to add to user_learning for deck ${deckIdentifier}.`);
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error('[Message Handlers addLearningDeck] Error handling addLearningDeck:', error);
        // Add more specific error reporting if it's a Tableland query error vs. local DB error
        if (error.message.startsWith('Tableland query failed')) {
             return { success: false, error: `Failed to fetch deck data from Tableland: ${error.message}` };
        }
        return { success: false, error: error.message || 'Failed to add learning deck.' };
    }
}
