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
    kokoroDevicePreference?: 'cpu' | 'webgpu'; // Added for Kokoro device preference
    // Add other common fields if necessary
}

// Define the shape of the user's overall configuration
export interface UserConfiguration {
    nativeLanguage: string | null;
    targetLanguage: string | null;
    learningGoal: string | null;
    onboardingComplete: boolean;
    llmConfig: FunctionConfig | null; // Use FunctionConfig like others
    embeddingConfig: FunctionConfig | null; // Use FunctionConfig like others
    ttsConfig: FunctionConfig | null; // Ensure TTS is included
    redirectSettings: RedirectSettings;
}
