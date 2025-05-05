import { createSignal, createEffect } from 'solid-js';
import { ConnectionTestPanel } from '../../../src/features/models/ConnectionTestPanel';
import type { ProviderOption } from '../../../src/features/models/ProviderSelectionPanel';

// --- Mock Data ---
const mockOllamaProvider: ProviderOption = { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' };
const mockJanProvider: ProviderOption = { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' };

// --- Story Definition ---
export default {
    title: 'Features/Models/ConnectionTestPanel',
    component: ConnectionTestPanel,
    tags: ['autodocs'],
    argTypes: {
        testStatus: {
            control: 'select',
            options: ['idle', 'testing', 'success', 'error'],
            description: 'Simulated connection test status',
        },
        testError: {
            control: 'object',
            description: 'Simulated test error object (null for no error)',
        },
        functionName: {
            control: 'text',
            description: 'Name of the function being tested (LLM, Embedding, etc.)',
        },
        selectedProvider: {
            control: 'object',
            description: 'The selected provider (used for showing CORS help)',
        },
         _forceOSForOllamaInstructions: {
            control: 'select',
            options: [undefined, 'linux', 'macos', 'windows', 'unknown'],
            description: 'Force specific OS instructions for Ollama CORS help'
        },
    },
    args: { // Default args
        testStatus: 'idle',
        testError: null,
        functionName: 'LLM',
        selectedProvider: mockOllamaProvider,
        _forceOSForOllamaInstructions: undefined,
    },
};

// --- Base Render Function ---
// Use 'any' for args type to match the requested pattern
const BaseRender = (args: any) => {
    // Create signals from args to pass as accessors
    const [status, setStatus] = createSignal(args.testStatus);
    const [error, setError] = createSignal(args.testError);
    const [provider, setProvider] = createSignal(args.selectedProvider);

    // Effects to update signals if controls change
    createEffect(() => setStatus(args.testStatus));
    createEffect(() => setError(args.testError));
    createEffect(() => setProvider(args.selectedProvider));

    return (
        <div class="p-4 bg-background max-w-xl mx-auto">
            <ConnectionTestPanel
                testStatus={status}
                testError={error}
                functionName={args.functionName}
                selectedProvider={provider}
                _forceOSForOllamaInstructions={args._forceOSForOllamaInstructions}
            />
            {/* Optional: Add buttons here to manually trigger status changes for testing */}
            {/* <div class="mt-4 space-x-2">
                 <button onClick={() => { setStatus('testing'); setError(null); }}>Set Testing</button>
                 <button onClick={() => { setStatus('success'); setError(null); }}>Set Success</button>
                 <button onClick={() => { setStatus('error'); setError(new Error("Simulated error")); }}>Set Error</button>
                 <button onClick={() => { setStatus('idle'); setError(null); }}>Set Idle</button>
            </div> */}
        </div>
    );
};

// --- Stories ---

export const Idle = {
    args: {
        testStatus: 'idle',
        testError: null,
    },
    render: BaseRender,
};

export const Testing = {
    args: {
        testStatus: 'testing',
        testError: null,
    },
     render: BaseRender,
};

export const Success = {
    args: {
        testStatus: 'success',
        testError: null,
    },
     render: BaseRender,
};

export const ErrorTimeout = {
    args: {
        testStatus: 'error',
        testError: Object.assign(new Error("Timeout"), { name: 'TimeoutError' }),
    },
     render: BaseRender,
};

export const ErrorGeneric = {
    args: {
        testStatus: 'error',
        testError: new Error("Something went wrong during the test."),
    },
     render: BaseRender,
};

export const ErrorCorsOllama = {
     args: {
        testStatus: 'error',
        testError: new TypeError("Failed to fetch"), // Simulate CORS/Network error
        selectedProvider: mockOllamaProvider, // Ensure Ollama provider is selected
    },
    render: BaseRender,
};

export const ErrorCorsJan = {
     args: {
        testStatus: 'error',
        testError: new TypeError("Failed to fetch"),
        selectedProvider: mockJanProvider, // Ensure Jan provider is selected
    },
    render: BaseRender,
};

// Example forcing specific OS for Ollama CORS instructions
export const ErrorCorsOllamaWindows = {
     args: {
        ...ErrorCorsOllama.args,
        _forceOSForOllamaInstructions: 'windows',
    },
    render: BaseRender,
}; 