import { defineExtensionMessaging } from '@webext-core/messaging';
import type {
    GetDueItemsRequest,
    GetDueItemsResponse,
    GetDistractorsRequest,
    GetDistractorsResponse,
    SubmitReviewRequest,
    SubmitReviewResponse
} from '../../shared/messaging-types';
import {
    getDueLearningItems,
    getDistractors,
    updateSRSState
} from '../../services/srs/scheduler';
import type { Grade } from 'ts-fsrs';

// Define the protocol map for messages handled by the background script
interface BackgroundProtocolMap {
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    getDistractorsForItem(data: GetDistractorsRequest): Promise<GetDistractorsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
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
            // Consider returning a more specific error structure if needed
            return { dueItems: [] }; // Return empty array on error for now
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
            return { distractors: [] }; // Return empty array on error
        }
    });

    // --- Listener for submitReviewResult --- 
    messaging.onMessage('submitReviewResult', async (message) => {
        console.log('[Message Handlers] Received submitReviewResult request:', message.data);
        try {
            // Ensure grade is treated as Grade type
            const grade = message.data.grade as Grade;
            await updateSRSState(message.data.learningId, grade);
            return { success: true };
        } catch (error: any) {
            console.error('[Message Handlers] Error handling submitReviewResult:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    console.log('[Message Handlers] Background message listeners registered.');
} 