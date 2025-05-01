import { Component, createSignal, createEffect, createResource, createMemo } from 'solid-js';
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
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export const SetupFunction: Component<SetupFunctionProps> = (props) => {
  const [selectedProviderId, setSelectedProviderId] = createSignal<string | undefined>(props.initialProviderId);
  const [selectedProvider, setSelectedProvider] = createSignal<ProviderOption | undefined>(
    props.providerOptions.find(p => p.id === props.initialProviderId)
  );
  const [selectedModelId, setSelectedModelId] = createSignal<string | undefined>(props.initialModelId);
  const [fetchStatus, setFetchStatus] = createSignal<FetchStatus>(props._fetchStatus || 'idle');
  const [fetchedModels, setFetchedModels] = createSignal<ModelOption[]>([]);
  const [fetchError, setFetchError] = createSignal<Error | null>(null);
  const [testStatus, setTestStatus] = createSignal<TestStatus>('idle');
  const [testError, setTestError] = createSignal<Error | null>(null);

  // Memo to filter models based on function type
  const displayModels = createMemo(() => {
    const models = fetchedModels();
    if (props.functionName !== 'Embedding') {
      return models; // Show all models for LLM/Reader
    }

    // Filter for embedding models
    const embeddingKeywords = ['embed', 'bge', 'minilm', 'paraphrase', 'granite'];
    return models.filter(model => {
        const lowerCaseId = model.id.toLowerCase();
        // Check if model ID contains any known embedding keywords
        const hasKeyword = embeddingKeywords.some(keyword => lowerCaseId.includes(keyword));
        // Additionally, check Ollama's family details if available (might be redundant with keywords but safer)
        const isOllamaEmbeddingFamily = (model as any).details?.family?.toLowerCase().includes('embedding'); 
        return hasKeyword || isOllamaEmbeddingFamily;
    });
  });

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
    } else if (provider.id === 'lmstudio' || provider.id === 'jan') { // Handle HTTP endpoints for WS-based servers
        // Replace ws:// with http:// specifically for the fetch call
        const httpBaseUrl = baseUrl.replace(/^ws:/, 'http:');
        apiUrl = `${httpBaseUrl}/v1/models`;
    } else { // Fallback or handle other specific providers
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
        return data.models.map((m: any) => ({
          id: m.name,
          name: m.name,
          description: undefined // Ensure no description is added
        }));
      } else if (data.data) { // OpenAI format
        return data.data.map((m: any) => ({ id: m.id, name: m.id, description: undefined })); // Ensure no description is added
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

  // Reset test status when provider or model changes
  createEffect(() => {
    selectedProviderId(); // Depend on provider
    selectedModelId(); // Depend on model
    setTestStatus('idle');
    setTestError(null);
    console.log("[SetupFunction] Provider or model changed, resetting test status.");
  });

  // Determine the correct label for the main action button
  const buttonLabel = () => {
    if (fetchStatus() === 'success' && selectedModelId()) {
      if (testStatus() === 'idle' || testStatus() === 'error') {
        return i18n().get('onboardingTestConnection', 'Test Connection');
      } else if (testStatus() === 'testing') {
        return i18n().get('onboardingTestingConnection', 'Testing...');
      } else { // testStatus === 'success'
        return props.continueLabel;
      }
    } 
    // Default to continueLabel if models not fetched or selected yet (button will be disabled anyway)
    return props.continueLabel;
  };

  // Determine the correct action for the main button click
  const handleButtonClick = () => {
     if (fetchStatus() === 'success' && selectedModelId()) {
        if (testStatus() === 'idle' || testStatus() === 'error') {
            handleTestConnection();
        } else if (testStatus() === 'success') {
            handleSubmit();
        } // No action if testing
     }
  };

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

  // We enable the main continue button only after a successful test
  const canContinue = () => selectedProviderId() && selectedModelId() && fetchStatus() === 'success' && testStatus() === 'success';

  // Function to test the actual inference endpoint
  const handleTestConnection = async () => {
    const provider = selectedProvider();
    const modelId = selectedModelId();

    if (!provider || !modelId) return;

    setTestStatus('testing');
    setTestError(null);

    const baseUrl = provider.defaultBaseUrl.replace(/\/+$/, '');
    let testApiUrl = '';
    let requestBody: any = {};
    let httpBaseUrl = baseUrl; // Default to original base URL

    try {
      if (provider.id === 'ollama') {
        if (props.functionName === 'Embedding') {
          testApiUrl = `${baseUrl}/api/embed`;
          requestBody = { model: modelId, input: "test" }; 
        } else { // LLM or Reader
          testApiUrl = `${baseUrl}/api/generate`;
          requestBody = { model: modelId, prompt: 'hi', stream: false, options: { num_predict: 1 } };
        }
      } else if (provider.id === 'lmstudio' || provider.id === 'jan') {
        // Replace ws:// with http:// specifically for the test fetch call
        httpBaseUrl = baseUrl.replace(/^ws:/, 'http:');
        if (props.functionName === 'Embedding') {
          testApiUrl = `${httpBaseUrl}/v1/embeddings`; // Standard OpenAI embed endpoint
          requestBody = { model: modelId, input: "test" };
        } else { // LLM or Reader
          testApiUrl = `${httpBaseUrl}/v1/chat/completions`;
          requestBody = { model: modelId, messages: [{ role: 'user', content: 'What is 2+2? Respond with nothing else.' }], max_tokens: 1 };
        }
      } else {
        // Fallback or other providers might use OpenAI standard
        if (props.functionName === 'Embedding') {
           testApiUrl = `${baseUrl}/v1/embeddings`;
           requestBody = { model: modelId, input: "test" };
        } else { // LLM or Reader
           testApiUrl = `${baseUrl}/v1/chat/completions`;
           requestBody = { model: modelId, messages: [{ role: 'user', content: 'What is 2+2? Respond with nothing else.' }], max_tokens: 1 };
        }
      }

      console.log(`[SetupFunction] Testing connection to ${provider.name} at ${testApiUrl} for ${props.functionName}`);

      const response = await fetch(testApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(7000) // Slightly longer timeout for inference test
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorBody = await response.json();
          errorMsg += ` - ${JSON.stringify(errorBody)}`;
        } catch { /* Ignore if body isn't JSON */ }
        throw new Error(errorMsg);
      }

      console.log(`[SetupFunction] Connection test to ${provider.name} successful.`);
      setTestStatus('success');

    } catch (error: any) {
      console.error(`[SetupFunction] Connection test failed for ${provider.name} at ${testApiUrl}:`, error);
      // Assume CORS or connectivity issue on TypeError or fetch failure
      setTestError(error instanceof TypeError ? new Error("Connection/CORS Issue") : error);
      setTestStatus('error');
    }
  };

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
        {/* Image 1: Centered at top for sm/md, hidden on lg */}
        <img
          src="/images/scarlett-supercoach/scarlett-on-llama.png"
          alt="Scarlett Supercoach"
          class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6 flex-shrink-0 lg:hidden"
        />

        {/* Main content block (text, providers, model select/status) */} 
        {/* This block remains centered due to parent's items-center */}
        <div class="text-center w-full max-w-lg mb-2">
          <p class="text-xl md:text-2xl mb-2">
            {props.title || i18n().get(`onboardingSetup${props.functionName}Title`, `Configure ${props.functionName}`)}
          </p>
          {props.description && (
            <p class="text-lg text-muted-foreground mb-4">{props.description}</p>
          )}
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg mb-4">
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
            <div class="w-full max-w-lg mb-6 flex justify-center items-center space-x-2 text-muted-foreground">
                <Spinner /> 
            </div>
        )}

        {fetchStatus() === 'error' && (
            <div class="w-full max-w-lg space-y-4">
                <Callout variant="error">
                    <CalloutContent>
                        {(fetchError() instanceof TypeError || (fetchError() as any)?.message?.includes('fetch')) ? (
                            <p class="text-lg">
                                {i18n().get('onboardingErrorFetchFailed', 'Error: Is the server running on')}{' '}{selectedProvider()?.defaultBaseUrl || ''}? Is CORS enabled?
                            </p>
                        ) : (fetchError() as any)?.status ? (
                            <p class="text-lg">
                                {i18n().get('onboardingErrorHTTPServerPrefix', 'Server responded with error:') + " "}
                                {(fetchError() as any).status}.{' '}
                                {i18n().get('onboardingErrorCheckAPIEndpoint', 'Please check the API endpoint.')}
                            </p>
                        ) : (
                            <p class="text-lg">{i18n().get('onboardingErrorUnknown', 'An unknown error occurred:') + " " + (fetchError()?.message || '')}</p>
                        )}
                    </CalloutContent>
                </Callout>

                {(fetchError() && (fetchError() instanceof TypeError || (fetchError() as any)?.message?.includes('fetch'))) && (
                    <div class="w-full max-w-lg text-sm mt-4"> 
                        <Switch fallback={<p class="text-xs text-muted-foreground">Instructions not available.</p>}>
                            <Match when={selectedProvider()?.id === 'ollama'}>
                                <div class="space-y-2">
                                    <p>1. Open Terminal:</p>
                                    <CodeBlock language="bash" code="sudo systemctl edit ollama.service" />
                                    <p>2. Add these lines under [Service]:</p>
                                    <CodeBlock language="plaintext" code={"[Service]\nEnvironment=\"OLLAMA_HOST=0.0.0.0\"\nEnvironment=\"OLLAMA_ORIGINS=*\""} />
                                    <p>3. Save, exit, then run:</p>
                                    <CodeBlock language="bash" code="sudo systemctl restart ollama" />
                                </div>
                            </Match>
                            <Match when={selectedProvider()?.id === 'jan'}>
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
                    </div>
                )}
            </div>
        )}

        {/* --- Model Selection Dropdown (Show ONLY on fetch success) --- */} 
        {fetchStatus() === 'success' && (
            <div class="w-full max-w-lg">
                <label for={`${props.functionName}-model-select`} class="block text-sm font-medium text-muted-foreground mb-1">
                    {i18n().get(`onboarding${props.functionName}ModelLabel`, `${props.functionName} Model`)}
                </label>
                <Select<ModelOption>
                    options={displayModels()}
                    optionValue="id"
                    optionTextValue="name"
                    placeholder={i18n().get(`onboardingSelect${props.functionName}ModelPlaceholder`, `Select a ${props.functionName} model...`)}
                    value={displayModels().find(m => m.id === selectedModelId())}
                    onChange={(selected) => setSelectedModelId(selected?.id)}
                    disabled={fetchStatus() !== 'success' || !selectedProviderId()} // Already covered by outer conditional, but safe
                    itemComponent={(itemProps) => (
                        <SelectItem item={itemProps.item} class="cursor-pointer">
                            <div class="flex flex-col">
                                <span class="font-medium">{itemProps.item.rawValue.name}</span>
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

        {/* --- Test Connection Status Indicators (Show ONLY on fetch success AND model selected) --- */} 
        {fetchStatus() === 'success' && selectedModelId() && (
            <div class="w-full max-w-lg text-center space-y-4 mt-8">
                 {/* Testing Spinner */} 
                 {testStatus() === 'testing' && (
                     <div class="flex justify-center items-center space-x-2 text-muted-foreground">
                         <Spinner /> 
                     </div>
                 )}
 
                 {/* Test Error Callout */} 
                 {testStatus() === 'error' && (
                     <>
                         <Callout variant="error">
                             <CalloutContent>
                                 {/* Show specific error message based on error type */}
                                 <p class="text-lg">
                                     {testError()?.name === 'TimeoutError'
                                         ? i18n().get('onboardingErrorTimeout', 'Error: Connection timed out. Is the server responding?')
                                         : testError() instanceof TypeError 
                                         ? i18n().get('onboardingErrorCORSCheck', 'Error: Is CORS enabled? Enable and restart')
                                         : testError()?.message || i18n().get('onboardingErrorUnknown', 'An unknown error occurred')
                                     }
                                 </p>
                             </CalloutContent>
                         </Callout>
                         {/* Show help images for TypeError (CORS) OR TimeoutError (Server Slow/Stuck) */}
                         {(testError() instanceof TypeError || testError()?.name === 'TimeoutError') && (
                             <div class="w-full max-w-lg text-sm mt-4">
                                 <Switch fallback={<p class="text-xs text-muted-foreground">Instructions not available.</p>}>
                                     <Match when={selectedProvider()?.id === 'ollama'}>
                                         <div class="space-y-2">
                                             <p>1. Open Terminal:</p>
                                             <CodeBlock language="bash" code="sudo systemctl edit ollama.service" />
                                             <p>2. Add these lines under [Service]:</p>
                                             <CodeBlock language="plaintext" code={"[Service]\nEnvironment=\"OLLAMA_HOST=0.0.0.0\"\nEnvironment=\"OLLAMA_ORIGINS=*\""} />
                                             <p>3. Save, exit, then run:</p>
                                             <CodeBlock language="bash" code="sudo systemctl restart ollama" />
                                         </div>
                                     </Match>
                                     <Match when={selectedProvider()?.id === 'jan'}>
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
                             </div>
                         )}
                     </>
                 )}
 
                 {/* Success Indicator */} 
                 {testStatus() === 'success' && (
                     <div class="flex justify-center items-center space-x-2 text-green-500">
                         <span class="text-md">{i18n().get('onboardingTestConnectionSuccess', 'Success!')}</span>
                     </div>
                 )}
             </div>
        )}
       
      </div>

      {/* Image 2: Positioned bottom-right only on lg screens */}
      <img 
        src="/images/scarlett-supercoach/scarlett-on-llama.png"
        alt="Scarlett Supercoach Help Image"
        // Hidden by default, shown and positioned absolutely on large screens
        class="hidden lg:block lg:absolute lg:right-12 lg:bottom-24 lg:w-64 lg:h-64 object-contain pointer-events-none" 
        // bottom-16 is 4rem/64px - Adjust as needed
        // w-40/h-40 is 10rem/160px - Adjust as needed
      />

      <div class="flex-shrink-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center">
        <div class="w-full max-w-xs">
          <Button
            size="lg"
            class="w-full"
            onClick={handleButtonClick} // Use the dynamic handler
            // Disable logic: fetching models, or no model selected, or currently testing
            disabled={
                fetchStatus() === 'loading' || 
                (fetchStatus() === 'success' && !selectedModelId()) ||
                testStatus() === 'testing'
            }
          >
            {/* Use the dynamic label */} 
            {buttonLabel()}
          </Button>
        </div>
      </div>
    </div>
  );
}; 