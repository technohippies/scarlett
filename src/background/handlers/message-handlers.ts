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
    GetSelectedTextResponse
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
import { getMarkdownFromHtml } from '../../services/llm/reader';
import { getOllamaEmbedding } from '../../services/llm/embedding';
import { addOrUpdateVisitedPage } from '../../services/db/visited_pages';
import type { Bookmark, Tag } from '../../services/db/types';

// Define the protocol map for messages handled by the background script
interface BackgroundProtocolMap {
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
}

// Initialize messaging for the background context
const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

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
    messaging.onMessage('processPageVisit', async ({ data }) => {
        const { url, title, htmlContent } = data;
        console.log(`[Message Handlers] Received processPageVisit for URL: ${url}`);
        try {
            // 1. Get Markdown
            console.log('[Message Handlers processPageVisit] Getting Markdown...');
            const markdown = await getMarkdownFromHtml(htmlContent);
            if (!markdown) {
                console.warn('[Message Handlers processPageVisit] Markdown extraction failed or returned null. Aborting.');
                return; // Don't proceed without markdown
            }
            console.log(`[Message Handlers processPageVisit] Markdown extracted (length: ${markdown.length}).`);

            // 2. Get Embedding
            console.log('[Message Handlers processPageVisit] Getting embedding...');
            const embeddingResult = await getOllamaEmbedding(markdown); // Embed the markdown
            if (!embeddingResult) { // Check the result object
                console.warn('[Message Handlers processPageVisit] Embedding generation failed or returned null. Aborting.');
                return; // Don't proceed without embedding
            }
            // Log dimension from the result
            console.log(`[Message Handlers processPageVisit] Embedding generated (model: ${embeddingResult.modelName}, dimension: ${embeddingResult.dimension}).`);

            // 3. Add/Update Database
            console.log('[Message Handlers processPageVisit] Adding/updating visited page in DB...');
            await addOrUpdateVisitedPage({ 
                url, 
                title, 
                markdown_content: markdown, 
                embeddingInfo: embeddingResult // Pass the whole result object
            });
            console.log(`[Message Handlers processPageVisit] DB operation complete for URL: ${url}`);

        } catch (error) {
            console.error(`[Message Handlers] Error handling processPageVisit for URL ${url}:`, error);
            // Decide if we should notify user or just log
        }
    });

    console.log('[Message Handlers] Background message listeners registered.');
} 