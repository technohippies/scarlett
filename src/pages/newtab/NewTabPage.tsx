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

// --- Main Component ---
const NewTabPage: Component = () => {
  const [currentItem, setCurrentItem] = createSignal<DueLearningItem | null>(null);
  const [itemError, setItemError] = createSignal<string | null>(null);
  // NEW: Signal for chosen direction
  const [exerciseDirection, setExerciseDirection] = createSignal<'EN_TO_NATIVE' | 'NATIVE_TO_EN'>('EN_TO_NATIVE');

  // --- Fetching Due Item Resource ---
  const [dueItemResource, { refetch: fetchDueItems }] = createResource(async () => {
    console.log('[NewTab] Fetching next due item resource...');
    setItemError(null);
    setCurrentItem(null); // Clear current item while fetching
    try {
      const response = await messaging.sendMessage('getDueItems', { limit: 1 });
      console.log('[NewTab] Received due item(s):', response.dueItems);
      if (response.dueItems && response.dueItems.length > 0) {
        const fetchedItem = response.dueItems[0];
        setCurrentItem(fetchedItem); // Set the raw item
        // Decide direction RANDOMLY when item is fetched
        const direction = Math.random() < 0.5 ? 'EN_TO_NATIVE' : 'NATIVE_TO_EN';
        setExerciseDirection(direction);
        console.log(`[NewTab] Set exercise direction: ${direction}`);
        return fetchedItem; // Return for the resource
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
  // Depend on both the item and the direction to avoid race conditions
  const [distractorResource] = createResource(
    // Source function returns dependencies
    () => ({ item: currentItem(), direction: exerciseDirection() }), 
    // Fetcher function receives the dependency object
    async (deps) => {
        const { item, direction } = deps;
        if (!item) return null; // No item, no distractors needed

        // We already have the correct direction from deps.direction
        // const direction = exerciseDirection(); // No longer needed to call signal getter here
        
        // Determine prompt/answer based on the received direction
        const promptTextForDistractors = direction === 'EN_TO_NATIVE' ? item.sourceText : item.targetText;
        const answerTextForDistractors = direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText;
        const languageForDistractors = direction === 'EN_TO_NATIVE' ? item.targetLang : 'en'; // Language OF the distractors

        console.log(`[NewTab Distractors] Generating/fetching ${languageForDistractors} distractors for [${direction}]: ${promptTextForDistractors}`);

        const requiredDistractors = 3;
        let finalDistractors: string[] = [];
        // Correct answer text depends on direction
        const correctCurrentAnswerText = direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText;

        // 1. Check Cache - Cache logic likely assumes native distractors, might need adjustment if storing English ones
        // For now, let's simplify and rely more on LLM generation when direction is Native->EN
        let useCache = direction === 'EN_TO_NATIVE'; // Only use cache for EN->Native for simplicity
        if (useCache && item.cachedDistractors && item.cachedDistractors.length >= requiredDistractors) {
          console.log('[NewTab Distractors] Using cached distractors (EN_TO_NATIVE).', item.cachedDistractors);
          const pool = [...item.cachedDistractors];
          if (item.lastIncorrectChoice && pool.includes(item.lastIncorrectChoice)) {
            finalDistractors.push(item.lastIncorrectChoice);
          } 
          // Fill remaining slots randomly from pool, avoiding duplicates and the correct answer
          const remainingPool = pool.filter(d => d !== item.lastIncorrectChoice && d !== correctCurrentAnswerText);
          while (finalDistractors.length < requiredDistractors && remainingPool.length > 0) {
               const randomIndex = Math.floor(Math.random() * remainingPool.length);
               finalDistractors.push(remainingPool.splice(randomIndex, 1)[0]);
          }
          // If still not enough (e.g., cache had duplicates), handle later
          // Ensure correctCurrentAnswerText is filtered
          finalDistractors = finalDistractors.filter(d => d !== correctCurrentAnswerText);

        } else {
          if (direction === 'NATIVE_TO_EN') {
              console.log('[NewTab Distractors] Skipping cache check for NATIVE_TO_EN direction.');
          }
          console.log(`[NewTab Distractors] No valid cached distractors found or NATIVE_TO_EN. Generating via LLM for ${languageForDistractors}...`);
          // 2. Attempt LLM Generation
          try {
            const llmResponse = await messaging.sendMessage('generateLLMDistractors', {
              // Pass texts based on the *distractor context*
              sourceText: promptTextForDistractors,
              targetText: answerTextForDistractors,
              targetLang: languageForDistractors, // Language we want distractors IN
              count: requiredDistractors,
              direction: direction // Pass the direction received from deps
            });

            if (llmResponse.distractors && llmResponse.distractors.length > 0) {
              console.log(`[NewTab Distractors] Received ${languageForDistractors} distractors from LLM:`, llmResponse.distractors);
              finalDistractors = [...new Set(llmResponse.distractors)]
                                  .filter(d => d !== correctCurrentAnswerText); // Filter out correct answer 
              
              // Cache results only if EN_TO_NATIVE and successful
              if (direction === 'EN_TO_NATIVE' && finalDistractors.length >= requiredDistractors) {
                 console.log('[NewTab Distractors] Caching LLM distractors (EN_TO_NATIVE)...');
                 messaging.sendMessage('cacheDistractors', { 
                     translationId: item.translationId, 
                     distractors: finalDistractors.slice(0, requiredDistractors) 
                 }).catch(cacheErr => console.error('[NewTab] Error caching distractors:', cacheErr));
              }
            }
            if (llmResponse.error) {
              console.warn('[NewTab Distractors] LLM generation failed:', llmResponse.error);
            }
          } catch (llmError) {
            console.error('[NewTab Distractors] Error calling generateLLMDistractors:', llmError);
          }

          // 3. Fallback 1: DB Learned Words (if still needed) - Renumbered from 2
          if (finalDistractors.length < requiredDistractors) {
              console.log('[NewTab Distractors] Using DB fallback...');
              try {
                  const needed = requiredDistractors - finalDistractors.length;
                  const dbResponse = await messaging.sendMessage('getDistractorsForItem', {
                      correctTargetLexemeId: item.targetLexemeId, // Use the ID of the correct English word
                      targetLanguage: 'en', // Target is English
                      count: needed
                  });
                  const dbDistractors = dbResponse.distractors.filter(d => !finalDistractors.includes(d) && d !== correctCurrentAnswerText);
                  finalDistractors.push(...dbDistractors);
                  console.log('[NewTab Distractors] Added from DB:', finalDistractors);
              } catch (dbError) {
                   console.error('[NewTab Distractors] Error fetching DB distractors:', dbError);
              }
          }
          // Ensure correctCurrentAnswerText is filtered from fallbacks too
          finalDistractors = finalDistractors.filter(d => d !== correctCurrentAnswerText);
        }

        // 4. Final Selection & Placeholder Fill (if needed) - Renumbered from 5
        let selectedDistractors: string[] = [];
        const pool = [...new Set(finalDistractors)].filter(d => d !== correctCurrentAnswerText);
        
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
    }
  );

  // --- Memo for Final MCQ Props ---
  const mcqProps = createMemo<MCQProps | null>(() => {
    // Depend on the same combined source for consistency
    const deps = { item: currentItem(), direction: exerciseDirection() };
    const distractors = distractorResource(); // This resource now implicitly depends on direction too

    if (!deps.item || !distractors) return null;

    // Determine prompt and correct answer text based on direction from deps
    const promptText = deps.direction === 'EN_TO_NATIVE' ? deps.item.sourceText : deps.item.targetText;
    const correctAnswerText = deps.direction === 'EN_TO_NATIVE' ? deps.item.targetText : deps.item.sourceText;

    // Create options array
    const options: Option[] = distractors.map((distractor, index) => ({
      id: index,
      text: distractor,
    }));

    // Insert the correct answer at a random position
    const correctOptionId = Math.floor(Math.random() * (options.length + 1));
    options.splice(correctOptionId, 0, { id: correctOptionId, text: correctAnswerText });

    // Re-assign IDs sequentially after insertion
    const finalOptions = options.map((opt, index) => ({ ...opt, id: index }));

    // Find the ID of the correct answer in the final shuffled list
    const finalCorrectId = finalOptions.find(opt => opt.text === correctAnswerText)?.id;

    if (finalCorrectId === undefined) {
        console.error("[NewTab] Failed to determine correct option ID after shuffling!");
        setItemError("Internal error creating exercise options.");
        return null;
    }

    const props: MCQProps = {
      instructionText: "Translate:",
      sentenceToTranslate: promptText,
      options: finalOptions,     
      correctOptionId: finalCorrectId, 
      onComplete: handleMcqComplete 
    };
    console.log('[NewTab] Generated Final MCQ Props:', props);
    return props;
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
    <div class="newtab-page-container p-8 font-sans bg-background min-h-screen flex flex-col items-center">
      {/* Loading / Error for Item Fetching */} 
      <div class="h-10 mb-4">
        <Show when={dueItemResource.loading}> 
          <p class="text-foreground text-lg animate-pulse">Loading review item...</p>
        </Show>
        <Show when={itemError()}>
          {(errorMsgAccessor) => <p class="text-red-600 font-semibold text-lg">Error: {errorMsgAccessor()}</p>}
        </Show>
      </div>

      {/* MCQ Area - Centered container with width constraints */}
      <div class="exercise-area mt-4 w-full max-w-md flex-grow flex flex-col justify-center">
        <Show when={!dueItemResource.loading && !itemError() && currentItem()} 
              fallback={
                  !dueItemResource.loading && !itemError() && (
                      <p class="text-foreground text-lg text-center">
                          🎉 No items due for review right now! Great job! 🎉
                      </p>
                  )
              }
        >
            <Show when={!distractorResource.loading && mcqProps()} 
                   fallback={
                       <p class="text-foreground text-lg animate-pulse">Preparing exercise...</p>
                   }
            >
                <Show when={mcqProps()}> 
                  {(propsAccessor) => {
                      const props = propsAccessor();
                      return (
                          <MCQ
                              instructionText={props.instructionText}
                              sentenceToTranslate={props.sentenceToTranslate}
                              options={props.options}
                              correctOptionId={props.correctOptionId}
                              onComplete={props.onComplete}
                          />
                      );
                  }}
                </Show>
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
        class="mt-8 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50 transition-colors"
      >
        {dueItemResource.loading ? 'Loading...' : 'Skip / Get Next'}
      </button>

    </div>
  );
};

export default NewTabPage; 