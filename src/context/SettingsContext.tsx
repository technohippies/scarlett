import { createContext, useContext, Component, createResource, createSignal, ParentComponent, createEffect } from 'solid-js';
import { createStore, produce } from 'solid-js/store'; // Import produce for easier updates
import { userConfigurationStorage } from '../services/storage/storage';
import type { UserConfiguration, FunctionConfig, RedirectSettings, RedirectServiceSetting } from '../services/storage/types'; // Centralize types
import type { ProviderOption } from '../features/models/ProviderSelectionPanel'; // Use types from panels where appropriate
import type { ModelOption } from '../features/models/ModelSelectionPanel'; // Need ModelOption too
import type { LLMConfig } from '../services/llm/types'; 

// Import provider implementations (adjust as needed, consider a registry)
// These imports need to be fixed based on the previous correction
import { OllamaProvider } from '../services/llm/providers/ollama'; 
import { JanProvider } from '../services/llm/providers/jan'; 
import { LMStudioProvider } from '../services/llm/providers/lmstudio';

// --- Helper Types (Local to context or shared) ---
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
export type TestStatus = 'idle' | 'testing' | 'success' | 'error';
// Update SettingsLoadStatus to include all possible states from createResource
export type SettingsLoadStatus = 'pending' | 'ready' | 'errored' | 'unresolved' | 'refreshing';

// --- Provider Implementations Map (Keep close to usage or in a service) ---
const providerImplementations = {
  ollama: OllamaProvider,
  jan: JanProvider,
  lmstudio: LMStudioProvider,
};

