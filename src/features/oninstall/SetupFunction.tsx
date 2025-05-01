import { Component, createSignal, createEffect, createResource } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { cn } from '../../lib/utils';
import type { Messages } from '../../types/i18n';
import { ArrowLeft } from 'phosphor-solid';
import { Callout, CalloutContent } from '../../components/ui/callout';
import { Spinner } from '../../components/ui/spinner';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Switch, Match } from 'solid-js';

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

// --- Mock Data for Storybook ---
const storybookMockModels: ModelOption[] = [
    { id: 'mock-model-1', name: 'Mock Model One', description: 'A simulated model for stories.' },
    { id: 'mock-model-2', name: 'Mock Model Two', description: 'Another simulated model.' }
];
const storybookMockError = new TypeError("Simulated connection error (TypeError).");
const storybookMockHttpError = new Error("Simulated HTTP 404");
(storybookMockHttpError as any).status = 404;
// --- End Mock Data ---

// Define props for the component
interface SetupFunctionProps {
  functionName: string; // e.g., "LLM", "Embedding", "Reader"
  providerOptions: ProviderOption[];
  onComplete: (config: { providerId: string; modelId: string; baseUrl: string }) => void;
  onBack: () => void;
  continueLabel: string;
  messages?: Messages;
  title?: string; // Optional override for title
  description?: string; // Optional description text
  initialProviderId?: string; // For potential pre-selection
  initialModelId?: string; // For potential pre-selection
  // Prop specifically for Storybook control
  _fetchStatus?: FetchStatus; 
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export const SetupFunction: Component<SetupFunctionProps> = (props) => {
  const [selectedProviderId, setSelectedProviderId] = createSignal<string | undefined>(props.initialProviderId);
  const [selectedProvider, setSelectedProvider] = createSignal<ProviderOption | undefined>(
    props.providerOptions.find(p => p.id === props.initialProviderId)
  );
  const [selectedModelId, setSelectedModelId] = createSignal<string | undefined>(props.initialModelId);
  const [fetchStatus, setFetchStatus] = createSignal<FetchStatus>(props._fetchStatus || 'idle');
  const [fetchedModels, setFetchedModels] = createSignal<ModelOption[]>([]);
  const [fetchError, setFetchError] = createSignal<Error | null>(null);

  // Ensure fetchModels implementation remains as previously defined
  const fetchModels = async (provider: ProviderOption | undefined): Promise<ModelOption[]> => {
    setFetchedModels([]); // Clear previous models on new fetch
    setFetchError(null);
    if (!provider) return [];

    const baseUrl = provider.defaultBaseUrl.replace(/\/+$/, ''); // Remove trailing slash
    let apiUrl = '';

    // Basic endpoint detection (improve as needed)
    if (provider.id === 'ollama') {
        apiUrl = `${baseUrl}/api/tags`;
    } else { // Assume OpenAI compatible for Jan, LMStudio etc.
        apiUrl = `${baseUrl}/v1/models`;
    }

    console.log(`[SetupFunction] Fetching models for ${provider.name} from ${apiUrl}`);

    try {
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) }); // 5 second timeout

      if (!response.ok) {
        // Throw an error with status for specific handling
        const error = new Error(`HTTP error! status: ${response.status}`);
        (error as any).status = response.status; 
        throw error;
      }

      const data = await response.json();

