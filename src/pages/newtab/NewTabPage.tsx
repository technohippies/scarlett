import { Component, createSignal, createResource, createMemo, Show } from 'solid-js'; // Added createResource, Show
import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
    GetDueItemsRequest,
    GetDueItemsResponse,
    SubmitReviewRequest,
    SubmitReviewResponse,
    CacheDistractorsRequest,     // Added
    CacheDistractorsResponse,    // Added
    GenerateLLMDistractorsRequest, // Added
    GenerateLLMDistractorsResponse,// Added
    GetDistractorsRequest,       // Added (for DB fallback)
    GetDistractorsResponse       // Added (for DB fallback)
} from '../../shared/messaging-types';
import type { DueLearningItem } from '../../services/srs/types';
import { Rating } from 'ts-fsrs';
import { MCQ } from '../../features/exercises/MCQ';
import type { MCQProps, Option } from '../../features/exercises/MCQ';
import nlp from 'compromise'; // Added compromise

// Define the protocol map for messages SENT TO the background
interface BackgroundProtocol {
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
    cacheDistractors(data: CacheDistractorsRequest): Promise<CacheDistractorsResponse>; // Added
    generateLLMDistractors(data: GenerateLLMDistractorsRequest): Promise<GenerateLLMDistractorsResponse>; // Added
    getDistractorsForItem(data: GetDistractorsRequest): Promise<GetDistractorsResponse>; // Added (for DB fallback)
}

// Initialize messaging client
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

