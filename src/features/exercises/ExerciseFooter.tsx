import { Component, Show, Switch, Match, createEffect } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { CheckCircle, XCircle } from 'phosphor-solid';
import { Motion, Presence } from 'solid-motionone';
import { Rating } from 'ts-fsrs';

// Updated interface with flashcard modes and props
interface ExerciseFooterProps {
  mode: 'check' | 'feedback' | 'flashcardShowAnswer' | 'flashcardRate';
  // Feedback mode props
  isCorrect?: boolean;
  correctAnswerText?: string;
  onContinue?: () => void;
  title?: string; 
  continueLabel?: string;
  // Check mode props
  isCheckDisabled?: boolean;
  onCheck?: () => void;
  checkLabel?: string;
  // Flashcard Show Answer Mode props
  onShowAnswer?: () => void;
  showAnswerLabel?: string;
  // Flashcard Rate Mode props
  onRate?: (rating: Rating) => void;
  ratingLabels?: { // Updated for two buttons
    again: string;
    good: string;
  };
}

export const ExerciseFooter: Component<ExerciseFooterProps> = (props) => {
  console.log(`[ExerciseFooter LIFECYCLE] Component rendering/updating with mode: ${props.mode}`);
  // Add a more specific log for when the mode might cause the 'Check' button
  createEffect(() => {
    if (props.mode === 'check') {
      console.log(`[ExerciseFooter MODE_CHECK] Mode is 'check'. isCheckDisabled: ${props.isCheckDisabled}`);
    }
  });

  const baseFooterClass = "fixed bottom-0 left-0 right-0 w-full px-6 pt-6 pb-6 bg-secondary";
  const correctBorder = "border-t-4 border-green-500";
  const incorrectBorder = "border-t-4 border-red-500";

  const footerContainerClass = () => cn(
    baseFooterClass,
    // Apply border only in MCQ feedback mode
    props.mode === 'feedback' && (props.isCorrect ? correctBorder : incorrectBorder) 
  );

  // === Feedback Mode Styles (for MCQ) ===
  const feedbackButtonClass = () => cn(
    "font-bold px-8", 
    props.isCorrect
      ? "bg-green-500 text-white hover:bg-green-600"
      : "bg-red-500 text-white hover:bg-red-600"
  );

  const getFeedbackTitleText = () => {
    if (props.isCorrect) {
      return props.title ?? "Correct!"; 
    } else {
      return "Correct solution:"; 
    }
  };
  
  const feedbackTitleClass = () => cn(
    "text-2xl font-bold",
    props.isCorrect ? "text-green-500" : "text-red-500"
  );

  const getFeedbackContinueLabel = () => props.continueLabel ?? "Continue";
  const iconSizeClass = "h-20 w-20";

  // === Check Mode / Flashcard Show Answer Mode Styles ===
  const getCheckLabel = () => props.checkLabel ?? "Check";
  const getShowAnswerLabel = () => props.showAnswerLabel ?? "Show";

  const transitionSettings = { duration: 0.25, easing: "ease-in-out" } as const;

  return (
    <div class={footerContainerClass()}>
      <div class="w-full max-w-2xl mx-auto min-h-20 flex items-center justify-center">
        <Presence exitBeforeEnter>
          {/* Switch to handle different modes */}
          <Switch>
            {/* === MCQ Feedback Mode === */}
            <Match when={props.mode === 'feedback'}>
              <div class="w-full flex flex-row items-center gap-5 text-left">
                <Motion
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={transitionSettings}
                  class="w-full flex flex-row items-center gap-5 text-left"
                >
                    <div class="flex-shrink-0">
                        <Show
                          when={props.isCorrect}
                          fallback={<XCircle weight="duotone" class={cn(iconSizeClass, "text-red-500")} />}
                        >
                          <CheckCircle weight="duotone" class={cn(iconSizeClass, "text-green-500")} />
                        </Show>
                    </div>
                    <div class="flex-grow flex flex-row items-center justify-between gap-4">
                        <div class="flex flex-col">
                            <h2 class={feedbackTitleClass()}>{getFeedbackTitleText()}</h2>
                            <Show when={!props.isCorrect && props.correctAnswerText}>
                              <p class="text-xl text-foreground">{props.correctAnswerText}</p> 
                            </Show>
                        </div>
                        <div class="flex-shrink-0">
                            <Button
                              size="xxl"
                              class={feedbackButtonClass()}
                              onClick={props.onContinue}
                            >
                              {getFeedbackContinueLabel()}
                            </Button>
                        </div>
                    </div>
                </Motion>
              </div>
            </Match>

            {/* === MCQ Check Mode === */}
            <Match when={props.mode === 'check'}>
              <Motion
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={transitionSettings}
                class="w-full max-w-md"
              >
                <Button 
                  size="xxl"
                  class="w-full" /* Full width button */
                  onClick={props.onCheck}
                  disabled={props.isCheckDisabled}
                >
                  {getCheckLabel()}
                </Button>
              </Motion>
            </Match>

            {/* === Flashcard Show Answer Mode === */}
            <Match when={props.mode === 'flashcardShowAnswer'}>
              <Motion
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={transitionSettings}
                class="w-full max-w-md"
              >
                <Button 
                  size="xxl" /* Same size as Check button */
                  class="w-full" /* Full width button */
                  onClick={props.onShowAnswer}
                >
                  {getShowAnswerLabel()}
                </Button>
              </Motion>
            </Match>

            {/* === Flashcard Rate Mode === */}
            <Match when={props.mode === 'flashcardRate'}>
              <Motion
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={transitionSettings}
                class="w-full max-w-md" /* Max width for the container of 2 buttons */
              >
                {/* Changed to 2-column grid for two buttons */}
                <div class="grid grid-cols-2 gap-4 w-full"> 
                  <Button
                    size="xxl" /* Match Check button size */
                    class="justify-center" /* Center text within the button */
                    // Variant should match Check button (default or primary)
                    onClick={() => props.onRate?.(Rating.Again)}
                    title="Rate as Again"
                  >
                    {props.ratingLabels?.again ?? "Again"}
                  </Button>
                  <Button
                    size="xxl" /* Match Check button size */
                    class="justify-center" /* Center text within the button */
                    // Variant should match Check button (default or primary)
                    onClick={() => props.onRate?.(Rating.Good)}
                    title="Rate as Good"
                  >
                    {props.ratingLabels?.good ?? "Good"}
                  </Button>
                </div>
              </Motion>
            </Match>
          </Switch>
        </Presence>
      </div>
    </div>
  );
};