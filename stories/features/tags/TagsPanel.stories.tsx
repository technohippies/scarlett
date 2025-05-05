import { Component, createMemo } from 'solid-js';
// Remove Storybook type imports
// import type { StoryObj, Meta, Args } from '@storybook/solidjs'; 
// import { action } from '@storybook/addon-actions';
import TagsPanel from '../../../src/features/tags/TagsPanel';
import type { Tag as DbTag } from '../../../src/services/db/types';

// --- Story Metadata (Simplified) ---
export default {
  title: 'Features/Tags/TagsPanel',
  component: TagsPanel,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    tags: { control: 'object' },
    // Removed onAddTag control
    // onAddTag: { action: 'addTag' }, 
  },
};

// Define Story type based on Meta
// type Story = StoryObj<typeof meta>; // Removed

// --- Mock Data (with required fields) ---
const now = new Date().toISOString(); // Get current timestamp for mock data
const mockTags: DbTag[] = [
  { tag_id: 1, tag_name: '#solidjs', created_at: now, updated_at: now },
  { tag_id: 2, tag_name: '#typescript', created_at: now, updated_at: now },
  { tag_id: 3, tag_name: '#webdev', created_at: now, updated_at: now },
  { tag_id: 4, tag_name: '#productivity', created_at: now, updated_at: now },
  { tag_id: 5, tag_name: '#ai', created_at: now, updated_at: now },
];

// --- Removed Story Template for state management --- 
// const StoryWithStateManagement: Component<{ initialTags: DbTag[] }> = (props) => { ... };

// --- Basic Story Template (Simpler) ---
// Use a simple template that just renders the component with args
const Template: Component<{ tags: DbTag[] }> = (args) => {
  // Create an accessor from the args passed by Storybook
  const tagsAccessor = createMemo(() => args.tags || []); 

  return (
    <div style={{ width: '500px', padding: '20px', border: '1px solid #ccc', 'border-radius': '8px' }}>
      {/* Render TagsPanel directly with the accessor */}
      <TagsPanel 
        tags={tagsAccessor} 
      />
    </div>
  );
};

// --- Specific Stories (Simplified Export) ---

export const Default: { render: Component<{ tags?: DbTag[] }>, args?: any } = {
  // Pass args to the Template component
  render: (args) => <Template tags={args.tags || mockTags} />, 
  args: {
    tags: mockTags, 
  },
};

export const Empty: { render: Component<{ tags?: DbTag[] }>, args?: any } = {
  // Pass args to the Template component
  render: (args) => <Template tags={args.tags || []} />, 
  args: {
    tags: [],
  },
};

// --- Removed NoLocalState story as it's not needed anymore ---

// --- Removed Loading story placeholder ---

// Potential story for loading state if added later
// export const Loading: { render: Component, args?: any } = {
//   render: Template,
//   args: {
//     initialTags: [],
//     isLoading: true, // Assuming isLoading prop is added
//   },
// }; 