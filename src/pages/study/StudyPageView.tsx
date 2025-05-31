import { Component, Show, Switch, Match, createEffect } from 'solid-js';
import { MCQ, type MCQProps } from '../../features/exercises/MCQ';
import FlashcardReviewer, { type ReviewableCardData } from '../../features/exercises/Flashcard';
import type { FlashcardStatus } from '../../services/db/types';
import { Header } from '../../components/layout/Header';
import { Spinner } from '../../components/ui/spinner';
import { Rating } from 'ts-fsrs';
import type { Messages } from '../../types/i18n';

// Props interface for the StudyPageView
export interface StudyPageViewProps {
  isLoadingItem: boolean;
  isLoadingDistractors: boolean;
  isFetchingNextItem: boolean;
  spinnerVisible: boolean;
  initialLoadComplete: boolean;
  itemError: string | null;
  distractorError: string | null;
  onSkipClick: () => void;
  onNavigateBack: () => void;

  currentStudyStep: 'flashcard' | 'mcq' | 'noItem';
  itemForFlashcardReviewer: ReviewableCardData | null;
  flashcardStatus: FlashcardStatus;
  onFlashcardRated: (rating: Rating) => void;
  mcqProps: MCQProps | null;
  messages?: Messages;
}

// The purely presentational Study Page component
export const StudyPageView: Component<StudyPageViewProps> = (props) => {
  console.log('[StudyPageView LIFECYCLE] Component rendering/updating');

  // Local i18n helper function
  const i18n = () => {
    const msgs = props.messages;
    return {
      get: (key: string, fallback: string) => msgs?.[key]?.message || fallback,
    };
  };

  createEffect(() => {
    console.log(`[StudyPageView PROPS] isFetchingNextItem: ${props.isFetchingNextItem}, spinnerVisible: ${props.spinnerVisible}, currentStudyStep: ${props.currentStudyStep}, itemError: ${props.itemError}`);
  });
  
  createEffect(() => {
    if (props.currentStudyStep === 'flashcard' && props.itemForFlashcardReviewer !== null) {
      console.log('[StudyPageView RENDER_MATCH] Matched: Flashcard');
    }
  });

  createEffect(() => {
    if (props.currentStudyStep === 'mcq') {
      console.log('[StudyPageView RENDER_MATCH] Matched: MCQ');
    }
  });
  
  createEffect(() => {
    if (props.currentStudyStep === 'noItem' && !props.itemError && !props.isLoadingItem) {
      console.log('[StudyPageView RENDER_MATCH] Matched: No items due message');
    }
  });

  createEffect(() => {
    if (props.spinnerVisible) {
        console.log('[StudyPageView RENDER_MATCH] Matched: Loading spinner (main)');
    }
  });

  createEffect(() => {
    if (props.currentStudyStep === 'noItem' && props.itemError) {
        console.log('[StudyPageView RENDER_MATCH] Matched: Item error display');
    }
  });

  return (
    <div class="study-page-container flex flex-col font-sans bg-background min-h-screen">
      <Header onBackClick={props.onNavigateBack} />

      <div class="flex-grow flex flex-col items-center pt-4 px-4 md:pt-8 md:px-8 pb-0 overflow-y-auto">
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
                // Fallback for the main exercise switch:
                // Show "No items due" only if initial load is complete, not loading, no error, and noItem step
                <Show when={props.initialLoadComplete && !props.isLoadingItem && !props.itemError && props.currentStudyStep === 'noItem'}>
                     <div class="flex flex-col items-center justify-end flex-grow text-center">
                        {/* Speech Bubble */}
                        <div class="bg-neutral-200 text-neutral-900 px-6 py-3 rounded-lg shadow-md mb-3 max-w-xs">
                            <p class="text-xl">
                                {i18n().get('studyPageCompletedMessage', 'Completed!')}
                            </p>
                        </div>
                        <img 
                            src="/images/scarlett-proud-512x512.png" 
                            alt="Scarlett Proud" 
                            class="w-128 h-128" // Respecting user-defined size
                        />
                     </div>
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