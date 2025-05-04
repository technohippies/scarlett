import { action } from '@storybook/addon-actions';
import { BookmarkTool, type BookmarkToolProps } from '../../../src/features/bookmark/BookmarkTool'; // Adjust path as needed
import { Button } from '../../../src/components/ui/button'; // For potential actions in story
import { createSignal } from 'solid-js';

// Base metadata for the story
export default {
  title: 'Features/Bookmark/BookmarkTool',
  component: BookmarkTool,
  parameters: {
    layout: 'centered', // Center component in the Storybook canvas
  },
  tags: ['autodocs'], // Enable automatic documentation generation
  argTypes: {
    // Define controls for props
    pageTitle: { control: 'text' },
    pageUrl: { control: 'text' },
    status: { control: 'text' },
    isSaving: { control: 'boolean' },
    statusIsError: { control: 'boolean' },
    isAlreadyBookmarked: { control: 'boolean' },
    initialBookmarkExists: { control: 'boolean' },
    initialTags: { control: 'object' }, // Use object control for array
    suggestedTags: { control: 'object' },
    isSuggestingTags: { control: 'boolean' },
    tagSuggestionError: { control: 'text' },
    initialSelectedText: { control: 'text' },
    // Actions - map them to Storybook actions
    onTagsChange: { action: 'tagsChanged' },
    onSelectedTextChange: { action: 'selectedTextChanged' },
    onSaveBookmark: { action: 'saveBookmarkClicked' },
  },
  // Default args for all stories
  args: {
    pageTitle: 'Example Web Page Title That Might Be Quite Long',
    pageUrl: 'https://example.com/path/to/very/interesting/article',
    status: '',
    isSaving: false,
    statusIsError: false,
    isAlreadyBookmarked: false,
    initialBookmarkExists: false,
    initialTags: ['#example', '#solidjs'],
    suggestedTags: [],
    isSuggestingTags: false,
    tagSuggestionError: null,
    initialSelectedText: 'This is some example text selected from the page.',
    // Use Storybook's action handler
    onTagsChange: action('tagsChanged'),
    onSelectedTextChange: action('selectedTextChanged'),
    onSaveBookmark: action('saveBookmarkClicked'),
  },
};

// --- Story Definitions --- //

// Basic story - Default state
export const Default = {};

// Story simulating saving state
export const Saving = {
  args: {
    isSaving: true,
    status: 'Saving bookmark...',
  },
};

// Story simulating an already bookmarked page
export const AlreadyBookmarked = {
  args: {
    isAlreadyBookmarked: true,
    initialBookmarkExists: true, // Match the button logic
    status: 'This page is already bookmarked.',
    initialTags: ['#example', '#solidjs', '#saved'],
  },
};

// Story with tag suggestions loading
export const SuggestingTags = {
  args: {
    isSuggestingTags: true,
    initialTags: [], // Start with no tags
    status: 'Suggesting tags...',
  },
};

// Story showing an error status
export const ErrorStatus = {
  args: {
    status: 'Error: Could not save bookmark. Please try again.',
    statusIsError: true,
  },
};

// Story with no initial selected text
export const NoSelectedText = {
  args: {
    initialSelectedText: '',
  },
};

// Story demonstrating tag merging (requires interaction)
// We wrap the component to manage state locally for the story
export const InteractiveTagMerging = {
  render: (props: BookmarkToolProps) => {
    const [tags, setTags] = createSignal(props.initialTags ?? []);
    const [text, setText] = createSignal(props.initialSelectedText ?? '');

    const handleSave = () => {
      action('saveBookmarkClicked')({ tags: tags(), text: text() });
      // Simulate saving completion or state change if needed
    };

    return (
      <div>
        <BookmarkTool
          {...props} // Pass through story args
          initialTags={tags()} // Use local signal for initial display
          initialSelectedText={text()}
          onTagsChange={(newTags) => {
            setTags(newTags);
            action('tagsChanged')(newTags); // Log action
          }}
          onSelectedTextChange={(newText) => {
            setText(newText);
            action('selectedTextChanged')(newText); // Log action
          }}
          onSaveBookmark={handleSave}
        />
        <div style={{ "margin-top": "20px", "font-family": "monospace" }}>
          <p>Current Tags State: {JSON.stringify(tags())}</p>
          <p>Current Text State: {text()}</p>
        </div>
        {/* Button to simulate suggestion loading */}
        <Button 
          onClick={() => {
            // Simulate suggestions being added
            const suggestions = ['#suggested1', '#suggested2'];
            const current = tags();
            const combined = Array.from(new Set([...current, ...suggestions]));
            setTags(combined);
            action('tagsChanged')(combined);
            action('simulateSuggestionsLoaded')(suggestions);
          }}
          style={{ "margin-top": "10px" }}
        >
          Simulate Suggestion Load
        </Button>
      </div>
    );
  },
  args: {
    // Override default args specific to this interactive story
    initialTags: ['#initial'],
    suggestedTags: [], // Suggestions will be triggered by button
  },
};