// --- Context Interface ---
// Defines the value provided by the context
interface ISettingsContext {
  config: typeof settingsStore; // Read-only access to store state
  loadStatus: () => SettingsLoadStatus;
  // Actions for direct settings updates (which also handle saving)
  updateLlmConfig: (config: FunctionConfig | null) => Promise<void>;
  updateEmbeddingConfig: (config: FunctionConfig | null) => Promise<void>;
  updateReaderConfig: (config: FunctionConfig | null) => Promise<void>;
  updateRedirectSetting: (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => Promise<void>;
  updateFullRedirectSettings: (settings: RedirectSettings) => Promise<void>; // Action to replace all redirect settings
  // Actions for dynamic operations + their transient state
  fetchModels: (funcType: string, provider: ProviderOption) => Promise<ModelOption[]>; // Make async, return models
  getTransientState: (funcType: string) => { // Get transient state scoped by function type
      models: () => ModelOption[];
      fetchStatus: () => FetchStatus;
      fetchError: () => Error | null;
      testStatus: () => TestStatus;
      testError: () => Error | null;
      showSpinner: () => boolean;
  };
  testConnection: (funcType: string, config: FunctionConfig) => Promise<void>; // Make async
}

// --- Initial State ---
// Define the default structure of your settings
const initialSettings: UserConfiguration = {
    nativeLanguage: null,
    targetLanguage: null,
    learningGoal: null,
    llmConfig: null,
    embeddingConfig: null,
    // Default reader config to null instead of specific provider
    readerConfig: null, // Use the new object structure
    redirectSettings: {}, // Default empty object
    onboardingComplete: false,
};

// --- Store Definition ---
// Use createStore for potentially complex/nested state
const [settingsStore, setSettingsStore] = createStore<UserConfiguration>(initialSettings);

// --- Context Definition ---
// Create the actual context object
const SettingsContext = createContext<ISettingsContext | undefined>(undefined); // Initialize with undefined

// --- Provider Component ---
export const SettingsProvider: ParentComponent = (props) => {
    // Resource to load initial settings from storage
    const [loadedSettings] = createResource(async () => {
        console.log("[SettingsContext] Attempting to load settings from storage...");
        const storedValue = await userConfigurationStorage.getValue();
        console.log("[SettingsContext] Value loaded from storage:", storedValue);
        // Return the stored value or the initial state if nothing is stored
        return storedValue || initialSettings; 
    });

    // Effect to populate the store once the resource is ready
    createEffect(() => {
        if (!loadedSettings.loading && loadedSettings.state === 'ready' && loadedSettings()) {
            console.log("[SettingsContext] Settings resource is ready. Updating store state.");
            // Use produce for potentially safer nested updates if needed, or direct set
            setSettingsStore(produce(state => {
                Object.assign(state, loadedSettings());
            }));
        } else if (loadedSettings.error) {
             console.error("[SettingsContext] Error loading settings:", loadedSettings.error);
        }
    });

    // --- Transient state signals MAP for fetch/test (scoped by function type) ---
    const [transientState, setTransientState] = createStore<Record<string, {
        models: ModelOption[];
        fetchStatus: FetchStatus;
        fetchError: Error | null;
        testStatus: TestStatus;
        testError: Error | null;
        showSpinner: boolean;
        spinnerTimeoutId?: ReturnType<typeof setTimeout>;
    }>>({});

    // Helper to get or initialize transient state for a function type
    const ensureTransientState = (funcType: string) => {
        if (!transientState[funcType]) {
            setTransientState(funcType, {
                models: [],
                fetchStatus: 'idle',
                fetchError: null,
                testStatus: 'idle',
                testError: null,
                showSpinner: false,
                spinnerTimeoutId: undefined
            });
        }
    };

    // Helper to save settings (can be called by update actions)
    const saveCurrentSettings = async () => {
        try {
            // Create a plain object copy for saving if store is complex proxy
            const settingsToSave = JSON.parse(JSON.stringify(settingsStore));
            await userConfigurationStorage.setValue(settingsToSave);
            console.log("[SettingsContext] Settings saved to storage:", settingsToSave);
        } catch (error) {
            console.error("[SettingsContext] Failed to save settings:", error);
            // Optional: Add user feedback about save failure
        }
    };

    // --- Define Actions ---

    // Example: Update LLM Config
    const updateLlmConfig = async (config: FunctionConfig | null) => {
        setSettingsStore('llmConfig', config);
        await saveCurrentSettings(); // Save after updating store
    };
    // ... other update actions (updateEmbeddingConfig, updateReaderConfig) ...
    const updateEmbeddingConfig = async (config: FunctionConfig | null) => {
      setSettingsStore('embeddingConfig', config);
      await saveCurrentSettings();
    };
    const updateReaderConfig = async (config: FunctionConfig | null) => {
      // Directly update the readerConfig object
      setSettingsStore('readerConfig', config);
      await saveCurrentSettings();
    };


    const updateRedirectSetting = async (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => {
        // Use produce for potentially easier nested updates
        setSettingsStore(produce(state => {
            if (!state.redirectSettings) {
                state.redirectSettings = {}; // Ensure object exists
            }
             state.redirectSettings[service] = {
                ...(state.redirectSettings[service] || { isEnabled: true, chosenInstance: '' }), // Ensure defaults
                ...update
            };
        }));
        await saveCurrentSettings();
    };

    const updateFullRedirectSettings = async (settings: RedirectSettings) => {
        setSettingsStore('redirectSettings', settings);
        await saveCurrentSettings();
    };

    // --- Dynamic Operations ---

    const fetchModels = async (funcType: string, provider: ProviderOption): Promise<ModelOption[]> => {
        ensureTransientState(funcType);
        // Clear previous spinner timeout
        const currentTimeoutId = transientState[funcType]?.spinnerTimeoutId;
        if (currentTimeoutId) clearTimeout(currentTimeoutId);

        setTransientState(funcType, 'fetchStatus', 'loading');
        setTransientState(funcType, 'fetchError', null);
        setTransientState(funcType, 'models', []);
        setTransientState(funcType, 'showSpinner', false); // Hide initially

        // Start spinner delay timer
        const timeoutId = setTimeout(() => {
            // Only show if still loading
            if (transientState[funcType]?.fetchStatus === 'loading') {
                setTransientState(funcType, 'showSpinner', true);
            }
        }, 200); // 200ms delay
        setTransientState(funcType, 'spinnerTimeoutId', timeoutId);


        try {
            // Get the current Base URL for the function type from the main store
            let baseUrl: string | undefined | null = null;
            if (funcType === 'LLM' && settingsStore.llmConfig) {
                baseUrl = settingsStore.llmConfig.baseUrl;
            } else if (funcType === 'Embedding' && settingsStore.embeddingConfig) {
                baseUrl = settingsStore.embeddingConfig.baseUrl;
            } else if (funcType === 'Reader' && settingsStore.readerConfig) {
                baseUrl = settingsStore.readerConfig.baseUrl;
            }

            if (!baseUrl) {
                baseUrl = provider.defaultBaseUrl; // Fallback to default if not set
                console.warn(`[SettingsContext] Base URL not found in config for ${funcType}, using default: ${baseUrl}`);
                if (!baseUrl) {
                    throw new Error(`Cannot fetch models for ${funcType}: Base URL is missing in config and provider has no default.`);
                }
            }

            // Call the actual provider's listModels function
            const fetchedModelInfo = await providerImplementations[provider.id as keyof typeof providerImplementations].listModels({ baseUrl });

            // Map ModelInfo to ModelOption, ensuring name is a string
            const fetchedModelOptions: ModelOption[] = fetchedModelInfo.map(info => ({
                id: info.id,
                name: info.name || info.id // Use ID as fallback name
            }));

            // Sort models alphabetically by name
            fetchedModelOptions.sort((a: ModelOption, b: ModelOption) => a.name.localeCompare(b.name));

            setTransientState(funcType, 'models', fetchedModelOptions);
            setTransientState(funcType, 'fetchStatus', 'success');
            console.log(`[SettingsContext] Models fetched successfully for ${funcType} / ${provider.id}.`);
            return fetchedModelOptions;
        } catch (err: any) {
            console.error(`[SettingsContext] Error fetching models for ${funcType} / ${provider.id}:`, err);
            setTransientState(funcType, 'fetchError', err);
            setTransientState(funcType, 'fetchStatus', 'error');
            return []; // Return empty array on error
        } finally {
             // Always clear spinner and timeout on completion (success or error)
            const finalTimeoutId = transientState[funcType]?.spinnerTimeoutId;
            if (finalTimeoutId) clearTimeout(finalTimeoutId);
             setTransientState(funcType, 'showSpinner', false);
             setTransientState(funcType, 'spinnerTimeoutId', undefined);
        }
    };

    const testConnection = async (funcType: string, config: FunctionConfig) => {
        ensureTransientState(funcType);
        // Use providerId instead of provider
        const providerId = config.providerId;
        const providerImpl = providerImplementations[providerId as keyof typeof providerImplementations];

        if (!providerImpl || !providerImpl.testConnection) {
            console.warn(`[SettingsContext] No testConnection method for provider: ${providerId}. Skipping.`);
             setTransientState(funcType, 'testStatus', 'success'); // Assume success if no test
             setTransientState(funcType, 'testError', null);
            return;
        }

        setTransientState(funcType, 'testStatus', 'testing');
        setTransientState(funcType, 'testError', null);

        try {
            console.log(`[SettingsContext] Testing connection for ${funcType} with config:`, config);
            // Map FunctionConfig to LLMConfig format expected by testConnection
            const testArgs: LLMConfig = {
                provider: config.providerId,
                // Assert non-null since testConnection assumes model/baseUrl are selected
                model: config.modelId!,
                baseUrl: config.baseUrl!,
                // Add apiKey: undefined or appropriate value if needed by LLMConfig/testConnection
            };
            await providerImpl.testConnection(testArgs, funcType as 'LLM' | 'Embedding' | 'Reader');
             setTransientState(funcType, 'testStatus', 'success');
            console.log(`[SettingsContext] Connection test successful for ${funcType}.`);
        } catch (err: any) {
            console.error(`[SettingsContext] Connection test failed for ${funcType}:`, err);
             setTransientState(funcType, 'testError', err);
             setTransientState(funcType, 'testStatus', 'error');
             // Rethrow or handle as needed, maybe notify user
        }
    };

    // Function to get scoped transient state accessors
    const getTransientState = (funcType: string) => {
         ensureTransientState(funcType); // Make sure the state exists
         return {
            models: () => transientState[funcType]?.models || [],
            fetchStatus: () => transientState[funcType]?.fetchStatus || 'idle',
            fetchError: () => transientState[funcType]?.fetchError || null,
            testStatus: () => transientState[funcType]?.testStatus || 'idle',
            testError: () => transientState[funcType]?.testError || null,
            showSpinner: () => transientState[funcType]?.showSpinner || false,
         };
    };

    // --- Context Value ---
    // Assemble the value to be provided by the context
    const value: ISettingsContext = {
        config: settingsStore,
        // Ensure the type matches the resource state directly
        loadStatus: () => loadedSettings.state,
        updateLlmConfig,
        updateEmbeddingConfig, // Add other update actions
        updateReaderConfig,
        updateRedirectSetting,
        updateFullRedirectSettings,
        fetchModels,
        getTransientState, // Provide the getter function
        testConnection,
    };

    // --- Render Provider ---
    return (
        <SettingsContext.Provider value={value}>
            {props.children}
        </SettingsContext.Provider>
    );
};

// --- Custom Hook ---
// Hook for easily consuming the context
export const useSettings = (): ISettingsContext => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        // Provide a more helpful error message
        throw new Error("useSettings must be used within a SettingsProvider. Make sure your component is wrapped in <SettingsProvider>.");
    }
    return context;
};

// --- Import Fix Placeholder --- 
// Removing redundant imports as they are correctly placed at the top now
// import { OllamaProvider } from '../services/llm/providers/ollama';
// import { JanProvider } from '../services/llm/providers/jan';
// import { LMStudioProvider } from '../services/llm/providers/lmstudio';

// ... rest of the file remains unchanged ... 