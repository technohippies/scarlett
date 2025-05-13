import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { ExerciseFooter } from './ExerciseFooter';

// Define and export the Option type
export interface Option {
  id: string | number;
  text: string;
}

// Export the props interface
export interface MCQProps {
  sentenceToTranslate: string;
  instructionText?: string;
  options: Option[]; // Use the exported Option type
  correctOptionId: string | number;
  // Remove onCheck and onContinue, combine into onComplete
  onComplete: (selectedOptionId: string | number, isCorrect: boolean) => void;
}

export const MCQ: Component<MCQProps> = (props) => {
  const [selectedOptionId, setSelectedOptionId] = createSignal<string | number | undefined>();
  const [showFeedback, setShowFeedback] = createSignal(false);
  const [feedbackCorrectness, setFeedbackCorrectness] = createSignal<boolean | undefined>();
  const [correctAnswerText, setCorrectAnswerText] = createSignal<string | undefined>();

  const handleOptionClick = (optionId: string | number) => {
    if (showFeedback()) return;
    setSelectedOptionId(optionId);
  };

  const handleCheck = () => {
    const selectedId = selectedOptionId();
    if (selectedId === undefined) return;

    const correct = selectedId === props.correctOptionId;
    setFeedbackCorrectness(correct);
    // Call props.onCheck(correct); - Removed

    if (!correct) {
      const correctOption = props.options.find(opt => opt.id === props.correctOptionId);
      setCorrectAnswerText(correctOption?.text);
    } else {
      setCorrectAnswerText(undefined);
    }
    setShowFeedback(true);
  };

  // Modify handleContinue to call onComplete
  const handleContinue = () => {
      const selectedId = selectedOptionId();
      const correct = feedbackCorrectness();
      
      if (selectedId !== undefined && correct !== undefined) {
         props.onComplete(selectedId, correct);
      }
      
      // Reset state after calling onComplete
      setShowFeedback(false);
      setFeedbackCorrectness(undefined);
      setCorrectAnswerText(undefined);
      setSelectedOptionId(undefined);
      // props.onContinue(); - Removed
  }

  return (
    <div class="relative flex flex-col h-full bg-background text-foreground">
      <div class="flex-grow overflow-y-auto flex flex-col items-center pb-60">
        
        <div class="w-full max-w-md mb-8">
          <p class="text-lg font-semibold mb-4">{props.instructionText ?? "Translate:"}</p>
          <p class="text-xl md:text-2xl">{props.sentenceToTranslate}</p>
        </div>

        <div class="grid grid-cols-1 gap-4 w-full max-w-md mb-6">
          <For each={props.options}>
            {(option) => (
              <Button
                variant={selectedOptionId() === option.id ? "secondary" : "outline"}
                class={`w-full justify-start h-14 text-lg pl-4 ${selectedOptionId() === option.id ? 'border border-secondary' : ''}`}
                onClick={() => handleOptionClick(option.id)}
                disabled={showFeedback()}
              >
                {option.text}
              </Button>
            )}
          </For>
        </div>

      </div>

      <ExerciseFooter 
        mode={showFeedback() ? 'feedback' : 'check'}
        isCheckDisabled={selectedOptionId() === undefined}
        onCheck={handleCheck}
        checkLabel="Check"
        isCorrect={feedbackCorrectness() ?? false}
        correctAnswerText={correctAnswerText()}
        onContinue={handleContinue}
      />
    </div>
  );
};