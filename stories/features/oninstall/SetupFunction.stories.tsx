import { SetupFunction, ProviderOption } from '../../../src/features/oninstall/SetupFunction';
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
    },
    _testStatus: {
        control: { type: 'select' },
        options: ['idle', 'testing', 'success', 'error'],
        description: 'Simulated connection test status (Storybook only)',
        name: 'Simulated Test Status'
    },
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
    description: "If you can't run a 4B+ model like Gemma3 or Qwen3 locally, setup Jan with an OpenRouter model, many of which are free.",
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
    title: "Go Faster with Reader LM",
    description: "Converts HTML to Markdown fast! 1.5B model, 1.1 GB.",
    initialProviderId: 'ollama',
    // initialModelId: 'mock-model-1', // Can pre-select a mock model ID
    _fetchStatus: 'success'
  },
    render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Story showing the Connection/CORS error state for Ollama
export const ConnectionErrorOllama = {
  name: "Connection Error (Ollama)",
  args: {
    functionName: 'LLM',
    providerOptions: mockLLMProviders,
    title: 'Configure LLM',
    description: "If you can't run a 4B+ model like Gemma3 or Qwen3 locally, setup Jan with an OpenRouter model, many of which are free.",
    initialProviderId: 'ollama', // Need a provider selected to show error context
    _fetchStatus: 'error' // Set to error
    // _mockErrorType: 'TypeError' // Could add another control later to simulate different errors
  },
  render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Story showing the Connection/CORS error state for Jan
export const ConnectionErrorJan = {
  name: "Connection Error (Jan)",
  args: {
    ...ConnectionErrorOllama.args, // Inherit common args
    initialProviderId: 'jan', // Set provider to Jan
    _fetchStatus: 'error',
  },
  render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Story showing the Connection/CORS error state for LMStudio
export const ConnectionErrorLMStudio = {
  name: "Connection Error (LMStudio)",
  args: {
    ...ConnectionErrorOllama.args, // Inherit common args
    initialProviderId: 'lmstudio', // Set provider to LMStudio
    _fetchStatus: 'error',
  },
  render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// --- New Stories for Test Connection States ---

// Story for successful fetch, ready to test (Jan)
export const ReadyToTestJan = {
  name: "Test Connection Ready (Jan)",
  args: {
    functionName: 'LLM',
    providerOptions: mockLLMProviders,
    title: 'Configure LLM',
    description: "If you can't run a 4B+ model like Gemma3 or Qwen3 locally, setup Jan with an OpenRouter model, many of which are free.",
    initialProviderId: 'jan',
    initialModelId: 'mock-model-1', // Pre-select mock model
    _fetchStatus: 'success',
    _testStatus: 'idle' // Test is ready but not run
  },
  render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Story showing the Test Connection error state for Jan
export const TestConnectionErrorJan = {
  name: "Test Connection Error (Jan)",
  args: {
    ...ReadyToTestJan.args, // Inherit setup
    _testStatus: 'error' // Simulate test failure
  },
  render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Story showing the Test Connection error state for LMStudio
export const TestConnectionErrorLMStudio = {
  name: "Test Connection Error (LMStudio)",
  args: {
    ...ReadyToTestJan.args, // Inherit setup
    initialProviderId: 'lmstudio',
    _testStatus: 'error' // Simulate test failure
  },
  render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
};

// Story showing the Test Connection success state 
export const TestConnectionSuccess = {
  name: "Test Connection Success",
  args: {
    ...ReadyToTestJan.args, // Inherit setup
    _testStatus: 'success' // Simulate test success
  },
  render: (args: any) => (<div class="h-screen w-full"><SetupFunction {...args} /></div>),
}; 