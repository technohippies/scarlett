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
    nativeLanguage: string | null;
    targetLanguage: string | null;
    learningGoal: string | null;
    onboardingComplete: boolean;
    isFocusModeActive?: boolean;
    userBlockedDomains?: DomainDetail[]; // New field for user-managed blocked domains
    llmConfig: FunctionConfig | null;
    embeddingConfig: FunctionConfig | null;
    ttsConfig: FunctionConfig | null;
    redirectSettings?: RedirectSettings;
    focusSettings?: FocusSettings; // Marking as optional, as it's being superseded by userBlockedDomains
}
