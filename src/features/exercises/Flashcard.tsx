import { Component, createSignal, createEffect } from 'solid-js';
import FlashcardDisplay from '../../shared/flashcard'; 
import { Rating } from 'ts-fsrs';
import type { FlashcardStatus } from '../../services/db/types';
import { ExerciseFooter } from './ExerciseFooter';
import { Motion } from 'solid-motionone';

export interface ReviewableCardData {
  id: number | string; 
  front: string;
  back: string | null;
  initialIsAnswerShown?: boolean;
}

export interface FlashcardReviewerProps {
  card: ReviewableCardData;
  status: FlashcardStatus; 
  onFlashcardRated: (rating: Rating) => void; 
  initialIsAnswerShown?: boolean;
}

// Define transition settings similar to MCQ.tsx
const transitionSettings = { duration: 0.3, easing: "ease-in-out" } as const;

export const FlashcardReviewer: Component<FlashcardReviewerProps> = (props) => {
  console.log('[FlashcardReviewer LIFECYCLE] Component init/render');
  // onCleanup(() => console.log('[FlashcardReviewer LIFECYCLE] Component unmounted'));

  const [isAnswerShown, setIsAnswerShown] = createSignal(props.initialIsAnswerShown ?? false);

  createEffect(() => {
    const mode = isAnswerShown() ? 'flashcardRate' : 'flashcardShowAnswer';
    console.log(`[FlashcardReviewer STATE_EFFECT] isAnswerShown changed: ${isAnswerShown()}. Calculated mode for footer: ${mode}`);
  });

  const handleShowAnswer = () => {
    console.log('[FlashcardReviewer FN_CALL] handleShowAnswer');
    setIsAnswerShown(true);
  };

  const handleRatingClick = (rating: Rating) => {
    console.log(`[FlashcardReviewer FN_CALL] handleRatingClick START - Rating: ${rating}`);
    if (rating === Rating.Again || rating === Rating.Good) {
      props.onFlashcardRated(rating);
      console.log('[FlashcardReviewer FN_CALL] handleRatingClick - Called props.onFlashcardRated');
      setIsAnswerShown(false); 
    } else {
      console.warn(`[FlashcardReviewer FN_CALL] handleRatingClick - Unexpected rating: ${rating}`);
    }
    console.log('[FlashcardReviewer FN_CALL] handleRatingClick END');
  };

  // Approximate footer height for padding, e.g. 8rem (128px) for pb-32
  const footerClearancePaddingBottom = "pb-32"; // Padding for the content to clear the footer
  const contentPaddingTop = "pt-4"; // Top padding for the content area

  return (
    <div class="relative flex flex-col h-full w-full">
      {/* Wrap the main content area with Motion for animation */}
      <Motion
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionSettings}
        class="flex-grow flex flex-col items-center justify-center overflow-y-auto"
      >
        <div class={`w-full max-w-md ${contentPaddingTop} ${footerClearancePaddingBottom}`}>
          <FlashcardDisplay
            front={props.card.front}
            back={isAnswerShown() ? (props.card.back ?? undefined) : undefined}
            status={props.status}
          />
        </div>
      </Motion> {/* End of Motion wrapper */}

      <ExerciseFooter
        mode={isAnswerShown() ? 'flashcardRate' : 'flashcardShowAnswer'}
        onShowAnswer={handleShowAnswer}
        onRate={handleRatingClick}
      />
    </div>
  );
};

export default FlashcardReviewer; 