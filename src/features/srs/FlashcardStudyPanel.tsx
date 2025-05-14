import { Component } from 'solid-js';
import { Button } from '../../components/ui/button';
import { BookOpen } from 'phosphor-solid';
import type { Messages } from '../../types/i18n';

export interface FlashcardStudyPanelProps {
  dueCount?: number;
  reviewCount?: number;
  newCount?: number;
  onStudyClick: () => void;
  class?: string;
  messages?: Messages | undefined;
}

export const FlashcardStudyPanel: Component<FlashcardStudyPanelProps> = (props) => {
  const i18n = () => {
    const msgs = props.messages;
    return {
      get: (key: string, fallback: string) => msgs?.[key]?.message || fallback,
    };
  };

  // Keep counts even if zero
  const newCount = () => props.newCount ?? 0;
  const reviewCount = () => props.reviewCount ?? 0;
  const dueCount = () => props.dueCount ?? 0;

  return (
    <div class={`flex flex-col gap-4 ${props.class ?? ''}`}>
      {/* Counts Container: Removed mt-2, mb-4 */}
      <div class="flex items-start justify-between gap-2 md:gap-3">
          {/* Box 1: New Count - Added min-w, text-center */}
          <div class="flex-1 bg-secondary p-2 rounded text-center min-w-16">
            <span class="block text-lg font-semibold text-blue-400">{newCount()}</span>
            <span class="block text-xs md:text-sm text-muted-foreground">{i18n().get('flashcardPanelLabelNew', 'New')}</span>
          </div>

          {/* Box 2: Review Count - Added min-w, text-center */}
          <div class="flex-1 bg-secondary p-2 rounded text-center min-w-16">
            <span class="block text-lg font-semibold text-green-400">{reviewCount()}</span>
            <span class="block text-xs md:text-sm text-muted-foreground">{i18n().get('flashcardPanelLabelReview', 'Review')}</span>
          </div>

          {/* Box 3: Due Count - Added min-w, text-center */}
          <div class="flex-1 bg-secondary p-2 rounded text-center min-w-16">
             <span class="block text-lg font-semibold text-red-400">{dueCount()}</span>
             <span class="block text-xs md:text-sm text-muted-foreground">{i18n().get('flashcardPanelLabelDue', 'Due')}</span>
          </div>
      </div>

      {/* Study Button */}
      <Button 
        size="xl"
        class={`w-full flex items-center justify-center gap-2`}
        onClick={props.onStudyClick}
      >
        <BookOpen size={18} weight="fill" /> 
        {i18n().get('flashcardPanelButtonStudy', 'Study')}
      </Button>
    </div>
  );
}; 