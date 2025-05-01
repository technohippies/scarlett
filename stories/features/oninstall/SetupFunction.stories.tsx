import { SetupFunction, ProviderOption, ModelOption } from '../../../src/features/oninstall/SetupFunction';
import messagesEn from '../../../public/_locales/en/messages.json';

// --- Mock Data ---
const mockLLMProviders: ProviderOption[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434',
    logoUrl: '/images/llm-providers/ollama.png'
  },
  {
    id: 'jan',
    name: 'Jan',
    defaultBaseUrl: 'http://localhost:1337',
    logoUrl: '/images/llm-providers/jan.png'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    defaultBaseUrl: 'ws://127.0.0.1:1234',
    logoUrl: '/images/llm-providers/lmstudio.png'
  }
];

const mockLLMModels: ModelOption[] = [
    { id: 'llama3:latest', name: 'llama3:latest', description: 'Recommended Llama 3 model.' },
    { id: 'phi3:latest', name: 'phi3:latest', description: "Microsoft's latest small model." },
    { id: 'gemma:7b', name: 'gemma:7b', description: "Google's Gemma 7B model." }
];

const mockEmbeddingProviders: ProviderOption[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434',
    logoUrl: '/images/llm-providers/ollama.png'
  },
   {
    id: 'lmstudio', // Assuming LMStudio can also serve embeddings
    name: 'LM Studio',
    defaultBaseUrl: 'ws://127.0.0.1:1234',
    logoUrl: '/images/llm-providers/lmstudio.png'
  }
];

const mockEmbeddingModels: ModelOption[] = [
  { id: 'nomic-embed-text', name: 'nomic-embed-text', description: 'High-performing open embedding model.' },
  { id: 'mxbai-embed-large', name: 'mxbai-embed-large', description: 'State-of-the-art large embedding model.' },
  { id: 'bge-m3', name: 'bge-m3', description: 'BGE-M3: Versatile embedding model.' },
];

const mockReaderProviders: ProviderOption[] = [
    { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
    // Add others if they can run the reader model
];

const mockReaderModels: ModelOption[] = [
  { id: 'milkey/reader-lm-v2', name: 'milkey/reader-lm-v2', description: 'HTML-to-Markdown conversion.' },
];
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
  },
};

// Story for LLM Setup
export const LLMSetup = {
  args: {
    functionName: 'LLM',
    providerOptions: mockLLMProviders,
    modelOptions: mockLLMModels,
    title: 'Configure LLM', // Example custom title
    description: 'Choose the provider and model for generating text responses.'
  },
    render: (args: any) => (
        <div class="h-screen w-full">
            <SetupFunction {...args} />
        </div>
    ),
};

// Story for Embedding Setup
export const EmbeddingSetup = {
  args: {
    functionName: 'Embedding',
    providerOptions: mockEmbeddingProviders,
    modelOptions: mockEmbeddingModels,
    // title: 'Configure Embedding' // Using default title construction
    description: 'Select the provider and model for creating text embeddings.',
    initialProviderId: 'ollama' // Example initial selection
  },
    render: (args: any) => (
        <div class="h-screen w-full">
            <SetupFunction {...args} />
        </div>
    ),
};

// Story for Reader Setup
export const ReaderSetup = {
  args: {
    functionName: 'Reader',
    providerOptions: mockReaderProviders,
    modelOptions: mockReaderModels,
    description: 'Select the provider and model for reading and summarizing content.',
    initialProviderId: 'ollama', // Example initial selection
    initialModelId: 'milkey/reader-lm-v2'
  },
    render: (args: any) => (
        <div class="h-screen w-full">
            <SetupFunction {...args} />
        </div>
    ),
}; 