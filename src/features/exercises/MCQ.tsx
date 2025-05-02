import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { ExerciseFooter } from './ExerciseFooter';

// Renamed interface
interface MCQProps {
  sentenceToTranslate: string;
  instructionText?: string;
  options: { id: string | number; text: string }[];
  correctOptionId: string | number;
  onCheck: (isCorrect: boolean) => void;
  onContinue: () => void;
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
    props.onCheck(correct);

    if (!correct) {
      const correctOption = props.options.find(opt => opt.id === props.correctOptionId);
      setCorrectAnswerText(correctOption?.text);
    } else {
      setCorrectAnswerText(undefined);
    }
    setShowFeedback(true);
  };

  const handleContinue = () => {
      setShowFeedback(false);
      setFeedbackCorrectness(undefined);
      setCorrectAnswerText(undefined);
      setSelectedOptionId(undefined);
      props.onContinue();
  }

  return (
    <div class="relative flex flex-col h-full bg-background text-foreground">
      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-12 md:p-8 md:pt-16 pb-40">
        
        <div class="w-full max-w-md mb-8">
          <p class="text-lg font-semibold mb-4">{props.instructionText ?? "Translate:"}</p>
          <p class="text-xl md:text-2xl">{props.sentenceToTranslate}</p>
        </div>

        <div class="grid grid-cols-1 gap-4 w-full max-w-md mb-6">
          <For each={props.options}>
            {(option) => (
              <Button
                variant={selectedOptionId() === option.id ? "secondary" : "outline"}
                class="w-full justify-start h-14 text-lg pl-4"
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