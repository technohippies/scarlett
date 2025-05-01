import { SetupLLM } from '../../../src/features/oninstall/SetupLLM'; // Reverted import path and name
import { ProviderOption } from '../../../src/features/oninstall/SetupProvider'; // Updated import path and type
import messagesEn from '../../../public/_locales/en/messages.json';
import type { ModelInfo } from '../../../src/services/llm/types'; // Import ModelInfo type

// --- Mock Data ---
const mockOllamaProvider: ProviderOption = { // Updated type
  id: 'ollama',
  name: 'Ollama',
  defaultBaseUrl: 'http://localhost:11434',
  logoUrl: '/images/llm-providers/ollama.png'
};

const mockDisplayModels: ModelInfo[] = [
  { id: 'llama3:latest', provider: 'ollama' /* other fields if needed */ },
  { id: 'phi3:medium', provider: 'ollama' },
  { id: 'gemma:7b', provider: 'ollama' },
];

// --- Story Definition (Simple) ---
export default {
  title: 'Features/OnInstall/SetupLLM', // Reverted title
  component: SetupLLM, // Reverted component
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: { // Default args shared by stories below
    selectedProvider: mockOllamaProvider,
    onComplete: (config: any) => console.log('Story [onComplete]:', config),
    onBack: () => console.log('Story [onBack]:'),
    // Default messages object - ensure keys exist in messages.json!
    messages: {
        ...messagesEn,
        // Use default strings directly to fix type errors, assuming keys don't exist in messagesEn
        onboardingLLMTestConnection: { message: "Test Connection" }, 
        onboardingLLMSelectModel: { message: "Choose Model" },
        // Ensure other necessary keys from messagesEn are included or have fallbacks
    },
    // Default initial state (will be overridden by specific stories)
    _initialIsLoadingModels: false,
    _initialInitialLoadError: null,
    _initialModels: [],
    _initialSelectedModelId: undefined,
    _initialTestState: 'idle',
    _initialTestError: null,
    _initialIsCorsError: false,
    _initialOS: 'linux', // Default to Linux for OS-specific stories unless overridden
  },
};

// Helper function to wrap stories
const renderWithWrapper = (args: any) => (
    <div class="h-screen w-full">
        <SetupLLM {...args} /> // Reverted component usage
    </div>
);

// --- Story Variants for Visual States ---

// 1. Initial Loading State
export const SetupLLMInitialLoading = {
    args: {
        _initialIsLoadingModels: true,
        _initialModels: [], // Ensure no models are shown
    },
    render: renderWithWrapper,
};

// 2. Initial Load Error (Generic)
export const SetupLLMLoadError = {
    args: {
        _initialIsLoadingModels: false,
        _initialInitialLoadError: 'Error: Server connection failed (500)',
        _initialModels: [],
        // Override the entire messages object for this story to change one button label
        messages: {
            ...messagesEn,
            onboardingLLMRetry: { message: "Retry" }, // Use specific label "Retry"
            // Include other required message fallbacks if not in messagesEn
            // Use default strings directly to fix type errors
            onboardingLLMTestConnection: { message: "Test Connection" }, 
        }
    },
    render: renderWithWrapper,
};

// 3. Model Selected, Ready to Test
export const SetupLLMModelSelected = {
    args: {
        _initialIsLoadingModels: false,
        _initialModels: mockDisplayModels,
        _initialSelectedModelId: mockDisplayModels[0].id, // Pre-select the first model
        _initialTestState: 'idle',
    },
    render: renderWithWrapper,
};

// 4. Testing Connection State (Spinner)
export const SetupLLMTestingConnection = {
  args: {
        _initialIsLoadingModels: false,
        _initialModels: mockDisplayModels,
        _initialSelectedModelId: mockDisplayModels[0].id,
        _initialTestState: 'testing', 
    },
    render: renderWithWrapper,
};

// 5. Test Connection Success
export const SetupLLMTestSuccess = {
   args: {
        _initialIsLoadingModels: false,
        _initialModels: mockDisplayModels,
        _initialSelectedModelId: mockDisplayModels[0].id,
        _initialTestState: 'success',
    },
    render: renderWithWrapper,
};

// 6. Test Connection Error (Generic)
export const SetupLLMTestErrorGeneric = {
  args: {
        _initialIsLoadingModels: false,
        _initialModels: mockDisplayModels,
        _initialSelectedModelId: mockDisplayModels[0].id,
        _initialTestState: 'error',
        _initialTestError: 'Error testing connection: Model not found',
        _initialIsCorsError: false,
    },
    render: renderWithWrapper,
};

// Function to create CORS error stories for different OS
const createCorsErrorStoryArgs = (os: 'macos' | 'linux' | 'windows' | 'unknown') => ({
    _initialIsLoadingModels: false,
    _initialModels: mockDisplayModels,
    _initialSelectedModelId: mockDisplayModels[0].id,
    _initialTestState: 'error' as const, // Explicitly type as 'error'
    // Use default string directly to fix type error
    _initialTestError: 'Connection failed during test. This might be a CORS issue.',
    _initialIsCorsError: true,
    _initialOS: os,
    // Ensure messages object is passed here too if needed, though defaults should cover it
    messages: {
        ...messagesEn,
        // Use default string directly to fix type error
        onboardingLLMTestConnection: { message: "Test Connection" }, 
    },
});

// 7. Test Error (CORS - macOS)
export const SetupLLMTestErrorCorsMacos = {
    args: createCorsErrorStoryArgs('macos'),
    render: renderWithWrapper,
};

// 8. Test Error (CORS - Linux)
export const SetupLLMTestErrorCorsLinux = {
    args: createCorsErrorStoryArgs('linux'),
    render: renderWithWrapper,
};

// 9. Test Error (CORS - Windows)
export const SetupLLMTestErrorCorsWindows = {
    args: createCorsErrorStoryArgs('windows'),
    render: renderWithWrapper,
};

// 10. Test Error (CORS - Unknown OS)
export const SetupLLMTestErrorCorsUnknown = {
    args: createCorsErrorStoryArgs('unknown'),
    render: renderWithWrapper,
};

// 11. Default (Ollama Provider Initial State)
// This story shows the component when the Ollama provider is selected.
// The actual display (loading, model list, error) depends on whether
// an Ollama server is accessible at the defaultBaseUrl when viewing the story.
export const SetupLLMOllamaDefault = {
    render: renderWithWrapper,
};

// VISUAL STATE APPROXIMATION NOTES:
// ----------------------------------
// The following states cannot be reliably shown with static stories in this simple format:
//
// - Initial Load Error: Requires mocking the initial `fetchInitialModels` to fail.
//   - To see this visually, you would need to ensure the Ollama server is *not* running
//     or accessible when viewing the `SetupLLMOllamaDefault` story.
//
// - Testing State: Requires simulating the click on "Test Connection" and mocking the
//   `testConnection` API call to be in a pending state. The spinner and "Testing..."
//   button rely on internal component state (`testState`).
//
// - Test Failed (CORS Help): Requires mocking the `testConnection` API call to fail
//   with a CORS-like error (TypeError) and mocking the `getOperatingSystem` utility.
//   - To see this visually, you'd need an advanced setup (e.g., MSW, module mocking)
//     or temporarily modify the component code to force this state.
//
// - Test Success: Requires mocking the `testConnection` API call to succeed.
//   - To see this visually, run a local Ollama server, select a model in the story's
//     UI, and click "Test Connection".
//
// This simplified story file focuses only on setting the initial provider.
