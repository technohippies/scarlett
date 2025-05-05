import { storage } from '#imports';

// Define the type here since file creation failed
export interface UserConfiguration {
  nativeLanguage: string | null;
  targetLanguage: string | null;
  learningGoal: string | null;
  onboardingComplete: boolean;
}

const defaultUserConfiguration: UserConfiguration = {
  nativeLanguage: null,
  targetLanguage: null,
  learningGoal: null,
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