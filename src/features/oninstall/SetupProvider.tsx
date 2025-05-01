import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import type { Messages } from '../../types/i18n';
import { ArrowLeft } from 'phosphor-solid';

// Define the structure for a provider option (Simplified)
export interface ProviderOption {
  id: string;
  name: string;
  defaultBaseUrl: string;
  logoUrl: string;
}

// Define props for the component
interface SetupProviderProps {
  onComplete: (selectedProvider: ProviderOption) => void;
  onBack: () => void;
  selectProviderLabel: string;
  continueLabel: string;
  availableProviders: ProviderOption[];
  messages?: Messages; // Optional
}

export const SetupProvider: Component<SetupProviderProps> = (props) => {
  const [selectedProviderId, setSelectedProviderId] = createSignal<string | undefined>();

  const handleSelect = (provider: ProviderOption) => {
    // No longer checking isDetected
    setSelectedProviderId(provider.id);
  };

  const handleSubmit = () => {
    const selectedId = selectedProviderId();
    if (!selectedId) return;

    const selectedProvider = props.availableProviders.find(p => p.id === selectedId);
    // No longer checking isDetected
    if (selectedProvider) {
      console.log('[SetupProvider] handleSubmit: Calling onComplete with:', selectedProvider);
      props.onComplete(selectedProvider);
    }
  };

  // Removed canContinue helper

  return (
    // Use flex column, full height, add relative
    <div class="relative flex flex-col min-h-screen bg-background text-foreground">
       {/* Back Button (Top Left) */}
       <Button 
           variant="ghost"
           size="icon"
           onClick={props.onBack}
           aria-label="Go back"
           class="absolute top-4 left-4 text-muted-foreground hover:text-foreground z-10"
       >
           <ArrowLeft class="h-6 w-6" />
       </Button>
      {/* Content Area: Ensure pt-24, remove justify-center */}
      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24">
          <img
            src="/images/scarlett-supercoach/scarlett-on-llama.png"
            alt="Scarlett Supercoach"
            // Adjusted mb for spacing within scrollable area
            class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6 flex-shrink-0" 
          />
          <div class="text-center w-full max-w-lg mb-6">
              {/* Main Title */}
              <p class="text-xl md:text-2xl mb-2">{props.selectProviderLabel}</p>
              {/* Added Description Text */}
              <p class="text-lg text-muted-foreground">
                If you can't run Qwen3 4B or Gemma3 4B or larger locally, 
                <a 
                  href="https://jan.ai/docs/remote-models/openrouter"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline text-primary hover:text-primary/90"
                >
                  setup Jan with an OpenRouter model
                </a>, many of which are free.
              </p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg mb-6">
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
      </div>
      {/* Footer Area: Fixed at bottom */}
      <div class="flex-shrink-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center">
          <div class="w-full max-w-xs"> {/* Maintain max-width for button */}
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
    </div>
  );
};
