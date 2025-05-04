import { Component, Show } from 'solid-js';
import { MCQ } from '../../features/exercises/MCQ';
import type { MCQProps } from '../../features/exercises/MCQ';

// Props interface for the StudyPageView
export interface StudyPageViewProps {
  isLoadingItem: boolean;
  isLoadingDistractors: boolean; // Separate loading state for distractors/MCQ props
  mcqProps: MCQProps | null; // The fully prepared props for the MCQ component
  itemError: string | null; // Error specifically from fetching the item
  distractorError: string | null; // Error specifically from generating distractors
  onSkipClick: () => void; // Callback for the skip button
  // onComplete is part of mcqProps, so no need to pass it separately
}

// The purely presentational Study Page component
export const StudyPageView: Component<StudyPageViewProps> = (props) => {
  return (
    <div class="study-page-container p-8 font-sans bg-background min-h-screen flex flex-col items-center">
      {/* --- Loading / Error for Item Fetching --- */}
      <div class="h-10 mb-4">
        <Show when={props.isLoadingItem}>
          <p class="text-foreground text-lg animate-pulse">Loading review item...</p>
        </Show>
        {/* Show item fetching error if it exists */}
        <Show when={props.itemError}>
          {(errorMsg) => <p class="text-red-600 font-semibold text-lg">Error: {errorMsg()}</p>}
        </Show>
      </div>

      {/* --- MCQ Area --- */}
      <div class="exercise-area mt-4 w-full max-w-md flex-grow flex flex-col justify-center">
        {/* Outer Show: Only proceed if item isn't loading and hasn't errored */}
        <Show when={!props.isLoadingItem && !props.itemError}>
            {/* Inner Show: Handle loading/display of MCQ/Distractors */}
            <Show
                when={!props.isLoadingDistractors}
                fallback={
                    // Show specific loading message only if item is loaded and not errored
                    <p class="text-foreground text-lg animate-pulse">Preparing exercise...</p>
                }
            >
                {/* Render MCQ when props are ready and no errors */}
                <Show when={props.mcqProps}>
                    {(mcqPropsAccessor) => {
                        const mcq = mcqPropsAccessor();
                        return mcq ? (
                            <MCQ
                                instructionText={mcq.instructionText}
                                sentenceToTranslate={mcq.sentenceToTranslate}
                                options={mcq.options}
                                correctOptionId={mcq.correctOptionId}
                                onComplete={mcq.onComplete} // Passed within mcqProps
                            />
                        ) : null;
                    }}
                </Show>

                 {/* Show distractor generation warning if it exists */}
                 <Show when={props.distractorError}>
                     {(errorMsg) => (
                        <p class="text-orange-600 font-semibold text-sm mt-2">
                            Warning: {errorMsg()}
                        </p>
                     )}
                 </Show>

                 {/* Show message if finished loading distractors but no MCQ props (e.g., no items due) */}
                 <Show when={!props.mcqProps && !props.distractorError}>
                     <p class="text-foreground text-lg text-center">
                        🎉 No items due for review right now! Great job! 🎉
                     </p>
                 </Show>
            </Show>
        </Show>
      </div>

      {/* --- Skip Button --- */}
      {/* Disable button if either item or distractors are loading */}
      <button
        onClick={props.onSkipClick}
        disabled={props.isLoadingItem || props.isLoadingDistractors}
        class="mt-8 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50 transition-colors"
      >
        {props.isLoadingItem || props.isLoadingDistractors ? 'Loading...' : 'Skip / Get Next'}
      </button>
    </div>
  );
}; 