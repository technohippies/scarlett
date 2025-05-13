import { Component, Show, Switch, Match } from 'solid-js';
import { MCQ, type MCQProps } from '../../features/exercises/MCQ';
import FlashcardReviewer, { type ReviewableCardData } from '../../features/exercises/Flashcard';
import type { FlashcardStatus } from '../../services/db/types';
import { Header } from '../../components/layout/Header';
import { Spinner } from '../../components/ui/spinner';
import { Rating } from 'ts-fsrs';

// Props interface for the StudyPageView
export interface StudyPageViewProps {
  isLoadingItem: boolean;
  isLoadingDistractors: boolean;
  isFetchingNextItem: boolean;
  spinnerVisible: boolean;
  itemError: string | null;
  distractorError: string | null;
  onSkipClick: () => void;
  onNavigateBack: () => void;

  currentStudyStep: 'flashcard' | 'mcq' | 'noItem';
  itemForFlashcardReviewer: ReviewableCardData | null;
  flashcardStatus: FlashcardStatus;
  onFlashcardRated: (rating: Rating) => void;
  mcqProps: MCQProps | null;
}

// The purely presentational Study Page component
export const StudyPageView: Component<StudyPageViewProps> = (props) => {
  return (
    <div class="study-page-container flex flex-col font-sans bg-background min-h-screen">
      <Header onBackClick={props.onNavigateBack} />

      <div class="flex-grow flex flex-col items-center p-4 md:p-8 overflow-y-auto">
        <Switch>
          <Match when={props.spinnerVisible}>
            <div class="h-10 mb-4 text-center flex items-center justify-center text-foreground text-lg">
              <Spinner class="h-5 w-5 mr-2" /> Loading Item...
            </div>
          </Match>
          <Match when={!props.isFetchingNextItem}>
            {/* --- Item Error Display (only if not fetching next and error exists) --- */}
            <Show when={props.currentStudyStep === 'noItem' && props.itemError}>
              {(itemErrorAccessor) => (
                <div class="h-10 mb-4 text-center">
                  <p class="text-destructive font-semibold text-lg">Error: {itemErrorAccessor()}</p>
                </div>
              )}
            </Show>

            {/* --- Exercise Area (only if not fetching next and no item error, or if there is an item) --- */}
            <div class="exercise-area w-full max-w-md flex flex-col flex-grow">
              <Switch fallback={
                // Fallback for the main exercise switch: No items due, only if not loading item and no error
                <Show when={!props.isLoadingItem && !props.itemError && props.currentStudyStep === 'noItem'}>
                     <p class="text-foreground text-lg text-center">
                        🎉 No items due for review right now! Great job! 🎉
                     </p>
                </Show>
              }>
                <Match when={props.currentStudyStep === 'flashcard' && props.itemForFlashcardReviewer !== null}>
                  <FlashcardReviewer 
                    card={props.itemForFlashcardReviewer!} 
                    status={props.flashcardStatus} 
                    onFlashcardRated={props.onFlashcardRated} 
                  />
                </Match>

                <Match when={props.currentStudyStep === 'mcq'}>
                  <Show 
                    when={!props.isLoadingDistractors && props.mcqProps !== null} 
                    fallback={
                      <div class="flex items-center justify-center text-foreground text-lg">
                        <Spinner class="h-5 w-5" /> {/* Spinner for loading MCQ distractors */}
                      </div>
                    }
                  >
                    <MCQ {...props.mcqProps!} />
                    <Show when={props.distractorError}>
                        {(error) => 
                            <p class="text-orange-600 font-semibold text-sm mt-2 text-center">
                                Warning (MCQ): {error()}
                            </p>
                        }
                    </Show>
                  </Show>
                </Match>
              </Switch>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  );
}; 