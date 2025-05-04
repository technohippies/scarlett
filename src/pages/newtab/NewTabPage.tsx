import { Component, createResource } from 'solid-js'; // Removed Show
import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
    // --- Import the actual types --- 
    GetStudySummaryRequest,
    GetStudySummaryResponse
} from '../../shared/messaging-types';
// Removed unused type imports
// import type { DueLearningItem } from '../../services/srs/types';
// import { Rating } from 'ts-fsrs';
// import { MCQ } from '../../features/exercises/MCQ';
// import type { MCQProps, Option } from '../../features/exercises/MCQ';

// --- NEW: Import the View component ---
import { NewTabPageView } from './NewTabPageView';

// Use actual types in the protocol map
interface BackgroundProtocol {
    getStudySummary(data: GetStudySummaryRequest): Promise<GetStudySummaryResponse>;
}

// Initialize messaging client
const messaging = defineExtensionMessaging<BackgroundProtocol>();

// --- Container Component ---
const NewTabPage: Component = () => {
  // Removed signals related to individual items
  // const [currentItem, setCurrentItem] = createSignal<DueLearningItem | null>(null);
  // const [itemError, setItemError] = createSignal<string | null>(null);
  // const [exerciseDirection, setExerciseDirection] = createSignal<'EN_TO_NATIVE' | 'NATIVE_TO_EN'>('EN_TO_NATIVE');

  // --- Resource to fetch study summary counts ---
  const [summaryResource] = createResource(async () => {
    console.log('[NewTab Container] Fetching study summary...');
    try {
      const response = await messaging.sendMessage('getStudySummary', {});
      console.log('[NewTab Container] Received study summary:', response);
      if (typeof response?.dueCount !== 'number' ||
          typeof response?.reviewCount !== 'number' ||
          typeof response?.newCount !== 'number') {
           console.error("[NewTab Container] Invalid summary response structure received:", response);
           return { dueCount: 0, reviewCount: 0, newCount: 0, error: 'Invalid data received from background.' } as GetStudySummaryResponse;
      }
      return response;
    } catch (err: any) {
      console.error('[NewTab Container] Error fetching study summary:', err);
      return { dueCount: 0, reviewCount: 0, newCount: 0, error: err.message || 'Failed to fetch summary.' } as GetStudySummaryResponse;
    }
  });

  // Removed resources and memos related to individual items/MCQ
  // const [dueItemResource, { refetch: fetchDueItems }] = createResource(...);
  // const [distractorResource] = createResource(...);
  // const mcqProps = createMemo(...);

  // Removed handler for MCQ completion
  // const handleMcqComplete = async (...) => { ... };

  // --- Handler for Study Button Click ---
  const handleStudyClick = () => {
    console.log('[NewTab Container] Study button clicked, navigating to study page...');
    try {
      const studyPageUrl = browser.runtime.getURL('/study.html');
      window.location.href = studyPageUrl;
    } catch (err) {
      console.error("[NewTab Container] Failed to get study page URL or navigate:", err);
      alert("Could not open the study page. Please try again.");
    }
  };

  // --- Render the View component ---
  // Helper to get summary data safely
  const getSummaryData = () => {
    const resource = summaryResource();
    // Return data only if resource loaded, has no error property, and has valid counts
    if (resource && !resource.error && typeof resource.dueCount === 'number') {
        return { 
            dueCount: resource.dueCount,
            reviewCount: resource.reviewCount,
            newCount: resource.newCount
        };
    }
    return null; // Otherwise, return null
  };

  // Helper to get error safely
  const getError = () => {
    const resource = summaryResource();
    // Return the error string if it exists, otherwise null
    return resource?.error ?? null;
  }

  return (
    <NewTabPageView
      isLoading={summaryResource.loading}
      summaryData={getSummaryData()} // Use helper function
      error={getError()}             // Use helper function
      onStudyClick={handleStudyClick}
    />
  );
};

export default NewTabPage; 