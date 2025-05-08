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
    RequestActiveLearningWordsResponse
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
import { getMCQGenerationPrompt, getMCQGenerationPromptNativeToEn } from '../../services/llm/prompts/exercises';
import type { LLMConfig, LLMChatResponse, LLMProviderId, ChatMessage } from '../../services/llm/types';
import { handleSaveBookmark, handleLoadBookmarks } from './bookmark-handlers';
import { handleTagList, handleTagSuggest } from './tag-handlers';
import { handleGetPageInfo, handleGetSelectedText } from './pageInteractionHandlers';
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
import { browser } from 'wxt/browser'; // Import browser namespace
// import type { LearningDirection, StudyItem } from '../../types/study';
// import type { ITask } from 'pg-promise';

// Define the threshold for reprocessing (e.g., 1 hour in milliseconds)
const REPROCESS_INFO_THRESHOLD_MS = 1000;

// Define a similarity threshold (Cosine Distance)
const EMBEDDING_SIMILARITY_THRESHOLD = 0.1;

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

// Define and EXPORT DeckInfoForFiltering
export interface DeckInfoForFiltering {
  id: string; 
  name: string;
  description?: string;
  cardCount: number;
  sourceLanguage: string | null;
  targetLanguage: string | null;
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
            const dueItems = await getDueLearningItems(message.data.limit);
            console.log(`[Message Handlers] getDueLearningItems returned ${dueItems?.length ?? 0} item(s). Returning to StudyPage.`);
            console.log('[Message Handlers] Due items data:', JSON.stringify(dueItems, null, 2));
            return { dueItems };
        } catch (error) {
            console.error('[Message Handlers] Error calling getDueLearningItems:', error);
            return { dueItems: [] }; 
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
        const { sourceText, targetText, targetLang, count, direction } = message.data;
        
        console.log(`[Message Handlers DEBUG] Received direction value: ${direction}`);

        // Fallback for LearningDirection if type '../../types/study' not available
        const safeDirection: string = direction as string || 'EN_TO_NATIVE'; // Cast to string if type is missing

        const sourceLang = safeDirection === 'NATIVE_TO_EN' ? targetLang : 'en';
        const effectiveTargetLang = safeDirection === 'NATIVE_TO_EN' ? 'en' : targetLang;

        console.log(`[Message Handlers] Distractor generation direction: ${safeDirection} (${sourceLang} -> ${effectiveTargetLang})`);

        let userLlmConfig: FunctionConfig | null = null; 
        try {
            const settings = await userConfigurationStorage.getValue(); 
            if (!settings || !settings.llmConfig) {
                throw new Error('LLM configuration not found for distractor generation.');
            }
            userLlmConfig = settings.llmConfig;
            if (!userLlmConfig.providerId || !userLlmConfig.modelId || !userLlmConfig.baseUrl) {
                 throw new Error('LLM configuration is incomplete for distractor generation.');
            }

            let prompt: string;
            if (safeDirection === 'NATIVE_TO_EN') {
                 prompt = getMCQGenerationPromptNativeToEn(sourceText, targetText, sourceLang, effectiveTargetLang); 
                 console.log(`[Message Handlers] Using NATIVE_TO_EN prompt generator.`);
            } else {
                prompt = getMCQGenerationPrompt(sourceText, targetText, sourceLang, effectiveTargetLang);
                 console.log(`[Message Handlers] Using EN_TO_NATIVE prompt generator.`);
            }
            
            const llmResponse = await dynamicChat([{ role: 'user', content: prompt }], userLlmConfig);
            
            let rawContent = llmResponse?.choices?.[0]?.message?.content?.trim();

            if (!rawContent) throw new Error('LLM returned empty content.');

            // Attempt to parse JSON, as parseJsonFromLLM from mcq-helpers is not available
            let parsedJson: any;
            try {
                const jsonRegex = /```json\n([\s\S]*?)\n```/;
                const match = rawContent.match(jsonRegex);
                if (match && match[1]) {
                    parsedJson = JSON.parse(match[1]);
                } else {
                    const cleanedContent = rawContent.replace(/^```json\s*|\s*```$/g, '').trim();
                    parsedJson = JSON.parse(cleanedContent);
                }
            } catch (parseError) {
                console.error('[Message Handlers] Failed to parse JSON from LLM content:', rawContent, parseError);
                throw new Error('Failed to parse JSON from LLM response.');
            }

            if (parsedJson && Array.isArray(parsedJson.options) && typeof parsedJson.correctOptionId === 'number') {
                const distractors = parsedJson.options
                                        .filter((opt: any) => opt.id !== parsedJson.correctOptionId)
                                        .map((opt: any) => opt.text);
                console.log('[Message Handlers] Extracted distractors:', distractors);
                if (distractors.length >= count) {
                    return { distractors: distractors.slice(0, count) };
                } else {
                     console.warn('[Message Handlers] LLM returned fewer distractors than requested.');
                     return { distractors };
                }
            } else {
                console.error('[Message Handlers] Failed to parse expected structure from LLM for distractors:', parsedJson);
                throw new Error('Failed to parse distractors from LLM response');
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

    messaging.onMessage('tag:suggest', ({ data, sender }) => {
        console.log('[Message Handlers] Received tag:suggest');
        return handleTagSuggest(data, sender);
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
        console.log('[Message Handlers] fetchAvailableDeckFiles HANDLER EXECUTED');
        try {
            const config = await userConfigurationStorage.getValue();
            const nativeLang = config?.nativeLanguage;
            const targetLang = config?.targetLanguage;

            console.log(`[Message Handlers fetchAvailableDeckFiles] User languages - Native: ${nativeLang}, Target: ${targetLang}`);

            if (!nativeLang || !targetLang) {
                console.warn('[Message Handlers fetchAvailableDeckFiles] Native or target language missing in config.');
                return { success: false, error: 'User languages not configured.', decks: [] };
            }

            const availableDecks: DeckInfoForFiltering[] = [];

            // Define known decks and their paths
            const knownDeckFiles = [
                { identifier: 'programming_vi_en', path: 'decks/vi/programming_vi_en.json' },
                { identifier: 'travel_vi_en', path: 'decks/vi/travel_vi_en.json' },
                { identifier: 'common_en_zh', path: 'decks/en/common_en_zh.json' }
                // Add more decks here as they are created
            ];

            for (const deckFile of knownDeckFiles) {
                console.log(`[Message Handlers fetchAvailableDeckFiles] Checking deck: ${deckFile.identifier} at path ${deckFile.path}`);
                try {
                    const deckUrl = browser.runtime.getURL(deckFile.path as any);
                    const response = await fetch(deckUrl);
                    if (!response.ok) {
                        console.warn(`[Message Handlers fetchAvailableDeckFiles] Failed to fetch ${deckFile.path} (status: ${response.status}). Skipping.`);
                        continue; // Skip this deck if file not found or error
                    }
                    const deckData = await response.json();

                    // Validate basic structure
                    if (deckData && deckData.deckId && deckData.name && deckData.terms && Array.isArray(deckData.terms) && deckData.deckSourceLanguage && deckData.deckTargetLanguage) {
                        // Check if this deck matches user's configured languages
                        if (deckData.deckSourceLanguage === nativeLang && deckData.deckTargetLanguage === targetLang) {
                            const deckInfo: DeckInfoForFiltering = {
                                id: deckData.deckId,
                                name: deckData.name, // Will be displayed in UI
                                description: deckData.description,
                                cardCount: deckData.terms.length,
                                sourceLanguage: deckData.deckSourceLanguage,
                                targetLanguage: deckData.deckTargetLanguage
                            };
                            availableDecks.push(deckInfo);
                            console.log(`[Message Handlers fetchAvailableDeckFiles] Added matching deck: ${deckData.deckId}`);
                        } else {
                            console.log(`[Message Handlers fetchAvailableDeckFiles] Deck ${deckData.deckId} language pair (${deckData.deckSourceLanguage}->${deckData.deckTargetLanguage}) does not match user config (${nativeLang}->${targetLang}). Skipping.`);
                        }
                    } else {
                        console.warn(`[Message Handlers fetchAvailableDeckFiles] Invalid format for deck: ${deckFile.path}`, deckData);
                    }
                } catch (fetchError) {
                    console.error(`[Message Handlers fetchAvailableDeckFiles] Error fetching or parsing deck ${deckFile.path}:`, fetchError);
                }
            }

            console.log(`[Message Handlers fetchAvailableDeckFiles] Returning ${availableDecks.length} decks matching user languages.`);
            return { success: true, decks: availableDecks };

        } catch (error) {
            console.error('[Message Handlers fetchAvailableDeckFiles] Unexpected error:', error);
            return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred', decks: [] };
        }
    });
    console.log('[Message Handlers Register] <<< AFTER registering fetchAvailableDeckFiles handler.');

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
function getDeckPathFromIdentifier(identifier: string): string | null {
    // Assuming identifier format like "deckName_sourceLang_targetLang"
    // and files are at "decks/sourceLang/identifier.json"
    // e.g., "programming_vi_en" -> "decks/vi/programming_vi_en.json"
    const parts = identifier.split('_');
    if (parts.length < 2) { // Needs at least name_sourceLang
        console.warn(`[getDeckPathFromIdentifier] Could not parse source language from identifier: ${identifier}`);
        // Fallback or more robust parsing needed if format varies
        // For now, let's try a direct approach if the example "programming_vi_en" is typical
        if (identifier === 'programming_vi_en') {
            return 'decks/vi/programming_vi_en.json';
        }
        // Add more specific cases or a more general parsing rule
        return null; 
    }
    // This is a simplified example; robust parsing would be needed for various formats.
    // For "programming_vi_en", parts[1] would be "vi".
    const sourceLang = parts[parts.length - 2]; // Assumes sourceLang is second to last
    return `decks/${sourceLang}/${identifier}.json`;
}

// --- Add Deck Handler ---
async function handleAddLearningDeck(message: { data: { deckIdentifier: string } }): Promise<{ success: boolean, error?: string }> {
    const { deckIdentifier } = message.data;
    console.log(`[Message Handlers] Received addLearningDeck request for identifier: ${deckIdentifier}`);

    try {
        const db = await getDbInstance();
        if (!db) {
            console.error('[Message Handlers addLearningDeck] Database instance is null.');
            return { success: false, error: 'Database not initialized.' };
        }

        // 1. Construct path and fetch deck data from JSON
        const deckJsonPath = getDeckPathFromIdentifier(deckIdentifier);
        if (!deckJsonPath) {
            console.error(`[Message Handlers addLearningDeck] Could not determine JSON path for identifier: ${deckIdentifier}`);
            return { success: false, error: `Could not determine JSON path for deck: ${deckIdentifier}` };
        }
        console.log(`[Message Handlers addLearningDeck] Attempting to fetch deck from JSON: ${deckJsonPath}`);
        
        let deckData;
        try {
            const deckUrl = browser.runtime.getURL(deckJsonPath as any); // Use 'as any' if WXT types are too strict
            const response = await fetch(deckUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${deckJsonPath} (status: ${response.status}): ${response.statusText}`);
            }
            deckData = await response.json();
            if (!deckData || !deckData.deckId || !deckData.terms || !Array.isArray(deckData.terms)) {
                console.error(`[Message Handlers addLearningDeck] Invalid deck data format in ${deckJsonPath}:`, deckData);
                return { success: false, error: `Invalid deck data format in ${deckJsonPath}` };
            }
            console.log(`[Message Handlers addLearningDeck] Successfully fetched and parsed deck JSON: ${deckData.deckId}`);
        } catch (fetchError: any) {
            console.error(`[Message Handlers addLearningDeck] Error fetching or parsing deck JSON ${deckJsonPath}:`, fetchError);
            return { success: false, error: `Error fetching deck file: ${fetchError.message}` };
        }

        // Now, use the parsed deckData to populate DB tables
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
                deckData.deckId, // This is the identifier like "programming_vi_en"
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
        return { success: false, error: error.message || 'Failed to add learning deck.' };
    }
}
