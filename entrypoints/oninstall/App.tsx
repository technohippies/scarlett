import { Component, createSignal, createResource, createEffect } from 'solid-js';
import { Language, LanguageOptionStub } from '../../src/features/oninstall/Language';
import { LearningGoal } from '../../src/features/oninstall/LearningGoal';
import { userConfigurationStorage } from '../../src/services/storage/storage';
// Import the shared Messages type
import type { Messages } from '../../src/types/i18n';
// Import the Redirects component
import { Redirects } from '../../src/features/oninstall/Redirects';
// Import the Progress component
import { Progress } from '../../src/components/ui/progress';
// Import necessary types from storage/types
import type { RedirectSettings, RedirectServiceSetting, UserConfiguration, FunctionConfig } from '../../src/services/storage/types';
// Import the Button component
import { Button } from '../../src/components/ui/button';

// --- Import NEW Context and Panels ---
import { SettingsProvider, useSettings } from '../../src/context/SettingsContext';
import ProviderSelectionPanel, { type ProviderOption } from '../../src/features/models/ProviderSelectionPanel';
import ModelSelectionPanel from '../../src/features/models/ModelSelectionPanel';
import ConnectionTestPanel from '../../src/features/models/ConnectionTestPanel';

// Define language lists here (could also be moved)
const nativeLanguagesList: LanguageOptionStub[] = [
  { value: 'en', emoji: '🇺🇸' }, { value: 'zh', emoji: '🇨🇳' }, 
  { value: 'th', emoji: '🇹🇭' }, { value: 'id', emoji: '🇮🇩' }, 
  { value: 'ar', emoji: '🇸🇦' }, { value: 'ja', emoji: '🇯🇵' }, 
  { value: 'ko', emoji: '🇰🇷' }, { value: 'es', emoji: '🇪🇸' },
  { value: 'vi', emoji: '🇻🇳' } // Added Vietnamese stub
];

const allTargetLanguagesList: LanguageOptionStub[] = [
  { value: 'en', emoji: '🇺🇸' }, { value: 'zh', emoji: '🇨🇳' }, 
  { value: 'ja', emoji: '🇯🇵' }, { value: 'ko', emoji: '🇰🇷' },
];

// Define available LLM Providers (Chat/Completion)
const availableProviders: ProviderOption[] = [ // Updated type
    {
      id: 'ollama',
      name: 'Ollama',
      defaultBaseUrl: 'http://localhost:11434',
      logoUrl: '/images/llm-providers/ollama.png' // Assuming logo path
    },
    {
      id: 'jan',
      name: 'Jan',
      defaultBaseUrl: 'http://localhost:1337',
      logoUrl: '/images/llm-providers/jan.png' // Assuming logo path
    },
    // Add LMStudio or others here when ready
    {
      id: 'lmstudio',
      name: 'LM Studio',
      defaultBaseUrl: 'ws://127.0.0.1:1234', // Default LM Studio WebSocket URL
      logoUrl: '/images/llm-providers/lmstudio.png' // Assuming logo path
    },
];

// Define available LLM Providers (Renamed for clarity)
const availableLLMProviders: ProviderOption[] = availableProviders; // Reuse the existing list

