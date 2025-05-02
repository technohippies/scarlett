import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';

// Define props for the component
interface TranslateProps {
  sentenceToTranslate: string;
  options: { id: string | number; text: string }[];
  correctOptionId: string | number;
  onCheck: (isCorrect: boolean) => void; // Callback when the user checks their answer
  checkLabel?: string; // Optional label for the check button
}

export const Translate: Component<TranslateProps> = (props) => {
  const [selectedOptionId, setSelectedOptionId] = createSignal<string | number | undefined>();
  const [showResult, setShowResult] = createSignal(false);
  const [isCorrect, setIsCorrect] = createSignal(false);

  const handleOptionClick = (optionId: string | number) => {
    if (showResult()) return; // Don't allow changing selection after checking
    setSelectedOptionId(optionId);
  };

  const handleCheck = () => {
    const correct = selectedOptionId() === props.correctOptionId;
    setIsCorrect(correct);
    setShowResult(true);
    props.onCheck(correct);
  };

  // Determine button label - could be expanded for "Continue" after correct, etc.
  const getButtonLabel = () => {
    return props.checkLabel || 'Check'; // Default to 'Check'
  };

  // Determine result message and styling
  const getResultFeedback = () => {
    if (!showResult()) return null;
    return isCorrect() ? (
      <div class="text-green-500 font-bold mt-4">Correct!</div>
    ) : (
      <div class="text-red-500 font-bold mt-4">Incorrect.</div>
    );
  };

  const getOptionClass = (optionId: string | number) => {
    const baseClass = 'h-auto p-4 flex items-center text-base border cursor-pointer w-full text-left';
    const hoverClass = 'hover:bg-neutral-700 hover:border-neutral-600';
    const focusClass = 'focus:outline-none focus:ring-1 focus:ring-primary';
    const selectedClass = 'bg-neutral-800 text-foreground border-neutral-700';
    const defaultBorder = 'border-neutral-700';

    // Result state styling
    if (showResult()) {
      if (optionId === props.correctOptionId) {
        return cn(baseClass, 'bg-green-800 border-green-600 text-white'); // Correct answer highlighted green
      }
      if (optionId === selectedOptionId() && !isCorrect()) {
        return cn(baseClass, 'bg-red-800 border-red-600 text-white'); // Incorrect selection highlighted red
      }
       // Non-selected, non-correct options get disabled/faded look
      return cn(baseClass, 'border-neutral-600 text-neutral-500 cursor-not-allowed');
    }

    // Default state styling
    return cn(
      baseClass,
      hoverClass,
      focusClass,
      selectedOptionId() === optionId ? selectedClass : defaultBorder
    );
  };


  return (
    // Mimicking Language.tsx layout: flex-col, h-full, sticky footer
    <div class="relative flex flex-col h-full bg-background text-foreground">
      {/* Content Area */}
      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-12 md:p-8 md:pt-16"> {/* Adjust padding as needed */}
        
        {/* Instruction/Sentence Area */}
        <div class="w-full max-w-md mb-8">
          <p class="text-lg font-semibold mb-4">Translate:</p>
          <p class="text-xl md:text-2xl">{props.sentenceToTranslate}</p>
        </div>

        {/* Options Area */}
        <div class="grid grid-cols-1 gap-4 w-full max-w-md mb-6">
          <For each={props.options}>
            {(option) => (
              <button
                onClick={() => handleOptionClick(option.id)}
                disabled={showResult()} // Disable after checking
                class={getOptionClass(option.id)}
              >
                <span>{option.text}</span>
              </button>
            )}
          </For>
        </div>

        {/* Result Feedback Area */}
        <div class="w-full max-w-md h-8"> {/* Reserve space for feedback */}
          {getResultFeedback()}
        </div>

      </div>

      {/* Footer Area: Sticky Button */}
      <div class="flex-shrink-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center">
        <div class="w-full max-w-xs">
          <Button
            size="lg"
            class="w-full"
            onClick={handleCheck}
            disabled={selectedOptionId() === undefined || showResult()} // Disable if no selection or already checked
          >
            {getButtonLabel()}
          </Button>
        </div>
      </div>
    </div>
  );
};