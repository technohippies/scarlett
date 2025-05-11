import { Component, Show } from 'solid-js';
import { MCQ } from '../../features/exercises/MCQ';
import type { MCQProps } from '../../features/exercises/MCQ';
import { Header } from '../../components/layout/Header';
import { Spinner } from '../../components/ui/spinner';

// Props interface for the StudyPageView
export interface StudyPageViewProps {
  isLoadingItem: boolean;
  isLoadingDistractors: boolean; // Separate loading state for distractors/MCQ props
  mcqProps: MCQProps | null; // The fully prepared props for the MCQ component
  itemError: string | null; // Error specifically from fetching the item
  distractorError: string | null; // Error specifically from generating distractors
  onSkipClick: () => void; // Callback for the skip button
  onNavigateBack: () => void; // Add navigation prop
}

// The purely presentational Study Page component
export const StudyPageView: Component<StudyPageViewProps> = (props) => {
  return (
    <div class="study-page-container flex flex-col font-sans bg-background min-h-screen">
      <Header onBackClick={props.onNavigateBack} />

      <div class="flex-grow flex flex-col items-center p-8 overflow-y-auto">
        {/* --- Loading / Error for Item Fetching --- */}
        <div class="h-10 mb-4 text-center">
          <Show when={props.isLoadingItem}>
            <div class="flex items-center justify-center text-foreground text-lg">
              <Spinner class="h-5 w-5 mr-2" />
            </div>
          </Show>
          <Show when={props.itemError}>
            {(errorMsg) => <p class="text-destructive font-semibold text-lg">Error: {errorMsg()}</p>}
          </Show>
        </div>

        {/* --- MCQ Area --- */}
        <div class="exercise-area mt-4 w-full max-w-md flex flex-col">
          <Show when={!props.isLoadingItem && !props.itemError}>
              <Show
                  when={!props.isLoadingDistractors}
                  fallback={
                      <div class="flex items-center justify-center text-foreground text-lg">
                        <Spinner class="h-5 w-5 mr-2" />
                      </div>
                  }
              >
                  <Show when={props.mcqProps}>
                      {(mcqPropsAccessor) => {
                          const mcq = mcqPropsAccessor();
                          return mcq ? (
                              <MCQ
                                  instructionText={mcq.instructionText}
                                  sentenceToTranslate={mcq.sentenceToTranslate}
                                  options={mcq.options}
                                  correctOptionId={mcq.correctOptionId}
                                  onComplete={mcq.onComplete}
                              />
                          ) : null;
                      }}
                  </Show>

                   <Show when={props.distractorError}>
                       {(errorMsg) => (
                          <p class="text-orange-600 font-semibold text-sm mt-2 text-center"> 
                              Warning: {errorMsg()} 
                          </p>
                       )}
                   </Show>

                   <Show when={!props.mcqProps && !props.distractorError && !props.isLoadingDistractors}> 
                       <p class="text-foreground text-lg text-center">
                          🎉 No items due for review right now! Great job! 🎉
                       </p>
                   </Show>
              </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}; 