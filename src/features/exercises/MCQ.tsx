import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { ExerciseFooter } from './ExerciseFooter';
import { Motion } from 'solid-motionone';

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
  onComplete: (selectedOptionId: string | number, isCorrect: boolean) => void;
}

const transitionSettings = { duration: 0.3, easing: "ease-in-out" } as const;

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

    if (!correct) {
      const correctOption = props.options.find(opt => opt.id === props.correctOptionId);
      setCorrectAnswerText(correctOption?.text);
    } else {
      setCorrectAnswerText(undefined);
    }
    setShowFeedback(true);
  };

  const handleContinue = () => {
      const selectedId = selectedOptionId();
      const correct = feedbackCorrectness();
      
      if (selectedId !== undefined && correct !== undefined) {
         props.onComplete(selectedId, correct);
      }
      
      setShowFeedback(false);
      setFeedbackCorrectness(undefined);
      setCorrectAnswerText(undefined);
      setSelectedOptionId(undefined);
  }

  return (
    <div class="relative flex flex-col h-full bg-background text-foreground">
      <Motion
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionSettings}
        class="flex-grow overflow-y-auto flex flex-col items-center pb-60"
      >
        <div class="w-full max-w-md mb-8 pt-6">
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
      </Motion>

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