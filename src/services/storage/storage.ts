import { storage } from '#imports';
// Import the correct type definition
import type { UserConfiguration } from './types';

// REMOVE the duplicate definition
// export interface UserConfiguration {
//   nativeLanguage: string | null;
//   targetLanguage: string | null;
//   learningGoal: string | null;
//   onboardingComplete: boolean;
// }

// Default values for user configuration
const defaultUserConfiguration: UserConfiguration = {
  nativeLanguage: null, // Or a sensible default like 'en'?
  targetLanguage: null,
  learningGoal: null,
  llmConfig: null, 
  embeddingConfig: null,
  ttsConfig: null,
  redirectSettings: { // Default redirect settings using lowercase names from constants.ts
    "github": { isEnabled: false, chosenInstance: '' },
    "chatgpt": { isEnabled: false, chosenInstance: '' },
    "x (twitter)": { isEnabled: false, chosenInstance: '' },
    "reddit": { isEnabled: false, chosenInstance: '' },
    "twitch": { isEnabled: false, chosenInstance: '' },
    "youtube": { isEnabled: false, chosenInstance: '' },
    "youtube music": { isEnabled: false, chosenInstance: '' },
    "medium": { isEnabled: false, chosenInstance: '' },
    "bluesky": { isEnabled: false, chosenInstance: '' },
    "pixiv": { isEnabled: false, chosenInstance: '' },
    "soundcloud": { isEnabled: false, chosenInstance: '' },
    "genius": { isEnabled: false, chosenInstance: '' },
  },
  onboardingComplete: false,
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