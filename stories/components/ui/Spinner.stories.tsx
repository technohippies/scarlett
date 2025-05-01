import { Spinner } from '../../../src/components/ui/spinner';

export default {
  title: 'Components/UI/Spinner',
  component: Spinner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    class: { control: 'text', description: 'Additional CSS classes' },
  },
};

// Default Story
export const Default = {
    args: {},
};

// Larger Spinner
export const Large = {
    args: {
        class: 'h-12 w-12 text-primary',
    },
}; 