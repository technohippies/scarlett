import type { Component } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';

// Re-use or import the ProviderOption interface
export interface ProviderOption {
  id: string;
  name: string;
  defaultBaseUrl: string;
  logoUrl: string;
}

export interface ProviderSelectionPanelProps {
  providerOptions: ProviderOption[];
  selectedProviderId: () => string | undefined; // Make it an accessor
  onSelectProvider: (provider: ProviderOption) => void;
}

export const ProviderSelectionPanel: Component<ProviderSelectionPanelProps> = (props) => {
  return (
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-lg mx-auto">
      {props.providerOptions.map((provider) => {
        const isSelected = () => props.selectedProviderId() === provider.id;
        return (
          <Button
            variant="outline"
            onClick={() => props.onSelectProvider(provider)}
            class={cn(
              'h-auto p-4 flex flex-col items-center justify-center space-y-2 text-base border relative',
              'transition-colors duration-150 ease-in-out',
              'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0 border-neutral-700',
              isSelected()
                ? 'bg-neutral-700 text-foreground border-neutral-500 ring-2 ring-primary ring-offset-2 ring-offset-background'
                : ''
            )}
          >
            <img
              src={provider.logoUrl}
              alt={`${provider.name} Logo`}
              class="w-16 h-16 mb-2 object-contain rounded-full" // Adjusted styles slightly if needed
            />
            <span class="mb-1.5">{provider.name}</span>
          </Button>
        );
      })}
    </div>
  );
};

export default ProviderSelectionPanel; 