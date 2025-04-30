import type { ComponentProps } from "solid-js";
import { Separator } from "../../../src/components/ui/separator";

export default {
  title: 'Components/UI/Separator',
  component: Separator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
    class: { control: 'text' }, // Allow class customization
  },
  args: {
    orientation: 'horizontal',
  },
};

type StoryProps = ComponentProps<typeof Separator>;

// Default story based on SeparatorDemo
export const Default = {
  render: (props: StoryProps) => {
    // Demo structure requires specific layout, not centered
    // We adjust it slightly for a better isolated story view
    return (
      <div class="flex h-[200px] w-[300px] flex-col justify-center space-y-6">
        <div class="space-y-1 text-center">
          <h4 class="text-sm font-medium leading-none">Radix Primitives</h4>
          <p class="text-sm text-muted-foreground">An open-source UI component library.</p>
        </div>
        {/* Horizontal separator based on props */}
        <Separator {...props} class={`my-4 ${props.class || ''}`} />
        {/* Vertical separators */}
        <div class="flex h-5 items-center justify-center space-x-4 text-sm">
          <div>Blog</div>
          <Separator orientation="vertical" />
          <div>Docs</div>
          <Separator orientation="vertical" />
          <div>Source</div>
        </div>
      </div>
    );
  },
  args: {
    // Default args for this story (can override global args)
  },
  parameters: {
    // Override layout for this story if needed
    layout: 'padded', // Example: Use padded layout instead of centered
  }
}; 