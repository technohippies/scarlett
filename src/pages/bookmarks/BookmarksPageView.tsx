import { Component, For, Show } from 'solid-js';
import type { Bookmark } from '../../services/db/types'; // Import Bookmark type
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'; // Use Card for structure
import { Spinner } from '../../components/ui/spinner';
import { Header } from '../../components/layout/Header'; // Import Header
import type { Messages } from '../../types/i18n';

export interface BookmarksPageViewProps {
  bookmarks: Bookmark[] | null;
  isLoading: boolean;
  error: string | null;
  onNavigateBack: () => void; // Add navigation prop
  messages?: Messages;
}

export const BookmarksPageView: Component<BookmarksPageViewProps> = (props) => {
  // Localization helper
  const getLocalizedString = (key: string, fallback: string) => {
    return props.messages?.[key]?.message || fallback;
  };

  const formatTags = (tagsString: string | null | undefined): string[] => {
    if (!tagsString) return [];
    return tagsString.split(',').map(tag => tag.trim()).filter(Boolean);
  };

  return (
    // Use flex-col to stack header and content
    <div class="bookmarks-page-container flex flex-col font-sans bg-background min-h-screen text-foreground">
      <Header title="Bookmarks" onBackClick={props.onNavigateBack} />
      
      {/* Main content area */}
      <div class="flex-grow p-4 md:p-8 overflow-hidden"> {/* Let content area grow and handle its own overflow */}
        {/* Removed original h1 */}

        <Show when={props.isLoading}>
          <div class="flex items-center justify-center mt-10">
            <Spinner class="h-8 w-8 mr-2" />
            {/* <p class="text-muted-foreground">Loading bookmarks...</p> */}
          </div>
        </Show>

        <Show when={props.error}>
          {(errorMsg) => (
              <div class="mt-10 text-center text-destructive">
                  <p class="font-semibold">Error loading bookmarks:</p>
                  <p>{errorMsg()}</p>
              </div>
          )}
        </Show>

        <Show when={!props.isLoading && !props.error && props.bookmarks}>
          {(bookmarks) => (
            <Show when={bookmarks().length > 0} fallback={<p class="text-muted-foreground text-center mt-10">{getLocalizedString('bookmarksPageNoBookmarksYet', 'No bookmarks saved yet.')}</p>}>
              {/* Scrollable content within the main area */}
              {/* Adjust height calculation based on header height (approx h-16 or 4rem) */}
              <div class="h-[calc(100vh-4rem-4rem)] md:h-[calc(100vh-4rem-6rem)] overflow-y-auto"> {/* Adjusted height, consider header/padding */}
                <div class="space-y-4 pr-2"> 
                  <For each={bookmarks()}>{(bookmark) =>
                    <Card>
                      <CardHeader>
                        <CardTitle class="text-lg"><a href={bookmark.url} target="_blank" rel="noopener noreferrer" class="hover:underline">{bookmark.title || 'No Title'}</a></CardTitle>
                        <CardDescription class="text-xs text-muted-foreground truncate"><a href={bookmark.url} target="_blank" rel="noopener noreferrer" class="hover:underline">{bookmark.url}</a></CardDescription>
                      </CardHeader>
                      <CardContent class="space-y-3 text-sm">
                        <Show when={bookmark.selected_text}>
                          <p class="border-l-4 pl-3 italic text-muted-foreground">{bookmark.selected_text}</p>
                        </Show>
                        <Show when={formatTags(bookmark.tags).length > 0}>
                          <div class="flex flex-wrap gap-1.5"><For each={formatTags(bookmark.tags)}>{(tag) =>
                            <span class="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs">{tag}</span>
                          }</For></div>
                        </Show>
                        <p class="text-xs text-muted-foreground/80 pt-1"><span class="font-medium">Saved:</span> {new Date(bookmark.saved_at).toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  }</For>
                </div>
              </div>
            </Show>
          )}
        </Show>
      </div> 
    </div>
  );
};

// Add default export if missing
// export default BookmarksPageView; // Not needed if using named export 'export const'
