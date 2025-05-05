import { Component, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { FlashcardStudyPanel } from '../../features/srs/FlashcardStudyPanel';
import { BookmarkSimple, Gear } from 'phosphor-solid';

// Define the shape of the summary data expected
export interface StudySummaryData {
    dueCount: number;
    reviewCount: number;
    newCount: number;
}

// Props for the View component
export interface NewTabPageViewProps {
    isLoading: boolean;
    summaryData: StudySummaryData | null;
    error: string | null;
    onBookmarksClick: () => void; // Callback for Bookmarks button
    onStudyClick: () => void; // Callback for Study button
    onSettingsClick: () => void; // <-- Add callback for Settings button
}

export const NewTabPageView: Component<NewTabPageViewProps> = (props) => {

  return (
    // Use flex-col, justify-between to push items to top and bottom
    <div class="newtab-page-container p-6 md:p-8 font-sans bg-background min-h-screen flex flex-col justify-between items-center">
      
      {/* Header Area (Centered) */}
      <header class="w-full flex justify-center items-center pt-8 md:pt-12">
        {/* Removed Welcome Back! text */}
      </header>

      {/* Spacer to push content down - or use justify-between */}
      {/* <div class="flex-grow"></div> */}

      {/* Bottom Area - Reverse order and add Settings button */}
      <footer class="w-full flex justify-between flex-row-reverse items-end px-2 md:px-4 pb-4"> {/* <-- Added flex-row-reverse */}
        {/* Study Panel (Now Bottom Right due to reverse) */}
        <div class="study-panel-area max-w-xs"> {/* Constrain width */}
            <Show 
                when={!props.isLoading} 
                fallback={ <div class="p-4"><Spinner class="h-8 w-8 text-muted-foreground" /></div> }
            >
                <Show 
                    when={!props.error} 
                    fallback={ <p class="text-destructive p-4">Error: {props.error}</p> }
                >
                    <Show 
                        when={props.summaryData} 
                        fallback={ <p class="text-muted-foreground p-4 text-sm">No study data available.</p> }
                    >
                        {(data) => (
                            // Render the FlashcardStudyPanel directly
                            <FlashcardStudyPanel
                                dueCount={data().dueCount}
                                reviewCount={data().reviewCount}
                                newCount={data().newCount}
                                onStudyClick={props.onStudyClick} 
                                // Add some padding/margin if needed via class
                                class="bg-card p-4 rounded-lg shadow-md" // Example styling
                            />
                        )}
                    </Show>
                </Show>
            </Show>
        </div>

        {/* Action Buttons (Now Bottom Left due to reverse) */}
        <div class="quick-actions flex flex-col gap-2"> {/* <-- Added flex-col and gap-2 */}
            <Button onClick={props.onBookmarksClick} class="flex items-center justify-start gap-2"> {/* <-- Adjusted justify-start */}
                <BookmarkSimple weight="fill" size={18} />
                Bookmarks
            </Button>
            {/* <-- Add Settings button --> */}
            <Button onClick={props.onSettingsClick} class="flex items-center justify-start gap-2"> {/* <-- Adjusted justify-start */}
                <Gear weight="fill" size={18} />
                Settings
            </Button>
        </div>
      </footer>

    </div>
  );
}; 