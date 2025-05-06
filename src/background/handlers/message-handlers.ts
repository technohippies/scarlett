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
    ExtractMarkdownResponse
} from '../../shared/messaging-types';
import {
    getDueLearningItems,
    getDistractors,
    updateSRSState,
    // --- UNCOMMENT: Import the actual function --- 
    getStudySummaryCounts // Assuming this function exists
} from '../../services/srs/scheduler';
import { updateCachedDistractors } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';
import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import { getMCQGenerationPrompt, getMCQGenerationPromptNativeToEn } from '../../services/llm/prompts/exercises';
import type { LLMConfig, LLMChatResponse, LLMProviderId, ChatMessage } from '../../services/llm/types';
import { handleSaveBookmark, handleLoadBookmarks } from './bookmark-handlers';
import { handleTagList, handleTagSuggest } from './tag-handlers';
import { handleGetPageInfo, handleGetSelectedText } from './pageInteractionHandlers';
import { getEmbedding } from '../../services/llm/embedding';
import { 
    recordPageVisitVersion, // Use the new function name
    getPagesNeedingEmbedding, 
    findLatestEmbeddedVersion, 
    finalizePageVersionEmbedding, 
    deletePageVersion, 
    incrementPageVersionVisitCount,
    countPagesNeedingEmbedding, 
    calculateHash, // Assuming calculateHash is exported or moved here
    updatePageVersionSummaryAndCleanup, // NEW function needed
    getSummaryEmbeddingForVersion // NEW function needed
} from '../../services/db/visited_pages';
import type { PageVersionToEmbed } from '../../services/db/visited_pages'; // Import interfaces
import { pageInfoProcessingTimestamps } from '../../services/storage/storage';
import type { PGlite } from '@electric-sql/pglite';
import { getSummarizationPrompt } from '../../services/llm/prompts/analysis'; // Import the prompt
// --- Import user configuration storage --- 
import { userConfigurationStorage } from '../../services/storage/storage'; // Correct name
// --- Import FunctionConfig --- 
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
        error?: string; // Explicitly add the optional error field 
    }>;
    getPendingEmbeddingCount(): Promise<{ count: number }>;
    generateTTS(data: GenerateTTSPayload): Promise<void>;
    extractMarkdownFromHtml(data: ExtractMarkdownRequest): Promise<ExtractMarkdownResponse>;
    REQUEST_TTS_FROM_WIDGET(data: { text: string; lang: string; speed?: number }): 
        Promise<{ success: boolean; audioDataUrl?: string; error?: string }>;
}

// Initialize messaging for the background context
const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

// Define the threshold for reprocessing (e.g., 1 hour in milliseconds)
// --- TEMPORARILY CHANGE FOR TESTING (AGAIN) --- 
const REPROCESS_INFO_THRESHOLD_MS = 1000; // Original: 1 * 60 * 60 * 1000; 

// Define a similarity threshold (Cosine Distance)
// Lower value = more similar. E.g., 0.1 means very similar. Adjust as needed.
const EMBEDDING_SIMILARITY_THRESHOLD = 0.1;

// --- Dynamic Chat Helper (Simplified to only handle confirmed non-streaming) --- 
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
        stream: false, // Explicitly set stream to false
        options: { temperature: 0 } 
    };

    console.log(`[dynamicChat] Calling provider: ${providerId}, Model: ${modelId}`);

    switch (providerId) {
        case 'ollama':
            // ollamaChat correctly handles stream: false and returns LLMChatResponse
            return ollamaChat(messages, chatConfig);
        // --- Removed other cases until non-streaming behavior is confirmed/handled --- 
        // case 'jan':
        // case 'lmstudio':
        default:
            // Throw error for any provider other than ollama for now
            console.error(`[dynamicChat] Unsupported or unverified non-streaming chat provider: ${providerId}`);
            throw new Error(`Unsupported or unverified non-streaming chat provider: ${providerId}`);
    }
}
// --- End Dynamic Chat Helper --- 

/**
 * Registers message listeners for background script operations (SRS, etc.).
 */
