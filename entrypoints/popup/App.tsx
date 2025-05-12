import { Component, createSignal, createEffect, Show } from 'solid-js';
import { BookmarkTool } from '../../src/features/bookmark/BookmarkTool';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { Bookmark } from '../../src/services/db/types';
import type { SaveBookmarkResponse } from '../../src/shared/messaging-types';
import type { InitialData } from './main';
import { Spinner } from '../../src/components/ui/spinner';


console.log('[Popup App] Script loaded');

const messaging = defineExtensionMessaging();

interface AppProps {
  initialData: InitialData | null;
  initialError: Error | null;
}

const App: Component<AppProps> = (props) => {
  console.log('[Popup App] Component executing with props:', props);

  // --- State Signals ---
  const [pageTitle] = createSignal(props.initialData?.pageTitle || '');
  const [pageUrl] = createSignal(props.initialData?.pageUrl || '');
  const [bookmarks, setBookmarks] = createSignal<Bookmark[]>(props.initialData?.bookmarks || []);
  const [initialSelectedText] = createSignal(props.initialData?.selectedText ?? '');

  const [status, setStatus] = createSignal('');
  const [isSaving, setIsSaving] = createSignal(false);
  const [statusIsError, setStatusIsError] = createSignal(false);
  const [isSaved, setIsSaved] = createSignal(false);
  const [isAlreadyBookmarked, setIsAlreadyBookmarked] = createSignal(false);
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [currentSelectedText, setCurrentSelectedText] = createSignal(initialSelectedText());

  // --- Effects ---

  // Effect to check if the page is already bookmarked initially or after saving
  createEffect(() => {
    const currentUrl = pageUrl();
    if (currentUrl) {
      const exists = bookmarks().some(bm => bm.url === currentUrl);
      setIsAlreadyBookmarked(exists);
      if (exists) {
        console.log(`[Popup App Effect] URL ${currentUrl} is bookmarked.`);
        // Pre-fill selected tags if already bookmarked?
        const existingBookmark = bookmarks().find(bm => bm.url === currentUrl);
        if (existingBookmark?.tags) {
          setSelectedTags(existingBookmark.tags.split(',').map((t: string) => t.trim()).filter(Boolean));
        }
      }
    }
  });

  // --- Event Handlers ---

  const onSaveBookmark = async () => {
    const urlToSave = pageUrl();
    if (!urlToSave) {
      setStatus('Cannot save without a URL');
      setStatusIsError(true);
      return;
    }
    // Prevent re-saving if already marked as bookmarked in state
    if (isAlreadyBookmarked()) {
      setStatus('Already bookmarked.');
      return;
    }

    setIsSaving(true);
    setStatus('Saving bookmark...');
    setStatusIsError(false);
    try {
      console.log('[Popup App onSaveBookmark] Sending saveBookmark message');
      const payload = {
        url: urlToSave,
        title: pageTitle(),
        tags: selectedTags().join(', '),
        selectedText: currentSelectedText()
      };
      console.log('[Popup App onSaveBookmark] Payload:', payload);
      const response = await messaging.sendMessage('saveBookmark', payload);
      // Assume response type based on inspirational code and needs
      const typedResponse = response as SaveBookmarkResponse;
      console.log('[Popup App onSaveBookmark] Received saveBookmark response:', typedResponse);

      if (typedResponse?.success) {
        setStatus('Bookmark saved!');
        setIsSaved(true);
        setIsAlreadyBookmarked(true); // Update state immediately
        if (typedResponse.bookmark) {
          // Add the new bookmark to the local list
          setBookmarks([...bookmarks(), typedResponse.bookmark]);
        }
        // Close popup after a short delay
        setTimeout(() => window.close(), 1200);
      } else {
        const errMsg = typedResponse?.error || 'Failed to save bookmark.';
        setStatus(errMsg);
        setStatusIsError(true);
      }
    } catch (error) {
      console.error('[Popup App onSaveBookmark] Error sending saveBookmark message:', error);
      let errMsg = 'Unknown error';
      if (error instanceof Error) errMsg = error.message;
      // Add specific check for potential webext-core messaging errors if needed
      setStatus(`Error: ${errMsg.substring(0, 100)}`); // Truncate long errors
      setStatusIsError(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for tags changing in the Bookmarker component
  const handleSelectedTagsChange = (newTags: string[]) => {
    setSelectedTags(newTags);
    console.log('[Popup App] Selected tags updated:', newTags);
  };

  // Handler for selected text changing in the Bookmarker component
  const handleSelectedTextChange = (newText: string) => {
    setCurrentSelectedText(newText);
  };

  // --- Render Logic ---

  // Handle initial loading error passed from main.tsx
  if (props.initialError) {
    console.error('[Popup App] Rendering critical error state:', props.initialError);
    return (
      <div class="w-full h-40 flex flex-col items-center justify-center p-4 bg-background text-destructive">
        <p class="font-semibold mb-2">Error Loading Popup</p>
        <p class="text-sm text-center">{props.initialError.message}</p>
      </div>
    );
  }

  // Handle case where initial data might be null (if fetch failed but didn't throw in main)
  if (!props.initialData) {
    console.warn('[Popup App] Rendering with null initialData.');
    return (
      <div class="w-full h-40 flex flex-col items-center justify-center p-4 bg-background text-muted-foreground">
        <Spinner class="mb-4" />
        <p>Loading data...</p>
      </div>
    );
  }

  // Main render
  console.log('[Popup App] Rendering main UI');
  return (
    // Removed rounded-lg for sharp corners
    <div class="w-96 bg-background text-foreground m-0 box-border overflow-hidden">
      <Show when={!isSaved()}
        fallback={
          // Saved state UI
          <div class="flex flex-col items-center justify-center p-8 h-48">
            <p class="text-xl font-semibold text-foreground">Saved!</p>
            {/* Maybe add an icon here */}
          </div>
        }
      >
        <BookmarkTool
          pageTitle={pageTitle()}
          pageUrl={pageUrl()}
          status={status()}
          isSaving={isSaving()}
          statusIsError={statusIsError()}
          isAlreadyBookmarked={isAlreadyBookmarked()}
          initialTags={selectedTags()}
          onTagsChange={handleSelectedTagsChange}
          initialSelectedText={initialSelectedText()}
          onSelectedTextChange={handleSelectedTextChange}
          onSaveBookmark={onSaveBookmark}
          initialBookmarkExists={isAlreadyBookmarked()}
        />
      </Show>
    </div>
  );
};

export default App;
