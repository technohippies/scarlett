import { Component, For, Show } from 'solid-js';
import type { Bookmark } from '../../services/db/types'; // Import Bookmark type
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'; // Use Card for structure
import { Spinner } from '../../components/ui/spinner';

export interface BookmarksPageViewProps {
  bookmarks: Bookmark[] | null;
  isLoading: boolean;
  error: string | null;
}

export const BookmarksPageView: Component<BookmarksPageViewProps> = (props) => {

  const formatTags = (tagsString: string | null | undefined): string[] => {
    if (!tagsString) return [];
    return tagsString.split(',').map(tag => tag.trim()).filter(Boolean);
  };

  return (
    <div class="bookmarks-page-container p-4 md:p-8 font-sans bg-background min-h-screen text-foreground">
      <h1 class="text-2xl font-bold mb-6">Saved Bookmarks</h1>

      <Show when={props.isLoading}>
        <div class="flex items-center justify-center mt-10">
          <Spinner class="h-8 w-8 mr-2" />
          <p class="text-muted-foreground">Loading bookmarks...</p>
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
          <Show when={bookmarks().length > 0} fallback={<p class="text-muted-foreground text-center mt-10">No bookmarks saved yet.</p>}>
            {/* Removed ScrollArea, using standard div which will scroll if content overflows */}
            <div class="h-[calc(100vh-10rem)] overflow-y-auto"> {/* Added overflow-y-auto */}
              <div class="space-y-4 pr-2"> {/* Added padding-right for scrollbar */}
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
  );
};

// Add default export if missing
// export default BookmarksPageView; // Not needed if using named export 'export const'
