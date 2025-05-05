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
import type { LLMConfig } from '../../services/llm/types';
import { handleSaveBookmark, handleLoadBookmarks } from './bookmark-handlers';
import { handleTagList, handleTagSuggest } from './tag-handlers';
import { handleGetPageInfo, handleGetSelectedText } from './pageInteractionHandlers';
import { getOllamaEmbedding } from '../../services/llm/embedding';
import { 
    recordPageVisitVersion, // Use the new function name
    getPagesNeedingEmbedding, 
    findLatestEmbeddedVersion, 
    finalizePageVersionEmbedding, 
    deletePageVersion, 
    incrementPageVersionVisitCount,
    countPagesNeedingEmbedding 
} from '../../services/db/visited_pages';
import type { PageVersionToEmbed, LatestEmbeddedVersion } from '../../services/db/visited_pages'; // Import interfaces
import { pageInfoProcessingTimestamps } from '../../services/storage/storage';
import type { PGlite } from '@electric-sql/pglite';

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
}

// Initialize messaging for the background context
const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

// Define the threshold for reprocessing (e.g., 1 hour in milliseconds)
// --- REVERT TEMPORARY CHANGE --- 
const REPROCESS_INFO_THRESHOLD_MS = 1 * 60 * 60 * 1000; // Original: 1 * 60 * 60 * 1000; 

// Define a similarity threshold (Cosine Distance)
// Lower value = more similar. E.g., 0.1 means very similar. Adjust as needed.
const EMBEDDING_SIMILARITY_THRESHOLD = 0.1;

/**
 * Registers message listeners for background script operations (SRS, etc.).
 */
