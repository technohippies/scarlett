import { MicVisualizer } from '../../../src/components/ui/MicVisualizer';

export default {
  title: 'Components/UI/MicVisualizer',
  component: MicVisualizer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    active: { control: 'boolean', description: 'Start/stop the animation' },
    barCount: { control: 'number', description: 'Number of bars to display' },
    maxHeight: { control: 'number', description: 'Maximum bar height in px' },
    minHeight: { control: 'number', description: 'Minimum bar height in px' },
    interval: { control: 'number', description: 'Animation update interval in ms' },
  },
};

export const Default = {
  args: {
    active: true,
    barCount: 20,
    maxHeight: 30,
    minHeight: 4,
    interval: 100,
  },
};

export const Inactive = {
  args: {
    active: false,
    barCount: 20,
    maxHeight: 30,
    minHeight: 4,
    interval: 100,
  },
};
