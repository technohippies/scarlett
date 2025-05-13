import { Component, createSignal } from 'solid-js';
import FlashcardDisplay from '../../shared/flashcard'; 
import { Rating } from 'ts-fsrs';
import type { FlashcardStatus } from '../../services/db/types';
import { ExerciseFooter } from './ExerciseFooter';

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

export const FlashcardReviewer: Component<FlashcardReviewerProps> = (props) => {
  const [isAnswerShown, setIsAnswerShown] = createSignal(props.initialIsAnswerShown ?? false);

  const handleShowAnswer = () => {
    setIsAnswerShown(true);
  };

  const handleRatingClick = (rating: Rating) => {
    if (rating === Rating.Again || rating === Rating.Good) {
      props.onFlashcardRated(rating);
      setIsAnswerShown(false); 
    } else {
      console.warn(`[FlashcardReviewer] Unexpected rating received: ${rating}`);
    }
  };

  // Approximate footer height for padding, e.g. 8rem (128px) for pb-32
  const footerClearancePaddingBottom = "pb-32"; // Padding for the content to clear the footer
  const contentPaddingTop = "pt-4"; // Top padding for the content area

  return (
    <div class="relative flex flex-col h-full w-full">
      <div class="flex-grow flex flex-col items-center justify-center overflow-y-auto">
        <div class={`w-full max-w-md ${contentPaddingTop} ${footerClearancePaddingBottom}`}>
          <FlashcardDisplay
            front={props.card.front}
            back={isAnswerShown() ? (props.card.back ?? undefined) : undefined}
            status={props.status}
          />
        </div>
      </div>

      <ExerciseFooter
        mode={isAnswerShown() ? 'flashcardRate' : 'flashcardShowAnswer'}
        onShowAnswer={handleShowAnswer}
        onRate={handleRatingClick}
      />
    </div>
  );
};

export default FlashcardReviewer; 