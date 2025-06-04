import { Component, createSignal, createResource, createMemo, createEffect } from 'solid-js';
import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
    GetDueItemsRequest,
    GetDueItemsResponse,
    SubmitReviewRequest,
    SubmitReviewResponse,
    GenerateLLMDistractorsRequest,
    GenerateLLMDistractorsResponse,
    GetDistractorsRequest,
    GetDistractorsResponse,
    GetDailyStudyStatsRequest,
    GetDailyStudyStatsResponse,
    IncrementDailyNewItemsStudiedRequest,
    IncrementDailyNewItemsStudiedResponse
} from '../../shared/messaging-types';
import { Rating, State as FSRSStateEnum } from 'ts-fsrs'; 
import type { DueLearningItem } from '../../services/srs/types'; // FSRSState was removed from here
import { StudyPageView } from './StudyPageView';
import type { MCQProps } from '../../features/exercises/MCQ';
import type { ReviewableCardData } from '../../features/exercises/Flashcard';
import type { FlashcardStatus } from '../../services/db/types';
import { userConfigurationStorage } from '../../services/storage/storage';
import type { Messages } from '../../types/i18n'; // For typing messages prop

// Define the protocol map for messages SENT TO the background
interface BackgroundProtocol {
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
    generateLLMDistractors(data: GenerateLLMDistractorsRequest): Promise<GenerateLLMDistractorsResponse>;
    getDistractorsForItem(data: GetDistractorsRequest): Promise<GetDistractorsResponse>;
    getDailyStudyStats(data: GetDailyStudyStatsRequest): Promise<GetDailyStudyStatsResponse>;
    incrementDailyNewItemsStudied(data: IncrementDailyNewItemsStudiedRequest): Promise<IncrementDailyNewItemsStudiedResponse>;
}

// Props for StudyPage
export interface StudyPageProps {
  onNavigateBack: () => void;
  messages?: Messages; // Added messages prop
}

// Initialize messaging client
const messaging = defineExtensionMessaging<BackgroundProtocol>();

// Define the daily new item limit
const DAILY_NEW_ITEM_LIMIT = 20;
const MCQ_INTERLEAVING_THRESHOLD = 3; // Show a pending MCQ after N other main activities

// Utility function to shuffle an array (Fisher-Yates shuffle)
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Define the structure for the distractor resource's return value
interface DistractorResourceData {
  distractors: string[] | null;
  error: string | null;
  forDirection: 'EN_TO_NATIVE' | 'NATIVE_TO_EN' | null;
  forTranslationId: number | null;
}

// Helper to map FSRS numeric state to FlashcardStatus string
const mapFsrsStateToStatus = (stateValue: number): FlashcardStatus => {
  switch (stateValue) {
    case FSRSStateEnum.New: return 'new';
    case FSRSStateEnum.Learning: return 'learning';
    case FSRSStateEnum.Review: return 'review';
    case FSRSStateEnum.Relearning: return 'relearning';
    default: 
      console.warn(`[StudyPage] Unknown FSRS state value: ${stateValue}`);
      return 'new';
  }
};

