import { Component, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { CheckCircle, XCircle } from 'phosphor-solid';
import { Motion, Presence } from 'solid-motionone';

// Renamed interface and updated props
interface ExerciseFooterProps {
  mode: 'check' | 'feedback';
  // Feedback mode props
  isCorrect?: boolean; // Required only for feedback mode
  correctAnswerText?: string;
  onContinue?: () => void; // Required only for feedback mode
  title?: string; 
  continueLabel?: string;
  // Check mode props
  isCheckDisabled?: boolean; // Required only for check mode
  onCheck?: () => void; // Required only for check mode
  checkLabel?: string;
}

// Renamed component
export const ExerciseFooter: Component<ExerciseFooterProps> = (props) => {

  // Base styles for the footer container
  const baseFooterClass = "fixed bottom-0 left-0 right-0 w-full px-6 pt-6 pb-6 bg-secondary"; // Added position fixed
  const correctBorder = "border-t-4 border-green-500";
  const incorrectBorder = "border-t-4 border-red-500";

  const footerContainerClass = () => cn(
    baseFooterClass,
    // Apply border only in feedback mode
    props.mode === 'feedback' && (props.isCorrect ? correctBorder : incorrectBorder) 
  );

  // === Feedback Mode Styles ===
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

  // === Check Mode Styles ===
  const getCheckLabel = () => props.checkLabel ?? "Check";

  const transitionSettings = { duration: 0.25, easing: "ease-in-out" } as const;

  return (
    <div class={footerContainerClass()}>
      <div class="w-full max-w-2xl mx-auto min-h-20 flex items-center justify-center">
        <Presence exitBeforeEnter>
          <Show 
            when={props.mode === 'feedback'}
            fallback={
              // === Check Mode Layout ===
              <div class="w-full flex items-center justify-center">
                <Motion
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={transitionSettings}
                  class="w-full max-w-md" // Apply max-width here
                >
                  <Button 
                    size="xxl"
                    class="w-full"
                    onClick={props.onCheck}
                    disabled={props.isCheckDisabled}
                  >
                    {getCheckLabel()}
                  </Button>
                </Motion>
              </div>
            }
          >
            {/* === Feedback Mode Layout === */}
            <div class="w-full flex flex-row items-center gap-5 text-left">
              <Motion
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={transitionSettings}
                class="w-full flex flex-row items-center gap-5 text-left"
              >
                  {/* Icon Column */} 
                  <div class="flex-shrink-0">
                      <Show
                        when={props.isCorrect}
                        fallback={<XCircle weight="duotone" class={cn(iconSizeClass, "text-red-500")} />}
                      >
                        <CheckCircle weight="duotone" class={cn(iconSizeClass, "text-green-500")} />
                      </Show>
                  </div>
                  {/* Text and Button Column */} 
                  <div class="flex-grow flex flex-row items-center justify-between gap-4">
                      {/* Text Block */} 
                      <div class="flex flex-col">
                          <h2 class={feedbackTitleClass()}>{getFeedbackTitleText()}</h2>
                          <Show when={!props.isCorrect && props.correctAnswerText}>
                            <p class="text-xl text-foreground">{props.correctAnswerText}</p> 
                          </Show>
                      </div>
                      {/* Button Block */} 
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
          </Show>
        </Presence>
      </div>
    </div>
  );
};