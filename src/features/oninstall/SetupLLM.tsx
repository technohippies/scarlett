import { Component, createSignal, onMount, createMemo } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../components/ui/select';
import * as SelectPrimitive from "@kobalte/core/select"; // Import primitives
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
import { TextField, TextFieldInput } from '../../components/ui/text-field'; // Use TextField components for input
import { ProviderOption } from './SetupProvider'; // Updated import: Renamed type and file is correct
import { OllamaProvider } from '../../services/llm/providers/ollama';
import { JanProvider, loadJanModel } from '../../services/llm/providers/jan';
import { LMStudioProvider } from '../../services/llm/providers/lmstudio'; // Add when ready
import type { ModelInfo, LLMConfig } from '../../services/llm/types';
import type { Messages } from '../../types/i18n';
import { getOperatingSystem } from '../../lib/os'; // Import the OS utility
import { mergeProps } from 'solid-js'; // Import mergeProps
import { CodeBlock } from '../../components/ui/CodeBlock'; // Import the new component
import { Callout, CalloutTitle, CalloutContent } from '../../components/ui/callout'; // Import the new Callout component
import { ArrowLeft } from 'phosphor-solid'; // Import icon

interface SetupLLMProps {
  selectedProvider: ProviderOption;
  onComplete: (config: LLMConfig) => void;
  onBack: () => void; // Add onBack prop
  messages: Messages; // Required for labels/instructions
  // --- Storybook-only Initial State Props ---
  _initialIsLoadingModels?: boolean;
  _initialInitialLoadError?: string | null;
  _initialModels?: ModelInfo[];
  _initialSelectedModelId?: string;
  _initialTestState?: TestState;
  _initialTestError?: string | null;
  _initialIsCorsError?: boolean;
  _initialOS?: 'windows' | 'macos' | 'linux' | 'unknown'; // To override OS for stories
}

type TestState = 'idle' | 'testing' | 'success' | 'error';

