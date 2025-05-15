import { defineExtensionMessaging } from '@webext-core/messaging';
import type {
    GetDueItemsRequest,
    BackgroundProtocolMap,
    DeckInfoForFiltering
} from '../../shared/messaging-types';
import { Grade } from 'ts-fsrs';
import {
    getDueLearningItems,
    getDistractors,
    updateSRSState,
    getStudySummaryCounts
} from '../../services/srs/scheduler';
import { getActiveLearningWordsFromDb, updateCachedDistractors } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';
import { ollamaChat } from '../../services/llm/providers/ollama/chat';
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
    getSummaryEmbeddingForVersion as _getSummaryEmbeddingForVersion
} from '../../services/db/visited_pages';
import type { PageVersionToEmbed } from '../../services/db/visited_pages';
import { pageInfoProcessingTimestamps } from '../../services/storage/storage';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { getSummarizationPrompt } from '../../services/llm/prompts/analysis';
import { userConfigurationStorage } from '../../services/storage/storage';
import type { FunctionConfig } from '../../services/storage/types';
import { 
    generateElevenLabsSpeechWithTimestamps
} from '../../services/tts/elevenLabsService';
import { DEFAULT_ELEVENLABS_MODEL_ID, DEFAULT_ELEVENLABS_VOICE_ID } from '../../shared/constants';
import {
    getOrInitDailyStudyStats,
    incrementNewItemsStudiedToday
} from '../../services/db/study_session';
import {
    getStudyStreakData,
    processDailyGoalCompletion,
    checkAndResetStreakIfNeeded,
    recordStudyActivityToday
} from '../../services/db/streaks';
import { registerLlmDistractorHandlers } from './llm-distractor-handlers';
import type { EmbeddingResult } from '../../services/llm/embedding';
// import type { LearningDirection, StudyItem } from '../../types/study';
// import type { ITask } from 'pg-promise';

// Define the threshold for reprocessing (e.g., 1 hour in milliseconds)
const REPROCESS_INFO_THRESHOLD_MS = 1000;

// --- Tableland Constants ---
const TABLELAND_BASE_URL = 'https://testnets.tableland.network/api/v1/query?statement=';
const TABLELAND_FLASHCARDS_TABLE_NAME = 'supercoach_flashcards_84532_111';
// IMPORTANT: Replace this placeholder with the actual full name of your decks metadata table on Tableland
const SUPERCOACH_DECKS_METADATA_TABLE_NAME = 'supercoach_deck_84532_110'; // e.g., 'yourprefix_decks_84532_yourdeckstableid'
// --- End Tableland Constants ---

// Utility function to get full language name from code
/* COMMENTING OUT - Replaced by Tableland fetching
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
*/

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

// --- START HELPER FUNCTION MOVED EARLIER ---
// Helper function to call the core getEmbedding service
async function getEmbeddingForText(text: string, config: FunctionConfig): Promise<EmbeddingResult | null> {
    if (!text) return null;
    console.log(`[Message Handlers getEmbeddingForText] Requesting embedding (length: ${text.length}) using provider: ${config.providerId}, model: ${config.modelId}`);
    try {
        // Use the imported getEmbedding function from the service
        const embeddingServiceResult = await getEmbedding(text, config);
        
        if (embeddingServiceResult) {
            console.log('[Message Handlers getEmbeddingForText] Embedding received from service.');
            return embeddingServiceResult; // This matches the EmbeddingResult interface
        } else {
            console.warn('[Message Handlers getEmbeddingForText] Embedding service returned null.');
            return null;
        }
    } catch (error) {
        console.error('[Message Handlers getEmbeddingForText] Error during embedding generation:', error);
        return null; // Return null on error to be handled by the caller
    }
}
// --- END HELPER FUNCTION MOVED EARLIER ---

// --- LRCLIB and Lyrics DB Imports ---
import { Client as LrcLibClient } from 'lrclib-api';
import { saveLyrics, type SongLyricsRecord } from '../../services/db/lyrics';
import type { SongDetectedMessagePayload } from '../../shared/messaging-types';
// --- End LRCLIB Imports ---

