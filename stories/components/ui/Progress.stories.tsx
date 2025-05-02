// Import the Progress component
import { Progress } from "../../../src/components/ui/progress";
// No need for specific SolidJS or Storybook imports here

export default {
  title: "Components/UI/Progress",
  component: Progress,
  parameters: {
    // Layout 'centered' might be fine for a simple progress bar
    layout: "centered", 
  },
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: { type: "number", min: 0 },
      description: "Current value of the progress bar",
    },
    minValue: {
      control: { type: "number" },
      description: "Minimum value for the progress bar",
      defaultValue: 0, // Set default for Storybook
    },
    maxValue: {
      control: { type: "number" },
      description: "Maximum value for the progress bar",
      defaultValue: 100, // Set default for Storybook
    },
    // Add other relevant props like 'class' if needed
    class: {
      control: { type: "text" },
      description: "CSS classes to apply to the root element",
    }
  },
};

// Default story rendering the Progress component
export const Default = {
  render: (args: any) => (
    // Provide a container for sizing in the story
    <div class="w-64 p-4">
      <Progress 
        value={args.value} 
        minValue={args.minValue} 
        maxValue={args.maxValue} 
        class={args.class}
      />
    </div>
  ),
  args: {
    // Default args for the story
    value: 50, // Start halfway
    minValue: 0,
    maxValue: 100,
    class: "", // Default no extra class
  },
};