export const SetupLLM: Component<SetupLLMProps> = (incomingProps) => {
  // Merge defaults for storybook props
  const props = mergeProps({
      _initialIsLoadingModels: true, // Default to loading initially
      _initialInitialLoadError: null,
      _initialModels: [],
      _initialSelectedModelId: undefined,
      _initialTestState: 'idle' as TestState,
      _initialTestError: null,
      _initialIsCorsError: false,
      _initialOS: getOperatingSystem(), // Default to actual OS
   }, incomingProps);

  // State for initial model loading
  const [isLoadingModels, setIsLoadingModels] = createSignal(props._initialIsLoadingModels);
  const [initialLoadError, setInitialLoadError] = createSignal(props._initialInitialLoadError);

  // State for selected model and model list
  const [models, setModels] = createSignal<ModelInfo[]>(props._initialModels);
  const [selectedModelId, setSelectedModelId] = createSignal<string | undefined>(props._initialSelectedModelId);
  
  // State for the connection test step
  const [testState, setTestState] = createSignal<TestState>(props._initialTestState);
  const [testError, setTestError] = createSignal(props._initialTestError);
  const [isCorsError, setIsCorsError] = createSignal(props._initialIsCorsError);

  const os = props._initialOS; // Get OS once, no need for signal if not changing dynamically

  // --- Functions ---

  // Initial fetch for models when component mounts
  const fetchInitialModels = async () => {
    setIsLoadingModels(true);
    setInitialLoadError(null);
    setModels([]);
    setSelectedModelId(undefined);
    setTestState('idle'); // Reset test state on initial fetch
    setTestError(null);
    setIsCorsError(false);

    const providerId = props.selectedProvider.id;
    const config: Pick<LLMConfig, 'baseUrl'> = {
      baseUrl: props.selectedProvider.defaultBaseUrl,
    };

    console.log(`[SetupLLM] Fetching initial models for ${providerId} from ${config.baseUrl}`);

    try {
      let fetchedModels: ModelInfo[] = [];
      switch (providerId) {
        case 'ollama':
          fetchedModels = await OllamaProvider.listModels(config);
          break;
        case 'jan':
          fetchedModels = await JanProvider.listModels(config);
          break;
        case 'lmstudio':
          fetchedModels = []; // No models to list
          break;
        // Add other providers as needed
        default:
             console.warn('[SetupLLM] Unsupported provider for model listing:', providerId);
             throw new Error(`Cannot list models for unsupported provider: ${providerId}`);
      }

      // Filter models specifically for Ollama
      let filteredModels = fetchedModels;
      if (providerId === 'ollama') {
          const allowedKeywords = ['gemma', 'qwen', 'llama', 'phi'];
          console.log('[SetupLLM] Original Ollama models:', fetchedModels.map(m => m.id));
          filteredModels = fetchedModels.filter(model => 
              allowedKeywords.some(keyword => model.id.toLowerCase().includes(keyword))
          );
          console.log('[SetupLLM] Filtered Ollama models:', filteredModels.map(m => m.id));
      }

      // Specific handling for empty lists based on provider
      if (filteredModels.length === 0 && providerId !== 'lmstudio') {
          console.warn(`[SetupLLM] Initial fetch: Connection successful to ${providerId} but no *allowed* models found.`);
          // Updated error message
          setInitialLoadError(props.messages.onboardingLLMErrorNoModels?.message || 'Error: No compatible models (Gemma, Qwen, Llama, Phi) found for the selected provider.');
      } else if (providerId === 'lmstudio') {
          console.log(`[SetupLLM] Initial fetch: Provider is LM Studio. Setting up for manual input.`);
          setModels([]); // Ensure model list is empty
          setInitialLoadError(null); // Clear any potential error
          // --- TEMP: Pre-fill for testing --- 
          const testModelId = 'smollm-360M-instruct-v0.2-Q8_0-GGUF/smollm-360m-instruct-add-basics-q8_0.gguf';
          setSelectedModelId(testModelId);
          console.log(`[SetupLLM] TEMP: Pre-filled LM Studio model ID: ${testModelId}`);
          // --- END TEMP --- 
          setTestState('idle'); // Ensure test state is ready
      } else {
          console.log(`[SetupLLM] Initial fetch: Found allowed models for ${providerId}:`, filteredModels.map(m => m.id));
          setModels(filteredModels);
          
          // Pre-select model in order: gemma, qwen, llama
          const preferredOrder = ['gemma', 'qwen', 'llama'];
          let preSelectedModelId: string | undefined = undefined;
          for (const keyword of preferredOrder) {
              const foundModel = filteredModels.find(m => m.id.toLowerCase().includes(keyword));
              if (foundModel) {
                  preSelectedModelId = foundModel.id;
                  console.log(`[SetupLLM] Pre-selecting model based on keyword '${keyword}': ${preSelectedModelId}`);
                  break;
              }
          }
          setSelectedModelId(preSelectedModelId); 
          // Ensure test state is idle after successful load, even if no pre-selection
          setTestState('idle');
      }
    } catch (error: any) {
      console.error(`[SetupLLM] Initial fetch error for ${providerId}:`, error);
      const errorMsg = error.message || 'An unknown error occurred';
      setInitialLoadError(`${props.messages.onboardingLLMErrorPrefix?.message || 'Error:'} ${errorMsg}`);
      // Set CORS flag only for initial load error if applicable (less critical here)
      if (providerId === 'ollama' && error instanceof TypeError) {
           setIsCorsError(true); 
      }
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Function to test connection with the selected model
  const testConnection = async () => {
    const modelId = selectedModelId();
    if (!modelId) return; // Should not happen if button is enabled correctly

    setTestState('testing');
    setTestError(null);
    setIsCorsError(false);

    const providerId = props.selectedProvider.id;
    const config: Pick<LLMConfig, 'baseUrl'> = {
      baseUrl: props.selectedProvider.defaultBaseUrl,
    };

    console.log(`[SetupLLM] Testing connection for ${providerId} at ${config.baseUrl} with model ${modelId}`);

    try {
      // --- Jan Specific: Load Model First --- 
      if (providerId === 'jan') {
        try {
            console.log(`[SetupLLM] Attempting to load Jan model: ${modelId}`);
            console.log(`[SetupLLM] Value passed to loadJanModel: '${modelId}'`); 
            await loadJanModel(config, modelId);
            console.log(`[SetupLLM] Jan model ${modelId} loaded successfully.`);
        } catch (loadError: any) {
             console.error(`[SetupLLM] Error loading Jan model ${modelId}:`, loadError);
             const errorMsg = loadError.message || 'Failed to load the selected model on the Jan server.';
             setTestError(`${props.messages.onboardingLLMErrorPrefix?.message || 'Error testing connection:'} ${errorMsg}`);
             setTestState('error');
             setIsCorsError(false); // Loading error is unlikely CORS
             return; // Stop testing if loading failed
        }
      }
      // --- End Jan Specific --- 

      // Use listModels as a simple connectivity test after potential load
      // Adapt based on provider
       switch (providerId) {
         case 'ollama': 
            await OllamaProvider.listModels(config); 
            break;
         case 'jan': 
            await JanProvider.listModels(config); // Still test basic connectivity
            break;
         case 'lmstudio':
            await LMStudioProvider.listModels(config); 
            break;
         default: 
            throw new Error(`Cannot test connection for unsupported provider: ${providerId}`);
       }

      console.log(`[SetupLLM] Test connection successful for ${providerId}.`);
      setTestState('success');

    } catch (error: any) {
      console.error(`[SetupLLM] Test connection error for ${providerId}:`, error);
      const errorMsg = error.message || 'An unknown error occurred';
      setTestError(`${props.messages.onboardingLLMErrorPrefix?.message || 'Error testing connection:'} ${errorMsg}`);
      setTestState('error');

      // Set CORS flag specifically for test errors
      if (providerId === 'ollama' && error instanceof TypeError) {
           console.log("[SetupLLM] Test connection TypeError, likely CORS issue.");
           setIsCorsError(true);
           setTestError(props.messages.onboardingLLMErrorCors?.message || "Connection failed during test. This might be a CORS issue. Please check Ollama's Host and CORS settings.");
      } else {
           setIsCorsError(false); // Ensure CORS flag is false if not a TypeError
      }
    } 
  };

  // Run initial model fetch on mount ONLY if not pre-configured by storybook args
  onMount(() => {
     if (props._initialIsLoadingModels && props._initialModels.length === 0 && !props._initialInitialLoadError) {
        fetchInitialModels();
     } else {
         console.log('[SetupLLM] Skipping initial fetch due to Storybook initial state args.');
     }
  });

  // Called only when test is successful and user clicks "Continue"
  const handleSubmit = () => {
    const modelId = selectedModelId();
    if (!modelId || testState() !== 'success') return; 

    const finalConfig: LLMConfig = {
      provider: props.selectedProvider.id,
      model: modelId,
      baseUrl: props.selectedProvider.defaultBaseUrl, 
    };
    console.log('[SetupLLM] Completing with config after successful test:', finalConfig);
    props.onComplete(finalConfig);
  };

  // Determine button properties based on state
  const getButtonProps = () => {
    const state = testState();
    const modelSelected = !!selectedModelId();
    const initialError = initialLoadError();

    // If there was an initial load error OR a test connection error, show Retry
    if (initialError || state === 'error') {
        return {
            label: props.messages.onboardingLLMRetry?.message || 'Retry',
            onClick: fetchInitialModels, // Always retry fetching models on error
            disabled: isLoadingModels(), // Disable if already loading
        };
    }

    if (state === 'success') {
      return {
        label: props.messages.onboardingContinue?.message || 'Continue',
        onClick: handleSubmit,
        disabled: false,
      };
    }
    if (state === 'testing') {
      return {
        label: props.messages.onboardingLLMTesting?.message || 'Testing...',
        onClick: () => {}, // No action while testing
        disabled: true,
      };
    }
    // Default state ('idle' or 'error')
    return {
      label: props.messages.onboardingLLMTestConnection?.message || 'Test Connection',
      onClick: testConnection,
      disabled: !modelSelected, // Disabled only if no model is selected
    };
  };

  // Make buttonProps reactive using createMemo
  const buttonProps = createMemo(() => getButtonProps());

  // --- UI Rendering --- 
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
          {/* Standard Top Image */} 
          <img
            src="/images/scarlett-supercoach/scarlett-on-llama.png" 
            alt="Scarlett Supercoach on Llama"
            // Adjusted mb for spacing within scrollable area
            class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6 flex-shrink-0"
          />
          
          {/* Group content elements to manage width and spacing */} 
          <div class="w-full max-w-lg space-y-6"> {/* Apply max-width and spacing here */} 
              {/* Initial Loading State */}
              {isLoadingModels() && (
                <div class="flex flex-col items-center space-y-2 w-full">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                </div>
              )}

              {/* Initial Load Error State - Use Callout */}
              {!isLoadingModels() && initialLoadError() && (
                <div class="w-full space-y-2 text-left">
                    <Callout 
                      variant="error" 
                      title="Error"
                    >
                        <CalloutTitle>Error</CalloutTitle>
                        <CalloutContent>
                            <p>{props.messages.onboardingLLMErrorInitialLoad?.message || 'Failed to load models:'} {initialLoadError()}</p>
                        </CalloutContent>
                    </Callout>
                    {isCorsError() && (
                        <p class="mt-2 italic text-muted-foreground text-base">{props.messages.onboardingLLMErrorCorsHint?.message || "(This might be a CORS issue. Try setting Ollama's host/origins if applicable.)"}</p>
                    )}
                </div>
              )}

              {/* Model Selection - Conditional */} 
              {!isLoadingModels() && !initialLoadError() && (
                <div class="w-full space-y-3 flex flex-col items-start">
                    <label for="model-select" class="block text-sm font-medium text-left self-start">
                        Choose Model: 
                    </label>
                    
                    {/* --- Conditional Rendering for Model Selector --- */}
                    {props.selectedProvider.id === 'lmstudio' ? (
                      // --- LM Studio: Use Input Field --- 
                      <TextField 
                        value={selectedModelId() || ''} 
                        onChange={(value: string) => {
                          setSelectedModelId(value); 
                          setTestState('idle'); 
                          setTestError(null);
                          setIsCorsError(false);
                        }}
                        class="w-full"
                      >
                        <TextFieldInput placeholder="Enter loaded model ID (e.g., Org/Model-GGUF)" />
                      </TextField>
                    ) : props.selectedProvider.id === 'jan' ? (
                      // --- Jan: Use Combobox --- 
                      <Combobox<ModelInfo>
                         id="model-select" 
                         options={models()}
                         optionValue="id" 
                         optionTextValue="id" 
                         optionDisabled={(_option) => false} 
                         placeholder={props.messages.onboardingLLMSelectPlaceholder?.message || 'Search or select a model...'}
                         itemComponent={(itemProps) => (
                           <ComboboxItem item={itemProps.item}>
                             <ComboboxItemLabel>{itemProps.item.rawValue.id}</ComboboxItemLabel>
                             <ComboboxItemIndicator />
                           </ComboboxItem>
                         )}
                         multiple={false} 
                         class="w-full"
                         value={models().find(m => m.id === selectedModelId())}
                         onChange={(model) => {
                             setSelectedModelId(model?.id);
                             setTestState('idle'); 
                             setTestError(null);
                             setIsCorsError(false);
                         }}
                       >
                         <ComboboxControl aria-label="Model">
                           <ComboboxInput value={selectedModelId() || ''} />
                           <ComboboxTrigger />
                         </ComboboxControl>
                         <ComboboxContent class="max-h-72 overflow-y-auto" /> 
                       </Combobox>
                    ) : (
                       // --- Ollama (and potentially others): Use Select --- 
                       <Select
                         id="model-select" 
                         options={models()}
                         value={models().find(m => m.id === selectedModelId())}
                         onChange={(model) => {
                             setSelectedModelId(model?.id);
                             setTestState('idle'); 
                             setTestError(null);
                             setIsCorsError(false);
                         }}
                         optionValue="id"
                         optionTextValue="id" 
                         placeholder={props.messages.onboardingLLMSelectPlaceholder?.message || 'Choose a model...'}
                         itemComponent={(itemProps) => (
                             <SelectItem item={itemProps.item}>
                                 {itemProps.item.rawValue.id}
                             </SelectItem>
                         )}
                         multiple={false}
                         class="w-full"
                       >
                         <SelectTrigger class="w-full" aria-label="Model">
                           <SelectPrimitive.Value<ModelInfo> class="flex-grow text-left">
                             {(state) => state.selectedOption()?.id || <span class="text-muted-foreground">{props.messages.onboardingLLMSelectPlaceholder?.message || 'Choose a model...'}</span>}
                           </SelectPrimitive.Value>
                           <SelectPrimitive.Icon as="svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 opacity-50">
                             <path d="M8 9l4 -4l4 4" />
                             <path d="M16 15l-4 4l-4 -4" />
                           </SelectPrimitive.Icon>
                         </SelectTrigger>
                         <SelectContent class="max-h-72 overflow-y-auto" />
                       </Select>
                    )}
                    {/* --- End Conditional Rendering --- */}
                </div>
              )}

              {/* Test Status/Error Display */} 
              {!isLoadingModels() && !initialLoadError() && (
                  <div class="w-full min-h-[100px] mt-4 flex flex-col items-center justify-center">
                    {/* Testing Spinner */} 
                    {testState() === 'testing' && (
                        <div class="flex flex-col items-center space-y-2">
                          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                    )}

                    {/* Test Success Message */} 
                    {testState() === 'success' && (
                        <div class="p-3 rounded-md bg-success/10 text-success text-sm font-medium">
                            {props.messages.onboardingLLMTestSuccess?.message || 'Connection successful!'}
                        </div>
                    )}

                    {/* Test Error Section */} 
                    {testState() === 'error' && testError() && (
                        <div class="w-full space-y-3 text-left">
                          <Callout variant="error"> 
                              <CalloutTitle>Error</CalloutTitle>
                              <CalloutContent>
                                  <p>{testError()}</p> 
                              </CalloutContent>
                          </Callout>

                          {!isCorsError() && (
                              <p class="text-foreground">{props.messages.onboardingLLMErrorInstructions?.message || 'Please ensure the LLM provider server is running and accessible.'}</p>
                          )}

                          {/* CORS help section */} 
                          {props.selectedProvider.id === 'ollama' && isCorsError() && (
                            <div class="space-y-4 pt-3 mt-3 border-t border-neutral-700 text-left text-foreground"> 
                              {/* Check CORS */}
                              <div>
                                <p class="font-medium mb-1">Check CORS:</p>
                                <CodeBlock 
                                  code={`curl -X OPTIONS ${props.selectedProvider.defaultBaseUrl} -H "Origin: ${window.location.origin}" -H "Access-Control-Request-Method: GET" -I`} 
                                  class="mt-1"
                                />
                                <p class="mt-1 italic text-muted-foreground">403 forbidden error means CORS is not enabled</p>
                              </div>

                              {/* Enable CORS Title */} 
                              <p class="font-medium pt-2">Enable CORS:</p> 

                              {/* OS Specific Instructions */} 
                              {/* ... macOS ... */} 
                              {os === 'macos' && (
                                <div class="space-y-1 text-left">
                                  <CodeBlock 
                                      code={`launchctl setenv OLLAMA_ORIGINS '${window.location.origin}'`} 
                                      class="mt-1"
                                    />
                                </div>
                              )}
                              {/* ... Linux ... */} 
                              {os === 'linux' && (
                                <div class="space-y-1 text-left">
                                  <CodeBlock code={`sudo systemctl edit ollama.service`} class="mt-1"/>
                                  <p class="mt-1">Add/edit in [Service] section:</p>
                                  <CodeBlock 
                                    code={`[Service]\nEnvironment="OLLAMA_ORIGINS=${window.location.origin}"\nEnvironment="OLLAMA_HOST=0.0.0.0"`}
                                    class="mt-1"
                                  />
                                </div>
                              )}
                              {/* ... Windows ... */} 
                              {os === 'windows' && (
                                  <div class="space-y-1 text-left">
                                    <p>
                                      Set System Environment Variable: `OLLAMA_ORIGINS` to `{window.location.origin}` (or `*`). Restart Ollama.
                                    </p>
                                  </div>
                              )}
                              {/* ... Unknown ... */} 
                              {os === 'unknown' && (
                                <p class="text-left">{props.messages.onboardingLLMErrorOllamaUnknownOS?.message || 'Check Ollama documentation for CORS/Host setup on your specific OS.'}</p>
                              )}
                            </div>
                          )}
                        </div>
                    )}
                  </div>
              )}
          </div>
      </div>
      {/* Footer Area: Fixed at bottom */}
      <div class="flex-shrink-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center">
          <div class="w-full max-w-xs"> {/* Maintain max-width for button */}
             <Button
               size="lg"
               class="w-full"
               // Access memoized values
               onClick={buttonProps().onClick}
               disabled={buttonProps().disabled}
             >
               {buttonProps().label} 
             </Button>
          </div>
       </div>
    </div>
  );
};
