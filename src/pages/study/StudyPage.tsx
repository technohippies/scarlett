import { Component, createSignal, createResource, createMemo } from 'solid-js';
import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
    GetDueItemsRequest,
    GetDueItemsResponse,
    SubmitReviewRequest,
    SubmitReviewResponse,
    CacheDistractorsRequest,
    CacheDistractorsResponse,
    GenerateLLMDistractorsRequest,
    GenerateLLMDistractorsResponse,
    GetDistractorsRequest,
    GetDistractorsResponse
} from '../../shared/messaging-types';
import type { DueLearningItem } from '../../services/srs/types';
import { Rating } from 'ts-fsrs';
import { StudyPageView } from './StudyPageView';
import type { MCQProps, Option } from '../../features/exercises/MCQ';

// Define the protocol map for messages SENT TO the background
interface BackgroundProtocol {
    getDueItems(data: GetDueItemsRequest): Promise<GetDueItemsResponse>;
    submitReviewResult(data: SubmitReviewRequest): Promise<SubmitReviewResponse>;
    cacheDistractors(data: CacheDistractorsRequest): Promise<CacheDistractorsResponse>;
    generateLLMDistractors(data: GenerateLLMDistractorsRequest): Promise<GenerateLLMDistractorsResponse>;
    getDistractorsForItem(data: GetDistractorsRequest): Promise<GetDistractorsResponse>;
}

// Props for StudyPage
export interface StudyPageProps {
  onNavigateBack: () => void;
}

// Initialize messaging client
const messaging = defineExtensionMessaging<BackgroundProtocol>();

