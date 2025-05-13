import { Component, Show } from 'solid-js';
import { type FlashcardStatus } from '../services/db/types'; // Adjusted path

export interface FlashcardProps {
  front: string;
  back?: string;
  status: FlashcardStatus; // Individual card's status string
  // Optional summary counts
  newCount?: number;
  reviewCount?: number;
  dueCount?: number;
}

const Flashcard: Component<FlashcardProps> = (props) => {
  const showSummaryCounts = () => 
    props.newCount !== undefined || props.reviewCount !== undefined || props.dueCount !== undefined;

  return (
    <div class="w-full flex flex-col items-center">
      {/* Status Counts (Only if provided) */}
      <Show when={showSummaryCounts()}>
        <div class="mb-2 flex space-x-2 self-start">
          <Show when={props.newCount !== undefined}>
            <span
              class="inline-block px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"
              title={`New: ${props.newCount}`}
            >
              N: {props.newCount}
            </span>
          </Show>
          <Show when={props.reviewCount !== undefined}>
            <span
              class="inline-block px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold"
              title={`Review: ${props.reviewCount}`}
            >
              R: {props.reviewCount}
            </span>
          </Show>
          <Show when={props.dueCount !== undefined}>
            <span
              class="inline-block px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold"
              title={`Due: ${props.dueCount}`}
            >
              D: {props.dueCount}
            </span>
          </Show>
        </div>
      </Show>
      
      {/* Main card structure */}
      <div class="aspect-[2/3] w-full max-w-sm rounded-lg bg-card text-card-foreground shadow-sm flex flex-col justify-between items-stretch relative overflow-hidden">
        {/* Top (Front) Text */}
        <div class="flex-1 flex flex-col justify-end px-4 pb-3 md:px-6 md:pb-4 text-left">
          <p class="text-lg">{props.front}</p>
        </div>
        
        {/* Divider (only show if back is present or will be shown) */}
        <Show when={props.back}>
          <div class="px-4">
            <hr class="border-t border-foreground/20" />
          </div>
        </Show>
        
        {/* Bottom (Back) Text - takes space only if back is defined */}
        <div class="flex-1 flex flex-col justify-start px-4 pt-3 md:px-6 md:pt-4 text-left">
          <Show when={props.back}>
            <p class="text-lg">{props.back}</p>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default Flashcard; 