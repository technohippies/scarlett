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
import type { PGlite } from '@electric-sql/pglite';
import { getSummarizationPrompt } from '../../services/llm/prompts/analysis';
import { userConfigurationStorage } from '../../services/storage/storage';
import type { FunctionConfig } from '../../services/storage/types';
import { generateElevenLabsSpeechStream } from '../../services/tts/elevenLabsService';
import { DEFAULT_ELEVENLABS_MODEL_ID, DEFAULT_ELEVENLABS_VOICE_ID } from '../../shared/constants';

// Define the protocol map for messages handled by the background script
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
}

// Initialize messaging for the background context
const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

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

/**
 * Registers message listeners for background script operations (SRS, etc.).
 */
export function registerMessageHandlers(): void {
    console.log('[Message Handlers] Registering background message listeners...');

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

        const sourceLang = direction === 'NATIVE_TO_EN' ? targetLang : 'en';
        const effectiveTargetLang = direction === 'NATIVE_TO_EN' ? 'en' : targetLang;

        console.log(`[Message Handlers] Distractor generation direction: ${direction} (${sourceLang} -> ${effectiveTargetLang})`);

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
            if (direction === 'NATIVE_TO_EN') {
                 prompt = getMCQGenerationPromptNativeToEn(sourceText, targetText, sourceLang, effectiveTargetLang); 
                 console.log(`[Message Handlers] Using NATIVE_TO_EN prompt generator.`);
            } else {
                prompt = getMCQGenerationPrompt(sourceText, targetText, sourceLang, effectiveTargetLang);
                 console.log(`[Message Handlers] Using EN_TO_NATIVE prompt generator.`);
            }
            
            const llmResponse = await dynamicChat([{ role: 'user', content: prompt }], userLlmConfig);
            
            let rawContent = llmResponse?.choices?.[0]?.message?.content?.trim();

            if (!rawContent) throw new Error('LLM returned empty content.');

            const jsonRegex = /```json\n([\s\S]*?)\n```/;
            const match = rawContent.match(jsonRegex);
            let parsedJson: any;
            if (match && match[1]) {
                 parsedJson = JSON.parse(match[1]);
            } else {
                 const cleanedContent = rawContent.replace(/^```json\s*|\s*```$/g, '').trim();
                 parsedJson = JSON.parse(cleanedContent);
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
        console.log('[Message Handlers] Received REQUEST_ACTIVE_LEARNING_WORDS request:', message.data);
        try {
            const words = await getActiveLearningWordsFromDb();
            console.log(`[Message Handlers] REQUEST_ACTIVE_LEARNING_WORDS: Found ${words.length} words.`);
            return { success: true, words: words };
        } catch (error) {
            console.error('[Message Handlers] Error handling REQUEST_ACTIVE_LEARNING_WORDS:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch active learning words.' };
        }
    });

    console.log('[Message Handlers] Background message listeners registered.');
}

async function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
} 