      // Map response to ModelOption[] based on provider type
      if (provider.id === 'ollama' && data.models) {
        return data.models.map((m: any) => ({ id: m.name, name: m.name, description: `${m.size_vram ? (m.size_vram / 1e9).toFixed(1) + 'B' : 'Size N/A'} - ${m.details?.family}` }));
      } else if (data.data) { // OpenAI format
        return data.data.map((m: any) => ({ id: m.id, name: m.id, description: m.object })); // Basic mapping
      } else {
          console.warn('[SetupFunction] Unexpected API response format:', data);
          throw new Error('Invalid response format from server.');
      }

    } catch (error: any) { // Catch network errors and explicitly thrown errors
      console.error(`[SetupFunction] Error fetching models from ${apiUrl}:`, error);
      setFetchError(error); // Store the error
      throw error; // Re-throw for createResource to catch
    }
  };

  // Resource for actual fetching (now declared after fetchModels)
  const [modelData] = createResource(selectedProvider, fetchModels);

  // Effect to sync internal state with Storybook control OR resource state
  createEffect(() => {
    // --- Storybook Control Logic ---
    if (props._fetchStatus !== undefined) {
        // We are controlled by Storybook args
        setFetchStatus(props._fetchStatus); 
        if (props._fetchStatus === 'success') {
            setFetchedModels(storybookMockModels); // Show mock models
            setFetchError(null);
        } else if (props._fetchStatus === 'error') {
            setFetchedModels([]);
            // Allow simulating different errors via description or a dedicated arg later?
            // For now, default to TypeError simulation
            setFetchError(storybookMockError); 
        } else { // idle or loading
            setFetchedModels([]);
            setFetchError(null);
        }
        return; // Exit early, don't react to resource state
    }

    // --- Real Fetch Logic (reacting to createResource) ---
    if (modelData.loading) {
        setFetchStatus('loading');
        setFetchedModels([]); // Clear models while loading
        setFetchError(null);
    } else if (modelData.error) {
        setFetchStatus('error');
        setFetchedModels([]); 
        // Store the actual error from the resource
        setFetchError(modelData.error); 
    } else if (modelData.state === 'ready') {
        setFetchStatus('success');
        setFetchedModels(modelData() || []); // Update with real models
        setFetchError(null);
    } else { // Initial state or provider deselected
        setFetchStatus('idle');
        setFetchedModels([]);
        setFetchError(null);
    }
  });

  const i18n = () => {
    const messages = props.messages;
    return {
      get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
    };
  };

  const handleSelectProvider = (provider: ProviderOption) => {
    setSelectedProviderId(provider.id);
    setSelectedProvider(provider);
    setSelectedModelId(undefined);
  };

  const handleSubmit = () => {
    const providerId = selectedProviderId();
    const modelId = selectedModelId();
    const provider = props.providerOptions.find(p => p.id === providerId);

    if (providerId && modelId && provider) {
      props.onComplete({
        providerId: providerId,
        modelId: modelId,
        baseUrl: provider.defaultBaseUrl
      });
    }
  };

  const canContinue = () => selectedProviderId() && selectedModelId() && fetchStatus() === 'success';

  return (
    <div class="relative flex flex-col min-h-screen bg-background text-foreground">
      <Button
        variant="ghost"
        size="icon"
        onClick={props.onBack}
        aria-label="Go back"
        class="absolute top-4 left-4 text-muted-foreground hover:text-foreground z-10"
      >
        <ArrowLeft class="h-6 w-6" />
      </Button>

      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24">
        <img
          src="/images/scarlett-supercoach/scarlett-on-llama.png"
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

        {fetchStatus() === 'loading' && (
            <div class="w-full max-w-lg mb-8 flex justify-center items-center space-x-2 text-muted-foreground">
                <Spinner /> 
                <span>{i18n().get('onboardingLoadingModels', 'Connecting to provider...')}</span>
            </div>
        )}

        {fetchStatus() === 'error' && (
            <div class="w-full max-w-lg mb-8 space-y-4">
                <Callout variant="error">
                    <CalloutContent>
                        {(fetchError() instanceof TypeError || (fetchError() as any)?.message?.includes('fetch')) ? (
                            <p>
                                {i18n().get('onboardingErrorConnectionFailed', 'Connection failed.') + " "}
                                {i18n().get('onboardingErrorCheckServerRunning', 'Is the server running at')}{' '}
                                <code class="text-sm font-semibold">{selectedProvider()?.defaultBaseUrl || ''}</code>?{' '}
                                {i18n().get('onboardingErrorCheckProviderHelp', 'Check provider settings below.')}
                            </p>
                        ) : (fetchError() as any)?.status ? (
                            <p>
                                {i18n().get('onboardingErrorHTTPServerPrefix', 'Server responded with error:') + " "}
                                <code class="text-sm font-semibold">{(fetchError() as any).status}</code>.{' '}
                                {i18n().get('onboardingErrorCheckAPIEndpoint', 'Please check the API endpoint.')}
                            </p>
                        ) : (
                            <p>{i18n().get('onboardingErrorUnknown', 'An unknown error occurred:') + " " + (fetchError()?.message || '')}</p>
                        )}
                    </CalloutContent>
                </Callout>

                {(fetchError() instanceof TypeError || (fetchError() as any)?.message?.includes('fetch')) && (
                    <Switch fallback={<p>Provider-specific instructions not available.</p>}>
                        <Match when={selectedProvider()?.id === 'ollama'}>
                            <CodeBlock 
                                language="bash" 
                                code={
`sudo systemctl edit ollama.service
# Add these lines in the editor:
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_ORIGINS=*"

# Save, exit editor, then run:
sudo service ollama restart`}
                            />
                        </Match>
                        <Match when={selectedProvider()?.id === 'jan'}>
                            <p class="text-sm text-muted-foreground mb-2">
                                Enable CORS in Jan settings (Server section):
                            </p>
                            <img 
                                src="/images/llm-providers/Jan-help.png" 
                                alt="Jan CORS setting location" 
                                class="rounded border border-neutral-700 max-w-sm mx-auto" 
                            />
                        </Match>
                        <Match when={selectedProvider()?.id === 'lmstudio'}>
                            <img 
                                src="/images/llm-providers/LMStudio-help.png" 
                                alt="LM Studio CORS setting location" 
                                class="rounded border border-neutral-700 max-w-sm mx-auto" 
                            />
                        </Match>
                    </Switch>
                )}
            </div>
        )}

        {fetchStatus() === 'success' && (
            <div class="w-full max-w-lg mb-8">
                <label for={`${props.functionName}-model-select`} class="block text-sm font-medium text-muted-foreground mb-1">
                     {i18n().get(`onboarding${props.functionName}ModelLabel`, `${props.functionName} Model`)}
                </label>
                <Select<ModelOption>
                     options={fetchedModels()}
                     optionValue="id"
                     optionTextValue="name"
                     placeholder={i18n().get(`onboardingSelect${props.functionName}ModelPlaceholder`, `Select a ${props.functionName} model...`)}
                     value={fetchedModels().find(m => m.id === selectedModelId())}
                     onChange={(selected) => setSelectedModelId(selected?.id)}
                     disabled={fetchStatus() !== 'success' || !selectedProviderId()}
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
        )}

      </div>

      <div class="flex-shrink-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center">
        <div class="w-full max-w-xs">
          <Button
            size="lg"
            class="w-full"
            onClick={handleSubmit}
            disabled={!canContinue()}
          >
            {props.continueLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}; 