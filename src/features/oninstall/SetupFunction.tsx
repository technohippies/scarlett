import { Component, createSignal } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { cn } from '../../lib/utils';
import type { Messages } from '../../types/i18n';
import { ArrowLeft } from 'phosphor-solid';

// Reusable interfaces (consider moving to a types file)
export interface ProviderOption {
  id: string;
  name: string;
  defaultBaseUrl: string;
  logoUrl: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description?: string; // Optional description for display
}

// Define props for the component
interface SetupFunctionProps {
  functionName: string; // e.g., "LLM", "Embedding", "Reader"
  providerOptions: ProviderOption[];
  modelOptions: ModelOption[];
  onComplete: (config: { providerId: string; modelId: string; baseUrl: string }) => void;
  onBack: () => void;
  messages?: Messages;
  title?: string; // Optional override for title
  description?: string; // Optional description text
  initialProviderId?: string; // For potential pre-selection
  initialModelId?: string; // For potential pre-selection
}

export const SetupFunction: Component<SetupFunctionProps> = (props) => {
  const [selectedProviderId, setSelectedProviderId] = createSignal<string | undefined>(props.initialProviderId);
  const [selectedModelId, setSelectedModelId] = createSignal<string | undefined>(props.initialModelId);

  const i18n = () => {
    const messages = props.messages;
    return {
      get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
    };
  };

  const handleSelectProvider = (provider: ProviderOption) => {
    setSelectedProviderId(provider.id);
    // Consider resetting model if provider changes?
    // setSelectedModelId(undefined);
  };

  const handleSubmit = () => {
    const providerId = selectedProviderId();
    const modelId = selectedModelId();
    const provider = props.providerOptions.find(p => p.id === providerId);

    if (providerId && modelId && provider) {
      props.onComplete({ 
        providerId: providerId, 
        modelId: modelId, 
        baseUrl: provider.defaultBaseUrl // Assuming we use the default URL
      });
    }
  };

  const canContinue = () => selectedProviderId() && selectedModelId();

  // TODO: Add logic to filter modelOptions based on selectedProviderId if needed
  const currentModelOptions = () => props.modelOptions;

  return (
    <div class="relative flex flex-col min-h-screen bg-background text-foreground">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={props.onBack}
        aria-label="Go back"
        class="absolute top-4 left-4 text-muted-foreground hover:text-foreground z-10"
      >
        <ArrowLeft class="h-6 w-6" />
      </Button>

      {/* Content Area */}
      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24">
        <img
          src="/images/scarlett-supercoach/scarlett-on-llama.png" // Reusing image
          alt="Scarlett Supercoach"
          class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6 flex-shrink-0"
        />
        <div class="text-center w-full max-w-lg mb-6">
          <p class="text-xl md:text-2xl mb-2">
            {props.title || i18n().get(`onboardingSetup${props.functionName}Title`, `Configure ${props.functionName}`)}
          </p>
          {props.description && (
            <p class="text-lg text-muted-foreground mb-4">{props.description}</p>
          )}
        </div>

        {/* Provider buttons - No heading above */}
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg mb-8">
            {props.providerOptions.map((provider) => {
                const isSelected = () => selectedProviderId() === provider.id;
                return (
                    <Button
                        variant="outline"
                        onClick={() => handleSelectProvider(provider)}
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
                            class="w-16 h-16 mb-2 object-contain rounded-full"
                        />
                        <span class="mb-1.5">{provider.name}</span>
                    </Button>
                );
            })}
        </div>

        {/* Model Selection */}
        <div class="w-full max-w-lg mb-8">
           {/* Changed heading to a label for the select */}
           <label for={`${props.functionName}-model-select`} class="block text-sm font-medium text-muted-foreground mb-1">
                {i18n().get(`onboardingSelect${props.functionName}Label`, `Select ${props.functionName}`)}
           </label>
           <Select<ModelOption>
                options={currentModelOptions()} // Use reactive model options
                optionValue="id"
                optionTextValue="name"
                placeholder={i18n().get(`onboardingSelect${props.functionName}ModelPlaceholder`, `Select a ${props.functionName} model...`)}
                value={currentModelOptions().find(m => m.id === selectedModelId())}
                onChange={(selected) => setSelectedModelId(selected?.id)}
                disabled={!selectedProviderId()} // Disable if no provider is selected
                itemComponent={(props) => (
                    <SelectItem item={props.item} class="cursor-pointer">
                        <div class="flex flex-col">
                            <span class="font-medium">{props.item.rawValue.name}</span>
                            {props.item.rawValue.description && (
                                <span class="text-xs text-muted-foreground">{props.item.rawValue.description}</span>
                            )}
                        </div>
                    </SelectItem>
                )}
            >
                <SelectTrigger id={`${props.functionName}-model-select`} class="w-full" disabled={!selectedProviderId()}>
                    <SelectValue<ModelOption>>{state => state.selectedOption()?.name}</SelectValue>
                </SelectTrigger>
                <SelectContent />
            </Select>
        </div>

      </div>

      {/* Footer Area */}
      <div class="flex-shrink-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center">
        <div class="w-full max-w-xs">
          <Button
            size="lg"
            class="w-full"
            onClick={handleSubmit}
            disabled={!canContinue()}
          >
            {i18n().get('onboardingContinue', 'Continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}; 