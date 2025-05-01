import { SetupFunction, ProviderOption, ModelOption } from '../../../src/features/oninstall/SetupFunction';
import messagesEn from '../../../public/_locales/en/messages.json';

// --- Mock Data ---
// (Keep mock providers as they are needed for selection)
const mockLLMProviders: ProviderOption[] = [
  { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
  { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' },
  { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' }
];
const mockEmbeddingProviders: ProviderOption[] = [
  { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
  { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' }
];
const mockReaderProviders: ProviderOption[] = [
    { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
];
// We don't need mock model data here anymore, component simulates it
// --- End Mock Data ---

export default {
  title: 'Features/OnInstall/SetupFunction',
  component: SetupFunction,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: { // Default args used across stories unless overridden
    onComplete: (config: { providerId: string; modelId: string; baseUrl: string }) => { 
        console.log('Story: SetupFunction onComplete triggered with:', config); 
    },
    onBack: () => console.log('Story: SetupFunction onBack triggered'),
    messages: messagesEn,
    continueLabel: messagesEn.onboardingContinue?.message || "Continue",
  },
  argTypes: {
    _fetchStatus: {
        control: { type: 'select' },
        options: ['idle', 'loading', 'success', 'error'],
        description: 'Simulated fetch status (Storybook only)',
        name: 'Simulated Fetch Status'
    }
    // Remove modelOptions from argTypes if it was ever added
  }
};

// Story for LLM Setup - Initial state
export const LLMSetupIdle = {
  name: "LLM Setup (Idle)", // Clearer story name
  args: {
    functionName: 'LLM',
    providerOptions: mockLLMProviders,
    title: 'Configure LLM',
    description: "If you can't run Qwen3 4B or Gemma3 4B or larger locally, setup Jan with an OpenRouter model, many of which are free.",
    _fetchStatus: 'idle' // Explicitly idle
  },
    render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Story for LLM Setup - Loading state
export const LLMSetupLoading = {
  name: "LLM Setup (Loading)",
  args: {
    ...LLMSetupIdle.args, // Inherit args
    _fetchStatus: 'loading' // Set to loading
  },
    render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};


// Story for Embedding Setup - Success state (shows mock models)
export const EmbeddingSetupSuccess = {
  name: "Embedding Setup (Success)",
  args: {
    functionName: 'Embedding',
    providerOptions: mockEmbeddingProviders,
    description: 'Select the provider and model for creating text embeddings.',
    initialProviderId: 'ollama',
    _fetchStatus: 'success' // Set to success
  },
    render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Story for Reader Setup - Success state (shows mock models)
export const ReaderSetupSuccess = {
  name: "Reader Setup (Success)",
  args: {
    functionName: 'Reader',
    providerOptions: mockReaderProviders,
    description: 'Select the provider and model for reading and summarizing content.',
    initialProviderId: 'ollama',
    // initialModelId: 'mock-model-1', // Can pre-select a mock model ID
    _fetchStatus: 'success'
  },
    render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Story showing the Connection/CORS error state
export const ConnectionError = {
  name: "Connection Error (TypeError)",
  args: {
    functionName: 'LLM',
    providerOptions: mockLLMProviders,
    title: 'Configure LLM',
    description: "If you can't run Qwen3 4B or Gemma3 4B or larger locally, setup Jan with an OpenRouter model, many of which are free.",
    initialProviderId: 'ollama', // Need a provider selected to show error context
    _fetchStatus: 'error' // Set to error
    // _mockErrorType: 'TypeError' // Could add another control later to simulate different errors
  },
  render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Optional: Story showing HTTP error state
// Note: Needs enhancement in component to simulate HTTP error via props if desired
export const HTTPError = {
  name: "Connection Error (Simulated HTTP)",
   args: {
     ...ConnectionError.args, // Inherit most args
     _fetchStatus: 'error', // Still uses error status
     // Need a way to tell the component *which* error to simulate if not TypeError
   },
   render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
 }; 