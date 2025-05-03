import { Component, createSignal, onMount, For } from 'solid-js';
import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
    GetDueItemsRequest,
    GetDueItemsResponse,
    SubmitReviewRequest,
    SubmitReviewResponse
} from '../../shared/messaging-types'; // Adjusted path
import type { DueLearningItem } from '../../services/srs/types'; // Adjusted path
import { Grade, Rating } from 'ts-fsrs';

// Define the protocol map for messages SENT TO the background
interface BackgroundProtocol {
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
}

// Initialize messaging client for this page
const messaging = defineExtensionMessaging<BackgroundProtocol>();

const NewTabPage: Component = () => {
  const [dueItems, setDueItems] = createSignal<DueLearningItem[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const fetchDueItems = async () => {
    console.log('[NewTab] Fetching due items...');
    setIsLoading(true);
    setError(null);
    try {
        // Fetching only 1 item initially for the MCQ focus
        const response = await messaging.sendMessage('getDueItems', { limit: 1 });
        console.log('[NewTab] Received due items:', response.dueItems);
        setDueItems(response.dueItems);
    } catch (err: any) {
        console.error('[NewTab] Error fetching due items:', err);
        setError(err.message || 'Failed to fetch due items.');
    } finally {
        setIsLoading(false);
    }
  };

  onMount(fetchDueItems);

  // We will replace this simple list/buttons with the MCQ component later
  const submitTestReview = async (learningId: number, grade: Grade) => {
      console.log(`[NewTab] Submitting test review for ${learningId} with grade ${grade}`);
      const currentItems = dueItems();
      // Remove the reviewed item optimistically
      setDueItems(currentItems.filter(item => item.learningId !== learningId));

      try {
          const response = await messaging.sendMessage('submitReviewResult', {
              learningId,
              grade
          });
          console.log('[NewTab] Submit review response:', response);
          if (!response.success) {
               alert(`Failed to submit review: ${response.error || 'Unknown error'}`);
               setDueItems(currentItems); // Revert UI on failure
          }
          // If successful, fetch the next item
          if (response.success) {
              fetchDueItems(); // Fetch the next item after successful submission
          }
      } catch (err: any) {
           console.error('[NewTab] Error submitting review:', err);
           alert(`Error submitting review: ${err.message}`);
           setDueItems(currentItems); // Revert UI on error
      }
  }

  return (
    <div class="newtab-page-container p-8 font-sans bg-gray-50 min-h-screen">
      <h1 class="text-3xl font-bold mb-6 text-gray-800">Scarlett Study Session</h1>

      <button 
        onClick={fetchDueItems} 
        disabled={isLoading()} 
        class="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
      >
        {isLoading() ? 'Loading...' : 'Get Next Item'}
      </button>

      {isLoading() && !dueItems().length && <p class="text-gray-600">Loading review item...</p>}
      {error() && <p class="text-red-600 font-semibold">Error: {error()}</p>}

      {/* This section will be replaced by the MCQ component */} 
      <div class="exercise-area mt-4">
        <For each={dueItems()} fallback={<p class="text-gray-600">{!isLoading() && !error() ? 'No items due for review right now!' : ''}</p>}>
          {(item) => (
            <div class="p-4 border border-gray-300 rounded-lg shadow-sm bg-white mb-4">
              <p class="text-lg font-medium text-gray-700 mb-3">
                Translate: <span class="font-semibold text-blue-700">{item.sourceText}</span>
              </p>
              <p class="text-gray-500 text-sm mb-3">(Hint: {item.targetText}) - ID: {item.learningId}</p> {/* Display target temporarily */}
              
              <div class="flex space-x-2">
                <button class="px-3 py-1 bg-red-200 text-red-800 rounded hover:bg-red-300" title="Grade 1: Again" onClick={() => submitTestReview(item.learningId, Rating.Again as Grade)}>Again</button>
                <button class="px-3 py-1 bg-orange-200 text-orange-800 rounded hover:bg-orange-300" title="Grade 2: Hard" onClick={() => submitTestReview(item.learningId, Rating.Hard as Grade)}>Hard</button>
                <button class="px-3 py-1 bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300" title="Grade 3: Good" onClick={() => submitTestReview(item.learningId, Rating.Good as Grade)}>Good</button>
                <button class="px-3 py-1 bg-green-200 text-green-800 rounded hover:bg-green-300" title="Grade 4: Easy" onClick={() => submitTestReview(item.learningId, Rating.Easy as Grade)}>Easy</button>
              </div>
            </div>
          )}
        </For>
      </div>

    </div>
  );
};

export default NewTabPage; 