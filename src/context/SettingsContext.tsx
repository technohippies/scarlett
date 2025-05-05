import { createContext, useContext, createResource, ParentComponent, createEffect } from 'solid-js';
import { createStore, produce } from 'solid-js/store'; // Import produce for easier updates
import { userConfigurationStorage } from '../services/storage/storage';
import type { UserConfiguration, FunctionConfig, RedirectSettings, RedirectServiceSetting } from '../services/storage/types'; // Centralize types
import type { ProviderOption } from '../features/models/ProviderSelectionPanel'; // Use types from panels where appropriate
import type { ModelOption } from '../features/models/ModelSelectionPanel'; // Need ModelOption too
import type { LLMConfig, LLMProviderId } from '../services/llm/types'; 

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

// --- Constants ---
const EMBEDDING_KEYWORDS = [
    'embed', 
    'bge',
    'minilm',
    'paraphrase',
    'nomic-embed', // Use more specific keyword from SetupFunction
    'mxbai-embed', // Use more specific keyword from SetupFunction
    'snowflake-arctic-embed', // Use more specific keyword from SetupFunction
    'granite-embedding' // Use more specific keyword from SetupFunction
    // Add other relevant keywords or model name fragments here if needed
];

// --- Define Provider Options Here ---
const llmProviderOptions: ProviderOption[] = [
    { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
    { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' },
    { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
];
const embeddingProviderOptions: ProviderOption[] = [...llmProviderOptions]; // Reuse for now
const ttsProviderOptions: ProviderOption[] = []; // Placeholder

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
  llmProviderOptions: ProviderOption[];
  embeddingProviderOptions: ProviderOption[];
  ttsProviderOptions: ProviderOption[];
  
  // --- Direct Config Update Actions (Use with care) ---
  updateLlmConfig: (config: FunctionConfig | null) => Promise<void>;
  updateEmbeddingConfig: (config: FunctionConfig | null) => Promise<void>;
  updateRedirectSetting: (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => Promise<void>;
  updateFullRedirectSettings: (settings: RedirectSettings) => Promise<void>; // Action to replace all redirect settings

  // --- UI Interaction Handlers --- 
  handleSelectProvider: (funcType: string, provider: ProviderOption) => Promise<void>;
  handleSelectModel: (funcType: string, modelId: string | undefined) => Promise<void>;
  // handleUpdateBaseUrl: (funcType: string, baseUrl: string) => Promise<void>; // Optional future addition

  // --- Dynamic Operations + Transient State --- 
  fetchModels: (funcType: string, provider: ProviderOption) => Promise<ModelOption[]>; // Make async, return models
  getTransientState: (funcType: string) => { // Get transient state scoped by function type
      localModels: () => ModelOption[];
      remoteModels: () => ModelOption[];
      fetchStatus: () => FetchStatus;
      fetchError: () => Error | null;
      testStatus: () => TestStatus;
      testError: () => Error | null;
      showSpinner: () => boolean;
  };
  testConnection: (funcType: string, config: FunctionConfig) => Promise<void>; // Make async
  handleRedirectSettingChange: (serviceName: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => Promise<void>;
}

// --- Initial Empty Config & State --- 
const initialConfig: UserConfiguration = {
  nativeLanguage: 'en', // Sensible default
  targetLanguage: '', // Needs to be set
  learningGoal: '', // Needs to be set
  onboardingComplete: false,
  llmConfig: null, // Use the new object structure
  embeddingConfig: null, // Use the new object structure
  // readerConfig: null, // Removed Reader
  ttsConfig: null, // Use the new object structure
  redirectSettings: {}
};

// --- Store Definition ---
// Use createStore for potentially complex/nested state
const [settingsStore, setSettingsStore] = createStore<UserConfiguration>(initialConfig);

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
        return storedValue || initialConfig; 
    });

    // Effect to populate the store once the resource is ready
    createEffect(() => {
        if (!loadedSettings.loading && loadedSettings.state === 'ready' && loadedSettings()) {
            console.log("[SettingsContext] Settings resource is ready. Updating store state.");
            // Explicitly type the loaded config
            const currentConfig = loadedSettings() as UserConfiguration;
            // Use produce for potentially safer nested updates if needed, or direct set
            setSettingsStore(produce(state => {
                Object.assign(state, currentConfig); // Update store with loaded config
            }));

            // --- Fetch models for pre-configured providers (Optimized) --- 
            console.log("[SettingsContext] Checking for pre-configured providers to fetch models (optimized)...", currentConfig);

            const providersToFetch = new Map<string, ProviderOption>();
            const funcTypesPerProvider = new Map<string, string[]>();

            // Helper to add provider and associated funcType
            const addProviderTask = (funcType: string, config: FunctionConfig | null, options: ProviderOption[]) => {
                if (config?.providerId) {
                    const provider = options.find(p => p.id === config.providerId);
                    if (provider) {
                        if (!providersToFetch.has(provider.id)) {
                            providersToFetch.set(provider.id, provider);
                            funcTypesPerProvider.set(provider.id, []);
                        }
                        funcTypesPerProvider.get(provider.id)!.push(funcType);
                    } else {
                        console.warn(`[SettingsContext] Pre-configured ${funcType} provider (${config.providerId}) not found in options.`);
                    }
                }
            };

            addProviderTask('LLM', currentConfig.llmConfig, llmProviderOptions);
            addProviderTask('Embedding', currentConfig.embeddingConfig, embeddingProviderOptions);
            // TODO: Add check for TTS

            if (providersToFetch.size > 0) {
                console.log(`[SettingsContext] Found ${providersToFetch.size} unique providers to fetch models for initial load:`, Array.from(providersToFetch.keys()));

                // Set loading state synchronously first for all relevant funcTypes
                providersToFetch.forEach((_provider, providerId) => {
                    const funcTypes = funcTypesPerProvider.get(providerId) || [];
                    funcTypes.forEach(funcType => {
                        ensureTransientState(funcType);
                        console.log(`[SettingsContext] Setting initial fetchStatus to 'loading' for ${funcType} (${providerId})`);
                        setTransientState(funcType, 'fetchStatus', 'loading');
                        setTransientState(funcType, 'fetchError', null);
                        setTransientState(funcType, 'testStatus', 'idle');
                        setTransientState(funcType, 'testError', null);
                        setTransientState(funcType, 'localModels', []);
                        setTransientState(funcType, 'remoteModels', []);
                        setTransientState(funcType, 'showSpinner', false); // Reset spinner too
                    });
                });

                // Now fetch models asynchronously, once per unique provider
                providersToFetch.forEach(async (provider, providerId) => {
                    const funcTypes = funcTypesPerProvider.get(providerId) || [];
                    console.log(`[SettingsContext] Fetching models ONCE for provider: ${providerId} (used by: ${funcTypes.join(', ')})`);
                    try {
                        // Reuse the core logic from fetchModels but without state setting yet
                        const fetchedModelInfoWithOptions = await fetchRawModelsForProvider(provider, currentConfig);

                        // Process results for each funcType using this provider
                        funcTypes.forEach(funcType => {
                             console.log(`[SettingsContext] Processing fetched models for ${funcType} (provider: ${providerId})`);
                             const { localModels, remoteModels } = filterModels(funcType, provider, fetchedModelInfoWithOptions);
                             
                             setTransientState(funcType, 'localModels', localModels);
                             setTransientState(funcType, 'remoteModels', remoteModels);
                             setTransientState(funcType, 'fetchStatus', 'success');
                             setTransientState(funcType, 'fetchError', null); // Clear any previous error
                             console.log(`[SettingsContext] Models processed for ${funcType}. Local: ${localModels.length}, Remote: ${remoteModels.length}`);
                         });

                    } catch (err: any) {
                        console.error(`[SettingsContext] Error fetching models for provider ${providerId}:`, err);
                        // Set error state for all funcTypes using this failed provider
                        funcTypes.forEach(funcType => {
                            setTransientState(funcType, 'fetchError', err);
                            setTransientState(funcType, 'fetchStatus', 'error');
                        });
                    } finally {
                        // Always clear spinner state for all funcTypes using this provider
                        funcTypes.forEach(funcType => {
                           const finalTimeoutId = transientState[funcType]?.spinnerTimeoutId;
                           if (finalTimeoutId) clearTimeout(finalTimeoutId);
                            setTransientState(funcType, 'showSpinner', false);
                            setTransientState(funcType, 'spinnerTimeoutId', undefined);
                        });
                    }
                });
            }

        } else if (loadedSettings.error) {
             console.error("[SettingsContext] Error loading settings:", loadedSettings.error);
        }
    });

    // --- Transient state signals MAP for fetch/test (scoped by function type) ---
    const [transientState, setTransientState] = createStore<Record<string, {
        localModels: ModelOption[];
        remoteModels: ModelOption[];
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
                localModels: [],
                remoteModels: [],
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

    // Example: Update LLM Config (Keep these as direct setters)
    const updateLlmConfig = async (config: FunctionConfig | null) => {
        setSettingsStore('llmConfig', config);
        await saveCurrentSettings(); // Save after updating store
    };
    const updateEmbeddingConfig = async (config: FunctionConfig | null) => {
      setSettingsStore('embeddingConfig', config);
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

    // --- UI Interaction Handler Implementations ---
    const handleSelectProvider = async (funcType: string, provider: ProviderOption | undefined) => {
      console.log(`[SettingsContext] handleSelectProvider called for ${funcType} with provider:`, provider);
      
      ensureTransientState(funcType); // Initializes transientState[funcType]

      // Determine the key for the specific function config
      const configKey = `${funcType.toLowerCase()}Config` as keyof UserConfiguration;

      // Update the store directly, resetting model ID
      setSettingsStore(configKey, {
          providerId: provider?.id,
          modelId: undefined, // <-- RESET modelId here
          baseUrl: provider?.defaultBaseUrl || undefined, // Use default or undefined
      });

      await saveCurrentSettings(); // Save the updated config

      // Clear transient state for the function type using funcType as the key
      setTransientState(funcType, 'fetchStatus', 'idle'); 
      setTransientState(funcType, 'fetchError', null);
      setTransientState(funcType, 'testStatus', 'idle');
      setTransientState(funcType, 'testError', null);
      setTransientState(funcType, 'localModels', []); // Clear models immediately
      setTransientState(funcType, 'remoteModels', []); 

      // Also reset spinner state using funcType as the key
      const currentTimeoutId = transientState[funcType]?.spinnerTimeoutId;
      if (currentTimeoutId) clearTimeout(currentTimeoutId);
      setTransientState(funcType, 'showSpinner', false);
      setTransientState(funcType, 'spinnerTimeoutId', undefined);

      if (provider) {
        console.log(`[SettingsContext] Triggering fetchModels for ${funcType} after provider selection.`);
        await fetchModels(funcType, provider); // Fetch models for the new provider
      } else {
         console.log(`[SettingsContext] Provider deselected for ${funcType}. Models cleared.`);
         // No fetch needed if provider is deselected
      }
    };

    const handleSelectModel = async (funcType: string, modelId: string | undefined) => {
        console.log(`[SettingsContext] handleSelectModel called for ${funcType} with modelId:`, modelId);
        const configKey = `${funcType.toLowerCase()}Config` as keyof UserConfiguration;
        const currentConfig = settingsStore[configKey] as FunctionConfig | null;

        if (currentConfig) {
            const newConfig: FunctionConfig = {
                ...currentConfig,
                modelId: modelId || '', // Use empty string if input is undefined
            };
            switch (configKey) {
                case 'llmConfig': await updateLlmConfig(newConfig); break;
                case 'embeddingConfig': await updateEmbeddingConfig(newConfig); break;
                // Add case for TTS
                default: console.warn(`[SettingsContext] Unknown funcType in handleSelectModel: ${funcType}`);
            }
        } else {
            console.warn(`[SettingsContext] Cannot select model for ${funcType} because current config is null.`);
        }
    };

    // --- Dynamic Operations ---

    // Helper function to fetch raw models (extracted logic)
    const fetchRawModelsForProvider = async (provider: ProviderOption, currentConfig: UserConfiguration): Promise<ModelOption[]> => {
        const providerImpl = providerImplementations[provider.id as keyof typeof providerImplementations];
        if (!providerImpl || !providerImpl.listModels) {
            console.warn(`[SettingsContext] listModels implementation not found for provider: ${provider.id}`);
            return [];
        }

        // Determine the correct baseUrl for the selected provider
        let baseUrl = provider.defaultBaseUrl || '';
        let apiKey: string | undefined;
        if (currentConfig.llmConfig?.providerId === provider.id) { 
            baseUrl = currentConfig.llmConfig.baseUrl || baseUrl;
            apiKey = currentConfig.llmConfig.apiKey ?? undefined;
        } else if (currentConfig.embeddingConfig?.providerId === provider.id) { 
            baseUrl = currentConfig.embeddingConfig.baseUrl || baseUrl;
            apiKey = currentConfig.embeddingConfig.apiKey ?? undefined;
        } 
        // Reader removed
        
        if (!baseUrl) {
            console.warn(`[SettingsContext] No baseUrl configured or defaulted for provider ${provider.id}. Cannot fetch models.`);
            throw new Error(`Base URL is missing for provider ${provider.id}`);
        }
        console.log(`[SettingsContext fetchRawModelsForProvider] Fetching models for ${provider.id} using baseUrl: ${baseUrl}`);
        const models = await providerImpl.listModels({ baseUrl, apiKey }); // Pass apiKey
        // Add providerId to each model info
        return models.map(m => ({ ...m, provider: provider.id })) as ModelOption[];
    };

    // Helper function to filter models based on funcType (extracted logic)
    const filterModels = (funcType: string, provider: ProviderOption, rawModels: ModelOption[]) => {
        console.log(`[SettingsContext filterModels] Filtering ${rawModels.length} raw models for ${funcType} (provider: ${provider.id})`);
        let localModels: ModelOption[] = rawModels;
        let remoteModels: ModelOption[] = []; // Assuming only Ollama has split local/remote concept for now

        if (provider.id === 'ollama') {
            // Keep all models as potential local models for Ollama
        } else if (provider.id === 'jan') {
            // Jan might mix local and remote? Treat all as local for now.
        } else if (provider.id === 'lmstudio') {
            // LM Studio models are typically explicitly loaded, treat as local
        }

        // Apply function-specific filtering
        if (funcType === 'Embedding') {
            // Keep only models containing embedding keywords
            localModels = localModels.filter(model => 
                EMBEDDING_KEYWORDS.some(keyword => model.id.toLowerCase().includes(keyword))
            );
            remoteModels = []; // No remote embedding models assumed
        } 
        // Reader removed
        console.log(`[SettingsContext filterModels] Filtered models for ${funcType}. Local: ${localModels.length}, Remote: ${remoteModels.length}`);
        return { localModels, remoteModels };
    };

    const fetchModels = async (funcType: string, provider: ProviderOption): Promise<ModelOption[]> => {
        ensureTransientState(funcType);
        const currentTimeoutId = transientState[funcType]?.spinnerTimeoutId;
        if (currentTimeoutId) clearTimeout(currentTimeoutId);

        // Set loading state
        setTransientState(funcType, 'fetchStatus', 'loading');
        setTransientState(funcType, 'fetchError', null);
        setTransientState(funcType, 'localModels', []); // Clear models immediately
        setTransientState(funcType, 'remoteModels', []);
        setTransientState(funcType, 'showSpinner', false);

        const timeoutId = setTimeout(() => {
            if (transientState[funcType]?.fetchStatus === 'loading') {
                setTransientState(funcType, 'showSpinner', true);
            }
        }, 200);
        setTransientState(funcType, 'spinnerTimeoutId', timeoutId);

        try {
            // Fetch raw models using helper
            const rawModels = await fetchRawModelsForProvider(provider, settingsStore);
            // Filter models using helper
            const { localModels, remoteModels } = filterModels(funcType, provider, rawModels);

            // Update state
            setTransientState(funcType, 'localModels', localModels);
            setTransientState(funcType, 'remoteModels', remoteModels);
            setTransientState(funcType, 'fetchStatus', 'success');
            console.log(`[SettingsContext] fetchModels completed for ${funcType} / ${provider.id}. Local: ${localModels.length}, Remote: ${remoteModels.length}`);
            return localModels.concat(remoteModels); // Return combined list

        } catch (err: any) {
            console.error(`[SettingsContext] Error in fetchModels for ${funcType} / ${provider.id}:`, err);
            setTransientState(funcType, 'fetchError', err);
            setTransientState(funcType, 'fetchStatus', 'error');
            return []; // Return empty array on error
        } finally {
             // Always clear spinner and timeout on completion
            const finalTimeoutId = transientState[funcType]?.spinnerTimeoutId;
            if (finalTimeoutId) clearTimeout(finalTimeoutId);
             setTransientState(funcType, 'showSpinner', false);
             setTransientState(funcType, 'spinnerTimeoutId', undefined);
        }
    };

    const testConnection = async (funcType: string, config: FunctionConfig) => {
        ensureTransientState(funcType);
        setTransientState(funcType, 'testStatus', 'testing');
        setTransientState(funcType, 'testError', null);
        console.log(`[SettingsContext] Testing connection for ${funcType}...`, config);

        const providerImpl = providerImplementations[config.providerId as keyof typeof providerImplementations];

        if (!providerImpl || !providerImpl.testConnection) {
            console.warn(`[SettingsContext] testConnection implementation not found for provider: ${config.providerId}`);
            setTransientState(funcType, 'testStatus', 'error');
            setTransientState(funcType, 'testError', new Error(`Test function not implemented for ${config.providerId}`));
            return;
        }

        try {
            // Construct the config needed by the test function
            const testArgs: LLMConfig = {
                // --- Add type assertion for providerId --- 
                provider: config.providerId as LLMProviderId, 
                model: config.modelId || '', // Provide modelId even if empty
                baseUrl: config.baseUrl || '', 
                apiKey: config.apiKey ?? undefined,
                // Add other fields if the LLMConfig type requires them (like stream?)
            };
            // --- Update type cast for funcType --- 
            await providerImpl.testConnection(testArgs, funcType as 'LLM' | 'Embedding');
            setTransientState(funcType, 'testStatus', 'success');
            console.log(`[SettingsContext] Connection test successful for ${funcType}.`);
        } catch (err: any) {
            console.error(`[SettingsContext] Connection test failed for ${funcType}:`, err);
            setTransientState(funcType, 'testStatus', 'error');
            setTransientState(funcType, 'testError', err);
        } finally {
            // Optional: Reset status after a delay?
        }
    };

    // Function to get scoped transient state accessors
    const getTransientState = (funcType: string) => {
         ensureTransientState(funcType); // Make sure the state exists
         return {
            localModels: () => transientState[funcType]?.localModels || [],
            remoteModels: () => transientState[funcType]?.remoteModels || [],
            fetchStatus: () => transientState[funcType]?.fetchStatus || 'idle',
            fetchError: () => transientState[funcType]?.fetchError || null,
            testStatus: () => transientState[funcType]?.testStatus || 'idle',
            testError: () => transientState[funcType]?.testError || null,
            showSpinner: () => transientState[funcType]?.showSpinner || false,
         };
    };

    // --- NEW: Handler for Redirect Setting Change ---
    const handleRedirectSettingChange = async (serviceName: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => {
        console.log(`[SettingsContext] Updating redirect for "${serviceName}":`, update);
        const currentConfig = await userConfigurationStorage.getValue(); // Get latest from storage
        if (!currentConfig) {
             console.error("[SettingsContext] Cannot update redirect: config not loaded.");
             return;
        }

        const updatedRedirects = {
            ...(currentConfig.redirectSettings || {}), // Start with existing or empty
            [serviceName]: {
                // Preserve existing chosenInstance if it exists, otherwise default to empty string
                chosenInstance: currentConfig.redirectSettings?.[serviceName]?.chosenInstance || '',
                ...update, // Apply the isEnabled update
            }
        };

        const newConfig = { ...currentConfig, redirectSettings: updatedRedirects };

        try {
            await userConfigurationStorage.setValue(newConfig);
            // Update local context state AFTER successful storage update
            setSettingsStore(prev => ({ ...prev, redirectSettings: updatedRedirects }));
            console.log(`[SettingsContext] Successfully saved and updated redirect setting for "${serviceName}"`);
        } catch (error) {
            console.error(`[SettingsContext] Error saving redirect setting for "${serviceName}":`, error);
            // Optional: Add user feedback about the save error
        }
    };

    // --- Context Value ---
    // Assemble the value to be provided by the context
    const value: ISettingsContext = {
        config: settingsStore,
        // Ensure the type matches the resource state directly
        loadStatus: () => loadedSettings.state,
        // Expose provider options
        llmProviderOptions,
        embeddingProviderOptions,
        ttsProviderOptions,
        updateLlmConfig,
        updateEmbeddingConfig,
        updateRedirectSetting,
        updateFullRedirectSettings,
        fetchModels,
        getTransientState,
        testConnection,
        handleSelectProvider,
        handleSelectModel,
        handleRedirectSettingChange,
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