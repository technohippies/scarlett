import { SpeechVisualizer } from '../../../src/components/ui/SpeechVisualizer';
import type { SpeechVisualizerProps } from '../../../src/components/ui/SpeechVisualizer';

export default {
  title: 'Components/UI/SpeechVisualizer',
  component: SpeechVisualizer,
  parameters: { layout: 'centered' },
  argTypes: {
    listening: { control: 'boolean' },
    processing: { control: 'boolean' },
    speaking: { control: 'boolean' },
    audioLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
  },
};

export const Idle = {
  render: (args: SpeechVisualizerProps) => <SpeechVisualizer {...args} />, 
  args: { listening: false, processing: false, speaking: false, audioLevel: 0 },
};

export const Listening = {
  render: (args: SpeechVisualizerProps) => <SpeechVisualizer {...args} />, 
  args: { listening: true, processing: false, speaking: false, audioLevel: 0 },
};

export const Processing = {
  render: (args: SpeechVisualizerProps) => <SpeechVisualizer {...args} />, 
  args: { listening: false, processing: true, speaking: false, audioLevel: 0 },
};

export const Speaking = {
  render: (args: SpeechVisualizerProps) => <SpeechVisualizer {...args} />, 
  args: { listening: false, processing: false, speaking: true, audioLevel: 0 },
};

export const SpeakingScaledLow = {
  render: (args: SpeechVisualizerProps) => <SpeechVisualizer {...args} />, 
  args: { listening: false, processing: false, speaking: true, audioLevel: 0.2 },
};

export const SpeakingScaledHigh = {
  render: (args: SpeechVisualizerProps) => <SpeechVisualizer {...args} />, 
  args: { listening: false, processing: false, speaking: true, audioLevel: 0.8 },
}; 