export function registerMessageHandlers(): void {
    console.log('[Message Handlers] Registering background message listeners...');

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

    // --- Listener for generateLLMDistractors ---
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

        // TODO: Retrieve actual LLM config from storage
        const mockLlmConfig: LLMConfig = {
            provider: 'ollama',
            model: 'gemma3:12b',
            baseUrl: 'http://localhost:11434',
            stream: false,
        };

        try {
            let prompt: string;
            // Choose prompt based on direction
            if (direction === 'NATIVE_TO_EN') {
                // We need the Native phrase as the prompt ('sourceText' in this context)
                // and the English phrase as the correct answer ('targetText' in this context)
                 prompt = getMCQGenerationPromptNativeToEn(sourceText, targetText, sourceLang, effectiveTargetLang); 
                 console.log(`[Message Handlers] Using NATIVE_TO_EN prompt generator.`);
            } else { // Default to EN_TO_NATIVE
                // Here, sourceText is English, targetText is Native
                prompt = getMCQGenerationPrompt(sourceText, targetText, sourceLang, effectiveTargetLang);
                 console.log(`[Message Handlers] Using EN_TO_NATIVE prompt generator.`);
            }
            
            const llmResponse = await ollamaChat([{ role: 'user', content: prompt }], mockLlmConfig);
            
            // Handle both streamed and non-streamed responses
            let rawContent: string | undefined;
            if (typeof llmResponse === 'object' && llmResponse && 'choices' in llmResponse) {
                // Non-streamed response
                rawContent = llmResponse.choices?.[0]?.message?.content?.trim();
            } else {
                console.warn('[Message Handlers] Received unexpected response type from ollamaChat (expected non-streamed object).');
                 throw new Error('Unexpected LLM response format. Expected non-streamed.');
            }

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

    // --- Listener for triggerBatchEmbedding (NEW VERSION) ---
    messaging.onMessage('triggerBatchEmbedding', async () => {
        console.log('[Message Handlers] Received triggerBatchEmbedding request.');
        let finalizedCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;
        let db: PGlite | null = null;
        // --- Initialize candidates array here --- 
        let candidates: PageVersionToEmbed[] = [];

        try {
            db = await getDbInstance(); // Get DB instance once
            candidates = await getPagesNeedingEmbedding(50); // Fetch candidates (assign to outer scope variable)

            if (candidates.length === 0) {
                console.log('[Message Handlers triggerBatchEmbedding] No page versions found needing embedding.');
                return { success: true, finalizedCount: 0, duplicateCount: 0, errorCount: 0 };
            }

            console.log(`[Message Handlers triggerBatchEmbedding] Found ${candidates.length} candidate versions to process.`);

            for (const candidate of candidates) {
                console.log(`[Message Handlers triggerBatchEmbedding] Processing candidate version_id: ${candidate.version_id} for URL: ${candidate.url}`);
                try {
                    // --- Log the markdown content before embedding --- 
                    console.log(`[Message Handlers triggerBatchEmbedding] Content for version_id ${candidate.version_id} (length: ${candidate.markdown_content?.length ?? 0}):\n${candidate.markdown_content?.substring(0, 500)}...`); // Log first 500 chars
                    // --- End Log ---

                    // 1. Generate embedding for the candidate
                    const candidateEmbeddingResult = await getOllamaEmbedding(candidate.markdown_content);
                    if (!candidateEmbeddingResult) {
                        console.warn(`[Message Handlers triggerBatchEmbedding] Embedding generation failed for version_id: ${candidate.version_id}. Skipping.`);
                        errorCount++;
                        continue; 
                    }

                    // 2. Find the latest previously embedded version for this URL
                    const latestEmbedded = await findLatestEmbeddedVersion(candidate.url);

                    // 3. Comparison Logic
                    if (latestEmbedded) {
                        // 3a. Check for exact hash match (optimization)
                        if (candidate.markdown_hash && latestEmbedded.markdown_hash && candidate.markdown_hash === latestEmbedded.markdown_hash) {
                            console.log(`[Message Handlers triggerBatchEmbedding] Exact hash match found for version_id: ${candidate.version_id} with version_id: ${latestEmbedded.version_id}. Handling as duplicate.`);
                            await incrementPageVersionVisitCount(latestEmbedded.version_id);
                            await deletePageVersion(candidate.version_id);
                            duplicateCount++;
                            continue; // Move to next candidate
                        }

                        // 3b. Hashes differ, proceed with semantic comparison
                        // Ensure dimensions match or handle mismatch (using latestEmbedded dimension for now)
                        if (candidateEmbeddingResult.dimension !== latestEmbedded.active_embedding_dimension) {
                            console.warn(`[Message Handlers triggerBatchEmbedding] Embedding dimension mismatch for version_id: ${candidate.version_id} (${candidateEmbeddingResult.dimension}) vs latest embedded (${latestEmbedded.active_embedding_dimension}). Skipping comparison, finalizing new version.`);
                            // Decide how to handle: skip comparison and finalize, or try re-embedding with target dimension? Finalizing for now.
                             await finalizePageVersionEmbedding({ version_id: candidate.version_id, embeddingInfo: candidateEmbeddingResult });
                             finalizedCount++;
                             continue;
                        }

                        // Get the actual vector string for comparison
                        const latestVector = latestEmbedded[`embedding_${latestEmbedded.active_embedding_dimension}` as keyof LatestEmbeddedVersion] as number[];
                        const candidateVector = candidateEmbeddingResult.embedding;

                        if (!latestVector || !candidateVector) {
                            console.error(`[Message Handlers triggerBatchEmbedding] Could not retrieve one or both vectors for comparison. Candidate: ${candidate.version_id}, Latest: ${latestEmbedded.version_id}. Skipping.`);
                            errorCount++;
                            continue;
                        }

                        // Perform vector comparison using SQL
                        const vectorCompareSql = `SELECT $1::vector <=> $2::vector as distance;`;
                        // Convert vectors to string format PGlite expects: '[1,2,...]'
                        const latestVectorString = `[${latestVector.join(',')}]`;
                        const candidateVectorString = `[${candidateVector.join(',')}]`;
                        
                        const distanceResult = await db.query<{ distance: number }>(vectorCompareSql, [latestVectorString, candidateVectorString]);
                        const distance = distanceResult.rows[0]?.distance;

                        if (typeof distance !== 'number') {
                             console.error(`[Message Handlers triggerBatchEmbedding] Failed to calculate vector distance between ${candidate.version_id} and ${latestEmbedded.version_id}. Skipping.`);
                             errorCount++;
                             continue;
                        }

                        console.log(`[Message Handlers triggerBatchEmbedding] Cosine distance between ${candidate.version_id} and ${latestEmbedded.version_id}: ${distance.toFixed(4)}`);

                        // Check threshold
                        if (distance < EMBEDDING_SIMILARITY_THRESHOLD) {
                            // Similar: Increment previous count, delete candidate
                            console.log(`[Message Handlers triggerBatchEmbedding] Semantically similar. Handling version_id: ${candidate.version_id} as duplicate of ${latestEmbedded.version_id}.`);
                            await incrementPageVersionVisitCount(latestEmbedded.version_id);
                            await deletePageVersion(candidate.version_id);
                            duplicateCount++;
                        } else {
                            // Different: Finalize the candidate embedding
                            console.log(`[Message Handlers triggerBatchEmbedding] Semantically different. Finalizing embedding for version_id: ${candidate.version_id}.`);
                            await finalizePageVersionEmbedding({ version_id: candidate.version_id, embeddingInfo: candidateEmbeddingResult });
                            finalizedCount++;
                        }

                    } else {
                        // 3c. No previous embedded version found for this URL. Finalize this one.
                        console.log(`[Message Handlers triggerBatchEmbedding] No previous embedded version found for URL ${candidate.url}. Finalizing embedding for version_id: ${candidate.version_id}.`);
                        await finalizePageVersionEmbedding({ version_id: candidate.version_id, embeddingInfo: candidateEmbeddingResult });
                        finalizedCount++;
                    }

                } catch (processingError) {
                    console.error(`[Message Handlers triggerBatchEmbedding] Error processing candidate version_id ${candidate.version_id}:`, processingError);
                    errorCount++;
                    // Continue to the next candidate even if one fails
                }
            } // End for loop

            console.log(`[Message Handlers triggerBatchEmbedding] Batch embedding complete. Finalized: ${finalizedCount}, Duplicates (Deleted): ${duplicateCount}, Errors: ${errorCount}.`);
            return { success: true, finalizedCount, duplicateCount, errorCount };

        } catch (error: any) {
            console.error('[Message Handlers triggerBatchEmbedding] Unexpected error during batch embedding:', error);
            // --- Now candidates is accessible here --- 
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

    console.log('[Message Handlers] Background message listeners registered.');
} 