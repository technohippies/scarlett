import { createContext, useContext, createResource, ParentComponent, createEffect, createSignal, Accessor, Setter } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { userConfigurationStorage } from '../services/storage/storage';
import type { UserConfiguration, FunctionConfig, RedirectSettings, RedirectServiceSetting, DomainDetail } from '../services/storage/types'; // Centralize types
import type { ProviderOption } from '../features/models/ProviderSelectionPanel'; // Use types from panels where appropriate
import type { ModelOption } from '../features/models/ModelSelectionPanel'; // Need ModelOption too
import { getAllBlockedDomains } from '../services/db/domains'; // <-- IMPORT DB FUNCTION
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BackgroundProtocolMap } from '../shared/messaging-types';

// Import provider implementations (adjust as needed, consider a registry)
// These imports need to be fixed based on the previous correction
import { OllamaProvider } from '../services/llm/providers/ollama'; 
import { JanProvider } from '../services/llm/providers/jan'; 
import { LMStudioProvider } from '../services/llm/providers/lmstudio';

// Import LLMProviderId and LLMConfig types
import type { LLMProviderId, LLMConfig } from '../services/llm/types';

// --- Import ElevenLabs Service and Constants ---
import { generateElevenLabsSpeechStream } from '../services/tts/elevenLabsService';
import { DEFAULT_ELEVENLABS_VOICE_ID } from '../shared/constants';

// --- Helper Types (Local to context or shared) ---
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
export type TestStatus = 'idle' | 'testing' | 'success' | 'error';
// Update SettingsLoadStatus to include all possible states from createResource
export type SettingsLoadStatus = 'pending' | 'ready' | 'errored' | 'unresolved' | 'refreshing';
export type FunctionName = 'LLM' | 'Embedding' | 'TTS'; // Define FunctionName

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

// Modern LLM keywords prioritizing latest model versions
const RECOMMENDED_LLM_KEYWORDS = [
    // Prioritize newest model families
    'qwen3',       // Latest Qwen family
    'gemma3',      // Latest Gemma family
    'gemma-3',     // Alternative naming
    'qwen-3',      // Alternative naming
    // Include latest DeepSeek models
    'deepseek-r1', // Latest DeepSeek reasoning model
    'deepseek-v3', // Latest DeepSeek v3
    // Include QwQ reasoning model
    'qwq',
    // Fallback to qwen2.5 (still relatively recent)
    'qwen2.5',
    'qwen-2.5',
    // Only include gemma2 for larger models
    'gemma2:27b',
    'gemma-2-27b',
    // Exclude older versions like qwen2:7b, gemma:7b, etc.
];

