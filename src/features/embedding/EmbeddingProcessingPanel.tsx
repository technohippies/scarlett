import { Component, Show, type Accessor } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { ArrowClockwise } from 'phosphor-solid';

// Props for the component
export interface EmbeddingProcessingPanelProps {
  pendingEmbeddingCount: Accessor<number>;
  isEmbedding: Accessor<boolean>;
  // Status message prop might not be needed if all state is shown in the button
  // embedStatusMessage: Accessor<string | null>; 
  onProcessClick: () => void; 
  processedCount?: Accessor<number>; // Optional: Items processed in current batch
  totalCount?: Accessor<number>;   // Optional: Total items in current batch
  class?: string; // Allow passing additional classes for positioning/margin
}

export const EmbeddingProcessingPanel: Component<EmbeddingProcessingPanelProps> = (props) => {
  
  // Determine button text and state
  const buttonContent = () => {
    const processed = props.processedCount ? props.processedCount() : 0;
    const total = props.totalCount ? props.totalCount() : 0;

    if (props.isEmbedding()) {
      return (
        <span class="flex items-center justify-center w-full">
          <Spinner class="mr-2 h-5 w-5 animate-spin" />
          Embedding...
          {(total > 0) && <span class="ml-2 text-sm">({processed}/{total})</span>}
        </span>
      );
    } else if (props.pendingEmbeddingCount() > 0) {
      return (
        <span class="flex items-center justify-center w-full">
          <ArrowClockwise weight="bold" size={18} class="mr-2" />
          Embed ({props.pendingEmbeddingCount()})
        </span>
      );
    } else {
        return (
            <span class="flex items-center justify-center w-full">
                Embed
            </span>
        );
    }
  };

  const isDisabled = () => {
    return props.isEmbedding() || props.pendingEmbeddingCount() === 0;
  };

  return (
    // Replace the outer div with a Button component
    <Button
      onClick={props.onProcessClick}
      disabled={isDisabled()}
      size="xl" // Use extra large size
      class={`w-full max-w-xs min-w-[280px] ${props.class ?? ''}`} // Button takes width, max-width, and positioning classes
      variant={props.pendingEmbeddingCount() > 0 && !props.isEmbedding() ? "outline" : "secondary"} // Use outline when active, secondary when disabled/empty
    >
      {buttonContent()} {/* Render dynamic content */}
    </Button>
    
    // --- Removed old structure --- 
    // <div class={`embedding-panel-area ...`}>...</div>
  );
}; 