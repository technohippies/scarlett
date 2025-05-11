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
import type { MCQProps } from '../../features/exercises/MCQ';
import { userConfigurationStorage } from '../../services/storage/storage';

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
    async (deps): Promise<DistractorResourceData> => {
        const { item, direction } = deps;
        if (!item) return { distractors: null, error: null, forDirection: null, forTranslationId: null };

        // Fetch user settings to determine the correct native language for DB fallback
        let userNativeLangCode = 'vi'; // Default, will be overridden by user settings
        try {
            const userSettings = await userConfigurationStorage.getValue();
            if (userSettings && userSettings.nativeLanguage) {
                userNativeLangCode = userSettings.nativeLanguage;
            }
        } catch (settingsError) {
            console.warn('[StudyPage Container Distractors] Could not fetch user settings for DB fallback language, using default.', settingsError);
        }

        const correctAnswerForFiltering = direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText;
        const requiredDistractors = 3;
        let llmGeneratedDistractors: string[] = [];
        let generationError: string | null = null;

        // Correctly determine the word the user is asked to translate for logging
        const questionWordForLog = direction === 'EN_TO_NATIVE' ? item.targetText : item.sourceText;
        
        // optionsLangForLog is an approximation for logging, actual distractor lang is determined by backend
        const optionsLangForLog = direction === 'EN_TO_NATIVE' 
            ? getFullLanguageName(item.targetLang) // If EN_TO_NATIVE, item.targetLang is 'en', this log will say 'English' for options lang. Actual options are Native.
            : getFullLanguageName('en');    // If NATIVE_TO_EN, this log will say 'English' for options lang. Actual options are English.
                                        // This logging line is imperfect for optionsLangForLog but avoids needing userSettings here.
                                        // Backend logs are more accurate for distractor language chosen.

        console.log(`[StudyPage Container Distractors] Generating/fetching ${optionsLangForLog} distractors for [${direction}]: ${questionWordForLog}`);
        
        // LLM Generation Attempt
        console.log(`[StudyPage Container Distractors] Attempting LLM generation...`);
        try {
          const llmResponse = await messaging.sendMessage('generateLLMDistractors', {
            sourceText: item.sourceText,    
            targetText: item.targetText,    
            correctAnswerForFiltering: correctAnswerForFiltering,
            count: requiredDistractors,
            direction: direction
          });

          if (llmResponse.distractors && llmResponse.distractors.length > 0) {
            // LLM response is now directly an array of strings
            llmGeneratedDistractors = [...new Set(llmResponse.distractors)].filter(d => d !== correctAnswerForFiltering);
            console.log('[StudyPage Container Distractors] LLM generated distractors:', llmGeneratedDistractors);
            // Caching logic can be re-added here if desired later.
            // For now, focusing on the core LLM distractor flow.
          } else if (llmResponse.error) {
             console.warn('[StudyPage Container Distractors] LLM generation issue:', llmResponse.error);
             generationError = llmResponse.error;
          }
        } catch (llmError: any) {
          console.error('[StudyPage Container Distractors] LLM call failed:', llmError);
          generationError = llmError.message ?? "LLM call failed";
        }

        let finalDistractorsPool = [...llmGeneratedDistractors];

        // DB Fallback if LLM did not provide enough
        if (finalDistractorsPool.length < requiredDistractors) {
            console.log('[StudyPage Container Distractors] LLM provided insufficient distractors. Using DB fallback...');
            try {
                const neededFromDb = requiredDistractors - finalDistractorsPool.length;
                
                // Corrected DB distractor language logic
                let dbDistractorLangCode: string;
                if (direction === 'NATIVE_TO_EN') {
                    // User is translating Native to English, so distractors from DB should be English.
                    // item.targetLang should be 'en' in this case.
                    dbDistractorLangCode = item.targetLang; 
                } else { // EN_TO_NATIVE
                    // User is translating English to Native, so distractors from DB should be in the user's Native language.
                    dbDistractorLangCode = userNativeLangCode; 
                }
                
                console.log(`[StudyPage Container Distractors] DB Fallback: Requesting ${neededFromDb} distractors in lang code: ${dbDistractorLangCode} for targetLexemeId: ${item.targetLexemeId}`);

                const dbResponse = await messaging.sendMessage('getDistractorsForItem', {
                    correctTargetLexemeId: item.targetLexemeId, 
                    targetLanguage: dbDistractorLangCode, 
                    count: neededFromDb
                });
                const dbDistractors = dbResponse.distractors.filter(d => !finalDistractorsPool.includes(d) && d !== correctAnswerForFiltering);
                finalDistractorsPool.push(...dbDistractors);
                console.log('[StudyPage Container Distractors] DB Fallback added:', dbDistractors);
            } catch (dbError: any) {
                 console.error('[StudyPage Container Distractors] DB fallback failed:', dbError);
                 if (!generationError) generationError = dbError.message ?? "DB fallback failed";
            }
        }
        
        // Ensure we have the right number of distractors, add placeholders if necessary
        let selectedDistractors: string[] = [];
        const availableDistractors = [...new Set(finalDistractorsPool)].filter(d => d !== correctAnswerForFiltering);
        
        // Prefer last incorrect choice if available and distinct
        if (item.lastIncorrectChoice && availableDistractors.includes(item.lastIncorrectChoice) && item.lastIncorrectChoice !== correctAnswerForFiltering) {
            selectedDistractors.push(item.lastIncorrectChoice);
            availableDistractors.splice(availableDistractors.indexOf(item.lastIncorrectChoice), 1);
        }

        while (selectedDistractors.length < requiredDistractors && availableDistractors.length > 0) {
             const randomIndex = Math.floor(Math.random() * availableDistractors.length);
             selectedDistractors.push(availableDistractors.splice(randomIndex, 1)[0]);
        }
        
        // If still not enough, add placeholders (this part should ideally not be reached often with good LLM + DB fallback)
        let placeholderIndex = 0;
        while (selectedDistractors.length < requiredDistractors) {
             selectedDistractors.push(`Placeholder ${String.fromCharCode(65 + placeholderIndex++)}`);
             if (!generationError) generationError = "Not enough unique distractors found from LLM or DB.";
        }

        console.log('[StudyPage Container Distractors] Final selected distractors to combine with correct answer:', selectedDistractors);
        return {
            distractors: selectedDistractors.slice(0, requiredDistractors),
            error: generationError,
            forDirection: direction,
            forTranslationId: item.translationId
        };
    }
  );

  // --- Memo for Final MCQ Props ---
  const mcqProps = createMemo<MCQProps | null>(() => {
    const currentItemData = currentItem();
    const currentDirection = exerciseDirection();

    if (distractorResource.loading) {
        console.log('[StudyPage MCQ Props] Waiting: Distractors loading...');
        return null;
    }

    const currentDistractorInfo = distractorResource();

    if (
        !currentItemData || 
        !currentDistractorInfo ||
        !currentDistractorInfo.distractors ||
        currentDistractorInfo.forDirection !== currentDirection ||
        currentDistractorInfo.forTranslationId !== currentItemData.translationId
    ) {
        if (!currentItemData) console.log('[StudyPage MCQ Props] Waiting: No current item data.');
        else if (!currentDistractorInfo) console.log('[StudyPage MCQ Props] Waiting: No distractor info (resource might have errored or not resolved).');
        else if (!currentDistractorInfo.distractors) console.log('[StudyPage MCQ Props] Waiting: Distractor info present, but no distractors array.');
        else if (currentDistractorInfo.forDirection !== currentDirection) {
            console.log(`[StudyPage MCQ Props] Waiting: Stale distractors direction. ` +
                        `Expected dir: ${currentDirection} (got ${currentDistractorInfo.forDirection})`);
        } else if (currentDistractorInfo.forTranslationId !== currentItemData.translationId) {
            console.log(`[StudyPage MCQ Props] Waiting: Stale distractors TId. ` +
                        `Expected TId: ${currentItemData.translationId} (got ${currentDistractorInfo.forTranslationId})`);
        }
        return null;
    }

    // Determine the text to display for translation and the correct option text
    let sentenceToTranslateDisplay: string;
    let correctAnswerForOptionsList: string;

    if (currentDirection === 'EN_TO_NATIVE') {
        // User sees English, options are Native
        sentenceToTranslateDisplay = currentItemData.targetText;  // English word
        correctAnswerForOptionsList = currentItemData.sourceText; // Native word
    } else { // NATIVE_TO_EN
        // User sees Native, options are English
        sentenceToTranslateDisplay = currentItemData.sourceText;  // Native word
        correctAnswerForOptionsList = currentItemData.targetText; // English word
    }

    // currentDistractorInfo.distractors is now an array of strings from the resource, verified for current item/direction
    const receivedDistractors = currentDistractorInfo.distractors;

    // Combine correct answer with distractors
    const allOptionsRaw = [correctAnswerForOptionsList, ...receivedDistractors];
    const shuffledOptions = shuffleArray(allOptionsRaw);

    const finalOptions = shuffledOptions.map((text, index) => ({
        id: index,
        text: text,
    }));

    const correctOptionId = finalOptions.findIndex(opt => opt.text === correctAnswerForOptionsList);

    if (correctOptionId === -1) {
        console.error("[StudyPage MCQ Props] Correct answer not found in final shuffled options!", { correctAnswerForOptionsList, finalOptions });
        return null; // Should not happen
    }

    const props: MCQProps = {
      instructionText: "Translate:",
      sentenceToTranslate: sentenceToTranslateDisplay,
      options: finalOptions,
      correctOptionId: correctOptionId,
      onComplete: handleMcqComplete
    };
    console.log('[StudyPage Container] Generated Final MCQ Props:', JSON.stringify(props, null, 2));
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