// --- Define Provider Options Here ---
const llmProviderOptions: ProviderOption[] = [
    { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/ollama.png' },
    { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/jan.png' },
    { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'http://127.0.0.1:1234', logoUrl: '/images/lmstudio.png' },
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
  updateTtsConfig: (config: FunctionConfig | null) => Promise<void>;
  updateRedirectSetting: (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => Promise<void>;
  updateFullRedirectSettings: (settings: RedirectSettings) => Promise<void>; // Action to replace all redirect settings
  updateUserConfiguration: (updates: Partial<UserConfiguration>) => Promise<void>; // <-- ADDED FOR GENERAL UPDATES

  // --- UI Interaction Handlers --- 
  handleSelectProvider: (funcType: FunctionName, provider: ProviderOption | undefined) => Promise<void>;
  handleSelectModel: (funcType: FunctionName, modelId: string | undefined) => Promise<void>;
  // handleUpdateBaseUrl: (funcType: string, baseUrl: string) => Promise<void>; // Optional future addition

  // --- Dynamic Operations + Transient State --- 
  fetchModels: (funcType: FunctionName, provider: ProviderOption) => Promise<ModelOption[]>; // Make async, return models
  getTransientState: (funcType: FunctionName) => { // Get transient state scoped by function type
      localModels: () => ModelOption[];
      remoteModels: () => ModelOption[];
      fetchStatus: () => FetchStatus;
      fetchError: () => Error | null;
      testStatus: () => TestStatus;
      testError: () => Error | null;
      showSpinner: () => boolean;
  };
  testConnection: (funcType: FunctionName, config: FunctionConfig) => Promise<void>; // Make async
  handleRedirectSettingChange: (serviceName: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => Promise<void>;
  ttsTestAudio: Accessor<Blob | null>; // Added for TTS test audio
  setTtsTestAudio: Setter<Blob | null>; // Expose setter for onboarding or direct use
}

// --- Initial Empty Config & State --- 
const initialConfig: UserConfiguration = {
  nativeLanguage: 'en', // Sensible default
  targetLanguage: '', // Needs to be set
  onboardingComplete: false,
  llmConfig: null, // Use the new object structure
  embeddingConfig: null, // Use the new object structure
  // readerConfig: null, // Removed Reader
  ttsConfig: null, // Use the new object structure
  redirectSettings: {},
  enableFocusMode: false, // UPDATED from isFocusModeActive
  focusModeBlockedDomains: [], // UPDATED from userBlockedDomains
  learningMotivation: null, // Initialize new field
};

// --- Store Definition ---
// Use createStore for potentially complex/nested state
const [settingsStore, setSettingsStore] = createStore<UserConfiguration>(initialConfig);

// --- Context Definition ---
// Create the actual context object
const SettingsContext = createContext<ISettingsContext | undefined>(undefined); // Initialize with undefined

// Define a default sample text for ElevenLabs testing
const ELEVENLABS_TEST_TEXT = "Testing ElevenLabs text-to-speech integration.";

// --- Provider Component ---
export const SettingsProvider: ParentComponent = (props) => {
    // Resource to load initial settings from storage
    const [loadedSettings] = createResource(async () => {
        console.log("[SettingsContext] Attempting to load settings from storage...");
        const storedValue = await userConfigurationStorage.getValue();
        console.log("[SettingsContext] Value loaded from storage:", storedValue);
        return storedValue || initialConfig; 
    });

    // Transient state signals MAP for fetch/test (scoped by function type)
    const [transientState, setTransientState] = createStore<Record<string, {
        localModels: ModelOption[];
        remoteModels: ModelOption[];
        fetchStatus: FetchStatus;
        fetchError: Error | null;
        testStatus: TestStatus;
        testError: Error | null;
        showSpinner: boolean;
        spinnerTimeoutId?: ReturnType<typeof setTimeout>;
        // Personality embedding progress
        personalityEmbeddingProgress?: number; // 0-100
        personalityEmbeddingCurrentChunk?: string;
        personalityEmbeddingChunksEmbedded?: number;
        personalityEmbeddingTotalChunks?: number;
    }>>({});

    // Define the signal for the TTS test audio blob
    const [ttsTestAudio, setTtsTestAudio] = createSignal<Blob | null>(null);

    // --- Watch for external storage changes --- 
    createEffect(() => {
        const unsubscribe = userConfigurationStorage.watch((newValue) => {
            console.log("[SettingsContext watch] Storage changed externally. Updating internal store.");
            // Check if newValue is actually different to avoid infinite loops if watch triggers on own setValue
            // A deep comparison might be needed if watch is overly sensitive
            if (JSON.stringify(newValue) !== JSON.stringify(settingsStore)) {
                // Update the internal Solid store with the new value from storage
                setSettingsStore(produce(state => {
                    Object.assign(state, newValue || initialConfig); // Ensure defaults if storage becomes null
                }));
                console.log("[SettingsContext watch] Internal store updated.");
            } else {
                console.log("[SettingsContext watch] Storage change detected, but new value matches internal store. Skipping update.");
            }
        });
        // Cleanup the watcher when the component unmounts or effect re-runs
        return () => unsubscribe();
    });
    // --- End Watcher ---

    // Helper to get or initialize transient state for a function type
    const ensureTransientState = (funcType: FunctionName) => {
        if (!transientState[funcType]) {
            setTransientState(funcType, {
                localModels: [],
                remoteModels: [],
                fetchStatus: 'idle',
                fetchError: null,
                testStatus: 'idle',
                testError: null,
                showSpinner: false,
                spinnerTimeoutId: undefined,
                personalityEmbeddingProgress: 0,
                personalityEmbeddingCurrentChunk: undefined,
                personalityEmbeddingChunksEmbedded: 0,
                personalityEmbeddingTotalChunks: 0
            });
        }
    };

    // Effect to populate the store once the resource is ready
    createEffect(() => {
        if (!loadedSettings.loading && loadedSettings.state === 'ready' && loadedSettings()) {
            console.log("[SettingsContext] Settings resource is ready. Updating store state.");
            
            const configFromStorage = loadedSettings() as Partial<UserConfiguration> | null;
            // Start with initialConfig, then overlay with what came from storage.
            let effectiveConfig: UserConfiguration = { ...initialConfig, ...(configFromStorage || {}) }; 

            let migrationNeeded = false;
            // Perform migration if old keys exist
            if (effectiveConfig.hasOwnProperty('isFocusModeActive')) {
                console.log("[SettingsContext] Migrating 'isFocusModeActive' to 'enableFocusMode'.");
                effectiveConfig.enableFocusMode = (effectiveConfig as any).isFocusModeActive;
                delete (effectiveConfig as any).isFocusModeActive;
                migrationNeeded = true;
            }
            if (effectiveConfig.hasOwnProperty('userBlockedDomains')) {
                console.log("[SettingsContext] Migrating 'userBlockedDomains' to 'focusModeBlockedDomains'.");
                effectiveConfig.focusModeBlockedDomains = (effectiveConfig as any).userBlockedDomains;
                delete (effectiveConfig as any).userBlockedDomains;
                migrationNeeded = true;
            }
            // Clean up learningGoal if it exists from old storage
            if (effectiveConfig.hasOwnProperty('learningGoal')) {
                console.log("[SettingsContext] Removing deprecated 'learningGoal' from config.");
                delete (effectiveConfig as any).learningGoal;
                migrationNeeded = true; 
            }

            if (migrationNeeded) {
                console.log("[SettingsContext] Migration/cleanup performed. Saving updated config to storage.");
                userConfigurationStorage.setValue(effectiveConfig).then(() => {
                     console.log("[SettingsContext] Migrated/cleaned config saved to storage.");
                }).catch(err => {
                    console.error("[SettingsContext] Error saving migrated/cleaned config to storage:", err);
                });
            }
            
            setSettingsStore(produce(state => {
                // Clear existing state keys that are not in effectiveConfig to ensure clean update
                for (const key in state) {
                    if (!(key in effectiveConfig)) {
                        delete (state as any)[key];
                    }
                }
                // Assign the properties from the processed effectiveConfig
                Object.assign(state, effectiveConfig);
            }));

            // --- Seed focusModeBlockedDomains from PGlite if empty ---
            // This part should now use 'effectiveConfig.focusModeBlockedDomains'
            if (!effectiveConfig.focusModeBlockedDomains || effectiveConfig.focusModeBlockedDomains.length === 0) {
                console.log("[SettingsContext] focusModeBlockedDomains is empty. Attempting to seed from PGlite.");
                (async () => {
                    try {
                        const pgLiteDomains = await getAllBlockedDomains(); 
                        if (pgLiteDomains && pgLiteDomains.length > 0) {
                            console.log(`[SettingsContext] Found ${pgLiteDomains.length} domains in PGlite.`);
                            const domainsToStore: DomainDetail[] = pgLiteDomains.map(d => ({ name: d.name }));
                            
                            // Fetch the latest config again before this specific update to avoid race conditions with other updates
                            let latestConfigForSeeding = { ...initialConfig, ...((await userConfigurationStorage.getValue()) || {}) };
                            
                            // Ensure latestConfigForSeeding is also clean of old/deprecated keys before merging new domains
                            if (latestConfigForSeeding.hasOwnProperty('isFocusModeActive')) {
                                latestConfigForSeeding.enableFocusMode = (latestConfigForSeeding as any).isFocusModeActive;
                                delete (latestConfigForSeeding as any).isFocusModeActive;
                            }
                            if (latestConfigForSeeding.hasOwnProperty('userBlockedDomains')) {
                                latestConfigForSeeding.focusModeBlockedDomains = (latestConfigForSeeding as any).userBlockedDomains;
                                delete (latestConfigForSeeding as any).userBlockedDomains;
                            }
                            if (latestConfigForSeeding.hasOwnProperty('learningGoal')) {
                                delete (latestConfigForSeeding as any).learningGoal;
                            }

                            const configWithSeededDomains: UserConfiguration = { 
                                ...latestConfigForSeeding, 
                                focusModeBlockedDomains: domainsToStore
                            };

                            await userConfigurationStorage.setValue(configWithSeededDomains);
                            
                            setSettingsStore('focusModeBlockedDomains', domainsToStore);
                            console.log("[SettingsContext] focusModeBlockedDomains seeded successfully and local store updated.");
                        } else {
                            console.log("[SettingsContext] No domains found in PGlite to seed or seeding returned empty.");
                        }
                    } catch (error) {
                        console.error("[SettingsContext] Error seeding focusModeBlockedDomains from PGlite:", error);
                    }
                })();
            }
            // --- End Seed ---

            // --- Fetch models for pre-configured providers (Optimized) --- 
            console.log("[SettingsContext] Checking for pre-configured providers to fetch models (optimized)...", effectiveConfig);

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

            addProviderTask('LLM', effectiveConfig.llmConfig ?? null, llmProviderOptions);
            addProviderTask('Embedding', effectiveConfig.embeddingConfig ?? null, embeddingProviderOptions);
            // TODO: Add check for TTS

            if (providersToFetch.size > 0) {
                console.log(`[SettingsContext] Found ${providersToFetch.size} unique providers to fetch models for initial load:`, Array.from(providersToFetch.keys()));

                // Set loading state synchronously first for all relevant funcTypes
                providersToFetch.forEach((_provider, providerId) => {
                    const funcTypes = funcTypesPerProvider.get(providerId) || [];
                    funcTypes.forEach(funcType => {
                        ensureTransientState(funcType as FunctionName);
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
                        const fetchedModelInfoWithOptions = await fetchRawModelsForProvider(provider, effectiveConfig);

                        // Process results for each funcType using this provider
                        funcTypes.forEach(funcType => {
                             console.log(`[SettingsContext] Processing fetched models for ${funcType} (provider: ${providerId})`);
                             const { localModels, remoteModels } = filterModels(funcType as FunctionName, provider, fetchedModelInfoWithOptions);
                             
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

    // Helper to sanitize config for logging (removes verbose fields)
    const sanitizeConfigForLogging = (config: UserConfiguration) => {
        const sanitized = { ...config };
        if (sanitized.focusModeBlockedDomains && sanitized.focusModeBlockedDomains.length > 0) {
            sanitized.focusModeBlockedDomains = [`... ${sanitized.focusModeBlockedDomains.length} domains`] as any;
        }
        return sanitized;
    };

    // Helper to save settings (can be called by update actions)
    const saveCurrentSettings = async () => {
        try {
            // 1. Get the LATEST value from storage directly
            const latestStoredConfig = await userConfigurationStorage.getValue() || initialConfig;
            
            // 2. Get the current state from the Solid store
            const currentStoreState = JSON.parse(JSON.stringify(settingsStore));

            // 3. Merge the store state ONTO the latest stored config.
            const configToSave: UserConfiguration = {
                ...latestStoredConfig,
                ...currentStoreState,
            };

            console.log(`[SettingsContext setValue] About to save from saveCurrentSettings. Full config: ${JSON.stringify(sanitizeConfigForLogging(configToSave), null, 2)}`);
            await userConfigurationStorage.setValue(configToSave);
            console.log(`[SettingsContext setValue] Save complete from saveCurrentSettings. Config was: ${JSON.stringify(sanitizeConfigForLogging(configToSave), null, 2)}`);
        } catch (error) {
            console.error("[SettingsContext] Failed to save settings:", error);
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

    // Added TTS config update function
    const updateTtsConfig = async (config: FunctionConfig | null) => {
        setSettingsStore('ttsConfig', config);
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

    // --- NEW: General User Configuration Update Function ---
    const updateUserConfiguration = async (updates: Partial<UserConfiguration>) => {
        console.log("[SettingsContext] updateUserConfiguration called with updates:", updates);
        try {
            // Get the latest full configuration from storage to merge onto
            const latestStoredConfig = await userConfigurationStorage.getValue() || initialConfig;
            
            // Create the new configuration by merging updates onto the latest stored config
            const newConfig: UserConfiguration = {
                ...latestStoredConfig,
                ...updates,
            };

            // Save the newly merged configuration to storage
            console.log(`[SettingsContext setValue] About to save from updateUserConfiguration. Full new config: ${JSON.stringify(sanitizeConfigForLogging(newConfig), null, 2)}`);
            await userConfigurationStorage.setValue(newConfig);
            console.log(`[SettingsContext setValue] Save complete from updateUserConfiguration.`);

            // Update the local Solid store to reflect the changes immediately
            // This ensures the UI reacts without needing a full refetch/reload of context
            setSettingsStore(produce(state => {
                Object.assign(state, newConfig);
            }));
            console.log("[SettingsContext] Internal store updated after updateUserConfiguration.");

        } catch (error) {
            console.error("[SettingsContext] Failed to update user configuration:", error);
            // Potentially re-throw or handle error state for UI feedback
        }
    };
    // --- END NEW ---

    // --- UI Interaction Handler Implementations ---
    const handleSelectProvider = async (funcType: FunctionName, provider: ProviderOption | undefined) => {
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

    const handleSelectModel = async (funcType: FunctionName, modelId: string | undefined) => {
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
                case 'ttsConfig': await updateTtsConfig(newConfig); break; // Added TTS case
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
    const filterModels = (funcType: FunctionName, provider: ProviderOption, rawModels: ModelOption[]) => {
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
        } else if (funcType === 'LLM' && provider.id === 'jan') {
            // Filter Jan LLM models to only show modern recommended models
            const modernModels = (model: ModelOption) => {
                const id = model.id.toLowerCase();
                const name = model.name.toLowerCase();
                
                // Only include Qwen3, Gemma3, and latest DeepSeek models
                return (
                    // Qwen3 models only
                    id.includes('qwen3') || name.includes('qwen3') ||
                    // Gemma3 models only  
                    id.includes('gemma3') || name.includes('gemma3') || id.includes('gemma-3') || name.includes('gemma-3') ||
                    // Latest DeepSeek models (R1, V3, and specific new ones)
                    id.includes('deepseek-r1') || name.includes('deepseek-r1') ||
                    id.includes('deepseek-v3') || name.includes('deepseek-v3') ||
                    id.includes('deepseek-prover-v2') || name.includes('deepseek-prover-v2') ||
                    // QwQ models
                    id.includes('qwq') || name.includes('qwq')
                );
            };
            
            localModels = localModels.filter(modernModels);
            remoteModels = remoteModels.filter(modernModels);
        }
        console.log(`[SettingsContext filterModels] Filtered models for ${funcType}. Local: ${localModels.length}, Remote: ${remoteModels.length}`);
        return { localModels, remoteModels };
    };

    const fetchModels = async (funcType: FunctionName, provider: ProviderOption): Promise<ModelOption[]> => {
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

    // --- Centralized Test Connection Logic ---
    const testConnection = async (functionName: FunctionName, configToTest?: FunctionConfig) => {
        const key = getFunctionConfigKey(functionName);
        // Use settingsStore() to get the reactive store value
        const storeValue = settingsStore[key]; 

        // Determine the configuration to test
        let currentFunctionConfig: FunctionConfig | null | undefined;
        if (configToTest) {
            currentFunctionConfig = configToTest;
        } else if (storeValue && typeof storeValue === 'object' && 'providerId' in storeValue && 'modelId' in storeValue) {
            // Check if storeValue looks like a FunctionConfig (it might be null)
            currentFunctionConfig = storeValue as FunctionConfig | null;
        } else {
            currentFunctionConfig = null; // or undefined, if storeValue is not a FunctionConfig-like object
        }
        
        // Get test status setters for the appropriate function type
        const setters = getTransientStateSetters(functionName);

        if (!currentFunctionConfig || !currentFunctionConfig.providerId || !currentFunctionConfig.modelId) {
            console.warn(`[SettingsContext] Test connection called for ${functionName} but config is incomplete. Received:`, currentFunctionConfig);
            setters.setTestError(new Error('Configuration incomplete or invalid.'));
            setters.setTestStatus('error'); // Also set status to error
            return;
        }

        console.log(`[SettingsContext] Testing connection for ${functionName}...`, currentFunctionConfig);
        setters.setTestStatus('testing');
        setters.setTestError(null);
        setTtsTestAudio(null);

        try {
            let success = false;
            if (functionName === 'LLM') {
                // Use the actual provider's testConnection method instead of stub
                const providerImpl = providerImplementations[currentFunctionConfig.providerId as keyof typeof providerImplementations];
                if (!providerImpl || !providerImpl.testConnection) {
                    throw new Error(`LLM provider ${currentFunctionConfig.providerId} does not support connection testing`);
                }
                
                console.log(`[SettingsContext] Testing LLM connection for provider ${currentFunctionConfig.providerId} with model ${currentFunctionConfig.modelId}`);
                
                // Convert FunctionConfig to LLMConfig for the provider test
                const llmConfig: LLMConfig = {
                    provider: currentFunctionConfig.providerId as LLMProviderId,
                    model: currentFunctionConfig.modelId,
                    baseUrl: currentFunctionConfig.baseUrl || 'http://localhost:1337', // Default or configured
                    apiKey: currentFunctionConfig.apiKey ?? undefined, // Convert null to undefined
                    stream: false
                };
                
                await providerImpl.testConnection(llmConfig, functionName);
                success = true;
            } else if (functionName === 'Embedding') {
                console.log(`[SettingsContext] Testing embedding and seeding personality for provider ${currentFunctionConfig.providerId}`);
                console.log(`[SettingsContext] EMBEDDING DEBUG: About to call embedPersonality via background messaging with config:`, currentFunctionConfig);
                console.log(`[SettingsContext] EMBEDDING DEBUG: Current timestamp before embedding:`, new Date().toISOString());
                
                // Note: Progress tracking could be added here in the future
                
                // Use background messaging to embed personality in the correct context
                const messaging = defineExtensionMessaging<BackgroundProtocolMap>();
                const result = await messaging.sendMessage('embedPersonality', { 
                    embeddingConfig: currentFunctionConfig 
                });
                console.log(`[SettingsContext] EMBEDDING DEBUG: embedPersonality background result:`, result);
                console.log(`[SettingsContext] EMBEDDING DEBUG: Current timestamp after embedding:`, new Date().toISOString());
                
                if (result.success) {
                    console.log(`[SettingsContext] EMBEDDING DEBUG: Embedding reported success, chunksEmbedded: ${result.chunksEmbedded}`);
                    success = true;
                } else {
                    console.error(`[SettingsContext] EMBEDDING DEBUG: Embedding failed with error:`, result.error);
                    throw new Error(result.error || 'Personality embedding failed');
                }
            } else if (functionName === 'TTS') {
                if (currentFunctionConfig.providerId === 'elevenlabs') {
                    if (!currentFunctionConfig.apiKey) {
                        throw new Error('API key is missing for ElevenLabs.');
                    }
                    const audioBlob = await generateElevenLabsSpeechStream(
                        currentFunctionConfig.apiKey, // Now type-safe
                        ELEVENLABS_TEST_TEXT,
                        currentFunctionConfig.modelId, // Now type-safe
                        DEFAULT_ELEVENLABS_VOICE_ID 
                    );
                    setTtsTestAudio(audioBlob);
                    success = true;
                } else {
                    // Only ElevenLabs is supported now
                    throw new Error(`Unsupported TTS provider: ${currentFunctionConfig.providerId}`);
                }
            }

            if (success) {
                console.log(`[SettingsContext] Connection test successful for ${functionName}.`);
                setters.setTestStatus('success');
            } else if (functionName === 'LLM' || functionName === 'Embedding') {
                // This branch might not be reached if success is true for LLM/Embedding above
                setters.setTestError(new Error('Test failed for unknown reasons.'));
                setters.setTestStatus('error');
            }
        } catch (error: any) {
            console.error(`[SettingsContext] Connection test failed for ${functionName}:`, error);
            setters.setTestError(error);
            setters.setTestStatus('error');
        }
    };

    // Function to get scoped transient state accessors
    const getTransientState = (funcType: FunctionName) => {
         ensureTransientState(funcType); // Make sure the state exists
         return {
            localModels: () => transientState[funcType]?.localModels || [],
            remoteModels: () => transientState[funcType]?.remoteModels || [],
            fetchStatus: () => transientState[funcType]?.fetchStatus || 'idle',
            fetchError: () => transientState[funcType]?.fetchError || null,
            testStatus: () => transientState[funcType]?.testStatus || 'idle',
            testError: () => transientState[funcType]?.testError || null,
            showSpinner: () => transientState[funcType]?.showSpinner || false,
            personalityEmbeddingProgress: () => transientState[funcType]?.personalityEmbeddingProgress || 0,
            personalityEmbeddingCurrentChunk: () => transientState[funcType]?.personalityEmbeddingCurrentChunk || '',
            personalityEmbeddingChunksEmbedded: () => transientState[funcType]?.personalityEmbeddingChunksEmbedded || 0,
            personalityEmbeddingTotalChunks: () => transientState[funcType]?.personalityEmbeddingTotalChunks || 0,
         };
    };

    // Helper for transient state setters
    const getTransientStateSetters = (funcType: FunctionName) => {
        ensureTransientState(funcType);
        return {
            setLocalModels: (models: ModelOption[]) => setTransientState(funcType, 'localModels', models),
            setRemoteModels: (models: ModelOption[]) => setTransientState(funcType, 'remoteModels', models),
            setFetchStatus: (status: FetchStatus) => setTransientState(funcType, 'fetchStatus', status),
            setFetchError: (error: Error | null) => setTransientState(funcType, 'fetchError', error),
            setTestStatus: (status: TestStatus) => setTransientState(funcType, 'testStatus', status),
            setTestError: (error: Error | null) => setTransientState(funcType, 'testError', error),
            setShowSpinner: (show: boolean) => setTransientState(funcType, 'showSpinner', show),
            setSpinnerTimeoutId: (id: ReturnType<typeof setTimeout> | undefined) => setTransientState(funcType, 'spinnerTimeoutId', id),
            setPersonalityEmbeddingProgress: (progress: number) => setTransientState(funcType, 'personalityEmbeddingProgress', progress),
            setPersonalityEmbeddingCurrentChunk: (chunk: string) => setTransientState(funcType, 'personalityEmbeddingCurrentChunk', chunk),
            setPersonalityEmbeddingChunksEmbedded: (count: number) => setTransientState(funcType, 'personalityEmbeddingChunksEmbedded', count),
            setPersonalityEmbeddingTotalChunks: (total: number) => setTransientState(funcType, 'personalityEmbeddingTotalChunks', total),
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
            console.log(`[SettingsContext setValue] About to save redirect setting for "${serviceName}". Full config: ${JSON.stringify(newConfig, null, 2)}`);
            await userConfigurationStorage.setValue(newConfig);
            // Update local context state AFTER successful storage update
            setSettingsStore(prev => ({ ...prev, redirectSettings: updatedRedirects }));
            console.log(`[SettingsContext] Successfully saved and updated redirect setting for "${serviceName}"`);
        } catch (error) {
            console.error(`[SettingsContext] Error saving redirect setting for "${serviceName}":`, error);
            // Optional: Add user feedback about the save error
        }
    };

    // --- Helper to get config key
    const getFunctionConfigKey = (functionName: FunctionName): keyof UserConfiguration => {
        if (functionName === 'LLM') return 'llmConfig';
        if (functionName === 'Embedding') return 'embeddingConfig';
        if (functionName === 'TTS') return 'ttsConfig';
        throw new Error(`Invalid function name: ${functionName}`);
    };

    // --- Context Value ---
    // Assemble the value to be provided by the context
    const value: ISettingsContext = {
        config: settingsStore,
        // Ensure the type matches the resource state directly
        loadStatus: () => loadedSettings.state as SettingsLoadStatus,
        // Expose provider options
        llmProviderOptions,
        embeddingProviderOptions,
        ttsProviderOptions,
        updateLlmConfig,
        updateEmbeddingConfig,
        updateTtsConfig,
        updateRedirectSetting,
        updateFullRedirectSettings,
        fetchModels,
        getTransientState,
        testConnection,
        handleSelectProvider,
        handleSelectModel,
        handleRedirectSettingChange,
        ttsTestAudio: ttsTestAudio, // Expose the signal accessor correctly
        setTtsTestAudio, // Expose setter
        updateUserConfiguration, // <-- ADDED TO CONTEXT VALUE
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