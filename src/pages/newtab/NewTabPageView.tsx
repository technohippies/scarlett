import { Component, Show, Accessor } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { 
  BookmarksSimple, Brain, Gear,
  SpinnerGap, // Use SpinnerGap instead of CircleNotch
} from 'phosphor-solid'; 
import type { StudySummary } from '../../services/srs/types'; // Import StudySummary type

// Define props for the View component
export interface NewTabPageViewProps {
  summary: Accessor<StudySummary | null>;
  summaryLoading: Accessor<boolean>;
  // Props for embedding trigger
  pendingEmbeddingCount: Accessor<number>;
  isEmbedding: Accessor<boolean>;
  embedStatusMessage: Accessor<string | null>;
  onEmbedClick: () => void;
  // Navigation callbacks
  onNavigateToBookmarks: () => void;
  onNavigateToStudy: () => void;
  onNavigateToSettings: () => void;
}

// Presentational Component
export const NewTabPageView: Component<NewTabPageViewProps> = (props) => {

  // Helper function to format large numbers (optional)
  const formatCount = (count: number | undefined): string => {
    return count !== undefined ? count.toLocaleString() : '-';
  };

  return (
    <div class="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <h1 class="text-4xl font-bold mb-8 text-primary">Scarlett</h1>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-8">
        {/* Study Card */}
        <Card class="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle class="flex items-center">
              <Brain class="mr-2 h-5 w-5" /> Study
            </CardTitle>
            <CardDescription>Review your flashcards</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col items-center space-y-2">
            <Show when={props.summaryLoading()} fallback={
              <div class="text-center space-y-1">
                  <p><span class="font-semibold">{formatCount(props.summary()?.dueCount)}</span> Due</p>
                  <p><span class="font-semibold">{formatCount(props.summary()?.reviewCount)}</span> Review</p>
                  <p><span class="font-semibold">{formatCount(props.summary()?.newCount)}</span> New</p>
              </div>
            }>
              <SpinnerGap class="h-6 w-6 animate-spin text-muted-foreground" />
              <p class="text-sm text-muted-foreground">Loading summary...</p>
            </Show>
            <Button onClick={props.onNavigateToStudy} class="mt-4 w-full">
              Start Studying
            </Button>
          </CardContent>
        </Card>

        {/* Bookmarks Card */}
        <Card class="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle class="flex items-center">
              <BookmarksSimple class="mr-2 h-5 w-5" /> Bookmarks
            </CardTitle>
            <CardDescription>Manage saved pages</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col items-center">
            {/* Placeholder for bookmark count if available */}
            <p class="text-muted-foreground mb-4 text-center">Access and organize your saved web pages.</p>
            <Button onClick={props.onNavigateToBookmarks} class="w-full">
              View Bookmarks
            </Button>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card class="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle class="flex items-center">
              <Gear class="mr-2 h-5 w-5" /> Settings
            </CardTitle>
            <CardDescription>Configure the extension</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col items-center">
            <p class="text-muted-foreground mb-4 text-center">Adjust models, language preferences, and other options.</p>
            <Button onClick={props.onNavigateToSettings} class="w-full">
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* --- Manual Embedding Section --- */}
      <div class="mt-8 p-4 border border-border rounded-md w-full max-w-md flex flex-col items-center space-y-3">
        <h2 class="text-lg font-semibold">Page Embedding</h2>
        <Show 
          when={props.pendingEmbeddingCount() > 0}
          fallback={<p class="text-sm text-muted-foreground">No pages waiting to be embedded.</p>}
        >
          <p class="text-sm text-center">
             <span class="font-semibold">{props.pendingEmbeddingCount()}</span> pages ready for embedding.
          </p>
          <Button 
            onClick={props.onEmbedClick} 
            disabled={props.isEmbedding()}
            size="sm"
            class="mt-2"
          >
            <Show when={!props.isEmbedding()} fallback={
              <div class="flex items-center">
                <SpinnerGap class="mr-2 h-4 w-4 animate-spin" />
                Embedding...
              </div>
            }>
             Embed Pending Pages
            </Show>
          </Button>
        </Show>
        <Show when={props.embedStatusMessage()}> 
           <p class={`text-xs mt-2 ${props.embedStatusMessage()?.startsWith('Error') ? 'text-destructive' : 'text-muted-foreground'}`}>
              {props.embedStatusMessage()}
           </p>
        </Show>
      </div>
      {/* --- End Manual Embedding Section --- */}

    </div>
  );
};

export default NewTabPageView; 