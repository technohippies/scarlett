import { Component, Show } from 'solid-js';
import { FlashcardStudyPanel } from '../../features/srs/FlashcardStudyPanel';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { browser } from 'wxt/browser';

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

  // Navigate functions
  const goToStudyPage = () => {
    const studyUrl = browser.runtime.getURL('/study.html');
    window.location.href = studyUrl;
  };

  const goToBookmarksPage = () => {
    const bookmarksUrl = browser.runtime.getURL('/bookmark-manager.html');
    window.location.href = bookmarksUrl;
  };

  // const goToSettingsPage = () => {
  //   // Assuming settings page is available via options_ui or a dedicated page
  //   // browser.runtime.openOptionsPage(); // Use this if options_ui is set
  //   // Or if it's a regular page:
  //   const settingsUrl = browser.runtime.getURL('/settings.html');
  //   window.location.href = settingsUrl;
  // };

  return (
    <div class="newtab-page-container p-8 font-sans bg-background min-h-screen flex flex-col justify-between items-start">
      <header class="flex justify-between items-center mb-12">
        <h1 class="text-3xl font-bold text-foreground mb-8 mt-8">Welcome Back!</h1>
        <nav class="flex items-center space-x-4">
          {/* <Button variant="outline" onClick={goToStudyPage}>Start Studying</Button> */}
          <Button variant="outline" onClick={goToBookmarksPage}>View Bookmarks</Button>
          {/* Settings Button (Example) */}
          {/* <Button variant="ghost" size="icon" onClick={goToSettingsPage}><Cog size={20} /></Button> */}
        </nav>
      </header>

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

      {/* Link to Bookmarks Manager */}
      <a
        href={browser.runtime.getURL('/bookmark-manager.html')}
        class="absolute bottom-4 right-4 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
        target="_blank" // Open in new tab if desired, or remove for same tab
      >
        View Bookmarks
      </a>
    </div>
  );
}; 