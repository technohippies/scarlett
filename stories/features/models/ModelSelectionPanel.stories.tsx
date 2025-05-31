import { createSignal, createEffect } from 'solid-js';
import { ModelSelectionPanel, type ModelOption } from '../../../src/features/models/ModelSelectionPanel';
import type { ProviderOption } from '../../../src/features/models/ProviderSelectionPanel';

// --- Mock Data ---
const mockOllamaProvider: ProviderOption = { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/ollama.png' };
const mockJanProvider: ProviderOption = { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/jan.png' };

const mockOllamaModels: ModelOption[] = [
    { id: 'llama3:latest', name: 'llama3:latest' },
    { id: 'mistral:latest', name: 'mistral:latest' },
    { id: 'codellama:latest', name: 'codellama:latest' },
    { id: 'bge-m3:latest', name: 'bge-m3:latest' }, // Embedding model
];
const mockJanLocalModels: ModelOption[] = [
    { id: 'jan-local-mistral-7b', name: 'Mistral 7B Instruct v0.2 (Local)' },
    { id: 'jan-local-bge-base', name: 'BGE Base EN v1.5 (Local)' }, // Embedding
];
const mockJanRemoteModels: ModelOption[] = [
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo (Remote)' },
    { id: 'mistralai/mixtral-8x7b', name: 'Mixtral 8x7B (Remote)' },
     { id: 'jan-remote-llama-8b', name: 'Llama3 8B Instruct (Remote)' },
];

// --- Story Definition ---
export default {
  title: 'Features/Models/ModelSelectionPanel',
  component: ModelSelectionPanel,
  tags: ['autodocs'],
  argTypes: {
    functionName: {
      control: 'select',
      options: ['LLM', 'Embedding', 'Reader'],
      description: 'The type of function being configured (affects filtering/display)',
    },
    selectedProvider: { control: 'object', description: 'The selected provider object' },
    fetchStatus: {
      control: 'select',
      options: ['idle', 'loading', 'success', 'error'],
      description: 'Simulated fetch status',
    },
    showSpinner: { control: 'boolean', description: 'Force spinner visibility (usually derived from fetchStatus)' },
    fetchError: { control: 'object', description: 'Simulated fetch error object (null for no error)' },
    fetchedModels: { control: 'object', description: 'Array of primary/local models' },
    remoteModels: { control: 'object', description: 'Array of remote models (for Jan)' },
    // selectedModelId is managed internally
    selectedModelId: { table: { disable: true } },
    onSelectModel: { table: { disable: true } },
    _forceOSForOllamaInstructions: {
        control: 'select',
        options: [undefined, 'linux', 'macos', 'windows', 'unknown'],
        description: 'Force specific OS instructions for Ollama CORS help'
    },
  },
  args: { // Default args for simplest case (Ollama, LLM, Success)
    functionName: 'LLM',
    selectedProvider: mockOllamaProvider,
    fetchStatus: 'success',
    showSpinner: false,
    fetchError: null,
    fetchedModels: mockOllamaModels.filter(m => !m.id.includes('embed') && !m.id.includes('reader')), // Simulate LLM filtering
    remoteModels: [],
    _forceOSForOllamaInstructions: undefined,
  },
};

// --- Base Render Function ---
// Use 'any' for args type to match the requested pattern
const BaseRender = (args: any) => {
    const [selectedModel, setSelectedModel] = createSignal<string | undefined>(undefined);

    const handleSelect = (modelId: string | undefined) => {
        console.log('[Story] Model selected:', modelId);
        setSelectedModel(modelId);
    };

    // Create signals from args to pass as accessors to the component
    const [provider, setProvider] = createSignal(args.selectedProvider);
    const [status, setStatus] = createSignal(args.fetchStatus);
    const [spinner, setSpinner] = createSignal(args.showSpinner);
    const [error, setError] = createSignal(args.fetchError);
    const [localModels, setLocalModels] = createSignal(args.fetchedModels);
    const [remModels, setRemModels] = createSignal(args.remoteModels);

    // Effects to update signals if controls change (optional but good for dynamic stories)
    createEffect(() => setProvider(args.selectedProvider));
    createEffect(() => setStatus(args.fetchStatus));
    createEffect(() => setSpinner(args.showSpinner));
    createEffect(() => setError(args.fetchError));
    createEffect(() => setLocalModels(args.fetchedModels));
    createEffect(() => setRemModels(args.remoteModels));
    // Reset selection if provider changes
    createEffect(() => {
        args.selectedProvider; // Depend on arg
        setSelectedModel(undefined);
    });

    return (
        <div class="p-4 bg-background max-w-xl mx-auto">
            <ModelSelectionPanel
                functionName={args.functionName}
                selectedProvider={provider}
                fetchStatus={status}
                showSpinner={spinner}
                fetchError={error}
                fetchedModels={localModels}
                remoteModels={remModels}
                selectedModelId={selectedModel}
                onSelectModel={handleSelect}
                _forceOSForOllamaInstructions={args._forceOSForOllamaInstructions}
            />
             <div class="mt-4 text-sm text-muted-foreground">Selected Model ID: {selectedModel() || 'None'}</div>
        </div>
    );
};

// --- Stories ---

export const OllamaSuccessLLM = {
    args: {
        functionName: 'LLM',
        selectedProvider: mockOllamaProvider,
        fetchStatus: 'success',
        showSpinner: false,
        fetchError: null,
        // Simulate filtering for LLM: exclude embedding/reader models
        fetchedModels: mockOllamaModels.filter(m => !m.id.includes('bge-m3') && !m.id.includes('reader-lm')),
        remoteModels: [],
    },
    render: BaseRender,
};

export const OllamaSuccessEmbedding = {
    args: {
        functionName: 'Embedding',
        selectedProvider: mockOllamaProvider,
        fetchStatus: 'success',
        showSpinner: false,
        fetchError: null,
        // Simulate filtering for Embedding: only include embedding models
        fetchedModels: mockOllamaModels.filter(m => m.id.includes('bge-m3')),
        remoteModels: [],
    },
    render: BaseRender,
};

export const OllamaSuccessReader = {
    args: {
        functionName: 'Reader',
        selectedProvider: mockOllamaProvider,
        fetchStatus: 'success',
        showSpinner: false,
        fetchError: null,
        // Simulate filtering for Reader: only include the reader model
        fetchedModels: mockOllamaModels.filter(m => m.id.includes('reader-lm')),
        remoteModels: [],
    },
     render: BaseRender,
};


export const JanSuccessLLM = {
    args: {
        functionName: 'LLM',
        selectedProvider: mockJanProvider,
        fetchStatus: 'success',
        showSpinner: false,
        fetchError: null,
        // For Jan LLM, show local non-embedding models + remote models
        fetchedModels: mockJanLocalModels.filter(m => !m.id.includes('bge')),
        remoteModels: mockJanRemoteModels,
    },
    render: BaseRender,
};

// Jan Embedding - only shows LOCAL embedding models, no remotes
export const JanSuccessEmbedding = {
    args: {
        functionName: 'Embedding',
        selectedProvider: mockJanProvider,
        fetchStatus: 'success',
        showSpinner: false,
        fetchError: null,
        fetchedModels: mockJanLocalModels.filter(m => m.id.includes('bge')),
        remoteModels: [], // Jan Embedding doesn't use remote
    },
    render: BaseRender,
};

export const LoadingWithSpinner = {
    args: {
        functionName: 'LLM',
        selectedProvider: mockOllamaProvider,
        fetchStatus: 'loading',
        showSpinner: true, // Explicitly show spinner for loading state
        fetchError: null,
        fetchedModels: [],
        remoteModels: [],
    },
    render: BaseRender,
};

export const FetchErrorNetwork = {
    args: {
        functionName: 'LLM',
        selectedProvider: mockOllamaProvider,
        fetchStatus: 'error',
        showSpinner: false,
        fetchError: new TypeError("Failed to fetch"), // Simulate CORS/Network error
        fetchedModels: [],
        remoteModels: [],
    },
    render: BaseRender,
};

export const FetchErrorServer = {
    args: {
        functionName: 'LLM',
        selectedProvider: mockOllamaProvider,
        fetchStatus: 'error',
        showSpinner: false,
        fetchError: Object.assign(new Error("Not Found"), { status: 404 }), // Simulate 404
        fetchedModels: [],
        remoteModels: [],
    },
    render: BaseRender,
};

export const FetchErrorOllamaCorsLinux = {
    args: {
        ...FetchErrorNetwork.args, // Reuse network error args
        _forceOSForOllamaInstructions: 'linux',
    },
     render: BaseRender,
};
export const FetchErrorOllamaCorsMac = {
    args: {
        ...FetchErrorNetwork.args,
        _forceOSForOllamaInstructions: 'macos',
    },
     render: BaseRender,
};
export const FetchErrorOllamaCorsWindows = {
    args: {
        ...FetchErrorNetwork.args,
        _forceOSForOllamaInstructions: 'windows',
    },
    render: BaseRender,
};
 export const FetchErrorJanCors = {
    args: {
        functionName: 'LLM',
        selectedProvider: mockJanProvider, // Change provider to Jan
        fetchStatus: 'error',
        showSpinner: false,
        fetchError: new TypeError("Failed to fetch"),
        fetchedModels: [],
        remoteModels: [],
    },
    render: BaseRender,
}; 