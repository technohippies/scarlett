import { Component, createSignal, createEffect, createMemo, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { TextField, TextFieldInput } from '../../components/ui/text-field';
import { Textarea } from '../../components/ui/textarea'; // Now using the SolidJS version
import { Spinner } from '../../components/ui/spinner'; // Import Spinner
import { BookmarkSimple } from 'phosphor-solid'; // CORRECTED package name
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
  suggestedTags?: string[];
  isSuggestingTags?: boolean;
  tagSuggestionError?: string | null;
  onTagsChange: (newTags: string[]) => void;
  initialSelectedText?: string;
  onSelectedTextChange: (newText: string) => void;
  onSaveBookmark: () => void;
}

export const BookmarkTool: Component<BookmarkToolProps> = (props) => {

  // Use signals for local state
  const [tagInput, setTagInput] = createSignal<string>(
    (props.initialTags ?? []).join(', ')
  );
  const [selectedText, setSelectedText] = createSignal<string>(
    props.initialSelectedText ?? ''
  );

  // Effect to update local tag input when initialTags or suggestedTags change
  createEffect(() => {
    const currentTags = tagInput().split(',').map(t => t.trim()).filter(Boolean);
    // Use props directly inside createEffect
    const initial = props.initialTags ?? [];
    const suggested = props.suggestedTags ?? [];
    const combined = Array.from(new Set([...currentTags, ...initial, ...suggested]));
    const newTagString = combined.join(', ');

    if (newTagString !== tagInput()) {
        setTagInput(newTagString);
        // Update parent if tags changed due to merge
        if (JSON.stringify(combined) !== JSON.stringify(currentTags)) {
            props.onTagsChange(combined);
        }
    }
  }); // Solid automatically tracks dependencies (props.initialTags, props.suggestedTags, tagInput)

  // Effect to update local selected text when initialSelectedText changes
  createEffect(() => {
    setSelectedText(props.initialSelectedText ?? '');
  }); // Tracks props.initialSelectedText

  // Handler for tag input changes (updates local signal only)
  const handleTagInputChange = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    setTagInput(target.value);
  };

  // Handler for when tag input loses focus or Enter is pressed
  const processTags = () => {
    const tags = tagInput()
      .split(',')
      .map(tag => {
        let trimmed = tag.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          trimmed = `#${trimmed}`;
        }
        return trimmed;
      })
      .filter(tag => tag.length > 1);
    const uniqueTags = Array.from(new Set(tags));
    const newTagString = uniqueTags.join(', ');
    setTagInput(newTagString);
    props.onTagsChange(uniqueTags);
  };

  const handleTagInputBlur = () => {
    processTags();
  };

  const handleTagInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      processTags();
      (event.currentTarget as HTMLInputElement).blur();
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
    <div class="bg-background text-foreground rounded-lg flex flex-col gap-4 p-4 max-w-md w-full">

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
            placeholder={props.isSuggestingTags ? "Suggesting tags..." : "#tag1, #tag2, #..."}
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
            value={selectedText()} // Access signal value
            onInput={handleSelectedTextChange} // Use onInput for live updates
            class="w-full h-24 text-base"
            placeholder="Selected text from page..."
            disabled={props.isSaving}
          />
        </div>
      </Show>

      {/* Status Message */}
      <div class={cn("mt-1 text-sm h-4", statusClass())} >
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