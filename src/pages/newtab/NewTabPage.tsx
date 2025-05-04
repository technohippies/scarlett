import { Component, createMemo, createResource, onMount } from 'solid-js';
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
import { NewTabPageView, type NewTabPageViewProps } from './NewTabPageView';

// Define the protocol map for messages SENT TO the background
interface BackgroundProtocol {
    getStudySummary(data: GetStudySummaryRequest): Promise<GetStudySummaryResponse>;
}

// Interface for the props NewTabPage will now accept
export interface NewTabPageProps {
    onNavigateToBookmarks: () => void;
    onNavigateToStudy: () => void;
}

// Initialize messaging client
const messaging = defineExtensionMessaging<BackgroundProtocol>();

// Define a type for the error response structure from the resource fetch
type FetchErrorResponse = { success: false; error: string };
// Assume the success response *also* has a success property (even if implicitly true)
type FetchSuccessResponse = GetStudySummaryResponse & { success?: true }; 

// --- Container Component ---
const NewTabPage: Component<NewTabPageProps> = (props) => {
  // Removed signals related to individual items
  // const [currentItem, setCurrentItem] = createSignal<DueLearningItem | null>(null);
  // const [itemError, setItemError] = createSignal<string | null>(null);
  // const [exerciseDirection, setExerciseDirection] = createSignal<'EN_TO_NATIVE' | 'NATIVE_TO_EN'>('EN_TO_NATIVE');

  // Resource fetches study summary, returns GetStudySummaryResponse on success, 
  // or FetchErrorResponse on caught error.
  const [summaryResource, { refetch }] = createResource<
      FetchSuccessResponse | FetchErrorResponse
  >(async () => {
      console.log('[NewTabPage] Fetching study summary...');
      try {
          const response = await messaging.sendMessage('getStudySummary', {});
          console.log('[NewTabPage] Received study summary:', response);
          // Return the successful response (potentially add success: true if needed)
          // If the background response doesn't explicitly include `success: true`, 
          // we might need to add it here or adjust the type definition.
          // For now, assuming it *might* be missing and FetchSuccessResponse handles it.
          return response as FetchSuccessResponse; 
      } catch (err) {
          console.error('[NewTabPage] Error fetching study summary:', err);
          return { success: false, error: (err as Error).message || 'Unknown error' };
      }
  });

  // Refetch data when the component mounts
  onMount(() => {
    refetch();
  });

  // Memo extracts summary data if the resource fetch was successful
  const summaryDataForView = createMemo<NewTabPageViewProps['summaryData']>(() => {
    const data = summaryResource();
    // Type guard: Check if data exists and success is not false (implies true or undefined)
    if (data && data.success !== false) {
      return {
        dueCount: data.dueCount ?? 0,
        reviewCount: data.reviewCount ?? 0,
        newCount: data.newCount ?? 0,
      };
    }
    return null;
  });

  // Memo extracts error message if the resource fetch failed
  const errorForView = createMemo<NewTabPageViewProps['error']>(() => {
    const data = summaryResource();
    // Type guard: Check if data exists and success is explicitly false
    if (data && data.success === false) {
      return data.error; 
    }
    // Check for resource-level loading errors
    if (summaryResource.error) {
      return summaryResource.error.message || 'Failed to load summary data.'; 
    }
    // Check if data loaded but wasn't the success structure (shouldn't happen with guards)
    // if (summaryResource.state === 'ready' && !summaryDataForView()){
    //     return 'Unexpected data format received.';
    // }
    return null;
  });

  // --- Render the View component ---
  return (
    <NewTabPageView
      isLoading={summaryResource.loading}
      summaryData={summaryDataForView()}
      error={errorForView()}
      // Pass navigation handlers down to the View component
      onBookmarksClick={props.onNavigateToBookmarks}
      onStudyClick={props.onNavigateToStudy}
    />
  );
};

export default NewTabPage; 