/**
 * Registers message listeners for background script operations (SRS, etc.).
 * @param messaging The messaging instance from the main background script.
 */
export function registerMessageHandlers(messaging: ReturnType<typeof defineExtensionMessaging<BackgroundProtocolMap>>): void {
    console.log('[Message Handlers] Registering background message listeners using passed instance...');

    // Register the new LLM Distractor Handlers
    registerLlmDistractorHandlers(messaging);

    // --- BEGIN songDetected Handler ---
    messaging.onMessage('songDetected', async (message) => {
        const { trackName, artistName, albumName } = message.data;
        console.log(`[Message Handlers songDetected] Received song: ${trackName} by ${artistName} (Album: ${albumName || 'N/A'})`);

        const lrcClient = new LrcLibClient();
        try {
            const query = {
                track_name: trackName,
                artist_name: artistName,
                album_name: albumName || undefined, // API expects undefined for missing album, not null
            };
            console.log('[Message Handlers songDetected] Querying lrclib.net with:', query);
            const lyricsData = await lrcClient.findLyrics(query);

            if (lyricsData) {
                console.log('[Message Handlers songDetected] Lyrics found on lrclib.net:', lyricsData);
                const recordToSave: Omit<SongLyricsRecord, 'id' | 'created_at' | 'updated_at'> = {
                    lrclib_id: lyricsData.id || null,
                    track_name: lyricsData.trackName,
                    artist_name: lyricsData.artistName,
                    album_name: lyricsData.albumName || null,
                    duration: lyricsData.duration || null,
                    instrumental: lyricsData.instrumental || false,
                    plain_lyrics: lyricsData.plainLyrics || null,
                    synced_lyrics: lyricsData.syncedLyrics || null,
                    has_synced_lyrics: !!lyricsData.syncedLyrics,
                };

                console.log('[Message Handlers songDetected] Attempting to save to DB:', recordToSave);
                const savedId = await saveLyrics(recordToSave);
                if (savedId) {
                    console.log(`[Message Handlers songDetected] Successfully saved/updated lyrics for "${trackName}", DB ID: ${savedId}`);
                } else {
                    console.error(`[Message Handlers songDetected] Failed to save lyrics for "${trackName}" to DB.`);
                }
            } else {
                console.log(`[Message Handlers songDetected] No lyrics found on lrclib.net for "${trackName}" by "${artistName}".`);
                // Optionally, save a record indicating no lyrics were found, or it's instrumental
                // This depends on whether you want to cache "not found" results to avoid re-querying.
                // For now, we'll only save if lyricsData is present.
                // If it's instrumental and not found by API, we might still want to save the basic track info.
                if (trackName && artistName) { // Basic check to at least have track and artist
                    const instrumentalRecord: Omit<SongLyricsRecord, 'id' | 'created_at' | 'updated_at'> = {
                        lrclib_id: null, // No lrclib ID
                        track_name: trackName,
                        artist_name: artistName,
                        album_name: albumName || null,
                        duration: null, // Unknown duration
                        instrumental: true, // Assume instrumental if no lyrics found, or refine this logic
                        plain_lyrics: null,
                        synced_lyrics: null,
                        has_synced_lyrics: false,
                    };
                    // Check if we already have a basic entry for this to avoid spamming instrumentals
                    const existing = await saveLyrics(instrumentalRecord); // saveLyrics handles upsert
                     if (existing) {
                        console.log(`[Message Handlers songDetected] Saved/updated (assumed) instrumental track info for "${trackName}", DB ID: ${existing}`);
                    } else {
                        console.log(`[Message Handlers songDetected] Did not save instrumental info for "${trackName}" as it might already exist or failed.`);
                    }
                }
            }
        } catch (error) {
            console.error(`[Message Handlers songDetected] Error fetching or processing lyrics for "${trackName}":`, error);
        }
        // No explicit return value needed for this handler as per BackgroundProtocolMap Promise<void>
    });
    // --- END songDetected Handler ---

    async function getSummaryFromLLM(text: string): Promise<string | null> {
        if (!text) return null;
        console.log('[Message Handlers getSummaryFromLLM] Requesting summary from LLM...');
        
        let llmFunctionConfig: FunctionConfig | null = null; 
        try {
            const settings = await userConfigurationStorage.getValue(); 
            if (!settings) {
                console.error('[Message Handlers getSummaryFromLLM] User settings not found. Cannot generate summary.');
                return null; 
            }

            // --- NEW: Prioritize settings.llmConfig --- 
            if (settings.llmConfig && 
                settings.llmConfig.providerId && settings.llmConfig.providerId !== 'none' &&
                settings.llmConfig.modelId && 
                settings.llmConfig.baseUrl) {
                
                console.log('[Message Handlers getSummaryFromLLM] Using nested llmConfig:', settings.llmConfig);
                llmFunctionConfig = {
                    providerId: settings.llmConfig.providerId,
                    modelId: settings.llmConfig.modelId,
                    baseUrl: settings.llmConfig.baseUrl,
                    apiKey: settings.llmConfig.apiKey, // Will be undefined if not set, which is fine
                };
            } else {
                // --- FALLBACK: Construct FunctionConfig from individual flat settings --- 
                console.log('[Message Handlers getSummaryFromLLM] Nested llmConfig not found or incomplete, attempting fallback to flat properties.');
                if (settings.selectedLlmProvider && settings.selectedLlmProvider !== 'none') {
                    llmFunctionConfig = {
                        providerId: settings.selectedLlmProvider,
                        modelId: '', // Placeholder, to be filled based on provider
                        baseUrl: '', // Placeholder, to be filled based on provider
                        apiKey: undefined, // Placeholder, if applicable
                    };

                    switch (settings.selectedLlmProvider) {
                        case 'ollama':
                            if (settings.ollamaModel && settings.ollamaBaseUrl) {
                                llmFunctionConfig.modelId = settings.ollamaModel;
                                llmFunctionConfig.baseUrl = settings.ollamaBaseUrl;
                            } else {
                                console.error('[Message Handlers getSummaryFromLLM] Fallback: Ollama configuration incomplete (flat properties).');
                                llmFunctionConfig = null; // Invalidate config
                            }
                            break;
                        case 'lmstudio':
                            if (settings.lmStudioModel && settings.lmStudioBaseUrl) {
                                llmFunctionConfig.modelId = settings.lmStudioModel;
                                llmFunctionConfig.baseUrl = settings.lmStudioBaseUrl;
                            } else {
                                console.error('[Message Handlers getSummaryFromLLM] Fallback: LMStudio configuration incomplete (flat properties).');
                                llmFunctionConfig = null; // Invalidate config
                            }
                            break;
                        case 'jan':
                            if (settings.janModel && settings.janBaseUrl) {
                                llmFunctionConfig.modelId = settings.janModel;
                                llmFunctionConfig.baseUrl = settings.janBaseUrl;
                            } else {
                                console.error('[Message Handlers getSummaryFromLLM] Fallback: Jan configuration incomplete (flat properties).');
                                llmFunctionConfig = null; // Invalidate config
                            }
                            break;
                        // Add cases for other providers if they exist (e.g., OpenAI with apiKey)
                        default:
                            console.error(`[Message Handlers getSummaryFromLLM] Fallback: Unsupported LLM provider: ${settings.selectedLlmProvider}`);
                            llmFunctionConfig = null; // Invalidate config
                    }
                } // End of fallback construction
            }

            if (!llmFunctionConfig) {
                 console.error('[Message Handlers getSummaryFromLLM] LLM configuration is missing, incomplete, or unsupported.');
                 return null;
            }

            const prompt = getSummarizationPrompt(text);
            console.log(`[Message Handlers getSummaryFromLLM] Using LLM config: Provider=${llmFunctionConfig.providerId}, Model=${llmFunctionConfig.modelId}, BaseUrl=${llmFunctionConfig.baseUrl}`);
            
            const response = await dynamicChat([{ role: 'user', content: prompt }], llmFunctionConfig);
            
            const summary = response?.choices?.[0]?.message?.content?.trim();
            if (!summary) {
                console.warn('[Message Handlers getSummaryFromLLM] LLM returned empty summary.');
                return null;
            }
            console.log(`[Message Handlers getSummaryFromLLM] Received summary (length: ${summary.length}): ${summary.substring(0, 100)}...`);
            return summary;
        } catch (error) {
            console.error('[Message Handlers getSummaryFromLLM] Error getting summary from LLM:', error);
            if (llmFunctionConfig) {
                 console.error(`[Message Handlers getSummaryFromLLM] Failed using config: Provider=${llmFunctionConfig.providerId}, Model=${llmFunctionConfig.modelId}, BaseUrl=${llmFunctionConfig.baseUrl}`);
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
             
            // Explicitly cast grade to Grade type from ts-fsrs if they are compatible
            await updateSRSState(learningId, grade as Grade, new Date(), incorrectChoiceText);
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
        console.log('[Message Handlers] Received triggerBatchEmbedding request.');
        let pagesProcessedCount = 0;
        let errorsEncountered = 0;
        let configErrorMessage: string | null = null;
        
        // Declare pagesToEmbed and preliminaryEmbeddingConfig outside try for catch block access
        let pagesToEmbed: PageVersionToEmbed[] = []; 
        let preliminaryEmbeddingConfig: FunctionConfig | null = null;

        try {
            const settings = await userConfigurationStorage.getValue();
            if (!settings) {
                console.error('[Message Handlers triggerBatchEmbedding] User settings not found.');
                return { success: false, message: 'User settings not found.', pagesProcessed: 0, errors: 1 };
            }

            // --- Determine preliminaryEmbeddingConfig ---
            if (settings.embeddingConfig && settings.embeddingConfig.providerId && settings.embeddingConfig.modelId && settings.embeddingConfig.baseUrl) {
                preliminaryEmbeddingConfig = settings.embeddingConfig;
                console.log('[Message Handlers triggerBatchEmbedding] Preliminary check: Using settings.embeddingConfig.');
            } else {
                console.log('[Message Handlers triggerBatchEmbedding] Preliminary check: settings.embeddingConfig not found or incomplete. Trying fallback.');
                if (settings.embeddingModelProvider && settings.embeddingModelProvider !== 'none') {
                    let modelId: string | null = null;
                    let baseUrl: string | null = null;
                    switch (settings.embeddingModelProvider) {
                        case 'ollama':
                            modelId = settings.ollamaEmbeddingModel || null;
                            baseUrl = settings.ollamaBaseUrl || null;
                            break;
                        case 'lmstudio':
                            modelId = settings.lmStudioEmbeddingModel || null;
                            baseUrl = settings.lmStudioBaseUrl || null;
                            break;
                        case 'jan':
                            modelId = settings.janEmbeddingModel || null;
                            baseUrl = settings.janBaseUrl || null;
                            break;
                        default:
                            console.error(`[Message Handlers triggerBatchEmbedding] Unsupported embedding provider for fallback: ${settings.embeddingModelProvider}`);
                    }
                    if (modelId && baseUrl) {
                        preliminaryEmbeddingConfig = {
                            providerId: settings.embeddingModelProvider,
                            modelId: modelId,
                            baseUrl: baseUrl,
                        };
                        console.log('[Message Handlers triggerBatchEmbedding] Preliminary check: Using flat properties for fallback.');
                    }
                }
            }
            
            if (!preliminaryEmbeddingConfig) {
                configErrorMessage = 'Embedding model or provider not configured by user, or configuration is incomplete.';
                console.error(`[Message Handlers triggerBatchEmbedding] ${configErrorMessage}`);
                return { success: false, message: configErrorMessage, pagesProcessed: 0, errors: 1 };
            }

            const db = await getDbInstance();
            if (!db) {
                console.error('[Message Handlers triggerBatchEmbedding] Database instance is null.');
                return { success: false, message: 'Database not initialized.', pagesProcessed: 0, errors: 1 };
            }

            // Assign to pagesToEmbed declared outside
            pagesToEmbed = await getPagesNeedingEmbedding();

            if (pagesToEmbed.length === 0) {
                console.log('[Message Handlers triggerBatchEmbedding] No page versions found needing embedding.');
                return { success: true, pagesProcessed: 0, errors: 0 };
            }

            console.log(`[Message Handlers triggerBatchEmbedding] Found ${pagesToEmbed.length} candidate versions to process.`);

            for (const page of pagesToEmbed) {
                console.log(`[Message Handlers triggerBatchEmbedding] Processing candidate version_id: ${page.version_id} for URL: ${page.url}`);
                try {
                    const latestEmbeddedVersion = await findLatestEmbeddedVersion(page.url);

                    if (latestEmbeddedVersion && latestEmbeddedVersion.markdown_hash === page.markdown_hash) {
                        console.log(`[Message Handlers triggerBatchEmbedding] Skipping page ${page.url} (version ${page.version_id}) as its content hash matches the latest embedded version.`);
                        await deletePageVersion(page.version_id);
                        continue;
                    }

                    console.log(`[Message Handlers triggerBatchEmbedding] Original markdown hashes differ or no previous embedded version. Proceeding with summarization for version_id: ${page.version_id}.`);
                    
                    const summary = await getSummaryFromLLM(page.markdown_content);
                    if (!summary) {
                        console.warn(`[Message Handlers triggerBatchEmbedding] Summarization failed for version_id: ${page.version_id}. Skipping.`);
                        errorsEncountered++;
                        continue;
                    }
                    const summaryHash = await calculateHash(summary);

                    const embeddingResult = await getEmbeddingForText(page.markdown_content, preliminaryEmbeddingConfig);
                    if (embeddingResult && embeddingResult.embedding && embeddingResult.embedding.length > 0) {
                        await updatePageVersionSummaryAndCleanup({ 
                            version_id: page.version_id, 
                            summary_content: summary, 
                            summary_hash: summaryHash 
                        });

                        if (latestEmbeddedVersion) {
                            if (summaryHash && latestEmbeddedVersion.summary_hash && summaryHash === latestEmbeddedVersion.summary_hash) {
                                console.log(`[Message Handlers triggerBatchEmbedding] Exact SUMMARY hash match found... Handling as duplicate.`);
                                await incrementPageVersionVisitCount(latestEmbeddedVersion.version_id);
                                await deletePageVersion(page.version_id);
                            } else {
                                console.log(`[Message Handlers triggerBatchEmbedding] SUMMARY semantically different. Finalizing embedding.`);
                                await finalizePageVersionEmbedding({ version_id: page.version_id, embeddingInfo: embeddingResult });
                            }
                        } else {
                            console.log(`[Message Handlers triggerBatchEmbedding] No previous embedded version found... Finalizing SUMMARY embedding.`);
                            await finalizePageVersionEmbedding({ version_id: page.version_id, embeddingInfo: embeddingResult });
                        }
                        pagesProcessedCount++; // Increment after successful processing path
                    } else {
                        console.error(`[Message Handlers triggerBatchEmbedding] Embedding generation failed or returned empty for version_id: ${page.version_id}. Skipping.`);
                        errorsEncountered++;
                        continue;
                    }
                } catch (processingError) {
                    console.error(`[Message Handlers triggerBatchEmbedding] Error processing candidate version_id ${page.version_id}:`, processingError);
                    errorsEncountered++;
                }
            }

            console.log(`[Message Handlers triggerBatchEmbedding] Batch embedding complete. Pages processed: ${pagesProcessedCount}, Errors: ${errorsEncountered}.`);
            return { success: true, pagesProcessed: pagesProcessedCount, errors: errorsEncountered };
        } catch (error: any) {
            console.error('[Message Handlers triggerBatchEmbedding] Unexpected error during batch embedding:', error);
            // Log embeddingFunctionConfig safely
            if (preliminaryEmbeddingConfig) { 
                 console.error(`[Message Handlers triggerBatchEmbedding] Failed using embedding config (if available): ${JSON.stringify(preliminaryEmbeddingConfig)}`);
            } else {
                 console.error('[Message Handlers triggerBatchEmbedding] Embedding configuration was not available or not set at the time of error.');
            }
            const totalPotentialErrorCount = pagesToEmbed.length > 0 ? pagesToEmbed.length : (errorsEncountered + 1);
            return { success: false, pagesProcessed: pagesProcessedCount, errors: totalPotentialErrorCount, message: error.message || 'Batch embedding failed.' };
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
            const settings = await userConfigurationStorage.getValue();
            if (!settings) {
                console.error('[Message Handlers REQUEST_TTS_FROM_WIDGET] User settings not found.');
                return { success: false, error: 'User settings not found' };
            }

            // Force ElevenLabs for debugging, bypassing settings for provider ID selection.
            const ttsProviderId = 'elevenlabs'; 
            const elevenLabsApiKey = settings.ttsConfig?.apiKey || settings.elevenLabsApiKey;
            
            // Correctly determine the Engine Model ID and the specific Voice ID
            const actualEngineModelId = DEFAULT_ELEVENLABS_MODEL_ID; // This is for the TTS engine model, e.g., 'eleven_multilingual_v2'
            const actualVoiceId = settings.elevenLabsVoiceId || DEFAULT_ELEVENLABS_VOICE_ID; // This is for the specific voice to use

            console.log(`[Message Handlers REQUEST_TTS_FROM_WIDGET] DEBUG: Forcing TTS Provider to: ${ttsProviderId}`);
            console.log(`[Message Handlers REQUEST_TTS_FROM_WIDGET] Using ElevenLabs. Voice ID: ${actualVoiceId}, Model ID: ${actualEngineModelId}`);

            if (ttsProviderId === 'elevenlabs') {
                if (!elevenLabsApiKey) {
                    const errMsg = 'ElevenLabs API key not configured.';
                    console.error(`[Message Handlers REQUEST_TTS_FROM_WIDGET] ${errMsg}`);
                    return { success: false, error: errMsg };
                }
                // console.log(`[Message Handlers REQUEST_TTS_FROM_WIDGET] Using ElevenLabs. Voice ID: ${elevenLabsVoiceId}, Model ID: ${elevenLabsModelId}`);
                
                try {
                    // Call the new function with timestamps
                    const ttsResult = await generateElevenLabsSpeechWithTimestamps(
                        elevenLabsApiKey,
                        text,
                        actualEngineModelId, 
                        actualVoiceId,
                        undefined, // voiceSettings
                        speed // speed
                    );

                    // If the above call succeeds, ttsResult contains audioBlob and alignmentData
                    const audioDataUrl = await blobToDataURL(ttsResult.audioBlob);
                    console.log('[Message Handlers REQUEST_TTS_FROM_WIDGET] ElevenLabs TTS with timestamps successful, returning data URL and alignment.');
                    return { success: true, audioDataUrl, alignmentData: ttsResult.alignmentData };

                } catch (elevenLabsError: any) {
                    // Handle errors thrown by generateElevenLabsSpeechWithTimestamps
                    console.error('[Message Handlers REQUEST_TTS_FROM_WIDGET] ElevenLabs TTS with timestamps failed:', elevenLabsError);
                    return { success: false, error: elevenLabsError.message || 'ElevenLabs TTS generation failed' };
                }
            } else if (ttsProviderId === 'browser') {
                console.log('[Message Handlers REQUEST_TTS_FROM_WIDGET] Using Browser TTS. Client should handle this.');
                // Instruct client to use browser TTS. The content script already has logic for this.
                return { success: false, error: 'Browser TTS should be handled client-side.', useBrowserTTS: true }; 
            } else {
                console.warn(`[Message Handlers REQUEST_TTS_FROM_WIDGET] No TTS vendor selected or unsupported vendor: ${ttsProviderId}`);
                return { success: false, error: 'No TTS vendor configured or vendor not supported for background generation.' };
            }
        } catch (error: any) {
            console.error('[Message Handlers REQUEST_TTS_FROM_WIDGET] Error:', error);
            return { success: false, error: error.message || 'Failed to generate TTS' };
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
    messaging.onMessage('getDailyStudyStats', async (_message) => {
        console.log('[Message Handlers] Received getDailyStudyStats request');
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
    messaging.onMessage('incrementDailyNewItemsStudied', async (_message) => {
        console.log('[Message Handlers] Received incrementDailyNewItemsStudied request.');
        try {
            // First, record that activity happened today.
            await recordStudyActivityToday(); 

            // Then, increment the count of new items studied.
            const updatedCount = await incrementNewItemsStudiedToday();
            
            // Check if daily goal is met AFTER incrementing.
            const dailyStats = await getOrInitDailyStudyStats(); // Re-fetch to get the latest count.
            const userSettings = await userConfigurationStorage.getValue();
            const dailyNewItemLimit = userSettings.newItemsPerDay || 20; // Use configured limit or default to 20

            if (dailyStats.newItemsStudiedToday >= dailyNewItemLimit) {
                console.log(`[Message Handlers incrementDailyNewItemsStudied] Daily new item goal (${dailyNewItemLimit}) met or exceeded (${dailyStats.newItemsStudiedToday}). Processing goal completion for streak.`);
                await processDailyGoalCompletion(); 
            }

            return { success: true, updatedNewItemsStudiedToday: updatedCount };
        } catch (error: any) {
            console.error('[Message Handlers] Error in incrementDailyNewItemsStudied:', error);
            return { success: false, error: error.message || 'Failed to increment daily new items studied' };
        }
    });

    // --- Add new streak handlers ---
    messaging.onMessage('getStudyStreakData', async (_message) => {
        console.log('[Message Handlers] Received getStudyStreakData request.');
        try {
            // It's crucial to check and reset the streak *before* fetching it for display.
            // This ensures the data is up-to-date regarding potential breaks from previous days.
            await checkAndResetStreakIfNeeded();
            const streakData = await getStudyStreakData();
            return {
                success: true,
                currentStreak: streakData.currentStreak,
                longestStreak: streakData.longestStreak,
                lastStreakIncrementDate: streakData.lastStreakIncrementDate,
                lastActivityDate: streakData.lastActivityDate
            };
        } catch (error: any) {
            console.error('[Message Handlers] Error in getStudyStreakData:', error);
            return { success: false, error: error.message || 'Failed to get study streak data' };
        }
    });

    messaging.onMessage('notifyDailyGoalComplete', async (_message) => {
        console.log('[Message Handlers] Received notifyDailyGoalComplete request');
        try {
            // This message is an explicit signal that the goal was met,
            // usually called from the frontend when it confirms the daily item count hits the limit.
            // The `incrementDailyNewItemsStudied` handler also calls this internally.
            // Calling it here ensures that if the internal call was missed or if there's another
            // path to goal completion, it's still processed.
            // `processDailyGoalCompletion` is idempotent for the same day.
            const updatedData = await processDailyGoalCompletion();
            if (updatedData) {
                return { success: true, updatedStreakData: updatedData };
            } else {
                return { success: false, error: 'Failed to process daily goal completion for streak.' };
            }
        } catch (error: any) {
            console.error('[Message Handlers] Error in notifyDailyGoalComplete:', error);
            return { success: false, error: error.message || 'Failed to process daily goal completion' };
        }
    });
    
    messaging.onMessage('recordStudyActivityToday', async (_message) => {
        console.log('[Message Handlers] Received recordStudyActivityToday request');
        try {
            await recordStudyActivityToday();
            return { success: true };
        } catch (error: any) {
            console.error('[Message Handlers] Error in recordStudyActivityToday:', error);
            return { success: false, error: error.message || 'Failed to record study activity.' };
        }
    });
    // --- END: Add new streak handlers ---

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
