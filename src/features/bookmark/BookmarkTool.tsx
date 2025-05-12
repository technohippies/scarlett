import { Component, createSignal, createEffect, createMemo, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { TextField, TextFieldInput } from '../../components/ui/text-field';
import { Textarea } from '../../components/ui/textarea'; // Now using the SolidJS version
import { Spinner } from '../../components/ui/spinner'; // Import Spinner
import { BookmarkSimple } from 'phosphor-solid';
import { cn } from '../../lib/utils'; // Correct path for cn

export interface BookmarkToolProps {
  pageTitle: string;
  pageUrl: string;
  status: string;
  isSaving: boolean;
  statusIsError: boolean;
  isAlreadyBookmarked: boolean;
  initialBookmarkExists?: boolean;
  initialTags?: string[];
  onTagsChange: (newTags: string[]) => void;
  initialSelectedText?: string;
  onSelectedTextChange: (newText: string) => void;
  onSaveBookmark: () => void;
}

export const BookmarkTool: Component<BookmarkToolProps> = (props) => {

  // Use signals for local state
  const [tagInput, setTagInput] = createSignal<string>('');
  const [selectedText, setSelectedText] = createSignal<string>(
    props.initialSelectedText ?? ''
  );

  // Effect to update tagInput string when props change
  createEffect(() => {
    const initial = props.initialTags ?? [];
    // Get current tags from the input string itself to preserve user edits
    const currentTagsFromString = tagInput()
                                  .split(',')
                                  .map(t => t.trim())
                                  .filter(t => t.startsWith('#') && t.length > 1);
                                  
    // No more suggested tags to merge, just use initial and current input
    const combined = Array.from(new Set([...currentTagsFromString, ...initial]));
    const newTagString = combined.join(', '); // Create the string representation

    // Update the input signal only if the string content changes
    if (newTagString !== tagInput()) {
      console.log('[BookmarkTool Effect] Updating tagInput:', newTagString);
      setTagInput(newTagString);
      // Still notify parent with the array version if change was triggered by props
      props.onTagsChange(combined);
    }
  }, [props.initialTags]);

  // Effect to update local selected text when initialSelectedText changes
  createEffect(() => {
    setSelectedText(props.initialSelectedText ?? '');
  }); // Tracks props.initialSelectedText

  // Handler for tag input changes (updates local signal only)
  const handleTagInputChange = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    setTagInput(target.value);
    // Don't call onTagsChange on every keystroke
  };

  // Handler for when tag input loses focus or Enter is pressed
  // Normalizes tags and calls onTagsChange with the array
  const processTags = () => {
    const tags = tagInput()
      .split(',')
      .map(tag => {
        let trimmed = tag.trim();
        // Add # if missing and it's not just whitespace
        if (trimmed && !trimmed.startsWith('#')) {
          trimmed = `#${trimmed}`;
        }
        return trimmed;
      })
      .filter(tag => tag.length > 1); // Filter out empty/short tags like just '#'
    const uniqueTags = Array.from(new Set(tags));
    const newTagString = uniqueTags.join(', ');
    
    // Update local input to the cleaned version
    if (newTagString !== tagInput()) {
        setTagInput(newTagString);
    }
    // Always notify parent with the processed array
    props.onTagsChange(uniqueTags);
    console.log('[BookmarkTool processTags] Notified parent with:', uniqueTags);
  };

  const handleTagInputBlur = () => {
    processTags();
  };

  const handleTagInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent form submission if inside a form
      processTags();
      (event.currentTarget as HTMLInputElement).blur(); // Optional: blur on enter
    }
  };

  // Handler for selected text textarea changes
  const handleSelectedTextChange = (event: Event) => {
    const target = event.currentTarget as HTMLTextAreaElement;
    const newText = target.value;
    setSelectedText(newText);
    props.onSelectedTextChange(newText);
  };

  // Memoize the disabled state for the save button
  const isSaveDisabled = createMemo(() =>
    props.isSaving || props.isAlreadyBookmarked || props.initialBookmarkExists
  );

  // Helper to get status class
  const statusClass = createMemo(() => 
     props.statusIsError ? 'text-destructive' : 'text-muted-foreground'
  );

  return (
    <div class="bg-background text-foreground flex flex-col gap-4 p-4 w-full">

      {/* Header */}
      <div class="flex items-center justify-between mb-1">
        <span class="flex items-center gap-2 text-lg font-semibold text-foreground">
          <BookmarkSimple weight="fill" size={24} class="text-destructive" />
          Bookmark
        </span>
      </div>

      {/* Page Info */}
      <div class="flex flex-col gap-1 text-base">
        {/* Title */}
        <div class="flex items-start gap-2">
          <p class="font-medium text-foreground/90 w-14 flex-shrink-0 mt-px">Title:</p>
          <p class="bg-background border border-transparent rounded-md py-0.5 px-1 overflow-hidden text-ellipsis whitespace-nowrap flex-grow min-w-0">
            {props.pageTitle || <span class="italic text-muted-foreground">No title</span>}
          </p>
        </div>
        {/* Source */}
        <div class="flex items-start gap-2">
          <p class="font-medium text-foreground/90 w-14 flex-shrink-0 mt-px">Source:</p>
          <p class="bg-background border border-transparent rounded-md py-0.5 px-1 overflow-hidden whitespace-nowrap text-ellipsis flex-grow min-w-0">
            {props.pageUrl || <span class="italic text-muted-foreground">No URL</span>}
          </p>
        </div>
      </div>

      {/* Tags Section */}
      <div class="flex flex-col gap-1.5">
        <label for="bookmark-tags" class="text-base font-medium text-foreground/90">Tags:</label>
        <TextField
          id="bookmark-tags"
          value={tagInput()}
          class="w-full"
          disabled={props.isSaving}
        >
          <TextFieldInput
            onInput={handleTagInputChange}
            onBlur={handleTagInputBlur}
            onKeyDown={handleTagInputKeyDown}
            placeholder={""}
            class="text-base placeholder:text-muted-foreground"
          />
        </TextField>
      </div>

      {/* Selected Text (Context) Section */}
      <Show when={props.initialSelectedText || selectedText()}>
        <div class="flex flex-col gap-1.5 w-full mt-1">
          <label for="bookmark-text" class="text-base font-medium text-foreground/90">Text:</label>
          <Textarea
            id="bookmark-text"
            value={selectedText()}
            onInput={handleSelectedTextChange}
            class="w-full h-24 text-base"
            placeholder="Selected text from page..."
            disabled={props.isSaving}
          />
        </div>
      </Show>

      {/* Status Message - Placed before Save Button */}
      <div class={cn("mt-1 text-sm h-4", statusClass())}>
          {props.status || ''}
      </div>

      {/* Save Button */}
      <Button
        class="w-full mt-1 flex items-center justify-center gap-2"
        onClick={props.onSaveBookmark}
        disabled={isSaveDisabled()}
      >
        <Show when={!props.isSaving}
            fallback={<>
              <Spinner class="h-4 w-4" />
              <span>Saving...</span>
            </>}
        >
            {props.isAlreadyBookmarked || props.initialBookmarkExists ? 'Bookmarked' : 'Save'}
        </Show>
      </Button>
    </div>
  );
}; 