// --- Main Component ---
const NewTabPage: Component = () => {
  const [currentItem, setCurrentItem] = createSignal<DueLearningItem | null>(null);
  const [itemError, setItemError] = createSignal<string | null>(null);

  // --- Fetching Due Item Resource ---
  const [dueItemResource, { refetch: fetchDueItems }] = createResource(async () => {
    console.log('[NewTab] Fetching next due item resource...');
    setItemError(null);
    setCurrentItem(null); // Clear current item while fetching
    try {
      const response = await messaging.sendMessage('getDueItems', { limit: 1 });
      console.log('[NewTab] Received due item(s):', response.dueItems);
      if (response.dueItems && response.dueItems.length > 0) {
        setCurrentItem(response.dueItems[0]); // Set the raw item
        return response.dueItems[0]; // Return for the resource
      } else {
        setCurrentItem(null);
        return null; // No items due
      }
    } catch (err: any) {
      console.error('[NewTab] Error fetching due items:', err);
      setItemError(err.message || 'Failed to fetch due items.');
      return null;
    }
  });

  // --- Generating Distractors (Async Logic Moved Here) ---
  const [distractorResource] = createResource(currentItem, async (item) => {
    if (!item) return null; // No item, no distractors needed

    console.log('[NewTab Distractors] Generating/fetching distractors for:', item.sourceText);

    const requiredDistractors = 3;
    let finalDistractors: string[] = [];
    const correctTargetText = item.targetText;

    // 1. Check Cache
    if (item.cachedDistractors && item.cachedDistractors.length >= requiredDistractors) {
      console.log('[NewTab Distractors] Using cached distractors.', item.cachedDistractors);
      // Select based on last incorrect choice if applicable
      const pool = [...item.cachedDistractors];
      if (item.lastIncorrectChoice && pool.includes(item.lastIncorrectChoice)) {
        finalDistractors.push(item.lastIncorrectChoice);
      } 
      // Fill remaining slots randomly from pool, avoiding duplicates and the correct answer
      const remainingPool = pool.filter(d => d !== item.lastIncorrectChoice && d !== correctTargetText);
      while (finalDistractors.length < requiredDistractors && remainingPool.length > 0) {
           const randomIndex = Math.floor(Math.random() * remainingPool.length);
           finalDistractors.push(remainingPool.splice(randomIndex, 1)[0]);
      }
      // If still not enough (e.g., cache had duplicates), handle later

    } else {
      console.log('[NewTab Distractors] No valid cached distractors found. Generating...');
      // 2. Attempt LLM Generation
      try {
        const llmResponse = await messaging.sendMessage('generateLLMDistractors', {
          sourceText: item.sourceText,
          targetText: correctTargetText,
          targetLang: item.targetLang, // Use the actual target language from the item
          count: requiredDistractors
        });

        if (llmResponse.distractors && llmResponse.distractors.length > 0) {
          console.log('[NewTab Distractors] Received distractors from LLM:', llmResponse.distractors);
          finalDistractors = [...new Set(llmResponse.distractors)] // Ensure unique
                              .filter(d => d !== correctTargetText); // Filter out correct answer just in case
          
          // Cache the LLM results if successful and we got enough
          if (finalDistractors.length >= requiredDistractors) {
             console.log('[NewTab Distractors] Caching LLM distractors...');
             // Fire-and-forget caching, no need to await
             messaging.sendMessage('cacheDistractors', { 
                 translationId: item.translationId, 
                 distractors: finalDistractors.slice(0, requiredDistractors) // Cache only needed amount
             }).catch(cacheErr => console.error('[NewTab] Error caching distractors:', cacheErr));
          }
        }
        if (llmResponse.error) {
          console.warn('[NewTab Distractors] LLM generation failed:', llmResponse.error);
        }
      } catch (llmError) {
        console.error('[NewTab Distractors] Error calling generateLLMDistractors:', llmError);
      }

      // 3. Fallback 1: Compromise.js (if still needed)
      if (finalDistractors.length < requiredDistractors) {
          console.log('[NewTab Distractors] Using Compromise.js fallback...');
          try {
              const doc = nlp(correctTargetText);
              // Get nouns/verbs/adjectives related to the target word
              const relatedWords = doc.terms().out('terms'); 
              let compromiseDistractors = relatedWords
                  .map((t: any) => t.text.toLowerCase()) // Assuming terms have text property
                  .filter((w: string) => w !== correctTargetText.toLowerCase() && !finalDistractors.includes(w)); 
              
              // Get synonyms more directly if possible (Compromise structure might vary)
              // This is a basic example, might need refinement based on library version/structure
              // let synonyms = doc.nouns().out('terms'); // Or verbs(), adjectives() etc.

              compromiseDistractors = [...new Set(compromiseDistractors)]; // Unique

              while(finalDistractors.length < requiredDistractors && compromiseDistractors.length > 0) {
                   finalDistractors.push(compromiseDistractors.shift()!); // Add unique related words
              }
              console.log('[NewTab Distractors] Added from Compromise:', finalDistractors);
          } catch(compromiseError) {
              console.error('[NewTab Distractors] Error using Compromise:', compromiseError);
          }
      }

      // 4. Fallback 2: DB Learned Words (if still needed)
      if (finalDistractors.length < requiredDistractors) {
          console.log('[NewTab Distractors] Using DB fallback...');
          try {
              const needed = requiredDistractors - finalDistractors.length;
              const dbResponse = await messaging.sendMessage('getDistractorsForItem', {
                  correctTargetLexemeId: item.targetLexemeId, // Use the ID of the correct English word
                  targetLanguage: 'en', // Target is English
                  count: needed
              });
              const dbDistractors = dbResponse.distractors.filter(d => !finalDistractors.includes(d) && d !== correctTargetText);
              finalDistractors.push(...dbDistractors);
              console.log('[NewTab Distractors] Added from DB:', finalDistractors);
          } catch (dbError) {
               console.error('[NewTab Distractors] Error fetching DB distractors:', dbError);
          }
      }
    }

    // 5. Final Selection & Placeholder Fill (if needed)
    let selectedDistractors: string[] = [];
    const pool = [...new Set(finalDistractors)].filter(d => d !== correctTargetText);
    
    // Prioritize last incorrect choice
    if (item.lastIncorrectChoice && pool.includes(item.lastIncorrectChoice)) {
        selectedDistractors.push(item.lastIncorrectChoice);
        pool.splice(pool.indexOf(item.lastIncorrectChoice), 1); // Remove from pool
    }
    // Fill remaining randomly from pool
    while (selectedDistractors.length < requiredDistractors && pool.length > 0) {
         const randomIndex = Math.floor(Math.random() * pool.length);
         selectedDistractors.push(pool.splice(randomIndex, 1)[0]);
    }
     // Add placeholders if absolutely necessary
    while (selectedDistractors.length < requiredDistractors) {
         selectedDistractors.push(`Placeholder ${String.fromCharCode(65 + selectedDistractors.length)}`);
    }

    console.log('[NewTab Distractors] Final selected distractors:', selectedDistractors);
    return selectedDistractors;
  });

  // --- Memo for Final MCQ Props ---
  const mcqProps = createMemo<MCQProps | null>(() => {
    const item = currentItem();
    const distractors = distractorResource();

    // Need item and successfully generated distractors
    if (!item || distractorResource.loading || !distractors || distractors.length < 3) {
      return null;
    }

    const correctOptionText = item.targetText;
    // Combine correct answer + finalized distractors and shuffle
    const rawOptions = [correctOptionText, ...distractors];
    const shuffledOptions = shuffleArray(rawOptions);

    // Create options with IDs
    let correctOptionId: number = -1;
    const options: Option[] = shuffledOptions.map((text, index) => {
        if (text === correctOptionText) {
            correctOptionId = index;
        }
        return { id: index, text };
    });

    if (correctOptionId === -1) {
        console.error("[NewTab] Couldn't find correct option ID after shuffling!", item);
        // Avoid setting global error here, maybe handle differently
        return null;
    }

    console.log("[NewTab] Generated Final MCQ Props:", { instruction: "Translate:", sentence: item.sourceText, options, correctId: correctOptionId });

    return {
        instructionText: "Translate:",
        sentenceToTranslate: item.sourceText,
        options: options,
        correctOptionId: correctOptionId,
        onComplete: handleMcqComplete, // Assign the handler
    };
  });

  // --- Handle MCQ Completion ---
  const handleMcqComplete = async (selectedOptionId: string | number, isCorrect: boolean) => {
    console.log(`[NewTab] MCQ Complete. Correct: ${isCorrect}, Selected ID: ${selectedOptionId}`);
    const item = currentItem();
    if (!item) {
      console.error("[NewTab] No current item found when MCQ completed.");
      setItemError("Error submitting review: Item not found.")
      return;
    }

    const grade = isCorrect ? Rating.Good : Rating.Again;
    let incorrectChoiceText: string | null = null;
    if (!isCorrect) {
        const finalProps = mcqProps(); // Get the props used for the completed MCQ
        const selectedOption = finalProps?.options.find(opt => opt.id === Number(selectedOptionId));
        if (selectedOption && selectedOption.id !== finalProps?.correctOptionId) {
             incorrectChoiceText = selectedOption.text;
        }
    }

    console.log(`[NewTab] Submitting review for Learning ID: ${item.learningId} with Grade: ${grade}. Incorrect choice: ${incorrectChoiceText ?? 'N/A'}`);

    try {
      const response = await messaging.sendMessage('submitReviewResult', {
        learningId: item.learningId,
        grade,
        incorrectChoiceText // Send the incorrect choice text
      });
      console.log('[NewTab] Submit review response:', response);
      if (!response.success) {
        setItemError(`Failed to submit review: ${response.error || 'Unknown error'}`);
        console.warn("[NewTab] Review submission failed, but fetching next item.");
      }
      // Refetch the next item *after* submission attempt
      fetchDueItems();
    } catch (err: any) {
      console.error('[NewTab] Error submitting review:', err);
      setItemError(`Error submitting review: ${err.message}`);
      // Still try to refetch
      fetchDueItems();
    } 
  }

  // --- Render ---
  return (
    <div class="newtab-page-container p-8 font-sans bg-gray-50 min-h-screen flex flex-col items-center">
      <h1 class="text-3xl font-bold mb-6 text-gray-800">Scarlett Study Session</h1>

      {/* Loading / Error for Item Fetching */} 
      <div class="h-10 mb-4">
        <Show when={dueItemResource.loading}> 
          <p class="text-gray-600 text-lg animate-pulse">Loading review item...</p>
        </Show>
        <Show when={itemError()}>
          {(errorMsgAccessor) => <p class="text-red-600 font-semibold text-lg">Error: {errorMsgAccessor()}</p>}
        </Show>
      </div>

      {/* MCQ Area - Centered container with width constraints */}
      <div class="exercise-area mt-4 w-full max-w-md flex-grow flex flex-col items-center justify-center">
        <Show when={!dueItemResource.loading && !itemError() && currentItem()} 
              fallback={
                  !dueItemResource.loading && !itemError() && (
                      <p class="text-gray-600 text-lg text-center">
                          🎉 No items due for review right now! Great job! 🎉
                      </p>
                  )
              }
        >
            <Show when={!distractorResource.loading && mcqProps()} 
                   fallback={
                       <p class="text-gray-600 text-lg animate-pulse">Preparing exercise...</p>
                   }
            >
                {(props) => <MCQ {...mcqProps()!} />}
            </Show>
            {/* Conditionally render the error paragraph if error exists */}
            {distractorResource.error && (
                 <p class="text-orange-600 font-semibold text-sm">
                    Warning: Could not generate optimal distractors ({String(distractorResource.error)})
                 </p>
            )}
         </Show>
      </div>

      {/* Skip Button */} 
      <button
        onClick={fetchDueItems}
        disabled={dueItemResource.loading}
        class="mt-8 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 transition-colors"
      >
        {dueItemResource.loading ? 'Loading...' : 'Skip / Get Next'}
      </button>

    </div>
  );
};

export default NewTabPage; 