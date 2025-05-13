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
const defaultUserConfiguration: UserConfiguration = {
  nativeLanguage: null, // Or a sensible default like 'en'?
  targetLanguage: null,
  learningGoal: null,
  llmConfig: null, 
  embeddingConfig: null,
  ttsConfig: null,
  redirectSettings: buildDefaultRedirectSettings(), // Use the helper function
  onboardingComplete: false,
  isFocusModeActive: false, // Default to not active
  userBlockedDomains: [], // Added new field with default empty array
  focusSettings: {}, // Changed to empty object as categories are removed from panel
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