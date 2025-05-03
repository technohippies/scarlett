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
    GenerateLLMDistractorsResponse
} from '../../shared/messaging-types';
import {
    getDueLearningItems,
    getDistractors,
    updateSRSState
} from '../../services/srs/scheduler';
import { updateCachedDistractors } from '../../services/db/learning';
import { getDbInstance } from '../../services/db/init';
import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import { getMCQGenerationPrompt } from '../../services/llm/prompts/exercises';
import type { LLMConfig } from '../../services/llm/types';

// Define the protocol map for messages handled by the background script
interface BackgroundProtocolMap {
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    getDistractorsForItem(data: GetDistractorsRequest): Promise<GetDistractorsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
    cacheDistractors(data: CacheDistractorsRequest): Promise<CacheDistractorsResponse>;
    generateLLMDistractors(data: GenerateLLMDistractorsRequest): Promise<GenerateLLMDistractorsResponse>;
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
            return { dueItems };
        } catch (error) {
            console.error('[Message Handlers] Error handling getDueItems:', error);
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
        const { sourceText, targetText, targetLang, count } = message.data;
        
        // TODO: Retrieve actual LLM config from storage
        const mockLlmConfig: LLMConfig = {
            provider: 'ollama',
            model: 'gemma3:12b',
            baseUrl: 'http://localhost:11434',
            stream: false,
        };

        try {
            // Assuming sourceLang is always 'en' for now
            const sourceLang = 'en'; 
            // We only need distractors, so we might need a more focused prompt or parse the MCQ prompt response
            // Using getMCQGenerationPrompt and parsing its output for now
            const prompt = getMCQGenerationPrompt(sourceText, targetText, sourceLang, targetLang);
            const llmResponse = await ollamaChat([{ role: 'user', content: prompt }], mockLlmConfig);
            
            // Handle both streamed and non-streamed responses
            let rawContent: string | undefined;
            if (typeof llmResponse === 'object' && llmResponse && 'choices' in llmResponse) {
                // Non-streamed response
                rawContent = llmResponse.choices?.[0]?.message?.content?.trim();
            } else {
                // Handle streamed response case if needed, or throw error if unexpected
                console.warn('[Message Handlers] Received unexpected response type from ollamaChat (expected non-streamed object).');
                 // For now, assume non-streamed or throw
                 throw new Error('Unexpected LLM response format. Expected non-streamed.');
                // If streaming was intended:
                // let fullContent = '';
                // for await (const part of llmResponse) {
                //     fullContent += part.message?.content || '';
                // }
                // rawContent = fullContent.trim();
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

    console.log('[Message Handlers] Background message listeners registered.');
} 