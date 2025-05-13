import { storage } from '#imports';
// Import the correct type definition
import type { UserConfiguration, RedirectSettings, FocusSettings, DomainDetail } from './types';
// Import constants needed to build the default
import { REDIRECT_SERVICES, DEFAULT_REDIRECT_INSTANCES } from '../../shared/constants';

// Helper function to build default redirect settings
function buildDefaultRedirectSettings(): RedirectSettings {
    const settings: RedirectSettings = {};
    for (const serviceName of REDIRECT_SERVICES) {
        const lowerCaseName = serviceName.toLowerCase();
        settings[lowerCaseName] = {
            isEnabled: false, // Still default to false
            chosenInstance: DEFAULT_REDIRECT_INSTANCES[lowerCaseName] ?? '', // Get default instance from constant
        };
    }
    return settings;
}

// Default values for user configuration
export const defaultUserConfiguration: UserConfiguration = {
  nativeLanguage: null,
  targetLanguage: null,
  onboardingComplete: false,
  // llmConfig: null, // Removed: UserConfiguration uses individual LLM fields
  // embeddingConfig: null, // Removed: UserConfiguration uses individual embedding fields
  // ttsConfig: null, // Removed: UserConfiguration uses individual TTS fields
  
  // LLM related fields (ensure these match UserConfiguration in types.ts)
  selectedLlmProvider: 'none',
  ollamaBaseUrl: undefined, // Or null, depending on preference for optional fields
  ollamaModel: undefined,
  lmStudioBaseUrl: undefined,
  lmStudioModel: undefined,
  janBaseUrl: undefined,
  janModel: undefined,
  
  // Embedding related fields
  embeddingModelProvider: 'none',
  embeddingModelName: undefined,
  
  // TTS related fields
  selectedTtsVendor: 'browser',
  elevenLabsApiKey: undefined,
  elevenLabsVoiceId: undefined,

  redirectSettings: buildDefaultRedirectSettings(),
  // focusSettings: {}, // focusSettings is not in UserConfiguration type, individual fields are
  enableFocusMode: false, // Default based on UserConfiguration type
  focusModeDuration: 30, // Default based on UserConfiguration type (example)
  focusModeBlockedDomains: [], // Default based on UserConfiguration type
  lastMoodEntryDate: null,
  newItemsPerDay: 20,

  // Optional UI display settings from UserConfiguration - default to true or sensible values
  showTargetLanguage: true,
  showNativeLanguage: true,
  showWordLists: true,
  showFlashcards: true,
  showGrammar: true,
  showEtymology: true,
  showTranslations: true,
  showDefinitions: true,
  showSynonyms: true,
  showAntonyms: true,
  showExamples: true,
  showDifficulty: false, // Often less useful by default
  showFrequency: false,  // Often less useful by default
  showCEFRLevel: false,  // Often less useful by default
  showHSKLevel: false,   // Often less useful by default
  enableAutomaticTranslation: true,
  enableAutomaticDefinition: true,
  enableAutomaticSynonyms: false,
  enableAutomaticAntonyms: false,
  enableAutomaticExamples: true,
  enableAutomaticDifficulty: false,
  enableAutomaticFrequency: false,
  enableAutomaticCEFRLevel: false,
  enableAutomaticHSKLevel: false,
};

/**
 * Stores the entire user configuration object.
 * Defaults to initial empty state.
 */
export const userConfigurationStorage = storage.defineItem<UserConfiguration>(
  'local:userConfiguration',
  {
    defaultValue: defaultUserConfiguration,
    // Add migration logic if needed
  }
);

/**
 * Stores timestamps (epoch ms) of the last time page info (markdown, title)
 * was successfully processed and saved to PGlite.
 * Key: URL, Value: Timestamp
 */
export const pageInfoProcessingTimestamps = storage.defineItem<Record<string, number>>(
    'local:pageInfoProcessingTimestamps',
    {
        fallback: {},
    }
); 