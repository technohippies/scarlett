import { Component, createSignal } from 'solid-js';
import { Button } from '../../components/ui/button';
import FlashcardDisplay from '../../shared/flashcard'; 
import { Rating } from 'ts-fsrs';
import type { FlashcardStatus } from '../../services/db/types';

export interface ReviewableCardData {
  id: number | string; 
  front: string;
  back: string | null;
}

export interface FlashcardReviewerProps {
  card: ReviewableCardData;
  status: FlashcardStatus; 
  onFlashcardRated: (rating: Rating) => void; 
  initialIsAnswerShown?: boolean;
}

const FlashcardReviewer: Component<FlashcardReviewerProps> = (props) => {
  const [isAnswerShown, setIsAnswerShown] = createSignal(props.initialIsAnswerShown ?? false);

  const handleShowAnswer = () => {
    setIsAnswerShown(true);
  };

  const handleRatingClick = (rating: Rating) => {
    props.onFlashcardRated(rating);
    setIsAnswerShown(false); 
  };

  return (
    <div class="flex flex-col items-center gap-6 w-full max-w-md mx-auto p-4">
      <div class="w-full">
        <FlashcardDisplay
          front={props.card.front}
          back={isAnswerShown() ? (props.card.back ?? undefined) : undefined}
          status={props.status}
        />
      </div>

      {!isAnswerShown() ? (
        <Button
          variant="secondary"
          class="w-full justify-center"
          onClick={handleShowAnswer}
          size="lg"
        >
          Show
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
    </div>
  );
};

export default FlashcardReviewer; 