// Define available Embedding Providers
const availableEmbeddingProviders: ProviderOption[] = [
    // Reuse or define specific providers
    { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
    { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' }, // Add Jan for embeddings
    { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
];

// Define available Reader Providers (likely subset of LLM providers)
const availableReaderProviders: ProviderOption[] = [
    { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
    // Add others capable of running the reader model
];

// Simplified Step type for the new flow
type Step = 'language' | 'learningGoal' | 'setupLLM' | 'setupEmbedding' | 'setupReader' | 'redirects';

// Helper function modified to return the best determined language code
function getBestInitialLangCode(): string {
  let preferredLang = 'en'; 
  try {
    const navLangs = navigator.languages;
    console.log(`[App] Initial navigator.languages: ${JSON.stringify(navLangs)}`);

    if (navLangs && navLangs.length > 0) {
      for (const lang of navLangs) {
        const baseLang = lang.split('-')[0];
        // Check only against native list for default UI language
        const foundInNative = nativeLanguagesList.some(nl => nl.value === baseLang);
        if (foundInNative) { 
          preferredLang = baseLang;
          console.log(`[App] Initial UI language set based on native list: ${preferredLang}`);
          break;
        }
      }
    }
    // Simplified fallback logic
    console.log(`[App] Initial UI language code determined: ${preferredLang}`);
    return preferredLang;
  } catch (e) {
    console.error("[App] Error getting initial language preference:", e);
    return 'en';
  }
}

// Fetch messages using browser.runtime.getURL and fetch
const fetchMessages = async (langCode: string): Promise<Messages> => {
  console.log(`[App] Attempting to fetch messages for langCode: ${langCode}`);
  // Use 'as any' to bypass strict WXT typing for getURL with locale pattern
  const messageUrl = browser.runtime.getURL(`/_locales/${langCode}/messages.json` as any);
  console.log(`[App] Constructed URL: ${messageUrl}`);
  try {
    const response = await fetch(messageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} for ${langCode}`);
    }
    const messages: Messages = await response.json();
    console.log(`[App] Successfully fetched and parsed ${langCode} messages.`);
    return messages;
  } catch (error) {
    console.warn(`[App] Failed to fetch ${langCode} messages from ${messageUrl}:`, error, ". Falling back to 'en'.");
    // Fallback to English
    // Use 'as any' for fallback URL too
    const fallbackUrl = browser.runtime.getURL('/_locales/en/messages.json' as any);
    try {
      const fallbackResponse = await fetch(fallbackUrl);
      if (!fallbackResponse.ok) {
        throw new Error(`HTTP error! status: ${fallbackResponse.status} for fallback 'en'`);
      }
      const englishMessages: Messages = await fallbackResponse.json();
      console.log("[App] Successfully fetched and parsed fallback 'en' messages."); 
      return englishMessages;
    } catch (fallbackError) {
      // Use simple concatenation as requested
      console.error('[App] Failed to fetch fallback \'en\' messages from ' + fallbackUrl + ':', fallbackError);
      return {}; 
    }
  }
};

// Keep steps definition for progress calculation
const onboardingSteps: Step[] = ['language', 'learningGoal', 'setupLLM', 'setupEmbedding', 'setupReader', 'redirects'];

const App: Component = () => {
  const [currentStep, setCurrentStep] = createSignal<Step>('language');
  const [targetLangLabel, setTargetLangLabel] = createSignal<string>('');
  const [uiLangCode, setUiLangCode] = createSignal<string>(getBestInitialLangCode());
  
  const [messagesData] = createResource(uiLangCode, fetchMessages);

  // --- Redirects State Management START ---
  // Resource to load initial redirect settings
  const [initialRedirectSettingsData] = createResource(async () => {
    console.log("[App] Fetching initial redirect settings from storage...");
    // Revert to assuming UserConfiguration type is correct and includes redirectSettings
    // Use type assertion on the awaited value
    const config = (await userConfigurationStorage.getValue()) as UserConfiguration; 
    return config?.redirectSettings || {}; 
  }, { initialValue: {} });

  // Signal to hold the current redirect settings state being modified
  const [redirectSettings, setRedirectSettings] = createSignal<RedirectSettings>({});

  // Effect to update the working signal when resource loads/reloads
  createEffect(() => {
    const loadedSettings = initialRedirectSettingsData();
    if (!initialRedirectSettingsData.loading && loadedSettings) {
        console.log("[App] Initial redirect settings loaded, updating signal:", loadedSettings);
        setRedirectSettings(loadedSettings);
    }
  });
  // --- Redirects State Management END ---

  // Calculate progress values
  const progressValue = () => onboardingSteps.indexOf(currentStep()) + 1; // 1-based index
  const progressMax = () => onboardingSteps.length;

  const i18n = () => {
    const messages = messagesData();
    // console.log(
    //   `[App] Recalculating i18n object. Loading: ${messagesData.loading}, Error: ${!!messagesData.error}, Has Data: ${!!messages}, Lang: ${uiLangCode()}`
    // );
    return {
      get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
    };
  };

  // Handler for immediate native language change
  const handleNativeLanguageSelect = (newLangCode: string) => {
    if (newLangCode !== uiLangCode()) {
        console.log(`[App] handleNativeLanguageSelect: UI language changing from ${uiLangCode()} to ${newLangCode}`);
        setUiLangCode(newLangCode); // Trigger resource reload immediately
    } else {
        console.log(`[App] handleNativeLanguageSelect: Selected language ${newLangCode} already active.`);
    }
  };

  // Updated handler: Save languages and move to learning goal
  const handleLanguageComplete = async (selectedLangs: { targetValue: string; targetLabel: string }) => {
    console.log('[App] Language Complete:', selectedLangs);
    setTargetLangLabel(selectedLangs.targetLabel);
    
    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig = {
      ...currentConfig,
      nativeLanguage: uiLangCode(), 
      targetLanguage: selectedLangs.targetValue,
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Config after saving languages:', updatedConfig);
    
    console.log('[App] Proceeding to learning goal step.');
    setCurrentStep('learningGoal'); // Go to learning goal next
  };

  // Updated handler: Save goal and move to LLM Function setup
  const handleLearningGoalComplete = async (goalId: string) => {
    console.log('[App] Learning Goal Complete:', goalId);
    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig = {
      ...currentConfig,
      learningGoal: goalId,
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Config after saving goal:', updatedConfig);
    
    console.log('[App] Proceeding to LLM setup step.');
    setCurrentStep('setupLLM'); // Go to the new LLM setup step
  };

  // Handler for LLM setup step completion
  const handleLLMComplete = async (config: FunctionConfig) => {
    console.log('[App] LLM Setup Complete:', config);
    if (!config.providerId || !config.modelId) {
        console.warn('[App] LLM setup skipped or incomplete. Proceeding without saving LLM config.');
    } else {
        const currentConfig = await userConfigurationStorage.getValue();
        const updatedConfig = {
          ...currentConfig,
          llmConfig: config, // Save LLM configuration
        };
        await userConfigurationStorage.setValue(updatedConfig);
        console.log('[App] Config after saving LLM setup:', updatedConfig);
    }
    console.log('[App] Proceeding to Embedding setup step.');
    setCurrentStep('setupEmbedding'); // Go to Embedding setup next
  };

  // Handler for Embedding setup step completion
  const handleEmbeddingComplete = async (config: FunctionConfig) => {
    console.log('[App] Embedding Setup Complete:', config);

    if (!config.providerId || !config.modelId) {
        console.warn('[App] Embedding setup skipped or incomplete. Proceeding without saving Embedding config.');
    } else {
        const currentConfig = await userConfigurationStorage.getValue();
        const updatedConfig = {
          ...currentConfig,
          embeddingConfig: config, // Save Embedding configuration
        };
        await userConfigurationStorage.setValue(updatedConfig);
        console.log('[App] Config after saving Embedding setup:', updatedConfig);
    }

    console.log('[App] Proceeding to Reader setup step.');
    setCurrentStep('setupReader'); // Go to Reader setup
  };

   // Handler for Reader setup step
   const handleReaderComplete = async (config: FunctionConfig) => {
    console.log('[App] Reader Setup Complete. Saving config.', config);

    // Use type assertion here
    const currentConfig = (await userConfigurationStorage.getValue() || {}) as UserConfiguration;
    // Construct full config, providing defaults for potentially missing fields
    const updatedConfig: UserConfiguration = {
      nativeLanguage: currentConfig.nativeLanguage || null,
      targetLanguage: currentConfig.targetLanguage || null,
      learningGoal: currentConfig.learningGoal || null,
      llmConfig: currentConfig.llmConfig || null,
      embeddingConfig: currentConfig.embeddingConfig || null,
      readerProvider: config.providerId, // Set reader info
      readerModel: config.modelId,
      readerBaseUrl: config.baseUrl,
      redirectSettings: currentConfig.redirectSettings || null, // Preserve existing or null
      onboardingComplete: false, // Ensure false before final step
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Config after saving Reader:', updatedConfig);
    
    // Proceed to Redirects step
    console.log('[App] Proceeding to Redirects setup step.');
    setCurrentStep('redirects'); 
  };

  // Handler for Redirects setup step (FINAL STEP)
  const handleRedirectsComplete = async () => {
      console.log('[App] Redirects Setup Complete (Final Step). Saving final settings.');
      const finalRedirectSettings = redirectSettings();
      
      // Use type assertion here
      const currentConfig = (await userConfigurationStorage.getValue() || {}) as UserConfiguration;
      // Construct full config, providing defaults for potentially missing fields
      const updatedConfig: UserConfiguration = {
          nativeLanguage: currentConfig.nativeLanguage || null,
          targetLanguage: currentConfig.targetLanguage || null,
          learningGoal: currentConfig.learningGoal || null,
          llmConfig: currentConfig.llmConfig || null,
          embeddingConfig: currentConfig.embeddingConfig || null,
          readerProvider: currentConfig.readerProvider || null, // Preserve existing reader info
          readerModel: currentConfig.readerModel || null,
          readerBaseUrl: currentConfig.readerBaseUrl || null,
          redirectSettings: finalRedirectSettings, // Save the latest redirect settings
          onboardingComplete: true, // Mark complete HERE
      };
      await userConfigurationStorage.setValue(updatedConfig);
      console.log('[App] Final config after saving Redirects:', updatedConfig);

      // Close tab logic
      console.log('[App] Onboarding complete, attempting to close tab.');
      try {
          const tab = await browser.tabs.getCurrent();
          if (tab?.id) {
              console.log(`[App] Closing tab with ID: ${tab.id}`);
              browser.tabs.remove(tab.id);
          }
      } catch (error) {
          console.error('[App] Error closing current tab:', error);
      }
  };

  // Handler for changes within the Redirects component
  const handleRedirectSettingChange = (serviceName: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => {
    setRedirectSettings(prev => {
      const currentServiceSetting = prev[serviceName] || { isEnabled: true, chosenInstance: '' }; // Default to enabled based on component logic
      return {
        ...prev,
        [serviceName]: {
          ...currentServiceSetting,
          isEnabled: update.isEnabled,
        },
      };
    });
  };

  // Back navigation handler
  const handleBack = () => {
    const step = currentStep();
    console.log(`[App] Back requested from step: ${step}`);
    switch (step) {
      case 'learningGoal':
        setCurrentStep('language');
        break;
      case 'setupLLM':
        setCurrentStep('learningGoal');
        break;
      case 'setupEmbedding':
        setCurrentStep('setupLLM'); // Go back to LLM setup
        break;
      case 'setupReader':
        setCurrentStep('setupEmbedding');
        break;
      case 'redirects': // Added case for redirects
        setCurrentStep('setupReader');
        break;
      // Add cases for other steps if needed
      default:
        console.warn('[App] Back requested from unhandled step:', step);
        // Optionally go back to a default previous step like language
        // setCurrentStep('language');
        break;
    }
  };

  // Wrap the main return in SettingsProvider
  return (
    <SettingsProvider>
      <OnboardingContent />
    </SettingsProvider>
  );
};

// Create a new component to contain the original App logic, now inside the provider
const OnboardingContent: Component = () => {
  const [currentStep, setCurrentStep] = createSignal<Step>('language');
  const [targetLangLabel, setTargetLangLabel] = createSignal<string>('');
  const [uiLangCode, setUiLangCode] = createSignal<string>(getBestInitialLangCode());
  
  const [messagesData] = createResource(uiLangCode, fetchMessages);

  // --- Redirects State Management (Keep as is) ---
  const [initialRedirectSettingsData] = createResource(async () => {
    console.log("[App] Fetching initial redirect settings from storage...");
    // Revert to assuming UserConfiguration type is correct and includes redirectSettings
    // Use type assertion on the awaited value
    const config = (await userConfigurationStorage.getValue()) as UserConfiguration; 
    return config?.redirectSettings || {}; 
  }, { initialValue: {} });
  const [redirectSettings, setRedirectSettings] = createSignal<RedirectSettings>({});
  createEffect(() => {
    const loadedSettings = initialRedirectSettingsData();
    if (!initialRedirectSettingsData.loading && loadedSettings) {
        setRedirectSettings(loadedSettings);
    }
  });

  // --- Use Settings Context --- 
  const settingsContext = useSettings(); // Now we can use the context!

  // Calculate progress values (Keep as is)
  const progressValue = () => onboardingSteps.indexOf(currentStep()) + 1;
  const progressMax = () => onboardingSteps.length;

  const i18n = () => {
    const messages = messagesData();
    return {
      get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
    };
  };

  // Handler for immediate native language change (Keep as is)
  const handleNativeLanguageSelect = (newLangCode: string) => {
    if (newLangCode !== uiLangCode()) {
        console.log(`[App] handleNativeLanguageSelect: UI language changing from ${uiLangCode()} to ${newLangCode}`);
        setUiLangCode(newLangCode); // Trigger resource reload immediately
    } else {
        console.log(`[App] handleNativeLanguageSelect: Selected language ${newLangCode} already active.`);
    }
  };

  // Language Complete Handler (Keep as is, uses storage directly)
  const handleLanguageComplete = async (selectedLangs: { targetValue: string; targetLabel: string }) => {
    console.log('[App] Language Complete:', selectedLangs);
    setTargetLangLabel(selectedLangs.targetLabel);
    
    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig = {
      ...currentConfig,
      nativeLanguage: uiLangCode(), 
      targetLanguage: selectedLangs.targetValue,
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Config after saving languages:', updatedConfig);
    
    console.log('[App] Proceeding to learning goal step.');
    setCurrentStep('learningGoal');
  };

  // Learning Goal Handler (Keep as is, uses storage directly)
  const handleLearningGoalComplete = async (goalId: string) => {
    console.log('[App] Learning Goal Complete:', goalId);
    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig = {
      ...currentConfig,
      learningGoal: goalId,
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Config after saving goal:', updatedConfig);
    
    console.log('[App] Proceeding to LLM setup step.');
    setCurrentStep('setupLLM');
  };

  // --- Model Setup Completion Handlers (Update to use context if desired, or keep storage logic) ---
  // Option A: Keep direct storage manipulation (simpler for now, might diverge from settings page)
  const handleLLMComplete = async (config: FunctionConfig) => {
    console.log('[App] LLM Setup Complete:', config);
    if (!config.providerId || !config.modelId) {
        console.warn('[App] LLM setup skipped or incomplete. Proceeding without saving LLM config.');
    } else {
        const currentConfig = await userConfigurationStorage.getValue() || {};
        const updatedConfig = { ...currentConfig, llmConfig: config };
        await userConfigurationStorage.setValue(updatedConfig);
        console.log('[App] Config after saving LLM setup:', updatedConfig);
    }
    setCurrentStep('setupEmbedding'); 
  };
  
  const handleEmbeddingComplete = async (config: FunctionConfig) => {
    console.log('[App] Embedding Setup Complete:', config);
    if (!config.providerId || !config.modelId) {
        console.warn('[App] Embedding setup skipped or incomplete.');
    } else {
        const currentConfig = await userConfigurationStorage.getValue() || {};
        const updatedConfig = { ...currentConfig, embeddingConfig: config };
        await userConfigurationStorage.setValue(updatedConfig);
        console.log('[App] Config after saving Embedding setup:', updatedConfig);
    }
    setCurrentStep('setupReader');
  };

   const handleReaderComplete = async (config: FunctionConfig) => {
    console.log('[App] Reader Setup Complete. Saving config.', config);
     if (!config.providerId || !config.modelId) {
        console.warn('[App] Reader setup skipped or incomplete.');
    } else {
        const currentConfig = await userConfigurationStorage.getValue() || {};
        // --- Ensure only readerConfig is used --- 
        const updatedConfig = { 
          ...currentConfig, 
          readerConfig: config // Assign the whole config object to the readerConfig property
        };
        await userConfigurationStorage.setValue(updatedConfig);
        console.log('[App] Config after saving Reader:', updatedConfig);
    }
    setCurrentStep('redirects');
  };

  // --- Redirects Handlers (Keep as is) ---
  const handleRedirectsComplete = async () => {
    // ... (existing logic using userConfigurationStorage and redirectSettings signal) ...
    // Mark onboarding complete definitively here
    const finalConfig = await userConfigurationStorage.getValue() || {};
    finalConfig.onboardingComplete = true;
    await userConfigurationStorage.setValue(finalConfig);
    window.close(); // Close the onboarding tab
  };

  const handleRedirectSettingChange = (serviceName: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => {
     // ... (existing logic using setRedirectSettings signal) ...
  };

  // Back Handler (Keep as is)
  const handleBack = () => {
     // ... (existing logic using setCurrentStep) ...
  };

  // --- Render Step Logic (Needs Major Update) ---
  const renderStep = () => {
    const step = currentStep();
    switch (step) {
      case 'language':
        return (
          <Language
            onComplete={handleLanguageComplete} 
            onNativeLangChange={handleNativeLanguageSelect} 
            iSpeakLabel={i18n().get('onboardingISpeak', 'I speak')}
            selectLanguagePlaceholder={i18n().get('onboardingSelectLanguage', 'Select language')}
            wantToLearnLabel={i18n().get('onboardingIWantToLearn', 'and I want to learn...')}
            continueLabel={i18n().get('onboardingContinue', 'Continue')}
            initialNativeLangValue={uiLangCode()} 
            availableNativeLanguages={nativeLanguagesList}
            availableTargetLanguages={allTargetLanguagesList}
            messages={messagesData() || {}} 
          />
        );
      case 'learningGoal':
        return (
          <LearningGoal
            onComplete={handleLearningGoalComplete} 
            onBack={handleBack}
            targetLanguageLabel={targetLangLabel()} 
            questionPrefix={i18n().get('onboardingLearningGoalQuestionPrefix', 'Why are you learning')}
            questionSuffix={i18n().get('onboardingLearningGoalQuestionSuffix', '?')}
            fallbackLabel={i18n().get('onboardingTargetLanguageFallback', 'your selected language')}
            continueLabel={i18n().get('onboardingContinue', 'Continue')}
            messages={messagesData() || {}} 
          />
        );

      // --- REPLACE SetupFunction with Panels --- 
      case 'setupLLM': { // Use block scope for constants
        const funcType = 'LLM';
        const transientState = settingsContext.getTransientState(funcType);
        const config = settingsContext.config.llmConfig;
        return (
          <div class="flex flex-col items-center w-full max-w-lg space-y-6">
            <ProviderSelectionPanel
              providerOptions={availableLLMProviders}
              selectedProviderId={() => config?.providerId}
              onSelectProvider={(provider) => settingsContext.handleSelectProvider(funcType, provider)}
            />
            <Show when={config?.providerId !== undefined}>
              <ModelSelectionPanel
                functionName={funcType}
                selectedProvider={() => availableLLMProviders.find(p => p.id === config?.providerId)}
                fetchStatus={transientState.fetchStatus}
                showSpinner={transientState.showSpinner}
                fetchError={transientState.fetchError}
                fetchedModels={transientState.localModels}
                remoteModels={transientState.remoteModels}
                selectedModelId={() => config?.modelId}
                onSelectModel={(modelId) => settingsContext.handleSelectModel(funcType, modelId)}
              />
              <Show when={transientState.fetchStatus() === 'success' && config?.modelId}>
                <ConnectionTestPanel
                  testStatus={transientState.testStatus}
                  testError={transientState.testError}
                  functionName={funcType}
                  selectedProvider={() => availableLLMProviders.find(p => p.id === config?.providerId)}
                />
                <div class="flex space-x-4 mt-4">
                   <Button 
                      onClick={() => config && settingsContext.testConnection(funcType, config)}
                      disabled={transientState.testStatus() === 'testing' || !config?.modelId}
                    >
                      {transientState.testStatus() === 'testing' ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button 
                      onClick={() => config && handleLLMComplete(config)} 
                      disabled={transientState.testStatus() !== 'success'}
                    >
                      {i18n().get('onboardingContinue', 'Continue')}
                    </Button>
                </div>
              </Show>
            </Show>
          </div>
        );
      }
      
      case 'setupEmbedding': {
        const funcType = 'Embedding';
        const transientState = settingsContext.getTransientState(funcType);
        const config = settingsContext.config.embeddingConfig;
        return (
          <div class="flex flex-col items-center w-full max-w-lg space-y-6">
            <ProviderSelectionPanel
              providerOptions={availableEmbeddingProviders}
              selectedProviderId={() => config?.providerId}
              onSelectProvider={(provider) => settingsContext.handleSelectProvider(funcType, provider)}
            />
            <Show when={config?.providerId !== undefined}>
              <ModelSelectionPanel
                functionName={funcType}
                selectedProvider={() => availableEmbeddingProviders.find(p => p.id === config?.providerId)}
                fetchStatus={transientState.fetchStatus}
                showSpinner={transientState.showSpinner}
                fetchError={transientState.fetchError}
                fetchedModels={transientState.localModels}
                remoteModels={transientState.remoteModels}
                selectedModelId={() => config?.modelId}
                onSelectModel={(modelId) => settingsContext.handleSelectModel(funcType, modelId)}
              />
              <Show when={transientState.fetchStatus() === 'success' && config?.modelId}>
                <ConnectionTestPanel
                  testStatus={transientState.testStatus}
                  testError={transientState.testError}
                  functionName={funcType}
                  selectedProvider={() => availableEmbeddingProviders.find(p => p.id === config?.providerId)}
                />
                <div class="flex space-x-4 mt-4">
                   <Button 
                      onClick={() => config && settingsContext.testConnection(funcType, config)}
                      disabled={transientState.testStatus() === 'testing' || !config?.modelId}
                    >
                      {transientState.testStatus() === 'testing' ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button 
                      onClick={() => config && handleEmbeddingComplete(config)} 
                      disabled={transientState.testStatus() !== 'success'}
                    >
                      {i18n().get('onboardingContinue', 'Continue')}
                    </Button>
                </div>
              </Show>
            </Show>
          </div>
        );
      }

      case 'setupReader': {
        const funcType = 'Reader';
        const transientState = settingsContext.getTransientState(funcType);
        const config = settingsContext.config.readerConfig;
        return (
          <div class="flex flex-col items-center w-full max-w-lg space-y-6">
            <ProviderSelectionPanel
              providerOptions={availableReaderProviders}
              selectedProviderId={() => config?.providerId}
              onSelectProvider={(provider) => settingsContext.handleSelectProvider(funcType, provider)}
            />
            <Show when={config?.providerId !== undefined}>
              <ModelSelectionPanel
                functionName={funcType}
                selectedProvider={() => availableReaderProviders.find(p => p.id === config?.providerId)}
                fetchStatus={transientState.fetchStatus}
                showSpinner={transientState.showSpinner}
                fetchError={transientState.fetchError}
                fetchedModels={transientState.localModels}
                remoteModels={transientState.remoteModels}
                selectedModelId={() => config?.modelId}
                onSelectModel={(modelId) => settingsContext.handleSelectModel(funcType, modelId)}
              />
              <Show when={transientState.fetchStatus() === 'success' && config?.modelId}>
                <ConnectionTestPanel
                  testStatus={transientState.testStatus}
                  testError={transientState.testError}
                  functionName={funcType}
                  selectedProvider={() => availableReaderProviders.find(p => p.id === config?.providerId)}
                />
                <div class="flex space-x-4 mt-4">
                   <Button 
                      onClick={() => config && settingsContext.testConnection(funcType, config)}
                      disabled={transientState.testStatus() === 'testing' || !config?.modelId}
                    >
                      {transientState.testStatus() === 'testing' ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button 
                      onClick={() => config && handleReaderComplete(config)} 
                      disabled={transientState.testStatus() !== 'success'}
                    >
                      {i18n().get('onboardingContinue', 'Continue')}
                    </Button>
                </div>
              </Show>
            </Show>
          </div>
        );
      }

      case 'redirects':
        return (
          <Redirects
            allRedirectSettings={redirectSettings} // Pass signal accessor
            isLoading={() => initialRedirectSettingsData.loading} 
            onSettingChange={handleRedirectSettingChange}
            onComplete={handleRedirectsComplete}
            onBack={handleBack}
            title={i18n().get('onboardingRedirectsTitle', 'Bypass Censorship & Paywalls')}
            description={i18n().get('onboardingRedirectsDescription', 'Use privacy-preserving frontends with many mirrors.')}
            continueLabel={i18n().get('onboardingFinishSetup', 'Finish Setup')}
          />
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  // Main return for OnboardingContent
  return (
    <div class="relative flex flex-col h-full bg-background text-foreground">
        {/* Progress Bar */}
        <div class="fixed top-0 left-0 right-0 z-20 px-4 pt-4 bg-background/80 backdrop-blur-sm">
            <Progress value={progressValue()} maxValue={progressMax()} />
        </div>
        {/* Back Button */}
        <Show when={currentStep() !== 'language'}>
            <button 
                onClick={handleBack} 
                class="absolute top-12 left-4 text-muted-foreground hover:text-foreground z-10 p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Go back"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"></path></svg>
            </button>
        </Show>
        
        {/* Step Content Area */}
        <div class="flex-grow flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24">
            {renderStep()}
        </div>

         {/* Removed fixed footer - buttons are now part of model setup steps */}
    </div>
  );
};

export default App; // Export the main App component
