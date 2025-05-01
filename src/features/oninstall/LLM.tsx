import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import type { Messages } from '../../types/i18n';

// Define the structure for a provider option (Simplified)
export interface LLMProviderOption {
  id: string;
  name: string;
  defaultBaseUrl: string;
  logoUrl: string;
}

// Define props for the component
interface LLMProps {
  onComplete: (selectedProvider: LLMProviderOption) => void;
  selectProviderLabel: string;
  continueLabel: string;
  availableProviders: LLMProviderOption[];
  messages?: Messages; // Optional
}

export const LLM: Component<LLMProps> = (props) => {
  const [selectedProviderId, setSelectedProviderId] = createSignal<string | undefined>();

  const handleSelect = (provider: LLMProviderOption) => {
    // No longer checking isDetected
    setSelectedProviderId(provider.id);
  };

  const handleSubmit = () => {
    const selectedId = selectedProviderId();
    if (!selectedId) return;

    const selectedProvider = props.availableProviders.find(p => p.id === selectedId);
    // No longer checking isDetected
    if (selectedProvider) {
      console.log('[LLM] handleSubmit: Calling onComplete with:', selectedProvider);
      props.onComplete(selectedProvider);
    }
  };

  // Removed canContinue helper

  return (
    <div class="p-4 md:p-8 w-[48rem] mx-auto flex flex-col items-center space-y-6 min-h-screen justify-center bg-background text-foreground">
      <img
        src="/images/scarlett-supercoach/scarlett-on-llama.png"
        alt="Scarlett Supercoach"
        class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6"
      />
      <div class="text-center text-xl md:text-2xl w-full">
        <p>{props.selectProviderLabel}</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-md">
        <For each={props.availableProviders}>
          {(provider) => {
            const isSelected = () => selectedProviderId() === provider.id;
            // const isDisabled = !provider.isDetected; // Removed
            return (
              <Button
                variant="outline"
                onClick={() => handleSelect(provider)}
                // disabled={isDisabled} // Removed
                class={cn(
                  'h-auto p-4 flex flex-col items-center justify-center space-y-2 text-base border relative',
                  'transition-colors duration-150 ease-in-out',
                  // Simplified styling: always clickable, hover effect
                  'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0 border-neutral-700',
                  isSelected()
                    ? 'bg-neutral-700 text-foreground border-neutral-500 ring-2 ring-primary ring-offset-2 ring-offset-background' // Selected style
                    : '' // Default style (already set above)
                )}
              >
                {/* Status Indicator Removed */}
                <img
                  src={provider.logoUrl}
                  alt={`${provider.name} Logo`}
                  class="w-16 h-16 mb-2 object-contain rounded-full"
                />
                <span class="mb-1.5">{provider.name}</span>
                {/* Status Indicator Div Removed */}
              </Button>
            );
          }}
        </For>
      </div>
      <div class="pt-6 w-full max-w-xs">
         <Button
           size="lg"
           class="w-full"
           onClick={handleSubmit}
           disabled={!selectedProviderId()} // Enable if any provider is selected
         >
           {props.continueLabel}
         </Button>
      </div>
    </div>
  );
};
