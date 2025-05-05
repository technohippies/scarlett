import { Component, createSignal, createEffect, createResource, Show, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { cn } from '../../lib/utils';
import type { Messages } from '../../types/i18n';
import { ArrowLeft, CaretRight, CheckCircle, WarningCircle } from 'phosphor-solid';
import { Callout, CalloutContent } from '../../components/ui/callout';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Switch, Match } from 'solid-js';
import { Label } from '../../components/ui/label';
import { Spinner } from '../../components/ui/spinner';
import { 
  Combobox, 
  ComboboxContent, 
  ComboboxControl, 
  ComboboxInput, 
  ComboboxItem, 
  ComboboxItemIndicator, 
  ComboboxItemLabel, 
  ComboboxTrigger 
} from '../../components/ui/combobox';
import type { LLMConfig } from '../../services/llm/types';
import { getOS } from '../../lib/os'; // Import OS detection
import { Motion, Presence } from 'solid-motionone'; // Add correct import

// --- Import the new panels --- 
import ProviderSelectionPanel, { type ProviderOption } from '../models/ProviderSelectionPanel';
import ModelSelectionPanel, { type ModelOption } from '../models/ModelSelectionPanel';
import ConnectionTestPanel from '../models/ConnectionTestPanel';

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
  // Add the new prop for storybook control
  _forceOSForOllamaInstructions?: 'linux' | 'macos' | 'windows' | 'unknown'; 
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

// Import provider implementations (adjust path as needed)
import { OllamaProvider } from '../../services/llm/providers/ollama';
import { JanProvider } from '../../services/llm/providers/jan';
import { LMStudioProvider } from '../../services/llm/providers/lmstudio';
// Add imports for other providers like LMStudio if they exist

// Map provider IDs to their implementations
// Consider moving this to a central registry if more providers are added
const providerImplementations = {
  ollama: OllamaProvider,
  jan: JanProvider,
  lmstudio: LMStudioProvider, 
};

// Helper to check if error warrants showing CORS help
const shouldShowCorsHelp = (error: Error | null): boolean => {
  if (!error) return false;
  const status = (error as any)?.status;
  return (
    error instanceof TypeError ||
    error.message?.includes('fetch') ||
    status === 403 // Explicitly include 403 Forbidden
    // Add other statuses like 0 (network error) if needed
  );
};

// --- Ollama CORS Instructions Component (Moved Outside) ---
interface OllamaCorsInstructionsProps {
  _forceOS?: 'linux' | 'macos' | 'windows' | 'unknown';
}
const OllamaCorsInstructions: Component<OllamaCorsInstructionsProps> = (props) => {
  const os = props._forceOS || getOS();
  console.log(`[OllamaCorsInstructions] Displaying instructions for OS: ${os}`);
  return (
    <div class="w-full max-w-lg">
      <Switch fallback={<p class="text-xs text-muted-foreground">Instructions not available.</p>}>
        <Match when={os === 'linux'}>
          {/* Linux instructions */}
          <div class="space-y-2">
            <p>1. Copy paste into Terminal</p>
            <CodeBlock language="bash" code="sudo systemctl edit ollama.service" />
            <p>2. Copy and paste this under [Service]</p>
            <CodeBlock language="plaintext" code={'Environment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_ORIGINS=*"'} />
            <p>3. Save, exit, restart</p>
            <CodeBlock language="bash" code="sudo systemctl restart ollama" />
          </div>
        </Match>
        <Match when={os === 'macos'}>
          {/* macOS instructions */}
          <div class="space-y-2">
                <p>1. Copy paste into Terminal</p>
                <div>
                  <CodeBlock language="bash" code={'launchctl setenv OLLAMA_HOST "0.0.0.0" && launchctl setenv OLLAMA_ORIGINS "*"'} /> 
                </div>
                <p>2. Restart Ollama (quit and open)</p>
            </div>
        </Match>
        <Match when={os === 'windows'}>
          {/* Windows instructions */}
          <div class="space-y-2">
                <p>1. Open System Properties &gt; Environment Variables</p>
                <p>2. Under "System variables", click "New...".</p>
                <p>3. Add Variable name: <code class="bg-neutral-700 px-1 py-0.5 rounded">OLLAMA_HOST</code>, Value: <code class="bg-neutral-700 px-1 py-0.5 rounded">0.0.0.0</code></p>
                <p>4. Add Variable name: <code class="bg-neutral-700 px-1 py-0.5 rounded">OLLAMA_ORIGINS</code>, Value: <code class="bg-neutral-700 px-1 py-0.5 rounded">*</code></p>
                <p>5. Click OK, then restart Ollama</p>
                <img 
                    src="/images/llm-providers/ollama-cors-windows.png"
                    alt="Ollama Windows Environment Variables settings"
                    class="mt-4 rounded border border-neutral-700"
                />
            </div>
        </Match>
        <Match when={os === 'unknown'}>
          <p class="text-xs text-muted-foreground">Could not detect OS for specific Ollama instructions. Please consult Ollama documentation for enabling CORS.</p>
        </Match>
      </Switch>
    </div>
  );
};
// --- End Ollama CORS Instructions Component ---

