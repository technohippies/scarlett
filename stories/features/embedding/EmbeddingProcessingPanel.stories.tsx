// stories/features/embedding/EmbeddingProcessingPanel.stories.tsx
import { EmbeddingProcessingPanel } from '../../../src/features/embedding/EmbeddingProcessingPanel';
import type { EmbeddingProcessingPanelProps } from '../../../src/features/embedding/EmbeddingProcessingPanel';
import { action } from '@storybook/addon-actions';
import { createSignal, createEffect, type JSX, type Accessor } from 'solid-js';

export default {
  title: 'Features/Embedding/EmbeddingProcessingPanel',
  component: EmbeddingProcessingPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    pendingEmbeddingCount: { control: 'number', description: 'Number of items in the queue' },
    isEmbedding: { control: 'boolean', description: 'Is the processing currently active?' },
    processedCount: { control: 'number', description: 'Items processed in current batch' },
    totalCount: { control: 'number', description: 'Total items in current batch' },
    onProcessClick: { action: 'processClicked', description: 'Handler for the process button' },
    class: { control: 'text', description: 'Additional CSS classes' },
  },
};

// Base render function - add progress props
const BaseRender = (args: Omit<EmbeddingProcessingPanelProps, 'pendingEmbeddingCount' | 'isEmbedding' | 'processedCount' | 'totalCount'> & { pendingEmbeddingCount: number; isEmbedding: boolean; processedCount?: number; totalCount?: number }) => {
  const [isEmbedding, setIsEmbedding] = createSignal(args.isEmbedding);

  createEffect(() => setIsEmbedding(args.isEmbedding));

  const panelProps: EmbeddingProcessingPanelProps = {
    pendingEmbeddingCount: () => args.pendingEmbeddingCount,
    isEmbedding: isEmbedding,
    processedCount: () => args.processedCount || 0,
    totalCount: () => args.totalCount || 0,
    onProcessClick: args.onProcessClick,
    class: args.class,
  };

  return <EmbeddingProcessingPanel {...panelProps} />;
};

// Define Stories
export const IdleEmpty = {
  render: BaseRender,
  args: {
    pendingEmbeddingCount: 0,
    isEmbedding: false,
    processedCount: 0,
    totalCount: 0,
    onProcessClick: action('processClicked'),
    class: "",
  },
};

export const IdleWithItems = {
  render: BaseRender,
  args: {
    pendingEmbeddingCount: 5,
    isEmbedding: false,
    processedCount: 0,
    totalCount: 0,
    onProcessClick: action('processClicked'),
    class: "",
  },
};

// --- NEW: Story showing progress --- 
export const ProcessingWithProgress = {
  render: BaseRender,
  args: {
    pendingEmbeddingCount: 150,
    isEmbedding: true,
    processedCount: 65,
    totalCount: 150,
    onProcessClick: action('processClicked'),
    class: "",
  },
};

// Old Processing story without progress shown
export const ProcessingInitial = {
  render: BaseRender,
  args: {
    pendingEmbeddingCount: 5,
    isEmbedding: true,
    processedCount: 0,
    totalCount: 5,
    onProcessClick: action('processClicked'),
    class: "",
  },
};

// Removed Complete/Error stories as button state handles this

// export const CompleteWithMessage = { ... }; // Removed
// export const ErrorState = { ... }; // Removed 