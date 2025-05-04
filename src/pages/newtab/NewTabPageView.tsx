import { Component, Show } from 'solid-js';
import { FlashcardStudyPanel } from '../../features/srs/FlashcardStudyPanel';
import { Card, CardContent } from '../../components/ui/card';

// Props interface for the View component
export interface NewTabPageViewProps {
  isLoading: boolean;
  // Allow null for initial state or when error occurs
  summaryData: { dueCount: number; reviewCount: number; newCount: number } | null;
  error: string | null;
  onStudyClick: () => void;
}

// The purely presentational component
export const NewTabPageView: Component<NewTabPageViewProps> = (props) => {
  
  // Helper condition to determine if the card should be shown at all
  const shouldShowCard = () => {
    return !props.isLoading && !props.error && props.summaryData && 
           (props.summaryData.dueCount > 0 || 
            props.summaryData.reviewCount > 0 || 
            props.summaryData.newCount > 0);
  };

  return (
    <div class="newtab-page-container p-8 font-sans bg-background min-h-screen flex flex-col justify-between items-start">
      <div class="w-full flex justify-center">
        <h1 class="text-3xl font-bold text-foreground mb-8 mt-8">Welcome Back!</h1>
      </div>

      <div class="study-panel-area mb-4">
        <Show when={shouldShowCard()} 
              fallback={
                // Show loading or error placeholder if card shouldn't be shown yet or has error
                <Show when={props.isLoading} fallback={
                  // If not loading, check for error
                  <Show when={props.error} fallback={
                    // If no error and not loading, but counts are zero, show nothing or a different message
                    // For now, showing nothing for the zero-counts-case fallback
                    <></> 
                  }>
                    {/* Error State Placeholder (Optional: Could style differently) */} 
                    <div class="w-64 p-4 text-center text-red-500 font-semibold">
                         Error: {props.error ?? 'Unknown error'}
                    </div>
                  </Show>
                }>
                  {/* Loading State Placeholder (Optional: Could style differently) */} 
                  <div class="w-64 p-4 text-center text-foreground animate-pulse">
                      Loading summary...
                  </div>
                </Show>
              }
        >
          {/* Render the Card only when shouldShowCard is true */}
          <Card class="w-64"> 
              <CardContent class="p-4"> 
                  {/* summaryData is guaranteed to be non-null here due to shouldShowCard condition */} 
                  <FlashcardStudyPanel
                      dueCount={props.summaryData!.dueCount}
                      reviewCount={props.summaryData!.reviewCount}
                      newCount={props.summaryData!.newCount}
                      onStudyClick={props.onStudyClick}
                  />
              </CardContent>
          </Card>
        </Show>
      </div>
    </div>
  );
}; 