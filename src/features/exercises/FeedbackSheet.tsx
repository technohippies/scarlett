import { Component, Show } from 'solid-js';
import { Sheet, SheetContent } from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { CheckCircle, XCircle } from 'phosphor-solid';

interface FeedbackSheetProps {
  isOpen: boolean;
  isCorrect: boolean;
  correctAnswerText?: string; // Used as body text when incorrect
  onContinue: () => void;
  onClose: () => void;
  title?: string; // Used ONLY when isCorrect is true
  continueLabel?: string;
}

export const FeedbackSheet: Component<FeedbackSheetProps> = (props) => {

  // Neutral background, keep colored border for subtle indication
  const baseSheetClass = "px-6 border-t-4"; // Removed pt/pb from here
  const correctBorder = "border-green-500";
  const incorrectBorder = "border-red-500";
  // Use a neutral background color from your theme, e.g., secondary or just background
  const neutralBgClass = "bg-secondary"; // Or bg-background, adjust as needed

  const sheetContentClass = () => cn(
    baseSheetClass,
    neutralBgClass, // Apply neutral background
    props.isCorrect ? correctBorder : incorrectBorder, // Apply colored border
    "pt-8 pb-8" // Apply padding here directly
  );

  // Button classes for filled look based on correctness (like Duolingo)
  const continueButtonClass = () => cn(
    "font-bold px-8", // Added px-8 for more width
    props.isCorrect
      ? "bg-green-500 text-white hover:bg-green-600" // Green filled button
      : "bg-red-500 text-white hover:bg-red-600" // Red filled button
  );

  // Determine title based on correctness
  const getTitleText = () => {
    if (props.isCorrect) {
      return props.title ?? "Correct!"; 
    } else {
      return "Correct solution:"; 
    }
  };
  
  // Title text color based on correctness
  const titleClass = () => cn(
    "text-2xl font-bold", // Changed from text-lg
    props.isCorrect ? "text-green-500" : "text-red-500"
  );

  const getContinueLabel = () => props.continueLabel ?? "Continue";
  // Increased icon size
  const iconSizeClass = "h-20 w-20"; // Changed from h-16 w-16

  return (
    <Sheet open={props.isOpen} onOpenChange={props.onClose}>
      <SheetContent
        position="bottom"
        class={sheetContentClass()} // Apply neutral bg + colored border
      >
          {/* Main content block: centered, max-width, flex row, align items center */}
          <div class="w-full max-w-2xl mx-auto flex flex-row items-center gap-5 text-left">
              {/* Icon Column: Takes space */}
              <div class="flex-shrink-0">
                  <Show
                    when={props.isCorrect}
                    fallback={<XCircle weight="duotone" class={cn(iconSizeClass, "text-red-500")} />}
                  >
                    <CheckCircle weight="duotone" class={cn(iconSizeClass, "text-green-500")} />
                  </Show>
              </div>

              {/* Text and Button Column: Takes remaining space, arranges items horizontally */}
              <div class="flex-grow flex flex-row items-center justify-between gap-4">
                  {/* Text Block */}
                  <div class="flex flex-col">
                      <h2 class={titleClass()}>{getTitleText()}</h2>

                      {/* Display correct answer text ONLY if incorrect */}
                      <Show when={!props.isCorrect && props.correctAnswerText}>
                        {/* Use default foreground color for better readability on neutral bg */}
                        <p class="text-xl text-foreground">{props.correctAnswerText}</p> 
                      </Show>
                  </div>

                  {/* Button Block */}
                  <div class="flex-shrink-0">
                      <Button
                        size="xxl" // Changed from xl to xxl
                        class={continueButtonClass()} // Apply dynamic filled style
                        onClick={() => {
                            props.onContinue();
                        }}
                      >
                        {getContinueLabel()}
                      </Button>
                  </div>
              </div>
          </div>
      </SheetContent>
    </Sheet>
  );
};