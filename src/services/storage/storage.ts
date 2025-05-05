import { storage } from '#imports';
// Import the correct type definition
import type { UserConfiguration, FunctionConfig, RedirectSettings } from './types';

// REMOVE the duplicate definition
// export interface UserConfiguration {
//   nativeLanguage: string | null;
//   targetLanguage: string | null;
//   learningGoal: string | null;
//   onboardingComplete: boolean;
// }

// Use the imported type for the default configuration
const defaultUserConfiguration: UserConfiguration = {
  nativeLanguage: null,
  targetLanguage: null,
  learningGoal: null,
  // Add the missing fields with default values based on the imported type
  llmConfig: null,
  embeddingConfig: null,
  readerConfig: null,
  redirectSettings: {}, // Default to empty object
  onboardingComplete: false,
};

/**
 * Stores the entire user configuration object.
 * Defaults to initial empty state.
 */
export const userConfigurationStorage = storage.defineItem<UserConfiguration>(
  'local:userConfiguration',
  {
    // Use a default object that matches the type
    fallback: defaultUserConfiguration,
  }
); 