// --- Container Component ---
const StudyPage: Component<StudyPageProps> = (props) => {
  console.log('[StudyPage LIFECYCLE] Component init');
  const [currentItem, setCurrentItem] = createSignal<DueLearningItem | null>(null);
  const [itemError, setItemError] = createSignal<string | null>(null);
  const [exerciseDirection, setExerciseDirection] = createSignal<'EN_TO_NATIVE' | 'NATIVE_TO_EN'>('EN_TO_NATIVE');
  const [currentStudyStep, setCurrentStudyStep] = createSignal<'flashcard' | 'mcq' | 'noItem'>('noItem');
  const [isFetchingNextItem, setIsFetchingNextItem] = createSignal<boolean>(false);
  const [shouldShowLoadingSpinner, setShouldShowLoadingSpinner] = createSignal<boolean>(false);
  let spinnerTimeoutId: any;

  // State for daily new item limits
  const [dailyNewItemCount, setDailyNewItemCount] = createSignal(0);
  const [lastResetDateForNewItems, setLastResetDateForNewItems] = createSignal(new Date().toISOString().split('T')[0]);
  const [dailyStatsLoaded, setDailyStatsLoaded] = createSignal(false);
  const [initialLoadComplete, setInitialLoadComplete] = createSignal(false);

  // State for delayed MCQs
  const [pendingMcqQueue, setPendingMcqQueue] = createSignal<DueLearningItem[]>([]);
  const [activitiesSinceLastPendingMcq, setActivitiesSinceLastPendingMcq] = createSignal(0);

  createEffect(() => console.log(`[StudyPage STATE] currentStudyStep changed to: ${currentStudyStep()}`));
  createEffect(() => console.log(`[StudyPage STATE] isFetchingNextItem changed to: ${isFetchingNextItem()}`));
  createEffect(() => console.log(`[StudyPage STATE] shouldShowLoadingSpinner changed to: ${shouldShowLoadingSpinner()}`));
  createEffect(() => console.log(`[StudyPage STATE] currentItem changed: ${JSON.stringify(currentItem())?.substring(0,100)}...`));
  createEffect(() => console.log(`[StudyPage STATE] dailyNewItemCount changed to: ${dailyNewItemCount()}/${DAILY_NEW_ITEM_LIMIT}, lastResetDate: ${lastResetDateForNewItems()}`));
  createEffect(() => console.log(`[StudyPage STATE] pendingMcqQueue length: ${pendingMcqQueue().length}, activitiesSinceLastPendingMcq: ${activitiesSinceLastPendingMcq()}`));

  // Effect to load daily study stats on component mount
  createEffect(async () => {
    console.log('[StudyPage EFFECT dailyStats] Attempting to load daily study stats.');
    try {
      const response = await messaging.sendMessage('getDailyStudyStats', {});
      if (response.success && response.lastResetDate && typeof response.newItemsStudiedToday === 'number') {
        console.log('[StudyPage EFFECT dailyStats] Loaded stats:', response);
        setLastResetDateForNewItems(response.lastResetDate);
        setDailyNewItemCount(response.newItemsStudiedToday);
      } else {
        console.warn('[StudyPage EFFECT dailyStats] Failed to load daily stats or stats were incomplete:', response.error);
        // Fallback to initializing with today's date and 0 count if BE fails to provide proper init
        const today = new Date().toISOString().split('T')[0];
        setLastResetDateForNewItems(today);
        setDailyNewItemCount(0);
      }
    } catch (error) {
      console.error('[StudyPage EFFECT dailyStats] Error fetching daily study stats:', error);
      const today = new Date().toISOString().split('T')[0];
      setLastResetDateForNewItems(today);
      setDailyNewItemCount(0);
    } finally {
      setDailyStatsLoaded(true);
      console.log('[StudyPage EFFECT dailyStats] Daily stats loading attempt complete.');
      if (!initialLoadComplete()) { // Ensure it only runs once for the very first load
        fetchNextStudyActivity(); // Start the study flow
      }
    }
  });

  // Orchestrator for study flow
  const fetchNextStudyActivity = () => {
    console.log(`[StudyPage FN_CALL] fetchNextStudyActivity. Pending MCQs: ${pendingMcqQueue().length}, Activities since last: ${activitiesSinceLastPendingMcq()}`);
    clearTimeout(spinnerTimeoutId);
    setShouldShowLoadingSpinner(false); // Reset spinner visibility, resource fetch will manage it if needed

    if (pendingMcqQueue().length > 0 && activitiesSinceLastPendingMcq() >= MCQ_INTERLEAVING_THRESHOLD) {
        const mcqItem = pendingMcqQueue()[0];
        setPendingMcqQueue(prevQueue => prevQueue.slice(1)); // Dequeue

        setCurrentItem(mcqItem);
        const direction = Math.random() < 0.5 ? 'EN_TO_NATIVE' : 'NATIVE_TO_EN';
        setExerciseDirection(direction);
        setCurrentStudyStep('mcq');
        setActivitiesSinceLastPendingMcq(0); // Reset counter
        console.log(`[StudyPage FN_CALL] fetchNextStudyActivity - Presenting pending MCQ for item ${mcqItem.learningId}`);
        setIsFetchingNextItem(false); // We are not fetching from backend
        setShouldShowLoadingSpinner(false); // Item is in memory
    } else {
        console.log(`[StudyPage FN_CALL] fetchNextStudyActivity - Fetching new due item from backend.`);
        fetchDueItems(); // Trigger the resource to fetch
    }
  };

  // --- Fetching Due Item Resource ---
  const [dueItemResource, { refetch: fetchDueItems }] = createResource(
    () => dailyStatsLoaded(), // Depend on dailyStatsLoaded to ensure stats are checked first
    async (statsLoaded) => {
    if (!statsLoaded) {
      console.log('[StudyPage FN_CALL] fetchDueItems (Resource) - Waiting for daily stats to load...');
      return null; // Don't fetch if daily stats aren't loaded yet
    }
    console.log('[StudyPage FN_CALL] fetchDueItems (Resource) START (Daily stats loaded)');
    setIsFetchingNextItem(true);
    clearTimeout(spinnerTimeoutId);
    setShouldShowLoadingSpinner(false); 
    spinnerTimeoutId = setTimeout(() => {
      if (isFetchingNextItem()) {
        console.log('[StudyPage FN_CALL] fetchDueItems (Resource) - Spinner timeout triggered, showing spinner.');
        setShouldShowLoadingSpinner(true);
      }
    }, 200);

    setItemError(null);

    // Check and potentially reset daily new item count if the date changed
    // This is a secondary check; primary reset happens in getOrInitDailyStudyStats (BE)
    const todayStrForFetch = new Date().toISOString().split('T')[0];
    if (lastResetDateForNewItems() !== todayStrForFetch) {
      console.log(`[StudyPage FN_CALL] fetchDueItems (Resource) - Date changed from ${lastResetDateForNewItems()} to ${todayStrForFetch}. Resetting UI count.`);
      setLastResetDateForNewItems(todayStrForFetch);
      setDailyNewItemCount(0); // Reset UI count, BE should have reset DB count via getDailyStudyStats
    }

    try {
      const requestData: GetDueItemsRequest = {
        limit: 1, // Still fetch one at a time from backend
        excludeNewIfLimitReached: true, 
        newItemsStudiedToday: dailyNewItemCount(),
        dailyNewItemLimit: DAILY_NEW_ITEM_LIMIT
      };
      console.log('[StudyPage FN_CALL] fetchDueItems (Resource) - Sending getDueItems message:', requestData);
      const response = await messaging.sendMessage('getDueItems', requestData);
      console.log(`[StudyPage FN_CALL] fetchDueItems (Resource) - Received getDueItems response (first item): ${JSON.stringify(response?.dueItems?.[0])?.substring(0,100)}...`);
      
      if (response && response.dueItems && response.dueItems.length > 0) {
        const fetchedItem = response.dueItems[0];
        setCurrentItem(fetchedItem);
        setActivitiesSinceLastPendingMcq(count => count + 1); // Item fetched from backend, increment activity
        const direction = Math.random() < 0.5 ? 'EN_TO_NATIVE' : 'NATIVE_TO_EN';
        setExerciseDirection(direction);
        setCurrentStudyStep('flashcard'); // New items from backend typically start as flashcards
        console.log(`[StudyPage FN_CALL] fetchDueItems (Resource) - Set exercise direction: ${direction}`);
        console.log('[StudyPage FN_CALL] fetchDueItems (Resource) END - Success, item fetched');
        return fetchedItem;
      } else {
        console.log('[StudyPage FN_CALL] fetchDueItems (Resource) - No due items returned from backend.');
        setCurrentItem(null); // No item from backend
        // If backend has no items, but we have pending MCQs, fetchNextStudyActivity will handle it
        // For now, we set step to 'noItem', and the orchestrator will pick up pending items if any
        // This avoids immediately re-triggering fetchNextStudyActivity from within the resource if the queue isn't ready.
        // The next user action or completion of an activity will call fetchNextStudyActivity.
        if (pendingMcqQueue().length > 0 && activitiesSinceLastPendingMcq() >= MCQ_INTERLEAVING_THRESHOLD) {
             console.log('[StudyPage FN_CALL] fetchDueItems (Resource) - Backend empty, but pending MCQs are ready. fetchNextStudyActivity will be called.');
             // fetchNextStudyActivity(); // Let the natural flow (e.g. after error/skip/complete) call this.
             // Or, more proactively:
             // setTimeout(fetchNextStudyActivity, 0); // Defer to next tick to avoid resource loop issues
        }
        setCurrentStudyStep('noItem');
        console.log('[StudyPage FN_CALL] fetchDueItems (Resource) END - Success, no items');
        return null;
      }
    } catch (err: any) {
      console.error('[StudyPage FN_CALL] fetchDueItems (Resource) - Error fetching due items:', err);
      setItemError(err.message || 'Failed to fetch due items.');
      setCurrentItem(null);
      setCurrentStudyStep('noItem'); // Ensure step reflects error state
      console.log('[StudyPage FN_CALL] fetchDueItems (Resource) END - Error');
      return null;
    } finally {
      clearTimeout(spinnerTimeoutId);
      setShouldShowLoadingSpinner(false);
      setIsFetchingNextItem(false);
      console.log('[StudyPage FN_CALL] fetchDueItems (Resource) - Finally block executed.');
    }
  });

  // Effect to manage currentStudyStep based on dueItemResource.loading and currentItem
  createEffect(() => {
    console.log(`[StudyPage EFFECT item/loading/step] dueItemResource.loading: ${dueItemResource.loading}, currentItem: ${!!currentItem()}, currentStudyStep: ${currentStudyStep()}`);

    if (currentStudyStep() === 'mcq') {
      // If step is already MCQ (set by fetchNextStudyActivity), distractor resource will run.
      return;
    }

    if (dueItemResource.loading && !currentItem() && currentStudyStep() !== 'mcq') {
      console.log("[StudyPage EFFECT item/loading/step] Loading new item and no current item, setting to 'noItem' (or will be updated by fetch)");
      setCurrentStudyStep('noItem'); 
    } else if (currentItem() && currentStudyStep() !== 'mcq') {
      console.log("[StudyPage EFFECT item/loading/step] Current item exists, not in MCQ mode, setting currentStudyStep to 'flashcard'");
      // This is where a newly fetched item from the resource becomes a flashcard.
      // activitiesSinceLastPendingMcq is incremented inside the resource fetch itself.
      setCurrentStudyStep('flashcard');
    } else if (!dueItemResource.loading && !currentItem() && currentStudyStep() !== 'mcq') {
      console.log("[StudyPage EFFECT item/loading/step] No item and not loading, setting currentStudyStep to 'noItem' (e.g. no items due or error).");
      // If the resource returned null (no items/error), and we are not in MCQ mode.
      // Check if there's something in the pendingMcqQueue that could be processed now.
      // This might be redundant if fetchNextStudyActivity is robustly called after every action.
      if (pendingMcqQueue().length === 0 || activitiesSinceLastPendingMcq() < MCQ_INTERLEAVING_THRESHOLD) {
        setCurrentStudyStep('noItem');
      } else {
        // Potentially trigger fetchNextStudyActivity here if the queue is ready and wasn't picked up
        // However, this might lead to complex effect interactions. Better to rely on explicit calls to fetchNextStudyActivity.
        console.log("[StudyPage EFFECT item/loading/step] No item, but pending MCQs might be ready. Awaiting next call to fetchNextStudyActivity.");
      }
    }
  });
  
  // Effect for initialLoadComplete
  createEffect(() => {
    if (dailyStatsLoaded() && !initialLoadComplete()) {
        // Considered initially loaded if stats are ready, and we are either displaying an item
        // or have confirmed no items are available (and not in the middle of fetching).
        if (currentItem() || (currentStudyStep() === 'noItem' && !dueItemResource.loading && !isFetchingNextItem())) {
            setInitialLoadComplete(true);
            console.log("[StudyPage EFFECT initialLoad] Initial load sequence complete.");
        }
    }
  });

  // --- Generating Distractors Resource (Only if moving to MCQ step) ---
  const [distractorResource] = createResource(
    () => ({ item: currentItem(), direction: exerciseDirection(), step: currentStudyStep() }),
    async (deps): Promise<DistractorResourceData> => {
        const { item, direction, step } = deps;
        // Only fetch distractors if we are in MCQ step and have an item
        if (step !== 'mcq' || !item) {
            return { distractors: null, error: null, forDirection: null, forTranslationId: null };
        }
        
        console.log(`[StudyPage Distractors] Step is MCQ, proceeding to fetch for item ${item.translationId}`);

        // Fetch user settings to determine the correct native language for DB fallback
        let userNativeLangCode = 'vi'; // Default, will be overridden by user settings
        try {
            const userSettings = await userConfigurationStorage.getValue();
            if (userSettings && userSettings.nativeLanguage) {
                userNativeLangCode = userSettings.nativeLanguage;
            }
        } catch (settingsError) {
            console.warn('[StudyPage Distractors] Could not fetch user settings for DB fallback language, using default.', settingsError);
        }

        // Determine correct answer for filtering based on actual language content and direction
        const isTargetEnglish = item.targetLang === 'en';
        let correctAnswerForFiltering: string;
        
        if (direction === 'EN_TO_NATIVE') {
            // Answer should be native language
            correctAnswerForFiltering = isTargetEnglish ? item.sourceText : item.targetText;
        } else { // NATIVE_TO_EN  
            // Answer should be English
            correctAnswerForFiltering = isTargetEnglish ? item.targetText : item.sourceText;
        }
        const requiredDistractors = 3;
        let llmGeneratedDistractors: string[] = [];
        let generationError: string | null = null;

        const questionWordForLog = direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText;
        const optionsLangForLog = direction === 'EN_TO_NATIVE' 
            ? getFullLanguageName(item.targetLang) 
            : getFullLanguageName('en');

        console.log(`[StudyPage Distractors] Generating/fetching ${optionsLangForLog} distractors for [${direction}]: ${questionWordForLog}`);
        
        console.log(`[StudyPage Distractors] Attempting LLM generation...`);
        console.log(`[StudyPage DEBUG] Direction: ${direction}`);
        console.log(`[StudyPage DEBUG] item.sourceText: "${item.sourceText}"`);
        console.log(`[StudyPage DEBUG] item.targetText: "${item.targetText}"`);
        console.log(`[StudyPage DEBUG] item.targetLang: "${item.targetLang}"`);
        console.log(`[StudyPage DEBUG] correctAnswerForFiltering: "${correctAnswerForFiltering}"`);
        console.log(`[StudyPage DEBUG] userNativeLangCode: "${userNativeLangCode}"`);
        
        try {
          const llmResponse = await messaging.sendMessage('generateLLMDistractors', {
            sourceText: item.sourceText,    
            targetText: item.targetText,    
            correctAnswerForFiltering: correctAnswerForFiltering,
            count: requiredDistractors,
            direction: direction
          });

          if (llmResponse.distractors && llmResponse.distractors.length > 0) {
            llmGeneratedDistractors = [...new Set(llmResponse.distractors)].filter(d => d !== correctAnswerForFiltering);
          } else if (llmResponse.error) {
             console.warn('[StudyPage Distractors] LLM generation issue:', llmResponse.error);
             generationError = llmResponse.error;
          }
        } catch (llmError: any) {
          console.error('[StudyPage Distractors] LLM call failed:', llmError);
          generationError = llmError.message ?? "LLM call failed";
        }

        let finalDistractorsPool = [...llmGeneratedDistractors];

        if (finalDistractorsPool.length < requiredDistractors) {
            console.log('[StudyPage Distractors] LLM provided insufficient. Using DB fallback...');
            try {
                const neededFromDb = requiredDistractors - finalDistractorsPool.length;
                
                // FIXED: DB distractors should also be in the same language as the correct answer options
                let dbDistractorLangCode: string;
                const isTargetEnglish = item.targetLang === 'en';
                
                if (direction === 'EN_TO_NATIVE') {
                    // Question: English, Options: All in native language
                    dbDistractorLangCode = isTargetEnglish ? userNativeLangCode : item.targetLang; // Same as correct answer
                } else { // NATIVE_TO_EN
                    // Question: Native, Options: All in English
                    dbDistractorLangCode = 'en'; // Same as correct answer
                }
                
                console.log(`[StudyPage Distractors] DB Fallback: Requesting ${neededFromDb} in lang: ${dbDistractorLangCode} for targetLexemeId: ${item.targetLexemeId}`);
                const dbResponse = await messaging.sendMessage('getDistractorsForItem', {
                    correctTargetLexemeId: item.targetLexemeId, 
                    targetLanguage: dbDistractorLangCode, 
                    count: neededFromDb
                });
                const dbDistractors = dbResponse.distractors.filter(d => !finalDistractorsPool.includes(d) && d !== correctAnswerForFiltering);
                finalDistractorsPool.push(...dbDistractors);
            } catch (dbError: any) {
                 console.error('[StudyPage Distractors] DB fallback failed:', dbError);
                 if (!generationError) generationError = dbError.message ?? "DB fallback failed";
            }
        }
        
        let selectedDistractors: string[] = [];
        const availableDistractors = [...new Set(finalDistractorsPool)].filter(d => d !== correctAnswerForFiltering);
        
        if (item.lastIncorrectChoice && availableDistractors.includes(item.lastIncorrectChoice) && item.lastIncorrectChoice !== correctAnswerForFiltering) {
            selectedDistractors.push(item.lastIncorrectChoice);
            availableDistractors.splice(availableDistractors.indexOf(item.lastIncorrectChoice), 1);
        }

        while (selectedDistractors.length < requiredDistractors && availableDistractors.length > 0) {
             const randomIndex = Math.floor(Math.random() * availableDistractors.length);
             selectedDistractors.push(availableDistractors.splice(randomIndex, 1)[0]);
        }
        
        let placeholderIndex = 0;
        while (selectedDistractors.length < requiredDistractors) {
             selectedDistractors.push(`Placeholder ${String.fromCharCode(65 + placeholderIndex++)}`);
             if (!generationError) generationError = "Not enough unique distractors from LLM or DB.";
        }

        return {
            distractors: selectedDistractors.slice(0, requiredDistractors),
            error: generationError,
            forDirection: direction,
            forTranslationId: item.translationId
        };
    }
  );
  
  // --- Memos for Props ---

  const itemForFlashcardReviewer = createMemo<ReviewableCardData | null>(() => {
    const item = currentItem();
    const direction = exerciseDirection();
    if (!item) return null;

    return {
      id: item.learningId,
      front: direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText,
      back: direction === 'EN_TO_NATIVE' ? item.sourceText : item.targetText,
    };
  });

  const flashcardStatus = createMemo<FlashcardStatus>(() => {
    const item = currentItem();
    if (item && typeof item.currentState === 'number') {
      return mapFsrsStateToStatus(item.currentState);
    }
    if (item && item.currentState === undefined) {
      console.warn(`[StudyPage] item.currentState is undefined for learningId: ${item.learningId}. Defaulting to 'new' status.`);
    }
    return 'new'; // Default if no item or currentState is not a number or undefined
  });

  const mcqProps = createMemo<MCQProps | null>(() => {
    const itemData = currentItem();
    const direction = exerciseDirection();
    const step = currentStudyStep();

    if (step !== 'mcq' || !itemData || distractorResource.loading) {
        return null;
    }

    const distractorInfo = distractorResource();

    if (
        !distractorInfo ||
        !distractorInfo.distractors ||
        distractorInfo.forDirection !== direction ||
        distractorInfo.forTranslationId !== itemData.translationId
    ) {
        if (!distractorInfo) console.log('[StudyPage MCQ Props] Waiting: No distractor info (resource might have errored or not resolved).');
        else if (!distractorInfo.distractors) console.log('[StudyPage MCQ Props] Waiting: Distractor info present, but no distractors array.');
        else if (distractorInfo.forDirection !== direction) {
            console.log(`[StudyPage MCQ Props] Waiting: Stale distractors direction. ` +
                        `Expected dir: ${direction} (got ${distractorInfo.forDirection})`);
        } else if (distractorInfo.forTranslationId !== itemData.translationId) {
            console.log(`[StudyPage MCQ Props] Waiting: Stale distractors TId. ` +
                        `Expected TId: ${itemData.translationId} (got ${distractorInfo.forTranslationId})`);
        }
        return null; 
    }

    let sentenceToTranslateDisplay: string;
    let correctAnswerForOptionsList: string;

    // Determine which text is English vs Native based on targetLang field and direction
    const isTargetEnglish = itemData.targetLang === 'en';
    
    if (direction === 'EN_TO_NATIVE') {
        // Question: English word, Correct Answer: Native word
        if (isTargetEnglish) {
            // sourceText is native, targetText is English
            sentenceToTranslateDisplay = itemData.targetText; // English (question)
            correctAnswerForOptionsList = itemData.sourceText; // Native (answer)
        } else {
            // sourceText is English, targetText is native  
            sentenceToTranslateDisplay = itemData.sourceText; // English (question)
            correctAnswerForOptionsList = itemData.targetText; // Native (answer)
        }
    } else { // NATIVE_TO_EN
        // Question: Native word, Correct Answer: English word
        if (isTargetEnglish) {
            // sourceText is native, targetText is English
            sentenceToTranslateDisplay = itemData.sourceText; // Native (question)
            correctAnswerForOptionsList = itemData.targetText; // English (answer)
        } else {
            // sourceText is English, targetText is native
            sentenceToTranslateDisplay = itemData.targetText; // Native (question)  
            correctAnswerForOptionsList = itemData.sourceText; // English (answer)
        }
    }

    const receivedDistractors = distractorInfo.distractors;
    const allOptionsRaw = [correctAnswerForOptionsList, ...receivedDistractors];
    const shuffledOptions = shuffleArray(allOptionsRaw);

    const finalOptions = shuffledOptions.map((text, index) => ({
        id: index,
        text: text,
    }));

    const correctOptionId = finalOptions.findIndex(opt => opt.text === correctAnswerForOptionsList);

    if (correctOptionId === -1) {
        console.error("[StudyPage MCQ Props] Correct answer not found in final options!", { correctAnswerForOptionsList, finalOptions });
        return null; 
    }

    const mcqP: MCQProps = {
      instructionText: "Translate:",
      sentenceToTranslate: sentenceToTranslateDisplay,
      options: finalOptions,
      correctOptionId: correctOptionId,
      onComplete: handleMcqComplete
    };
    return mcqP;
  });

  // --- Handlers ---

  const handleFlashcardRated = async (rating: Rating) => {
    console.log(`[StudyPage FN_CALL] handleFlashcardRated START - Rating: ${rating}`);
    const itemJustReviewed = currentItem();
    if (!itemJustReviewed) {
      console.error("[StudyPage FN_CALL] handleFlashcardRated - No current item found.");
      setItemError("Error submitting review: Item not found.");
      fetchNextStudyActivity();
      console.log(`[StudyPage FN_CALL] handleFlashcardRated END - No item, fetching next activity.`);
      return;
    }

    const wasNewItem = itemJustReviewed.currentState === FSRSStateEnum.New;
    if (wasNewItem) {
        console.log(`[StudyPage FN_CALL] handleFlashcardRated - Item ${itemJustReviewed.learningId} was new. Current daily new count: ${dailyNewItemCount()}`);
    }

    console.log(`[StudyPage FN_CALL] handleFlashcardRated - Submitting review for Learning ID: ${itemJustReviewed.learningId}`);
    try {
      const response = await messaging.sendMessage('submitReviewResult', {
        learningId: itemJustReviewed.learningId,
        grade: rating,
      });
      if (!response.success) {
        setItemError(`Failed to submit review: ${response.error || 'Unknown error'}`);
        console.warn(`[StudyPage FN_CALL] handleFlashcardRated - Review submission failed: ${response.error}`);
      } else {
        if (wasNewItem) {
          console.log(`[StudyPage FN_CALL] handleFlashcardRated - Incrementing daily new item count for item ${itemJustReviewed.learningId}.`);
          try {
            const incrementResponse = await messaging.sendMessage('incrementDailyNewItemsStudied', {});
            if (incrementResponse.success && typeof incrementResponse.updatedNewItemsStudiedToday === 'number') {
              setDailyNewItemCount(incrementResponse.updatedNewItemsStudiedToday);
              console.log(`[StudyPage FN_CALL] handleFlashcardRated - Daily new item count updated via backend to: ${incrementResponse.updatedNewItemsStudiedToday}`);
            } else {
              console.warn('[StudyPage FN_CALL] handleFlashcardRated - Failed to increment daily new item count on backend:', incrementResponse.error);
              setDailyNewItemCount(prev => prev + 1); // Fallback local increment
            }
          } catch (incrementError) {
            console.error('[StudyPage FN_CALL] handleFlashcardRated - Error sending increment message:', incrementError);
            setDailyNewItemCount(prev => prev + 1); // Fallback local increment
          }
        }
      }

      // If it was a new item and rated well, queue it for a later MCQ
      if ((rating === Rating.Good || rating === Rating.Easy) && wasNewItem) {
        console.log(`[StudyPage FN_CALL] handleFlashcardRated - New item ${itemJustReviewed.learningId} rated ${rating}. Adding to pending MCQ queue.`);
        setPendingMcqQueue(prevQueue => [...prevQueue, itemJustReviewed]);
      }
      // For ALL flashcard outcomes, proceed to the next distinct study activity.
      fetchNextStudyActivity();

    } catch (err: any) {
      console.error('[StudyPage FN_CALL] handleFlashcardRated - Error submitting flashcard review:', err);
      setItemError(`Error submitting review: ${err.message}`);
      fetchNextStudyActivity(); // Attempt to recover by fetching next
    }
    console.log('[StudyPage FN_CALL] handleFlashcardRated END');
  };

  const handleMcqComplete = async (selectedOptionId: string | number, isCorrect: boolean) => {
    console.log(`[StudyPage FN_CALL] handleMcqComplete START - Selected: ${selectedOptionId}, Correct: ${isCorrect}`);
    const item = currentItem(); // This is the item that was just used for MCQ
    if (!item) {
      console.error("[StudyPage FN_CALL] handleMcqComplete - No current item found.");
      setItemError("Error submitting review: Item not found.")
      fetchNextStudyActivity();
      console.log('[StudyPage FN_CALL] handleMcqComplete END - No item, fetching next activity.');
      return;
    }

    const grade = isCorrect ? Rating.Good : Rating.Again;
    let incorrectChoiceText: string | null = null;
    if (!isCorrect) {
        const completedMcqProps = mcqProps();
        const selectedOption = completedMcqProps?.options.find(opt => opt.id === Number(selectedOptionId));
        if (selectedOption && selectedOption.id !== completedMcqProps?.correctOptionId) {
             incorrectChoiceText = selectedOption.text;
        }
    }

    try {
      console.log(`[StudyPage FN_CALL] handleMcqComplete - Submitting review for Learning ID: ${item.learningId}, Grade: ${grade}`);
      const response = await messaging.sendMessage('submitReviewResult', {
        learningId: item.learningId,
        grade,
        incorrectChoiceText
      });
      if (!response.success) {
        setItemError(`Failed to submit review: ${response.error || 'Unknown error'}`);
        console.warn(`[StudyPage FN_CALL] handleMcqComplete - Review submission failed: ${response.error}`);
      }
    } catch (err: any) {
      console.error('[StudyPage FN_CALL] handleMcqComplete - Error submitting MCQ review:', err);
      setItemError(`Error submitting review: ${err.message}`);
    } finally {
      console.log('[StudyPage FN_CALL] handleMcqComplete - Fetching next activity.');
      fetchNextStudyActivity(); // Orchestrate the next activity
    }
    console.log('[StudyPage FN_CALL] handleMcqComplete END');
  }

  // Effect to automatically fetch next item if MCQ step is entered but no MCQ can be formed
  // This might need adjustment based on the new flow where MCQs are explicitly set
  createEffect(() => {
    const step = currentStudyStep();
    const item = currentItem();
    const props = mcqProps(); // This is mcqProps() from StudyPage
    const loadingDistractors = distractorResource.loading;
    const distError = distractorResource()?.error;
    const itemErr = itemError(); // Renamed to avoid conflict with `itemError` signal
    console.log(`[StudyPage EFFECT mcqGuard] Step: ${step}, Item: ${!!item}, Distractors Loading: ${loadingDistractors}, MCQ Props: ${!!props}, Dist Error: ${distError}, Item Error: ${itemErr}`);

    if (step === 'mcq' && item && !loadingDistractors && !props && !itemErr) {
        if (distError) {
            console.warn(`[StudyPage EFFECT mcqGuard] Distractor error for item ${item.learningId}: ${distError}. Fetching next activity.`);
        } else {
            console.warn(`[StudyPage EFFECT mcqGuard] In MCQ step for item ${item.learningId}, but no MCQ props (e.g., distractor issue not caught by resource). Fetching next activity.`);
        }
        fetchNextStudyActivity();
    }
  });
  
  const handleSkipClick = () => {
    console.log('[StudyPage FN_CALL] handleSkipClick');
    // Current item is skipped. Decide what's next.
    fetchNextStudyActivity();
  }

  console.log('[StudyPage LIFECYCLE] Component setup complete, returning view props.');
  // --- Render the View component ---
  return (
    <StudyPageView
        isLoadingItem={dueItemResource.loading}
        isLoadingDistractors={currentStudyStep() === 'mcq' && distractorResource.loading}
        isFetchingNextItem={isFetchingNextItem()}
        spinnerVisible={shouldShowLoadingSpinner()}
        initialLoadComplete={initialLoadComplete()}
        itemForFlashcardReviewer={itemForFlashcardReviewer()}
        flashcardStatus={flashcardStatus()}
        mcqProps={mcqProps()}
        itemError={itemError()}
        distractorError={currentStudyStep() === 'mcq' ? distractorResource()?.error ?? null : null}
        onSkipClick={handleSkipClick}
        onNavigateBack={props.onNavigateBack}
        currentStudyStep={currentStudyStep()}
        onFlashcardRated={handleFlashcardRated}
        messages={props.messages} // Pass messages to the view
    />
  );
};

// Helper to get full language name (could be moved to a shared util if used elsewhere in UI)
function getFullLanguageName(code: string): string {
    // Access user settings if possible, or keep simple switch
    // For now, simple switch as before to avoid major refactor for logging only
    switch (code?.toLowerCase()) {
        case 'en': return 'English';
        case 'vi': return 'Vietnamese';
        // Add other languages as needed
        default: return code || 'Unknown';
    }
}

export default StudyPage; 