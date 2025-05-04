import { Component } from 'solid-js';
import { Button } from '../../components/ui/button';
import { BookOpen } from 'phosphor-solid';

export interface FlashcardStudyPanelProps {
  dueCount?: number;
  reviewCount?: number;
  newCount?: number;
  onStudyClick: () => void;
  class?: string;
}

export const FlashcardStudyPanel: Component<FlashcardStudyPanelProps> = (props) => {
  // Keep counts even if zero
  const newCount = () => props.newCount ?? 0;
  const reviewCount = () => props.reviewCount ?? 0;
  const dueCount = () => props.dueCount ?? 0;

  return (
    <div class={`flex flex-col pb-3 ${props.class ?? ''}`}>
      {/* Counts Container: Adjust gap */}
      <div class="flex items-start gap-3 mt-2 mb-4"> 
          {/* Box 1: New Count */}
          {/* Added bg-secondary, p-2, rounded, text-left */}
          <div class="flex-1 bg-secondary p-2 rounded text-left">
            <span class="block text-lg font-semibold text-blue-400">{newCount()}</span>
            <span class="block text-sm text-muted-foreground">New</span>
          </div>

          {/* Box 2: Review Count */}
          <div class="flex-1 bg-secondary p-2 rounded text-left">
            <span class="block text-lg font-semibold text-green-400">{reviewCount()}</span>
            <span class="block text-sm text-muted-foreground">Review</span>
          </div>

          {/* Box 3: Due Count */}
          <div class="flex-1 bg-secondary p-2 rounded text-left">
             <span class="block text-lg font-semibold text-red-400">{dueCount()}</span>
             <span class="block text-sm text-muted-foreground">Due</span>
          </div>
      </div>

      {/* Study Button */}
      <Button 
        variant="default" 
        size="sm" 
        class={`w-full`}
        onClick={props.onStudyClick}
      >
        <BookOpen size={18} class="mr-2" weight="bold" />
        Study
      </Button>
    </div>
  );
}; 