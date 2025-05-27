import { Component, type Accessor } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { ArrowClockwise } from 'phosphor-solid';
import type { Messages } from '../../types/i18n'; // Import Messages

// Props for the component
export interface EmbeddingProcessingPanelProps {
  pendingEmbeddingCount: Accessor<number>;
  isEmbedding: Accessor<boolean>;
  // Status message prop might not be needed if all state is shown in the button
  embedStatusMessage: Accessor<string | null>;
  onProcessClick: () => void; 
  processedCount?: Accessor<number>; // Optional: Items processed in current batch
  totalCount?: Accessor<number>;   // Optional: Total items in current batch
  class?: string; // Allow passing additional classes for positioning/margin
  messages?: Messages | undefined; // Added messages prop
}

export const EmbeddingProcessingPanel: Component<EmbeddingProcessingPanelProps> = (props) => {
  // Hide the panel when there's nothing to embed and not currently embedding
  if (!props.isEmbedding() && props.pendingEmbeddingCount() === 0) {
    return null;
  }
  const i18n = () => {
    const msgs = props.messages;
    return {
      get: (key: string, fallback: string) => msgs?.[key]?.message || fallback,
    };
  };

  // Determine button text and state
  const buttonContent = () => {
    const processed = props.processedCount ? props.processedCount() : 0;
    const total = props.totalCount ? props.totalCount() : 0;

    if (props.isEmbedding()) {
      return (
        <span class="flex items-center justify-center w-full">
          <Spinner class="mr-2 h-5 w-5 animate-spin" />
          {i18n().get('embeddingPanelButtonEmbeddingInProgress', 'Embedding...')}
          {(total > 0) && <span class="ml-2 text-sm">({processed}/{total})</span>}
        </span>
      );
    } else if (props.pendingEmbeddingCount() > 0) {
      return (
        <span class="flex items-center justify-center w-full">
          <ArrowClockwise weight="bold" size={18} class="mr-2" />
          {i18n().get('embeddingPanelButtonEmbed', 'Update Memory')} ({props.pendingEmbeddingCount()})
        </span>
      );
    } else {
      return (
        <span class="flex items-center justify-center w-full">
          {i18n().get('embeddingPanelButtonEmbed', 'Update Memory')}
        </span>
      );
    }
  };

  const isDisabled = () => {
    return props.isEmbedding() || props.pendingEmbeddingCount() === 0;
  };

  return (
    <Button
      onClick={props.onProcessClick}
      disabled={isDisabled()}
      size="sm" // Reduced size for header placement
      class={`w-[180px] ${props.class ?? ''}`} // Fixed width instead of min-width to prevent any resizing
      variant={props.pendingEmbeddingCount() > 0 && !props.isEmbedding() ? "outline" : "secondary"}
    >
      {buttonContent()}
    </Button>
    
    // --- Removed old structure --- 
    // <div class={`embedding-panel-area ...`}>...</div>
  );
}; 