// --- Container Component ---
const StudyPage: Component<StudyPageProps> = (props) => {
  const [currentItem, setCurrentItem] = createSignal<DueLearningItem | null>(null);
  const [itemError, setItemError] = createSignal<string | null>(null);
  const [exerciseDirection, setExerciseDirection] = createSignal<'EN_TO_NATIVE' | 'NATIVE_TO_EN'>('EN_TO_NATIVE');

  // --- Fetching Due Item Resource ---
  const [dueItemResource, { refetch: fetchDueItems }] = createResource(async () => {
    console.log('[StudyPage Container] Fetching next due item resource...');
    setItemError(null);
    setCurrentItem(null);
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
        console.log(`[StudyPage Container] Set exercise direction: ${direction}`);
        return fetchedItem;
      } else {
        console.log('[StudyPage Container] No due items returned in response.');
        setCurrentItem(null);
        return null;
      }
    } catch (err: any) {
      console.error('[StudyPage Container] Error fetching due items via messaging:', err);
      setItemError(err.message || 'Failed to fetch due items.');
      return null;
    }
  });

  // --- Generating Distractors Resource ---
  const [distractorResource] = createResource(
    () => ({ item: currentItem(), direction: exerciseDirection() }),
    async (deps) => {
        const { item, direction } = deps;
        if (!item) return { distractors: null, error: null };

        const promptTextForDistractors = direction === 'EN_TO_NATIVE' ? item.sourceText : item.targetText;
        const answerTextForDistractors = direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText;
        const languageForDistractors = direction === 'EN_TO_NATIVE' ? item.targetLang : 'en';
        const correctCurrentAnswerText = direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText;
        const requiredDistractors = 3;
        let finalDistractors: string[] = [];
        let generationError: string | null = null;

        console.log(`[StudyPage Container Distractors] Generating/fetching ${languageForDistractors} distractors for [${direction}]: ${promptTextForDistractors}`);

        let useCache = direction === 'EN_TO_NATIVE';
        if (useCache && item.cachedDistractors && item.cachedDistractors.length >= requiredDistractors) {
          console.log('[StudyPage Container Distractors] Using cached distractors.');
          const pool = [...item.cachedDistractors].filter(d => d !== correctCurrentAnswerText);
          if (item.lastIncorrectChoice && pool.includes(item.lastIncorrectChoice)) {
            finalDistractors.push(item.lastIncorrectChoice);
          }
          const remainingPool = pool.filter(d => d !== item.lastIncorrectChoice);
          while (finalDistractors.length < requiredDistractors && remainingPool.length > 0) {
               const randomIndex = Math.floor(Math.random() * remainingPool.length);
               finalDistractors.push(remainingPool.splice(randomIndex, 1)[0]);
          }
        } else {
            console.log(`[StudyPage Container Distractors] Attempting LLM generation...`);
            try {
              const llmResponse = await messaging.sendMessage('generateLLMDistractors', {
                sourceText: promptTextForDistractors,
                targetText: answerTextForDistractors,
                targetLang: languageForDistractors,
                count: requiredDistractors,
                direction: direction
              });
              if (llmResponse.distractors && llmResponse.distractors.length > 0) {
                finalDistractors = [...new Set(llmResponse.distractors)].filter(d => d !== correctCurrentAnswerText);
                if (direction === 'EN_TO_NATIVE' && finalDistractors.length >= requiredDistractors) {
                    messaging.sendMessage('cacheDistractors', {
                        translationId: item.translationId,
                        distractors: finalDistractors.slice(0, requiredDistractors)
                    }).catch(e => console.error("Cache error", e));
                }
              } else if (llmResponse.error) {
                 console.warn('[StudyPage Container Distractors] LLM generation issue:', llmResponse.error);
                 generationError = llmResponse.error;
              }
            } catch (llmError: any) {
              console.error('[StudyPage Container Distractors] LLM call failed:', llmError);
              generationError = llmError.message ?? "LLM call failed";
            }

            if (finalDistractors.length < requiredDistractors) {
                console.log('[StudyPage Container Distractors] Using DB fallback...');
                try {
                    const needed = requiredDistractors - finalDistractors.length;
                    const dbResponse = await messaging.sendMessage('getDistractorsForItem', {
                        correctTargetLexemeId: item.targetLexemeId,
                        targetLanguage: 'en',
                        count: needed
                    });
                    const dbDistractors = dbResponse.distractors.filter(d => !finalDistractors.includes(d) && d !== correctCurrentAnswerText);
                    finalDistractors.push(...dbDistractors);
                } catch (dbError: any) {
                     console.error('[StudyPage Container Distractors] DB fallback failed:', dbError);
                     if (!generationError) generationError = dbError.message ?? "DB fallback failed";
                }
            }
        }

        let selectedDistractors: string[] = [];
        const availableDistractors = [...new Set(finalDistractors)].filter(d => d !== correctCurrentAnswerText);
        if (item.lastIncorrectChoice && availableDistractors.includes(item.lastIncorrectChoice)) {
            selectedDistractors.push(item.lastIncorrectChoice);
            availableDistractors.splice(availableDistractors.indexOf(item.lastIncorrectChoice), 1);
        }
        while (selectedDistractors.length < requiredDistractors && availableDistractors.length > 0) {
             const randomIndex = Math.floor(Math.random() * availableDistractors.length);
             selectedDistractors.push(availableDistractors.splice(randomIndex, 1)[0]);
        }
        while (selectedDistractors.length < requiredDistractors) {
             selectedDistractors.push(`Placeholder ${String.fromCharCode(65 + selectedDistractors.length)}`);
             if (!generationError) generationError = "Not enough unique distractors found.";
        }

        console.log('[StudyPage Container Distractors] Final selected distractors:', selectedDistractors);
        return { distractors: selectedDistractors, error: generationError };
    }
  );

  // --- Memo for Final MCQ Props ---
  const mcqProps = createMemo<MCQProps | null>(() => {
    const itemData = dueItemResource();
    const distractorData = distractorResource();
    const direction = exerciseDirection();

    if (!itemData || dueItemResource.loading || !distractorData || distractorResource.loading || !distractorData.distractors) {
        return null;
    }

    const promptText = direction === 'EN_TO_NATIVE' ? itemData.sourceText : itemData.targetText;
    const correctAnswerText = direction === 'EN_TO_NATIVE' ? itemData.targetText : itemData.sourceText;

    const options: Option[] = distractorData.distractors.map((distractor, index) => ({
      id: index,
      text: distractor,
    }));

    const correctOptionId = Math.floor(Math.random() * (options.length + 1));
    options.splice(correctOptionId, 0, { id: correctOptionId, text: correctAnswerText });

    const finalOptions = options.map((opt, index) => ({ ...opt, id: index }));
    const finalCorrectId = finalOptions.find(opt => opt.text === correctAnswerText)?.id;

    if (finalCorrectId === undefined) {
        console.error("[StudyPage Container] Failed to determine correct option ID after shuffling!");
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
    console.log('[StudyPage Container] Generated Final MCQ Props:', props);
    return props;
  });

  // --- Handle MCQ Completion ---
  const handleMcqComplete = async (selectedOptionId: string | number, isCorrect: boolean) => {
    console.log(`[StudyPage Container] MCQ Complete. Correct: ${isCorrect}, Selected ID: ${selectedOptionId}`);
    const item = currentItem();
    if (!item) {
      console.error("[StudyPage Container] No current item found when MCQ completed.");
      setItemError("Error submitting review: Item not found.")
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

    console.log(`[StudyPage Container] Submitting review for Learning ID: ${item.learningId} with Grade: ${grade}. Incorrect choice: ${incorrectChoiceText ?? 'N/A'}`);

    try {
      const response = await messaging.sendMessage('submitReviewResult', {
        learningId: item.learningId,
        grade,
        incorrectChoiceText
      });
      console.log('[StudyPage Container] Submit review response:', response);
      if (!response.success) {
        setItemError(`Failed to submit review: ${response.error || 'Unknown error'}`);
        console.warn("[StudyPage Container] Review submission failed, but fetching next item.");
      }
      fetchDueItems();
    } catch (err: any) {
      console.error('[StudyPage Container] Error submitting review:', err);
      setItemError(`Error submitting review: ${err.message}`);
      fetchDueItems();
    }
  }

  // --- Render the View component ---
  return (
    <StudyPageView
        isLoadingItem={dueItemResource.loading}
        isLoadingDistractors={distractorResource.loading}
        mcqProps={mcqProps()}
        itemError={itemError()}
        distractorError={distractorResource()?.error ?? null}
        onSkipClick={fetchDueItems}
        onNavigateBack={props.onNavigateBack}
    />
  );
};

export default StudyPage; 