export function registerMessageHandlers(): void {
    console.log('[Message Handlers] Registering background message listeners...');

    // --- Define helper for LLM call (Uses User Config & Dynamic Chat) --- 
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

            // --- Check if config is complete --- 
            if (!userLlmConfig.providerId || !userLlmConfig.modelId || !userLlmConfig.baseUrl) {
                 console.error('[Message Handlers getSummaryFromLLM] LLM configuration is incomplete:', userLlmConfig);
                 return null;
            }

            const prompt = getSummarizationPrompt(text);
            console.log(`[Message Handlers getSummaryFromLLM] Using LLM config: Provider=${userLlmConfig.providerId}, Model=${userLlmConfig.modelId}, BaseUrl=${userLlmConfig.baseUrl}`);
            
            // --- Use the dynamic chat helper --- 
            const response = await dynamicChat([{ role: 'user', content: prompt }], userLlmConfig);
            // --- End dynamic chat call --- 
            
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
    // --- End LLM helper ---

    // --- Listener for getDueItems --- 
    messaging.onMessage('getDueItems', async (message) => {
        console.log('[Message Handlers] Received getDueItems request:', message.data);
        try {
            const dueItems = await getDueLearningItems(message.data.limit);
            // --- Log Result from Service --- 
            console.log(`[Message Handlers] getDueLearningItems returned ${dueItems?.length ?? 0} item(s). Returning to StudyPage.`);
            console.log('[Message Handlers] Due items data:', JSON.stringify(dueItems, null, 2));
            return { dueItems };
        } catch (error) {
            // --- Log Error from Service --- 
            console.error('[Message Handlers] Error calling getDueLearningItems:', error);
            return { dueItems: [] }; 
        }
    });

    // --- Listener for getDistractorsForItem --- 
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

    // --- Listener for submitReviewResult --- 
    messaging.onMessage('submitReviewResult', async (message) => {
        console.log('[Message Handlers] Received submitReviewResult request:', message.data);
        const { learningId, grade, incorrectChoiceText } = message.data;
        try {
            // --- Fetch variation_type before updating SRS state ---
            let variationType: string | null = 'unknown';
            try {
                const db = await getDbInstance();
                // Query to get translation_id from learningId, then variation_type from translation_id
                const result = await db.query<{ variation_type: string | null }>(
                   `SELECT lt.variation_type 
                    FROM lexeme_translations lt
                    JOIN user_learning ul ON lt.translation_id = ul.translation_id
                    WHERE ul.learning_id = $1;`,
                   [learningId]
                );
                if (result.rows && result.rows.length > 0) {
                    variationType = result.rows[0].variation_type ?? 'original'; // Default to original if null
                }
                 console.log(`[Message Handlers] Fetched variation type for learningId ${learningId}: ${variationType}`);
            } catch (fetchError) {
                 console.error(`[Message Handlers] Error fetching variation type for learningId ${learningId}:`, fetchError);
                 // Proceed with SRS update even if variation type fetch fails
            }
            // --- End fetch variation_type ---
            
            // Now log the variation type along with the grade
             console.log(`[Message Handlers] Submitting review grade ${grade} for variation type: ${variationType}`);
             
            // Update SRS state (original logic)
            await updateSRSState(learningId, grade, new Date(), incorrectChoiceText);
            return { success: true };
        } catch (error: any) {
            console.error('[Message Handlers] Error handling submitReviewResult:', error);
            return { success: false, error: error.message || 'Failed to update SRS state.' };
        }
    });

    // --- Listener for cacheDistractors ---
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

    // --- Listener for generateLLMDistractors (Uses Dynamic Chat) --- 
    messaging.onMessage('generateLLMDistractors', async (message) => {
        console.log('[Message Handlers] Received generateLLMDistractors request:', message.data);
        const { sourceText, targetText, targetLang, count, direction } = message.data;
        
        // ---- DEBUG: Log received direction ----
        console.log(`[Message Handlers DEBUG] Received direction value: ${direction}`);
        // ---- END DEBUG ----

        // Determine source language based on direction
        const sourceLang = direction === 'NATIVE_TO_EN' ? targetLang : 'en';
        const effectiveTargetLang = direction === 'NATIVE_TO_EN' ? 'en' : targetLang;

        // Log the direction being processed
        console.log(`[Message Handlers] Distractor generation direction: ${direction} (${sourceLang} -> ${effectiveTargetLang})`);

        let userLlmConfig: FunctionConfig | null = null; 
        try {
            // --- Load user LLM config --- 
            const settings = await userConfigurationStorage.getValue(); 
            if (!settings || !settings.llmConfig) {
                throw new Error('LLM configuration not found for distractor generation.');
            }
            userLlmConfig = settings.llmConfig;
            // --- Check if config is complete --- 
            if (!userLlmConfig.providerId || !userLlmConfig.modelId || !userLlmConfig.baseUrl) {
                 throw new Error('LLM configuration is incomplete for distractor generation.');
            }
            // --- End Load/Check Config --- 

            let prompt: string;
            if (direction === 'NATIVE_TO_EN') {
                 prompt = getMCQGenerationPromptNativeToEn(sourceText, targetText, sourceLang, effectiveTargetLang); 
                 console.log(`[Message Handlers] Using NATIVE_TO_EN prompt generator.`);
            } else { // Default to EN_TO_NATIVE
                prompt = getMCQGenerationPrompt(sourceText, targetText, sourceLang, effectiveTargetLang);
                 console.log(`[Message Handlers] Using EN_TO_NATIVE prompt generator.`);
            }
            
            // --- Use the dynamic chat helper --- 
            const llmResponse = await dynamicChat([{ role: 'user', content: prompt }], userLlmConfig);
            // --- End dynamic chat call --- 
            
            let rawContent = llmResponse?.choices?.[0]?.message?.content?.trim();

            if (!rawContent) throw new Error('LLM returned empty content.');

            // Attempt to parse the JSON response (from MCQ prompt)
            const jsonRegex = /```json\n([\s\S]*?)\n```/;
            const match = rawContent.match(jsonRegex);
            let parsedJson: any;
            if (match && match[1]) {
                 parsedJson = JSON.parse(match[1]);
            } else {
                 // Attempt fallback parse of whole string
                 const cleanedContent = rawContent.replace(/^```json\s*|\s*```$/g, '').trim();
                 parsedJson = JSON.parse(cleanedContent);
            }

            if (parsedJson && Array.isArray(parsedJson.options) && typeof parsedJson.correctOptionId === 'number') {
                // Extract distractors by filtering out the correct answer
                const distractors = parsedJson.options
                                        .filter((opt: any) => opt.id !== parsedJson.correctOptionId)
                                        .map((opt: any) => opt.text);
                console.log('[Message Handlers] Extracted distractors:', distractors);
                // Ensure we have enough, though the prompt asks for 3 incorrect + 1 correct
                if (distractors.length >= count) {
                    return { distractors: distractors.slice(0, count) }; // Return the requested count
                } else {
                     console.warn('[Message Handlers] LLM returned fewer distractors than requested.');
                     return { distractors }; // Return what we got
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

    // --- Listener for getStudySummary ---
    messaging.onMessage('getStudySummary', async (message) => {
        console.log('[Message Handlers] Received getStudySummary request:', message.data);
        try {
            // --- Use the actual function (UNCOMMENTED) --- 
            const counts = await getStudySummaryCounts(); 
            // const counts = { due: 0, review: 0, new: 0 }; // Placeholder removed
            console.log('[Message Handlers] Retrieved summary counts from scheduler:', counts);
            // ---------

            // Validate and ensure counts are numbers, default to 0 if not
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

    // --- Listener for saveBookmark ---
    messaging.onMessage('saveBookmark', ({ data, sender }) => {
        console.log('[Message Handlers] Received saveBookmark');
        return handleSaveBookmark(data, sender);
    });

    // --- Listener for loadBookmarks ---
    messaging.onMessage('loadBookmarks', ({ data, sender }) => {
        console.log('[Message Handlers] Received loadBookmarks');
        return handleLoadBookmarks(data, sender);
    });

    // --- Listener for tag:list ---
    messaging.onMessage('tag:list', ({ data, sender }) => {
        console.log('[Message Handlers] Received tag:list');
        return handleTagList(data, sender);
    });

    // --- Listener for tag:suggest ---
    messaging.onMessage('tag:suggest', ({ data, sender }) => {
        console.log('[Message Handlers] Received tag:suggest');
        return handleTagSuggest(data, sender);
    });

    // --- Listener for getPageInfo --- (Uses new handler)
    messaging.onMessage('getPageInfo', ({ data, sender }) => {
        console.log('[Message Handlers] Received getPageInfo');
        return handleGetPageInfo(data, sender);
    });
    
    // --- Listener for getSelectedText --- (Uses new handler)
    messaging.onMessage('getSelectedText', ({ data, sender }) => {
        console.log('[Message Handlers] Received getSelectedText');
        return handleGetSelectedText(data, sender);
    });

    // --- Listener for processPageVisit ---
    messaging.onMessage('processPageVisit', async ({ data, sender }) => {
        const { url, title: originalTitle, htmlContent } = data;
        console.log(`[Message Handlers] Received processPageVisit for URL: ${url}`);
        
        // --- Ensure sender and tabId exist --- 
        if (!sender || !sender.tab || !sender.tab.id) {
             console.error(`[Message Handlers processPageVisit] Missing sender information for URL: ${url}. Cannot request markdown.`);
             return;
        }
        const senderTabId = sender.tab.id;
        // FrameId might be useful if multiple content scripts run in one tab (e.g., iframes)
        // const senderFrameId = sender.frameId; 
        // --- End Sender Check --- 

        try {
            // --- Check timestamp before processing --- 
            const timestamps = await pageInfoProcessingTimestamps.getValue();
            const lastProcessed = timestamps[url];
            if (lastProcessed && (Date.now() - lastProcessed < REPROCESS_INFO_THRESHOLD_MS)) {
                console.log(`[Message Handlers processPageVisit] URL ${url} info processed recently (${new Date(lastProcessed).toISOString()}). Skipping info re-processing.`);
                return; // Exit the handler early
            }
            console.log(`[Message Handlers processPageVisit] URL ${url} info not processed recently or not found. Proceeding.`);
            // --- End Timestamp Check ---

            // 1. --- NEW: Request Markdown Extraction from Content Script --- 
            console.log(`[Message Handlers processPageVisit] Requesting markdown extraction from content script (Tab ID: ${senderTabId}) for URL: ${url}...`);
            const markdownResponse = await messaging.sendMessage(
                'extractMarkdownFromHtml', 
                { htmlContent, baseUrl: url }, // Pass HTML and URL as base
                // --- Target the specific content script --- 
                { tabId: senderTabId, frameId: sender.frameId } // Use sender.frameId too if available
            );

            if (!markdownResponse || !markdownResponse.success || !markdownResponse.markdown) {
                console.warn(`[Message Handlers processPageVisit] Markdown extraction failed in content script for URL ${url}. Error: ${markdownResponse?.error}. Aborting save.`);
                // Optionally, still update the timestamp to avoid retrying a failing page?
                // await pageInfoProcessingTimestamps.setValue({ ...timestamps, [url]: Date.now() });
                return; // Don't proceed without markdown
            }
            const { markdown, title: extractedTitle } = markdownResponse;
            // --- End NEW Markdown Extraction ---
            
            const finalTitle = extractedTitle || originalTitle;
            console.log(`[Message Handlers processPageVisit] Markdown received from CS (length: ${markdown.length}), Title: ${finalTitle}`);

            // 2. --- REMOVED Embedding step --- 
            // ... (embedding logic remains removed) ...

            // 3. Add/Update Database (Info Only)
            console.log('[Message Handlers processPageVisit] Adding/updating visited page info in DB...');
            // --- Use the new function --- 
            await recordPageVisitVersion({ 
                url,
                title: finalTitle, 
                markdown_content: markdown, 
            });
            console.log(`[Message Handlers processPageVisit] DB info operation complete for URL: ${url}`);

            // --- Update timestamp AFTER successful DB write --- 
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
            // --- End Timestamp Update ---

        } catch (error) {
            console.error(`[Message Handlers] Error handling processPageVisit for URL ${url}:`, error);
        }
    });

    // --- Listener for triggerBatchEmbedding (Uses Dynamic Embedding) --- 
    messaging.onMessage('triggerBatchEmbedding', async () => {
        console.log('[Message Handlers] Received triggerBatchEmbedding request (with dynamic embedding).');
        let finalizedCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;
        let db: PGlite | null = null;
        let candidates: PageVersionToEmbed[] = [];
        let userEmbeddingConfig: FunctionConfig | null = null; // Store user config

        try {
            // --- Load user embedding config ONCE at the start --- 
            const settings = await userConfigurationStorage.getValue(); 
            if (!settings || !settings.embeddingConfig) {
                console.error('[Message Handlers triggerBatchEmbedding] Embedding configuration not found in user settings. Aborting batch.');
                return { success: false, finalizedCount, duplicateCount, errorCount: 0, error: 'Embedding configuration not found.' }; 
            }
            userEmbeddingConfig = settings.embeddingConfig;
            // --- Check if config is complete --- 
            if (!userEmbeddingConfig.providerId || !userEmbeddingConfig.modelId || !userEmbeddingConfig.baseUrl) {
                 console.error('[Message Handlers triggerBatchEmbedding] Embedding configuration is incomplete:', userEmbeddingConfig);
                 return { success: false, finalizedCount, duplicateCount, errorCount: 0, error: 'Embedding configuration incomplete.' }; 
            }
            console.log('[Message Handlers triggerBatchEmbedding] Using embedding config:', userEmbeddingConfig);
            // --- End Load/Check Config --- 

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
                    // 1. Find latest previously EMBEDDED version (based on summary embeddings)
                    const latestEmbedded = await findLatestEmbeddedVersion(candidate.url);

                    // 2. Compare Original Markdown Hashes (Quick check for exact content match)
                    if (latestEmbedded && candidate.markdown_hash && latestEmbedded.markdown_hash && candidate.markdown_hash === latestEmbedded.markdown_hash) {
                        console.log(`[Message Handlers triggerBatchEmbedding] Exact ORIGINAL markdown hash match found... Handling as duplicate.`);
                        await incrementPageVersionVisitCount(latestEmbedded.version_id);
                        await deletePageVersion(candidate.version_id); 
                        duplicateCount++;
                        continue; 
                    }

                    // --- Markdown differs (or first time), proceed with summarization & semantic check --- 
                    console.log(`[Message Handlers triggerBatchEmbedding] Original markdown hashes differ or no previous embedded version. Proceeding with summarization for version_id: ${candidate.version_id}.`);
                    
                    // 3. Summarize the candidate's markdown content
                    const summary = await getSummaryFromLLM(candidate.markdown_content);
                    if (!summary) {
                        console.warn(`[Message Handlers triggerBatchEmbedding] Summarization failed for version_id: ${candidate.version_id}. Skipping.`);
                        errorCount++;
                        continue;
                    }
                    const summaryHash = await calculateHash(summary);

                    // 4. Embed the generated SUMMARY (Use dynamic function)
                    // --- Use the dynamic getEmbedding function --- 
                    const summaryEmbeddingResult = await getEmbedding(summary, userEmbeddingConfig); // Pass loaded config
                    // --- End dynamic embedding call --- 

                    if (!summaryEmbeddingResult) {
                        console.warn(`[Message Handlers triggerBatchEmbedding] SUMMARY embedding generation failed for version_id: ${candidate.version_id}. Skipping.`);
                        errorCount++;
                        continue; 
                    }
                    
                    // --- Update DB with Summary Info BEFORE comparison --- 
                    await updatePageVersionSummaryAndCleanup({ 
                        version_id: candidate.version_id, 
                        summary_content: summary, 
                        summary_hash: summaryHash 
                    });
                    // --- 

                    // 5. Compare Summaries
                    if (latestEmbedded) {
                        // 5a. Check Summary Hashes (Optimization)
                        if (summaryHash && latestEmbedded.summary_hash && summaryHash === latestEmbedded.summary_hash) {
                            console.log(`[Message Handlers triggerBatchEmbedding] Exact SUMMARY hash match found... Handling as duplicate.`);
                            await incrementPageVersionVisitCount(latestEmbedded.version_id);
                            await deletePageVersion(candidate.version_id);
                            duplicateCount++;
                            continue;
                        }

                        // 5b. Hashes differ, compare SUMMARY embeddings
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

                        // Perform vector comparison using SQL
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

                        // Check threshold
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
                        // 5c. No previous embedded version found. Finalize this one.
                        console.log(`[Message Handlers triggerBatchEmbedding] No previous embedded version found... Finalizing SUMMARY embedding.`);
                        await finalizePageVersionEmbedding({ version_id: candidate.version_id, embeddingInfo: summaryEmbeddingResult });
                        finalizedCount++;
                    }

                } catch (processingError) {
                    console.error(`[Message Handlers triggerBatchEmbedding] Error processing candidate version_id ${candidate.version_id}:`, processingError);
                    errorCount++;
                }
            } // End for loop

            console.log(`[Message Handlers triggerBatchEmbedding] Batch embedding complete. Finalized: ${finalizedCount}, Duplicates (Deleted): ${duplicateCount}, Errors: ${errorCount}.`);
            return { success: true, finalizedCount, duplicateCount, errorCount };

        } catch (error: any) {
            console.error('[Message Handlers triggerBatchEmbedding] Unexpected error during batch embedding:', error);
            // Log config if error occurs
            if (userEmbeddingConfig) {
                 console.error(`[Message Handlers triggerBatchEmbedding] Failed using embedding config: Provider=${userEmbeddingConfig.providerId}, Model=${userEmbeddingConfig.modelId}, BaseUrl=${userEmbeddingConfig.baseUrl}`);
            }
            return { success: false, finalizedCount, duplicateCount, errorCount: candidates.length, error: error.message || 'Batch embedding failed.' };
        }
    });
    // --- End Listener for triggerBatchEmbedding --- 

    // --- Listener for getPendingEmbeddingCount (Should be correct already) ---
    messaging.onMessage('getPendingEmbeddingCount', async () => {
        console.log('[Message Handlers] Received getPendingEmbeddingCount request.');
        try {
            const count = await countPagesNeedingEmbedding(); // Uses updated function
            return { count };
        } catch (error: any) {
            console.error('[Message Handlers getPendingEmbeddingCount] Error:', error);
            return { count: 0 }; // Return 0 on error
        }
    });
    // --- End Listener for getPendingEmbeddingCount ---

    // --- Handler for REQUEST_TTS_FROM_WIDGET ---
    messaging.onMessage('REQUEST_TTS_FROM_WIDGET', async (message) => {
        console.log('[Message Handlers] Received REQUEST_TTS_FROM_WIDGET:', message.data);
        // Destructure speed along with text and lang
        const { text, lang, speed } = message.data; 

        try {
            const userConfig = await userConfigurationStorage.getValue();
            const ttsConfig = userConfig?.ttsConfig;

            if (!ttsConfig || ttsConfig.providerId !== 'elevenlabs' || !ttsConfig.apiKey) {
                console.warn('[Message Handlers REQUEST_TTS_FROM_WIDGET] ElevenLabs TTS not configured or API key missing.');
                return { success: false, error: 'ElevenLabs TTS not configured or API key missing.' };
            }

            const apiKey = ttsConfig.apiKey;
            const effectiveModelId = DEFAULT_ELEVENLABS_MODEL_ID;
            const effectiveVoiceId = DEFAULT_ELEVENLABS_VOICE_ID;

            console.log(`[Message Handlers REQUEST_TTS_FROM_WIDGET] Generating audio via ElevenLabs. Text: "${text.substring(0,30)}...", Lang: ${lang}, Model: ${effectiveModelId}, Voice: ${effectiveVoiceId}, Speed: ${speed ?? 'default'}`);

            // Pass the received speed to generateElevenLabsSpeechStream
            const audioBlob = await generateElevenLabsSpeechStream(
                apiKey,
                text,
                effectiveModelId,
                effectiveVoiceId,
                undefined, // voiceSettings (can be added later if needed)
                speed      // Pass the speed parameter here
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

    // --- Regarding existing 'generateTTS' handler --- 
    // It seems there's an existing 'generateTTS(data: GenerateTTSPayload): Promise<void>;'
    // We should review if this is still needed or if REQUEST_TTS_FROM_WIDGET replaces its intended functionality.
    // For now, I will leave the old one. If it was for direct audio playback in background, it has different requirements.
    messaging.onMessage('generateTTS', async (message) => {
        console.log('[Message Handlers] Received OLD generateTTS request:', message.data);
        // This handler is likely different. It doesn't return audio data to content script.
        // It might have been intended for background playback or saving, which is not the current goal.
        // For now, just logging it. If it was used by the widget, it would explain the previous "No response" error.
        // TODO: Investigate and remove or refactor this old 'generateTTS' if it's redundant or causing confusion.
        return; // Explicitly return nothing as per its void promise type
    });

    console.log('[Message Handlers] Background message listeners registered.');
}

// Helper function to convert Blob to Data URL
async function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
} 