import { Timeline, TimelinePropsItem } from '../../../src/components/ui/timeline';

// Mock data for the timeline items
const mockItems: TimelinePropsItem[] = [
  {
    title: "Provider Selected",
    description: "You chose Ollama as your provider."
  },
  {
    title: "Model Configured",
    description: "You selected the llama3:latest model."
  },
  {
    title: "Connection Tested",
    description: "Successfully connected to the Ollama server."
  },
  {
    title: "Ready to Go!",
    description: "Onboarding complete."
  }
];

export default {
  title: 'Components/UI/Timeline',
  component: Timeline,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    items: { control: 'object', description: 'Array of timeline item objects (title, description, bullet?)' },
    activeItem: { control: { type: 'number', min: -1 }, description: 'Index of the last fully completed step (line/bullet active). -1 means none active.' },
    bulletSize: { control: { type: 'number', min: 4 }, description: 'Size of the bullet point in pixels.' },
    lineSize: { control: { type: 'number', min: 1 }, description: 'Thickness of the connecting line in pixels.' },
  },
  args: {
    items: mockItems,
    activeItem: 1, // Default to second item active (index 1)
    bulletSize: 16,
    lineSize: 2,
  },
};

// Default Story
export const Default = {
    render: (args: any) => (
        <div class="w-64">
            <Timeline {...args} />
        </div>
    ),
};

// Story with no items active
export const NoneActive = {
    render: (args: any) => (
        <div class="w-64">
            <Timeline {...args} />
        </div>
    ),
    args: {
        activeItem: -1,
    },
};

// Story with all items active
export const AllActive = {
    render: (args: any) => (
        <div class="w-64">
            <Timeline {...args} />
        </div>
    ),
    args: {
        activeItem: mockItems.length, // Set active beyond the last item index
    },
};

// Story with custom bullet size
export const LargeBullet = {
    render: (args: any) => (
        <div class="w-64">
            <Timeline {...args} />
        </div>
    ),
    args: {
        activeItem: 2,
        bulletSize: 24,
        lineSize: 3,
    },
};
