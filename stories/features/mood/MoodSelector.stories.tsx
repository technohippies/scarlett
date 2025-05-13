import { MoodSelector, type MoodSelectorProps } from '../../../src/features/mood/MoodSelector';

// Mock fn for storybook actions (if not using @storybook/test)
const fn = () => (...args: any[]) => console.log('[Storybook Action]', ...args);

export default {
  title: 'Features/Mood/MoodSelector',
  component: MoodSelector,
  parameters: {
    layout: 'centered',
    // Optional: Add notes or docs specific to this component
    notes: 'A component to select a mood using Lottie animations.',
  },
  tags: ['autodocs'],
  argTypes: {
    initialMood: {
      control: 'select',
      options: [null, 'happy', 'slightly-happy', 'neutral', 'slightly-frowning', 'sad'],
      description: 'The initially selected mood.',
      table: {
        type: { summary: 'Mood | null' },
        defaultValue: { summary: 'null' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the mood selector.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    onSelect: {
      action: 'selected',
      description: 'Callback when a mood is selected. Passes the selected mood (or null).'
    },
    class: { // Added for Solid's class handling
        control: 'text',
        description: 'Additional CSS classes for the component.',
        table: {
            type: { summary: 'string' },
            defaultValue: { summary: '' },
        },
    }
  },
  args: {
    onSelect: fn(),
    disabled: false,
    initialMood: null,
    class: '',
  },
};

// Define Story type using ComponentProps for SolidJS
type Story = {
  args?: Partial<MoodSelectorProps>;
  // render function is optional for basic stories in SolidJS if args are enough
  render?: (props: MoodSelectorProps) => any; 
};

// === Stories ===

export const Default: Story = {
  args: {
    // Uses default args from meta
  },
};

export const InitiallyHappy: Story = {
  args: {
    initialMood: 'happy',
  },
};

export const InitiallyNeutral: Story = {
  args: {
    initialMood: 'neutral',
  },
};

export const InitiallySad: Story = {
  args: {
    initialMood: 'sad',
  },
};

export const Disabled: Story = {
  args: {
    initialMood: 'slightly-happy', 
    disabled: true,
  },
};

// Story to demonstrate loading state (might need internal component state manipulation or a wrapper)
// export const LoadingState: Story = {
//   render: (props) => {
//     // This is a bit tricky as isLoading is internal. 
//     // One way could be to delay the lottieSrc loading in a story-specific way,
//     // or expose a temporary prop if really needed for story visualization.
//     return <MoodSelector {...props} />;
//   },
//   args: {
//     // initialMood: null, // or some mood
//     // You'd need to simulate the loading condition, perhaps by providing invalid lottieSrc
//     // or by modifying the component temporarily if this state is critical to visualize often.
//   }
// };

// Optional: Story to demonstrate error state
// export const ErrorState: Story = {
//   render: (props: MoodSelectorProps) => {
//     // To properly test this, you might pass a non-existent lottieSrc or modify fetch to fail
//     // For demonstration, we'll assume the component handles error display internally based on bad data.
//     // We can try to force an error by providing a faulty moodOptions or an unresolvable path.
//     // This story might require modifying moodOptions at the story level if possible or providing
//     // a specific prop to the component to induce an error state for testing.
    
//     // A simpler way if component shows error text:
//     // return <div>Error: Failed to load mood animations (Simulated in Story)</div>;
    
//     // If you have a way to pass faulty sources to trigger internal error:
//     const faultyMoodOptions = [
//       { mood: 'happy', lottieSrc: '/lottie/non-existent.json', label: 'Happy' },
//     ];
//     // This would require MoodSelector to accept moodOptions as a prop, or use a wrapper.
    
//     return (
//        <div class="flex items-center justify-center p-2 bg-red-100 text-red-700 rounded-md h-[56px]">
//          Error: Failed to load mood animations. (Simulated in Story)
//       </div>
//     );
//   },
//   args: {
//     // initialMood: 'happy' // Or any other mood
//   }
// }; 