export const SetupFunction: Component<SetupFunctionProps> = (props) => {
  // Default selection logic for single-provider Reader
  const initialDefaultProvider = 
    props.functionName === 'Reader' && props.providerOptions.length === 1 
      ? props.providerOptions[0] 
      : props.providerOptions.find(p => p.id === props.initialProviderId);

  const [selectedProviderId, setSelectedProviderId] = createSignal<string | undefined>(initialDefaultProvider?.id);
  const [selectedProvider, setSelectedProvider] = createSignal<ProviderOption | undefined>(initialDefaultProvider);
  const [selectedModelId, setSelectedModelId] = createSignal<string | undefined>(props.initialModelId);
  const [fetchStatus, setFetchStatus] = createSignal<FetchStatus>(props._fetchStatus || 'idle');
  const [fetchedModels, setFetchedModels] = createSignal<ModelOption[]>([]);
  const [remoteModels, setRemoteModels] = createSignal<ModelOption[]>([]);
  const [fetchError, setFetchError] = createSignal<Error | null>(null);
  const [testStatus, setTestStatus] = createSignal<TestStatus>('idle');
  const [testError, setTestError] = createSignal<Error | null>(null);

  // Signal to control spinner visibility with a delay
  const [showSpinner, setShowSpinner] = createSignal(false);
  let spinnerTimeoutId: ReturnType<typeof setTimeout> | undefined;

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
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) }); // 15 second timeout

      if (!response.ok) {
        // Throw an error with status for specific handling
        const error = new Error(`HTTP error! status: ${response.status}`);
        (error as any).status = response.status; 
        throw error;
      }

      const data = await response.json();

      // Map response to ModelOption[] based on provider type
      if (provider.id === 'ollama' && data.models) {
        let ollamaModels = data.models.map((m: any) => ({
          id: m.name,
          name: m.name,
          description: undefined // Ensure no description is added
        }));

        // Apply function-specific filtering for Ollama
        if (props.functionName === 'Embedding') {
          // Filter *in* known embedding models based on keywords
          const embeddingKeywords = [
            'embed', 
            'bge', 
            'minilm', 
            'paraphrase', 
            'nomic-embed', 
            'mxbai-embed', 
            'snowflake-arctic-embed', 
            'granite-embedding'
          ];
          ollamaModels = ollamaModels.filter((model: ModelOption) => {
            const lowerCaseId = model.id.toLowerCase();
            return embeddingKeywords.some(keyword => lowerCaseId.includes(keyword));
          });
          if (ollamaModels.length === 0) {
             console.log(`[SetupFunction] No known embedding models found in Ollama list based on keywords.`);
          }
        } else if (props.functionName === 'Reader') {
          // Filter specifically for Reader function
          const readerModelName = 'milkey/reader-lm-v2:latest';
          ollamaModels = ollamaModels.filter((model: ModelOption) => model.id === readerModelName);
          if (ollamaModels.length === 0) {
            console.log(`[SetupFunction] Reader model '${readerModelName}' not found in Ollama models.`);
          }
        }
        // Filter specifically for LLM function (exclude embedding/reader models)
        else if (props.functionName === 'LLM') {
          const readerModelName = 'milkey/reader-lm-v2:latest';
          const embeddingKeywords = ['embed', 'bge', 'minilm', 'paraphrase', 'granite', 'embedding']; // Added 'embedding' keyword
          
          ollamaModels = ollamaModels.filter((model: ModelOption) => {
            const lowerCaseId = model.id.toLowerCase();
            // Exclude the specific reader model
            if (lowerCaseId === readerModelName) return false;
            // Exclude models containing embedding keywords
            const isEmbeddingModel = embeddingKeywords.some(keyword => lowerCaseId.includes(keyword));
            return !isEmbeddingModel;
          });
        }

        return ollamaModels;

      } else if (data.data && (provider.id === 'jan' || provider.id === 'lmstudio')) { // OpenAI format - Jan/LMStudio specific handling
        const allModels = data.data.map((m: any) => ({
          id: m.id, 
          name: m.name || m.id, // Prefer name if available
          status: m.status, // Keep status for filtering
          description: undefined // Ensure no description
        }));

        if (provider.id === 'jan') {
          let local = allModels.filter((m: any) => m.status === 'downloaded');
          let remote = allModels.filter((m: any) => m.status !== 'downloaded'); // Group non-local
          console.log(`[SetupFunction] Jan - Initial remote models (${remote.length}):`, remote.map((m: ModelOption) => m.id)); // Log initial remote

          // Apply Embedding filter if necessary
          if (props.functionName === 'Embedding') {
              // ** Jan does not support embedding endpoints. Only show LOCAL models that match keywords. **
              console.log('[SetupFunction] Jan selected for Embedding function. Filtering local models for embedding keywords and clearing remote list.');
              const embeddingKeywords = [
                'embed', 'bge', 'minilm', 'paraphrase', 'nomic-embed', 
                'mxbai-embed', 'snowflake-arctic-embed', 'granite-embedding'
              ];
              local = local.filter((model: ModelOption) => {
                const lowerCaseId = model.id.toLowerCase();
                return embeddingKeywords.some(keyword => lowerCaseId.includes(keyword));
              });
              remote = [];
          }
          // TODO: Add similar filtering for LLM/Reader if needed for Jan?
          
          console.log(`[SetupFunction] Jan models: ${local.length} local, ${remote.length} remote/downloadable.`);
          setRemoteModels(remote); // Set remote models state
          return local; // Return only local models for the primary fetchedModels state
        } else {
          // For LMStudio or others using this format but without status distinction
          setRemoteModels([]); // Ensure remote models are cleared
          // Explicitly type the parameter to satisfy the linter
          interface ModelWithStatus extends ModelOption {
            status?: string; 
          }
          return allModels.map((model: ModelWithStatus) => {
            const { status, ...rest } = model;
            return rest; 
          });
        }

      } else if (data.data) { // Generic OpenAI format fallback (no status check)
         console.log('[SetupFunction] Processing generic OpenAI format response.');
         setRemoteModels([]); // Ensure remote models are cleared
         return data.data.map((m: any) => ({ 
             id: m.id, 
             name: m.name || m.id, 
             description: undefined 
         }));
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
    // Clear any previous timeout when this effect re-runs or loading stops
    if (spinnerTimeoutId) {
      clearTimeout(spinnerTimeoutId);
      spinnerTimeoutId = undefined;
    }
    // Ensure spinner is hidden by default unless loading state explicitly sets it
    setShowSpinner(false);

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
        // If storybook forces loading, show spinner immediately (no delay needed for testing)
        if (props._fetchStatus === 'loading') {
            setShowSpinner(true);
        }
        return; // Exit early, don't react to resource state
    }

    // --- Real Fetch Logic (reacting to createResource) ---
    if (modelData.loading) {
        setFetchStatus('loading');
        setFetchedModels([]); // Clear models while loading
        setRemoteModels([]); // Clear remote models too
        setFetchError(null);
        // Start a timer to show the spinner after a short delay (e.g., 200ms)
        spinnerTimeoutId = setTimeout(() => {
          // Only show if still loading after the delay
          if (modelData.loading) {
            setShowSpinner(true);
          }
          spinnerTimeoutId = undefined; // Clear ID after timeout runs
        }, 200); // 200ms delay
    } else if (modelData.error) {
        setFetchStatus('error');
        setFetchedModels([]);
        setRemoteModels([]); // Clear remote models too
        // Store the actual error from the resource
        setFetchError(modelData.error);
        // Ensure spinner is hidden on error
        setShowSpinner(false); 
    } else if (modelData.state === 'ready') {
        setFetchStatus('success');
        const models = modelData() || [];
        setFetchedModels(models);
        setFetchError(null);
        // Ensure spinner is hidden on success
        setShowSpinner(false); 

        // Auto-select reader model if found
        if (props.functionName === 'Reader' && models.length > 0) {
            const readerModelName = 'milkey/reader-lm-v2:latest';
            const readerModel = models.find(m => m.id === readerModelName);
            if (readerModel) {
                console.log(`[SetupFunction] Auto-selecting Reader model: ${readerModel.id}`);
                setSelectedModelId(readerModel.id);
            }
        }

    } else { // Initial state or provider deselected
        setFetchStatus('idle');
        setFetchedModels([]);
        setRemoteModels([]); // Clear remote models too
        setFetchError(null);
        // Ensure spinner is hidden in idle state
        setShowSpinner(false); 
    }

    // Cleanup function for the effect
    onCleanup(() => {
        if (spinnerTimeoutId) {
            clearTimeout(spinnerTimeoutId);
        }
    });
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

  const handleSelectModel = (modelId: string | undefined) => {
    setSelectedModelId(modelId);
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
  
  // Refactored function to test connection using provider method
  const handleTestConnection = async () => {
    const providerId = selectedProviderId();
    const modelId = selectedModelId();
    const providerInfo = selectedProvider(); // Get the basic info (URL etc)

    if (!providerId || !modelId || !providerInfo) return;

    // Get the actual provider implementation
    const provider = providerImplementations[providerId as keyof typeof providerImplementations];

    if (!provider || !provider.testConnection) {
      console.warn(`[SetupFunction] No testConnection method found for provider: ${providerId}. Skipping test.`);
      // Optionally set status to success to allow proceeding, or error if test is mandatory
      setTestStatus('success'); // Treat as success if no test method
      setTestError(null);
      return;
    }

    setTestStatus('testing');
    setTestError(null);

    // Construct the config needed for the test
    const testConfig: LLMConfig = {
      provider: providerId,
      model: modelId,
      baseUrl: providerInfo.defaultBaseUrl,
      // Add apiKey if relevant: apiKey: providerInfo.apiKey // Assuming apiKey is part of ProviderOption if needed
    };

    console.log(`[SetupFunction] Calling ${providerId}.testConnection for ${props.functionName}`);

    try {
      // Call the provider-specific test method
      await provider.testConnection(testConfig, props.functionName as 'LLM' | 'Embedding' | 'Reader');

      console.log(`[SetupFunction] ${providerId}.testConnection successful.`);
      setTestStatus('success');

    } catch (error: any) {
      console.error(`[SetupFunction] ${providerId}.testConnection failed:`, error);
      // Keep error object as is, display logic handles TimeoutError etc.
      setTestError(error);
      setTestStatus('error');
    }
  };

  // Handler for skip button
  const handleSkip = () => {
    console.log(`[SetupFunction] Skipping ${props.functionName} setup.`);
    props.onComplete({
      providerId: '', // Indicate skipped by empty values
      modelId: '',
      baseUrl: ''
    });
  };

  return (
    <div class="relative flex flex-col h-full bg-background text-foreground">
      <Button
        variant="ghost"
        size="icon"
        onClick={props.onBack}
        aria-label="Go back"
        class="absolute top-4 left-4 text-muted-foreground hover:text-foreground z-10"
      >
        <ArrowLeft class="h-6 w-6" />
      </Button>

      <Show when={props.functionName === 'Reader'}>
        <Button
          variant="ghost"
          onClick={handleSkip}
          aria-label="Skip setup"
          class="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-10 flex items-center space-x-1 px-2"
        >
          <span>{i18n().get('onboardingSkip', 'Skip')}</span>
          <CaretRight class="h-5 w-5" />
        </Button>
      </Show>

      <div class="flex-grow flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24">
        {/* Image 1: Centered at top for sm/md, hidden on lg */}
        <img
          src="/images/scarlett-supercoach/scarlett-on-llama.png"
          alt="Scarlett Supercoach"
          class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6 flex-shrink-0 lg:hidden"
        />

        {/* Main content block (text, providers, model select/status) */} 
        {/* This block remains centered due to parent's items-center */}
        <div class="w-full max-w-lg mb-2">
          <p class="text-xl md:text-2xl mb-2">
            {props.title || i18n().get(`onboardingSetup${props.functionName}Title`, `Configure ${props.functionName}`)}
          </p>
          {props.description && (
            <p class="text-lg text-muted-foreground mb-6">{props.description}</p>
          )}
        </div>

        {/* --- Replace Provider Grid with Panel --- */}
        <div class="w-full max-w-lg mb-6">
          <ProviderSelectionPanel
            providerOptions={props.providerOptions}
            selectedProviderId={selectedProviderId} // Pass accessor
            onSelectProvider={handleSelectProvider}
          />
        </div>

        {/* --- Replace Model Selection Logic with Panels --- */}
        {/* Only render model/test panels if a provider is selected */} 
        <Show when={selectedProviderId() !== undefined}>
          <ModelSelectionPanel
            functionName={props.functionName}
            selectedProvider={selectedProvider} // Pass accessor
            fetchStatus={fetchStatus} // Pass accessor
            showSpinner={showSpinner} // Pass accessor
            fetchError={fetchError} // Pass accessor
            fetchedModels={fetchedModels} // Pass accessor
            remoteModels={remoteModels} // Pass accessor
            selectedModelId={selectedModelId} // Pass accessor
            onSelectModel={handleSelectModel} // Pass new handler
            _forceOSForOllamaInstructions={props._forceOSForOllamaInstructions}
            // Pass messages if needed: messages={props.messages}
          />
          
          {/* Conditionally show Test Panel only when a model is selected AND fetch was successful */} 
          <Show when={fetchStatus() === 'success' && selectedModelId() !== undefined}>
            <ConnectionTestPanel
              testStatus={testStatus} // Pass accessor
              testError={testError} // Pass accessor
              functionName={props.functionName}
              selectedProvider={selectedProvider} // Pass accessor
              _forceOSForOllamaInstructions={props._forceOSForOllamaInstructions}
              // Pass messages if needed: messages={props.messages}
            />
                    </Show>
                  </Show>
       
        {/* End of main content area */}
      </div>

      {/* Image 2: Positioned bottom-right only on lg screens */}
      {/* This should remain outside the main scrollable content */}
      {/* If it needs to scroll, move it inside the flex-grow div */} 
      <img 
        src="/images/scarlett-supercoach/scarlett-on-llama.png"
        alt="Scarlett Supercoach Help Image"
        class="hidden lg:block lg:absolute lg:right-12 lg:bottom-24 lg:w-64 lg:h-64 object-contain pointer-events-none" 
      />

      {/* Footer Button Container - Apply fixed positioning */}
      <div class="fixed bottom-0 left-0 right-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center">
        <div class="w-full max-w-xs">
          <Button
            size="lg"
            class="w-full"
            onClick={handleButtonClick} // Use the dynamic handler
            // Corrected Disable Logic:
            // Disable if: loading models, OR (load succeeded BUT no model selected), OR actively testing.
            disabled={
                !selectedProviderId() || // Disable if no provider selected
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