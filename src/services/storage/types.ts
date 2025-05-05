// Add these interfaces for redirect settings
export interface RedirectServiceSetting {
    isEnabled: boolean;
    chosenInstance: string; 
}
  
export interface RedirectSettings {
    [serviceName: string]: RedirectServiceSetting; // Use the interface defined above
}

// --- User Configuration Structure ---

// Define a basic structure for function config used in UserConfiguration
// (Expand this based on actual requirements if needed)
export interface FunctionConfig {
    providerId: string;
    modelId: string;
    baseUrl?: string | null; // Base URL might be needed
    apiKey?: string | null; // API Key might be needed
    // Add other common fields if necessary
}

// Define the main User Configuration interface
export interface UserConfiguration {
    nativeLanguage: string | null;
    targetLanguage: string | null;
    learningGoal: string | null;
    llmConfig: FunctionConfig | null;
    embeddingConfig: FunctionConfig | null;
    // Represent reader config similarly or adjust as needed
    readerConfig: FunctionConfig | null; // Use FunctionConfig like others
    // Add the missing redirect settings field
    redirectSettings: RedirectSettings | null; // Allow null, but not undefined
    onboardingComplete: boolean; // Should likely be non-optional boolean
    // Add any other top-level settings stored in userConfigurationStorage
}
