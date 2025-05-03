import { Component, createSignal, onMount, createMemo } from 'solid-js'; // Added createMemo
import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
    GetDueItemsRequest,
    GetDueItemsResponse,
    SubmitReviewRequest,
    SubmitReviewResponse
} from '../../shared/messaging-types'; // Adjusted path
import type { DueLearningItem } from '../../services/srs/types'; // Adjusted path
import { Grade, Rating } from 'ts-fsrs';

// Import MCQ component and types
import { MCQ } from '../../features/exercises/MCQ'; // Corrected import (named)
import type { MCQProps, Option } from '../../features/exercises/MCQ'; // Corrected import (types)

// Define the protocol map for messages SENT TO the background
interface BackgroundProtocol {
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
}

// Initialize messaging client for this page
const messaging = defineExtensionMessaging<BackgroundProtocol>();

// Helper function to shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

const NewTabPage: Component = () => {
  // Use currentItem signal instead of dueItems array
  const [currentItem, setCurrentItem] = createSignal<DueLearningItem | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [showMcq, setShowMcq] = createSignal(false); // Control MCQ visibility

  const fetchDueItems = async () => {
    console.log('[NewTab] Fetching next due item...');
    setIsLoading(true);
    setError(null);
    setCurrentItem(null); // Clear current item
    setShowMcq(false); // Hide MCQ while loading
    try {
        const response = await messaging.sendMessage('getDueItems', { limit: 1 });
        console.log('[NewTab] Received due item(s):', response.dueItems);
        if (response.dueItems && response.dueItems.length > 0) {
            setCurrentItem(response.dueItems[0]);
            // setShowMcq(true); // Let the memo handle this based on currentItem
        } else {
             setCurrentItem(null); // No items due
        }
    } catch (err: any) {
        console.error('[NewTab] Error fetching due items:', err);
        setError(err.message || 'Failed to fetch due items.');
    } finally {
        setIsLoading(false);
    }
  };

  onMount(fetchDueItems);

  // Memo to compute MCQ props only when currentItem changes
  const mcqProps = createMemo<MCQProps | null>(() => {
    const item = currentItem();
    // Only proceed if we have an item and are not loading/in error
    if (!item || isLoading() || error()) {
        setShowMcq(false);
        return null;
    }

    const correctOptionText = item.targetText;
    let distractors = item.llmDistractors && Array.isArray(item.llmDistractors) && item.llmDistractors.length >= 3
        ? item.llmDistractors.slice(0, 3) // Use first 3 LLM distractors
        : [`${correctOptionText} B`, `${correctOptionText} C`, `${correctOptionText} D`]; // Basic placeholders if needed

    // Ensure distractors don't include the correct answer and are unique
    distractors = [...new Set(distractors)].filter(d => d !== correctOptionText).slice(0, 3);
    
    // If we still don't have 3 unique distractors, add more placeholders
    while (distractors.length < 3) {
        distractors.push(`Placeholder ${String.fromCharCode(68 + distractors.length)}`); // D, E, F...
    }

    // Combine correct answer + distractors and shuffle
    const rawOptions = [correctOptionText, ...distractors];
    const shuffledOptions = shuffleArray(rawOptions);

    // Create options with IDs (use index as ID for simplicity here)
    let correctOptionId: number = -1;
    const options: Option[] = shuffledOptions.map((text, index) => {
        if (text === correctOptionText) {
            correctOptionId = index;
        }
        return { id: index, text };
    });

    if (correctOptionId === -1) {
        console.error("[NewTab] Couldn't find correct option ID after shuffling!", item);
        setError("Internal error preparing exercise.");
        setShowMcq(false);
        return null; 
    }
    
    console.log("[NewTab] Generated MCQ Props:", { instruction: "Translate:", sentence: item.sourceText, options, correctId: correctOptionId });
    setShowMcq(true); // Ready to show MCQ

    return {
        instructionText: "Translate the following word:",
        sentenceToTranslate: item.sourceText,
        options: options,
        correctOptionId: correctOptionId,
        onComplete: handleMcqComplete, // Assign the handler
    };
  });

  // Renamed from submitTestReview for clarity
  const handleMcqComplete = async (selectedOptionId: string | number, isCorrect: boolean) => {
    console.log(`[NewTab] MCQ Complete. Correct: ${isCorrect}, Selected ID: ${selectedOptionId}`);
    const item = currentItem(); // Get the item that was just reviewed
    if (!item) {
        console.error("[NewTab] No current item found when MCQ completed.");
        setError("Error submitting review: Item not found.")
        return;
    }

    // Don't hide MCQ here, let fetchDueItems handle it
    // setShowMcq(false);

    // Determine FSRS grade based on correctness
    const grade = isCorrect ? Rating.Good : Rating.Again; // Simple mapping

    console.log(`[NewTab] Submitting review for Learning ID: ${item.learningId} with Grade: ${grade}`);

    try {
        setIsLoading(true); // Show loading state during submission/fetch
        const response = await messaging.sendMessage('submitReviewResult', {
            learningId: item.learningId,
            grade
        });
        console.log('[NewTab] Submit review response:', response);
        if (!response.success) {
             // Show error, fetch next item anyway
             setError(`Failed to submit review: ${response.error || 'Unknown error'}`);
             console.warn("[NewTab] Review submission failed, but fetching next item.");
        }
        // Fetch the next item after submission attempt
        fetchDueItems(); 
    } catch (err: any) {
         console.error('[NewTab] Error submitting review:', err);
         setError(`Error submitting review: ${err.message}`);
         // Still try to fetch next item to avoid getting stuck
         fetchDueItems();
    } 
    // setIsLoading(false) will be handled by fetchDueItems finally block
  }

  return (
    // Use flex column and center items for better layout
    <div class="newtab-page-container p-8 font-sans bg-gray-50 min-h-screen flex flex-col items-center">
      <h1 class="text-3xl font-bold mb-6 text-gray-800">Scarlett Study Session</h1>

      {/* Loading and Error States */} 
      <div class="h-10 mb-4"> {/* Placeholder for height consistency */}
        {isLoading() && <p class="text-gray-600 text-lg animate-pulse">Loading review item...</p>}
        {error() && <p class="text-red-600 font-semibold text-lg">Error: {error()}</p>}
      </div>

      {/* MCQ Area - Render based on showMcq and mcqProps */} 
      <div class="exercise-area mt-4 w-full max-w-md flex-grow flex items-center justify-center">
        {(showMcq() && mcqProps()) ? (
           <MCQ {...mcqProps()!} />
        ) : (
            // Show no items due message only if not loading and no error
            !isLoading() && !error() && !currentItem() && (
                <p class="text-gray-600 text-lg text-center">
                    🎉 No items due for review right now! Great job! 🎉
                </p>
            )
        )}
      </div>

      {/* Optional: Button to manually fetch next (useful for debugging or skipping) */} 
      <button
        onClick={fetchDueItems}
        disabled={isLoading()}
        class="mt-8 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 transition-colors"
      >
        {isLoading() ? 'Loading...' : 'Skip / Get Next'}
      </button>

    </div>
  );
};

export default NewTabPage; 