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
    GetDistractorsResponse
} from '../../shared/messaging-types';
import { Rating, State as FSRSStateEnum } from 'ts-fsrs'; 
import type { DueLearningItem } from '../../services/srs/types'; // FSRSState was removed from here
import { StudyPageView } from './StudyPageView';
import type { MCQProps } from '../../features/exercises/MCQ';
import type { ReviewableCardData } from '../../features/exercises/Flashcard';
import type { FlashcardStatus } from '../../services/db/types';
import { userConfigurationStorage } from '../../services/storage/storage';

// Define the protocol map for messages SENT TO the background
interface BackgroundProtocol {
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
    generateLLMDistractors(data: GenerateLLMDistractorsRequest): Promise<GenerateLLMDistractorsResponse>;
    getDistractorsForItem(data: GetDistractorsRequest): Promise<GetDistractorsResponse>;
}

// Props for StudyPage
export interface StudyPageProps {
  onNavigateBack: () => void;
}

// Initialize messaging client
const messaging = defineExtensionMessaging<BackgroundProtocol>();

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
  const [currentItem, setCurrentItem] = createSignal<DueLearningItem | null>(null);
  const [itemError, setItemError] = createSignal<string | null>(null);
  const [exerciseDirection, setExerciseDirection] = createSignal<'EN_TO_NATIVE' | 'NATIVE_TO_EN'>('EN_TO_NATIVE');
  const [currentStudyStep, setCurrentStudyStep] = createSignal<'flashcard' | 'mcq' | 'noItem'>('noItem');

  // --- Fetching Due Item Resource ---
  const [dueItemResource, { refetch: fetchDueItems }] = createResource(async () => {
    console.log('[StudyPage Container] Fetching next due item resource...');
    setItemError(null);
    setCurrentItem(null);
    setCurrentStudyStep('noItem'); // Reset step
    try {
      const requestData = { limit: 1 };
      console.log('[StudyPage Container] Sending getDueItems message with data:', requestData);
      const response = await messaging.sendMessage('getDueItems', requestData);
      console.log('[StudyPage Container] Received getDueItems response:', JSON.stringify(response, null, 2));
      
      if (response && response.dueItems && response.dueItems.length > 0) {
        const fetchedItem = response.dueItems[0];
        console.log('[StudyPage Container] Setting current item:', JSON.stringify(fetchedItem, null, 2));
        setCurrentItem(fetchedItem);
        const direction = Math.random() < 0.5 ? 'EN_TO_NATIVE' : 'NATIVE_TO_EN';
        setExerciseDirection(direction);
        setCurrentStudyStep('flashcard'); // Start with flashcard
        console.log(`[StudyPage Container] Set exercise direction: ${direction}`);
        return fetchedItem;
      } else {
        console.log('[StudyPage Container] No due items returned in response.');
        setCurrentItem(null);
        setCurrentStudyStep('noItem');
        return null;
      }
    } catch (err: any) {
      console.error('[StudyPage Container] Error fetching due items via messaging:', err);
      setItemError(err.message || 'Failed to fetch due items.');
      setCurrentStudyStep('noItem');
      return null;
    }
  });

  // Effect to reset study step when a new item starts loading or is loaded
  createEffect(() => {
    if (dueItemResource.loading) {
        setCurrentStudyStep('noItem'); // Show loading for item itself
    } else if (currentItem()) {
        setCurrentStudyStep('flashcard');
    } else {
        setCurrentStudyStep('noItem');
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

        const correctAnswerForFiltering = direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText;
        const requiredDistractors = 3;
        let llmGeneratedDistractors: string[] = [];
        let generationError: string | null = null;

        const questionWordForLog = direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText;
        const optionsLangForLog = direction === 'EN_TO_NATIVE' 
            ? getFullLanguageName(item.targetLang) 
            : getFullLanguageName('en');

        console.log(`[StudyPage Distractors] Generating/fetching ${optionsLangForLog} distractors for [${direction}]: ${questionWordForLog}`);
        
        console.log(`[StudyPage Distractors] Attempting LLM generation...`);
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
                let dbDistractorLangCode: string;
                if (direction === 'NATIVE_TO_EN') {
                    dbDistractorLangCode = item.targetLang; 
                } else { 
                    dbDistractorLangCode = userNativeLangCode; 
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
    return item ? mapFsrsStateToStatus(item.currentState) : 'new';
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

    if (direction === 'EN_TO_NATIVE') {
        sentenceToTranslateDisplay = itemData.targetText;
        correctAnswerForOptionsList = itemData.sourceText;
    } else { 
        sentenceToTranslateDisplay = itemData.sourceText;
        correctAnswerForOptionsList = itemData.targetText;
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
    const item = currentItem();
    if (!item) {
      console.error("[StudyPage] No current item found when flashcard rated.");
      setItemError("Error submitting review: Item not found.");
      fetchDueItems(); // Try to get a new item
      return;
    }

    console.log(`[StudyPage] Flashcard rated for Learning ID: ${item.learningId} with Grade: ${rating}`);
    try {
      const response = await messaging.sendMessage('submitReviewResult', {
        learningId: item.learningId,
        grade: rating,
      });
      if (!response.success) {
        setItemError(`Failed to submit review: ${response.error || 'Unknown error'}`);
      }

      // Decide if we should proceed to MCQ or fetch next item
      if (rating === Rating.Again || rating === Rating.Hard) {
        fetchDueItems();
      } else {
        setCurrentStudyStep('mcq'); // Attempt to move to MCQ, distractorResource will trigger
      }

    } catch (err: any) {
      console.error('[StudyPage] Error submitting flashcard review:', err);
      setItemError(`Error submitting review: ${err.message}`);
      fetchDueItems(); // Fetch next item on error
    }
  };

  const handleMcqComplete = async (selectedOptionId: string | number, isCorrect: boolean) => {
    const item = currentItem();
    if (!item) {
      console.error("[StudyPage] No current item found when MCQ completed.");
      setItemError("Error submitting review: Item not found.")
      fetchDueItems();
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
      const response = await messaging.sendMessage('submitReviewResult', {
        learningId: item.learningId,
        grade,
        incorrectChoiceText
      });
      if (!response.success) {
        setItemError(`Failed to submit review: ${response.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('[StudyPage] Error submitting MCQ review:', err);
      setItemError(`Error submitting review: ${err.message}`);
    } finally {
      fetchDueItems(); // Always fetch next item after MCQ
    }
  }

  // Effect to automatically fetch next item if MCQ step is entered but no MCQ can be formed
  createEffect(() => {
    const step = currentStudyStep();
    const item = currentItem();
    const props = mcqProps();
    const loadingDistractors = distractorResource.loading;
    const distError = distractorResource()?.error;

    if (step === 'mcq' && item && !loadingDistractors && !props && !itemError()) {
        if (distError) {
            console.warn(`[StudyPage] Distractor error for item ${item.learningId}: ${distError}. Fetching next item.`);
        } else {
            console.warn(`[StudyPage] In MCQ step for item ${item.learningId}, but no MCQ props. Fetching next item.`);
        }
        fetchDueItems();
    }
  });
  
  const handleSkipClick = () => {
    fetchDueItems();
  }

  // --- Render the View component ---
  return (
    <StudyPageView
        isLoadingItem={dueItemResource.loading}
        isLoadingDistractors={currentStudyStep() === 'mcq' && distractorResource.loading}
        itemForFlashcardReviewer={itemForFlashcardReviewer()}
        flashcardStatus={flashcardStatus()}
        mcqProps={mcqProps()}
        itemError={itemError()}
        distractorError={currentStudyStep() === 'mcq' ? distractorResource()?.error ?? null : null}
        onSkipClick={handleSkipClick}
        onNavigateBack={props.onNavigateBack}
        currentStudyStep={currentStudyStep()}
        onFlashcardRated={handleFlashcardRated}
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