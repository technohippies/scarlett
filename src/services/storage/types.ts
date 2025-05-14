import type { LLMProviderId } from '../llm/types';

// Add these interfaces for redirect settings
export interface RedirectServiceSetting {
    isEnabled: boolean;
    chosenInstance: string; // URL of the chosen frontend instance
}
  
export interface RedirectSettings {
    [serviceName: string]: RedirectServiceSetting; // Use the interface defined above
}

// --- NEW: Focus Mode Settings Types ---
export interface FocusCategorySetting {
    isEnabled: boolean;
    // Add future settings per category if needed, e.g., timeLimitMinutes?: number
}

export interface FocusSettings {
    // Key is the category name in lowercase (e.g., 'distracting', 'social media')
    [category: string]: FocusCategorySetting;
}
// --- END NEW ---

// --- NEW: Domain Detail for Focus Mode Blocked List ---
export interface DomainDetail {
  name: string;
  // description?: string; // Keeping it simple for now, can be added back if needed from CSV
}
// --- END NEW ---

// --- User Configuration Structure ---

// Define a basic structure for function config used in UserConfiguration
// (Expand this based on actual requirements if needed)
export interface FunctionConfig {
    providerId: string;
    modelId: string;
    baseUrl?: string | null; // Base URL might be needed
    apiKey?: string | null; // API Key might be needed
    // REMOVE Kokoro specific field
    // kokoroDevicePreference?: 'cpu' | 'webgpu'; 
    // Add other common fields if necessary
}

// Define the shape of the user's overall configuration
export interface UserConfiguration {
    nativeLanguage?: string | null;
    targetLanguage?: string | null;
    showTargetLanguage?: boolean;
    showNativeLanguage?: boolean;
    showWordLists?: boolean;
    showFlashcards?: boolean;
    showGrammar?: boolean;
    showEtymology?: boolean;
    showTranslations?: boolean;
    showDefinitions?: boolean;
    showSynonyms?: boolean;
    showAntonyms?: boolean;
    showExamples?: boolean;
    showDifficulty?: boolean;
    showFrequency?: boolean;
    showCEFRLevel?: boolean;
    showHSKLevel?: boolean;
    enableAutomaticTranslation?: boolean;
    enableAutomaticDefinition?: boolean;
    enableAutomaticSynonyms?: boolean;
    enableAutomaticAntonyms?: boolean;
    enableAutomaticExamples?: boolean;
    enableAutomaticDifficulty?: boolean;
    enableAutomaticFrequency?: boolean;
    enableAutomaticCEFRLevel?: boolean;
    enableAutomaticHSKLevel?: boolean;
    enableFocusMode?: boolean;
    focusModeDuration?: number; // in minutes
    focusModeBlockedDomains?: DomainDetail[];
    selectedTtsVendor?: 'elevenlabs' | 'browser' | 'none';
    elevenLabsApiKey?: string;
    elevenLabsVoiceId?: string;
    selectedLlmProvider?: LLMProviderId | 'none'; // none means no LLM features enabled
    
    // New unified LLM config object
    llmConfig?: FunctionConfig | null; 

    // Old flat properties - mark as optional, to be deprecated/removed later
    ollamaBaseUrl?: string | null;
    ollamaModel?: string | null;
    lmStudioBaseUrl?: string | null; 
    lmStudioModel?: string | null;
    janBaseUrl?: string | null;
    janModel?: string | null;

    // New unified Embedding config object
    embeddingConfig?: FunctionConfig | null;

    // Old flat properties for embedding - mark as optional, to be deprecated/removed later
    embeddingModelProvider?: LLMProviderId | 'none'; // LLMProviderId can serve for embedding too
    ollamaEmbeddingModel?: string | null;
    lmStudioEmbeddingModel?: string | null; // If LM Studio offers specific embedding models
    janEmbeddingModel?: string | null;      // If Jan offers specific embedding models
    // embeddingModelName?: string; // This was generic, provider-specific ones are better for fallbacks

    // New unified TTS config object
    ttsConfig?: FunctionConfig | null;

    lastMoodEntryDate?: string | null; // YYYY-MM-DD -- Allow null

    // Added missing properties
    redirectSettings?: RedirectSettings;
    onboardingComplete?: boolean;
    newItemsPerDay?: number; // Added for daily new item limit
}
