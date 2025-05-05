// stories/pages/settings/SettingsPageView.stories.tsx
import { action } from '@storybook/addon-actions'; // For logging handler calls
// Use createEffect from solid-js
import { createSignal, createEffect, type Accessor } from 'solid-js'; 
import SettingsPageView from '../../../src/pages/settings/SettingsPageView';
import type { UserConfiguration, RedirectSettings, RedirectServiceSetting, FunctionConfig } from '../../../src/services/storage/types';
import type { ProviderOption } from '../../../src/features/models/ProviderSelectionPanel';
import type { ModelOption } from '../../../src/features/models/ModelSelectionPanel';
// Import the exported status types
import type { SettingsLoadStatus, FetchStatus, TestStatus } from '../../../src/context/SettingsContext'; 

// --- Mock Data ---

const mockLlmProviderOptions: ProviderOption[] = [
    { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
    { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' },
    { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
];
const mockEmbeddingProviderOptions: ProviderOption[] = [...mockLlmProviderOptions];
const mockTtsProviderOptions: ProviderOption[] = [];

const mockRedirectSettings: RedirectSettings = {
  GitHub: { isEnabled: true, chosenInstance: '' },
  ChatGPT: { isEnabled: false, chosenInstance: '' },
  'X (Twitter)': { isEnabled: true, chosenInstance: '' },
  Reddit: { isEnabled: true, chosenInstance: '' },
  Twitch: { isEnabled: false, chosenInstance: '' },
  YouTube: { isEnabled: true, chosenInstance: '' },
  'YouTube Music': { isEnabled: true, chosenInstance: '' },
  Medium: { isEnabled: true, chosenInstance: '' },
  Bluesky: { isEnabled: false, chosenInstance: '' },
  Pixiv: { isEnabled: true, chosenInstance: '' },
  Soundcloud: { isEnabled: true, chosenInstance: '' },
  Genius: { isEnabled: false, chosenInstance: '' },
};

const mockInitialConfig: UserConfiguration = {
    nativeLanguage: 'en',
    targetLanguage: 'es',
    learningGoal: 'casual',
    llmConfig: null,
    embeddingConfig: null,
    ttsConfig: null,
    redirectSettings: mockRedirectSettings,
    onboardingComplete: true,
};

const mockLlmConfigSelected: FunctionConfig = {
    providerId: 'ollama',
    modelId: 'llama3:latest',
    baseUrl: 'http://localhost:11434'
};

// Helper type for the transient state accessors expected by the ViewProps
interface TransientStateAccessors {
  localModels: Accessor<ModelOption[]>;
  remoteModels: Accessor<ModelOption[]>;
  fetchStatus: Accessor<FetchStatus>;
  fetchError: Accessor<Error | null>;
  testStatus: Accessor<TestStatus>;
  testError: Accessor<Error | null>;
  showSpinner: Accessor<boolean>;
}


// Helper to create mock transient state accessors
const createMockTransientState = (
    localModels: ModelOption[] = [],
    remoteModels: ModelOption[] = [],
    fetchStatus: FetchStatus = 'idle',
    fetchError: Error | null = null,
    testStatus: TestStatus = 'idle',
    testError: Error | null = null,
    showSpinner: boolean = false
): TransientStateAccessors => ({ // Ensure return type matches interface
    localModels: () => localModels,
    remoteModels: () => remoteModels,
    fetchStatus: () => fetchStatus,
    fetchError: () => fetchError,
    testStatus: () => testStatus,
    testError: () => testError,
    showSpinner: () => showSpinner,
});

// --- Story Definition ---
export default {
  title: 'Pages/Settings/SettingsPageView',
  component: SettingsPageView,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
     initialActiveSection: {
        control: { type: 'select' },
        options: ['llm', 'embedding', 'tts', 'redirects', null],
        description: 'Initial active section to display',
        name: 'Initial Section'
     },
     initialLoadStatus: {
         control: { type: 'select' },
         options: ['pending', 'ready', 'errored'],
         description: 'Simulate initial load status',
         name: 'Load Status'
     },
     config: { table: { disable: true } },
     llmTransientState: { table: { disable: true } },
     embeddingTransientState: { table: { disable: true } },
     ttsTransientState: { table: { disable: true } },
     llmProviderOptions: { table: { disable: true } },
     embeddingProviderOptions: { table: { disable: true } },
     ttsProviderOptions: { table: { disable: true } },
     onSectionChange: { action: 'onSectionChange' },
     onLlmSelectProvider: { action: 'onLlmSelectProvider' },
     onLlmSelectModel: { action: 'onLlmSelectModel' },
     onLlmTestConnection: { action: 'onLlmTestConnection' },
     onEmbeddingSelectProvider: { action: 'onEmbeddingSelectProvider' },
     onEmbeddingSelectModel: { action: 'onEmbeddingSelectModel' },
     onEmbeddingTestConnection: { action: 'onEmbeddingTestConnection' },
     onRedirectSettingChange: { action: 'onRedirectSettingChange' },
     onBackClick: { action: 'onBackClick' },
  },
  args: {
    initialActiveSection: 'llm',
    initialLoadStatus: 'ready',
    config: mockInitialConfig,
    llmTransientState: createMockTransientState([], []),
    embeddingTransientState: createMockTransientState([], []),
    ttsTransientState: createMockTransientState([], []),
  }
};

// --- Base Render Function ---
const BaseRender = (args: any) => {
    // Simulate activeSection state needed for sidebar interaction within the story
    const [activeSection, setActiveSection] = createSignal<string | null>(args.initialActiveSection);

    // Update internal signal when control arg changes
    createEffect(() => setActiveSection(args.initialActiveSection));

    // Construct the full props object expected by SettingsPageView
    // Ensure all required props are provided, using args for overrides
    const viewProps = {
        loadStatus: () => args.initialLoadStatus as SettingsLoadStatus,
        config: args.config, // Use the potentially overridden config from args
        activeSection: activeSection, // Use the signal accessor
        llmTransientState: args.llmTransientState,
        embeddingTransientState: args.embeddingTransientState,
        ttsTransientState: args.ttsTransientState,
        llmProviderOptions: mockLlmProviderOptions, // Use fixed mock options
        embeddingProviderOptions: mockEmbeddingProviderOptions,
        ttsProviderOptions: mockTtsProviderOptions,
        onSectionChange: (section: string | null) => {
            action('onSectionChange')(section); // Log the action
            setActiveSection(section); // Update the signal for UI feedback
            // Note: Storybook controls won't update automatically here,
            // but the UI within the story will reflect the change.
        },
        // Pass actions directly for other handlers
        onLlmSelectProvider: action('onLlmSelectProvider'),
        onLlmSelectModel: action('onLlmSelectModel'),
        onLlmTestConnection: action('onLlmTestConnection'),
        onEmbeddingSelectProvider: action('onEmbeddingSelectProvider'),
        onEmbeddingSelectModel: action('onEmbeddingSelectModel'),
        onEmbeddingTestConnection: action('onEmbeddingTestConnection'),
        onRedirectSettingChange: async (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => {
            action('onRedirectSettingChange')(service, update);
        },
        onBackClick: action('onBackClick'),
    };

    // Validate required props are present (basic check)
    if (!viewProps.loadStatus || !viewProps.config || !viewProps.activeSection || !viewProps.llmTransientState) {
        console.error("[Storybook Render Error] Missing required props for SettingsPageView");
        return <div>Error: Missing required props</div>;
    }


    return <SettingsPageView {...viewProps} />;
};

// --- Stories ---

export const Default = {
  render: BaseRender,
  args: {
    initialActiveSection: 'llm',
    initialLoadStatus: 'ready',
    config: mockInitialConfig,
    llmTransientState: createMockTransientState([], []),
  },
};

export const Loading = {
  render: BaseRender,
  args: {
    initialLoadStatus: 'pending',
    initialActiveSection: null,
  },
};

export const LoadError = {
  render: BaseRender,
  args: {
    initialLoadStatus: 'errored',
    initialActiveSection: null,
  },
};

export const LLM_ModelsReady = {
  render: BaseRender,
  args: {
    initialActiveSection: 'llm',
    initialLoadStatus: 'ready',
    config: { ...mockInitialConfig, llmConfig: { providerId: 'ollama', modelId: '', baseUrl: 'http://localhost:11434' } },
    llmTransientState: createMockTransientState(
        [ { id: 'llama3:latest', name: 'llama3:latest' }, { id: 'mistral:latest', name: 'mistral:latest' } ],
        [],
        'success'
    ),
  },
};

export const LLM_TestReady = {
  render: BaseRender,
  args: {
    initialActiveSection: 'llm',
    initialLoadStatus: 'ready',
    config: { ...mockInitialConfig, llmConfig: mockLlmConfigSelected },
    llmTransientState: createMockTransientState(
        [ { id: 'llama3:latest', name: 'llama3:latest' }, { id: 'mistral:latest', name: 'mistral:latest' } ],
        [],
        'success',
        null,
        'idle'
    ),
  },
};

export const LLM_TestSuccess = {
  render: BaseRender,
  args: {
    ...LLM_TestReady.args, // Inherit base args
    // Override only the necessary part of the transient state
    llmTransientState: createMockTransientState(
        LLM_TestReady.args.llmTransientState.localModels(),
        LLM_TestReady.args.llmTransientState.remoteModels(),
        'success',
        null,
        'success'
    ),
  },
};

export const LLM_TestError = {
  render: BaseRender,
  args: {
     ...LLM_TestReady.args, // Inherit base args
     // Override only the necessary part of the transient state
     llmTransientState: createMockTransientState(
        LLM_TestReady.args.llmTransientState.localModels(),
        LLM_TestReady.args.llmTransientState.remoteModels(),
        'success',
        null,
        'error',
        new Error('Connection failed: Timeout')
    ),
  },
};

export const Redirects = {
  render: BaseRender,
  args: {
    initialActiveSection: 'redirects',
    initialLoadStatus: 'ready',
    config: mockInitialConfig, // Use default config which includes redirects
  },
};

// TODO: Add stories for Embedding and Reader sections