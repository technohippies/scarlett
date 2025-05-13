import { Component, createSignal, Show, Match, Switch } from 'solid-js';
import Flashcard from '../../shared/flashcard'; // UNCOMMENTED
import { Button } from '../../components/ui/button'; // Corrected path
import { MCQ } from './MCQ'; // Assuming MCQ.tsx is in the same directory
import type { Option as McqOption } from './MCQ'; // Import Option type from MCQ
import { type Flashcard as FlashcardDbType, type FlashcardStatus } from '../../services/db/types'; // Corrected path
import { Rating } from 'ts-fsrs';

interface MCQData {
  type: 'mcq';
  question: string;
  options: string[]; // Raw options from DB
  correct_index: number;
}

export interface FlashcardReviewerProps {
  card: FlashcardDbType;
  status: FlashcardStatus;
  onReview: (rating: Rating) => void;
  initialIsAnswerShown?: boolean;
}

const FlashcardReviewer: Component<FlashcardReviewerProps> = (props) => {
  const [isAnswerShown, setIsAnswerShown] = createSignal(props.initialIsAnswerShown ?? false);

  const handleShowAnswer = () => {
    setIsAnswerShown(true);
  };

  const handleRatingClick = (rating: Rating) => {
    console.log(`[Reviewer] Rating selected: ${Rating[rating]}`);
    props.onReview(rating);
  };

  const getMCQData = (): MCQData | null => {
    if (props.card.exercise_type === 'mcq' && props.card.exercise_data) {
      try {
        const parsed = JSON.parse(props.card.exercise_data);
        if (parsed && parsed.type === 'mcq' && parsed.question && Array.isArray(parsed.options) && typeof parsed.correct_index === 'number') {
          return parsed as MCQData;
        }
      } catch (e) {
        console.error('[Reviewer] Failed to parse MCQ exercise_data:', e, props.card.exercise_data);
      }
    }
    return null;
  };

  const handleMcqComplete = (selectedOptionId: string | number, isCorrect: boolean) => {
    const rating = isCorrect ? Rating.Good : Rating.Again;
    props.onReview(rating);
  };

  return (
    <div class="flex flex-col items-center gap-6 w-full max-w-sm mx-auto p-4">
      <Switch fallback={
        <Flashcard  // UNCOMMENTED and using the new props structure
          front={props.card.front ?? '?'}
          back={isAnswerShown() ? (props.card.back ?? undefined) : undefined} // Pass undefined if not shown or no back text
          status={props.status}
          // newCount, reviewCount, dueCount are not passed from here
          // as FlashcardReviewer focuses on a single card, not summary data.
        />
      }>
        <Match when={props.card.exercise_type === 'mcq' && getMCQData()}>
          {(mcqData) => {
            // Map string options to McqOption[]
            const mcqOptions: McqOption[] = mcqData().options.map((optText, index) => ({
              id: index, // Use index as ID, or ensure exercise_data provides unique IDs
              text: optText,
            }));
            const correctOptionId = mcqData().correct_index;

            return (
              <MCQ
                instructionText="Select the correct answer:" // Default instruction
                sentenceToTranslate={mcqData().question}
                options={mcqOptions}
                correctOptionId={correctOptionId}
                onComplete={handleMcqComplete} // Use the adapted handler
              />
            );
          }}
        </Match>
        <Match when={props.card.type === 'cloze' || props.card.exercise_type === 'cloze'}>
          <div>
            <p><strong>Cloze Card (Not Implemented)</strong></p>
            <pre>{props.card.cloze_text ?? 'No cloze text found'}</pre>
            <Show when={isAnswerShown()}>
              <p>Answer Shown Area (TODO)</p>
            </Show>
          </div>
        </Match>
      </Switch>

      <Show when={props.card.exercise_type !== 'mcq' || !getMCQData()}>
        {!isAnswerShown() ? (
          <Button
            variant="default"
            class="w-full justify-center"
            onClick={handleShowAnswer}
            size="lg"
          >
            Show Answer
          </Button>
        ) : (
          <div class="grid grid-cols-4 gap-2 w-full">
            <Button
              variant="secondary"
              class="justify-center"
              onClick={() => handleRatingClick(Rating.Again)}
              size="lg"
              title="Rate as Again (1)"
            >
              Again
            </Button>
            <Button
              variant="secondary"
              class="justify-center"
              onClick={() => handleRatingClick(Rating.Hard)}
              size="lg"
              title="Rate as Hard (2)"
            >
              Hard
            </Button>
            <Button
              variant="secondary"
              class="justify-center"
              onClick={() => handleRatingClick(Rating.Good)}
              size="lg"
              title="Rate as Good (3)"
            >
              Good
            </Button>
            <Button
              variant="secondary"
              class="justify-center"
              onClick={() => handleRatingClick(Rating.Easy)}
              size="lg"
              title="Rate as Easy (4)"
            >
              Easy
            </Button>
          </div>
        )}
      </Show>
    </div>
  );
};

export default FlashcardReviewer; 