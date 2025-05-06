import { Component, createSignal, createResource, createEffect, Show, Accessor, Setter } from 'solid-js';
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
// Import the constants
import { REDIRECT_SERVICES, DEFAULT_REDIRECT_INSTANCES } from '../../src/shared/constants';

// Define language lists here (could also be moved)
const nativeLanguagesList: LanguageOptionStub[] = [
  { value: 'en', emoji: '🇺🇸', name: 'English' }, 
  { value: 'zh', emoji: '🇨🇳', name: 'Chinese' }, 
  { value: 'th', emoji: '🇹🇭', name: 'Thai' }, 
  { value: 'id', emoji: '🇮🇩', name: 'Indonesian' }, 
  { value: 'ar', emoji: '🇸🇦', name: 'Arabic' }, 
  { value: 'ja', emoji: '🇯🇵', name: 'Japanese' }, 
  { value: 'ko', emoji: '🇰🇷', name: 'Korean' }, 
  { value: 'es', emoji: '🇪🇸', name: 'Spanish' },
  { value: 'vi', emoji: '🇻🇳', name: 'Vietnamese' } 
];

// Update target languages: Add name, remove Korean
const allTargetLanguagesList: LanguageOptionStub[] = [
  { value: 'en', emoji: '🇺🇸', name: 'English' }, 
  { value: 'zh', emoji: '🇨🇳', name: 'Chinese' }, 
  { value: 'ja', emoji: '🇯🇵', name: 'Japanese' },
  // { value: 'ko', emoji: '🇰🇷', name: 'Korean' }, // Removed Korean
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

// Simplified Step type for the new flow
type Step = 'language' | 'learningGoal' | 'setupLLM' | 'setupEmbedding' | 'redirects';

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
const onboardingSteps: Step[] = ['language', 'learningGoal', 'setupLLM', 'setupEmbedding', 'redirects'];

const App: Component = () => {

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
    const loadedConfig = initialRedirectSettingsData();
    // During onboarding (this component), always initialize signal with all redirects ON
    if (!initialRedirectSettingsData.loading) {
        console.log("[App] Onboarding: Initializing redirect settings signal with all ON.");
        const initialOnSettings: RedirectSettings = {};
        // Import REDIRECT_SERVICES here or pass it down
        // Assuming REDIRECT_SERVICES is available or imported:
        const services = REDIRECT_SERVICES; // You might need to import this
        for (const serviceName of services) {
            const lowerCaseName = serviceName.toLowerCase();
            // Set isEnabled: true for display, but use the ACTUAL default instance
            initialOnSettings[lowerCaseName] = {
                 isEnabled: true, 
                 chosenInstance: DEFAULT_REDIRECT_INSTANCES[lowerCaseName] ?? '' 
            };
        }
        setRedirectSettings(initialOnSettings);
    }
  });
  // --- Redirects State Management END ---

  // Wrap the main return in SettingsProvider
  return (
    <SettingsProvider>
      {/* Pass redirect state and setter down */}
      <OnboardingContent
        redirectSettings={redirectSettings}
        setRedirectSettings={setRedirectSettings}
        initialRedirectLoading={() => initialRedirectSettingsData.loading}
      />
    </SettingsProvider>
  );
};

// --- Props for OnboardingContent ---
interface OnboardingContentProps {
  redirectSettings: Accessor<RedirectSettings>;
  setRedirectSettings: Setter<RedirectSettings>;
  initialRedirectLoading: Accessor<boolean>;
}

// Create a new component to contain the original App logic, now inside the provider
// Accept props for redirect state
const OnboardingContent: Component<OnboardingContentProps> = (props) => {
  const [currentStep, setCurrentStep] = createSignal<Step>('language');
  // Keep targetLangLabel for goal step display
  const [targetLangLabel, setTargetLangLabel] = createSignal<string>('');
  // Add signals for selections made in child components
  const [selectedTargetLangValue, setSelectedTargetLangValue] = createSignal<string>('');
  const [selectedGoalId, setSelectedGoalId] = createSignal<string>('');
  const [uiLangCode, setUiLangCode] = createSignal<string>(getBestInitialLangCode());

  const [messagesData] = createResource(uiLangCode, fetchMessages);

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

  // --- ADD BACK handlers inside OnboardingContent ---
  // Language Complete Handler (Update to use signals)
  const handleLanguageComplete = async () => {
    const nativeLang = uiLangCode();
    const targetValue = selectedTargetLangValue();
    const targetLabel = targetLangLabel(); // This is already set by the change handler

    console.log('[App] Language Complete:', { targetValue, targetLabel, nativeLang });
    // Set targetLangLabel signal needed by the LearningGoal component
    // setTargetLangLabel(targetLabel); // Already set by onTargetLangChange

    if (!targetValue) {
      console.error('[App] Cannot complete language step: target language value is missing.');
      return; // Prevent moving forward without selection
    }

    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig = {
      ...currentConfig,
      nativeLanguage: nativeLang,
      targetLanguage: targetValue,
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Config after saving languages:', updatedConfig);

    console.log('[App] Proceeding to learning goal step.');
    setCurrentStep('learningGoal');
  };

  // Learning Goal Handler (Update to use signal)
  const handleLearningGoalComplete = async () => {
    const goalId = selectedGoalId();
    console.log('[App] Learning Goal Complete:', goalId);

    if (!goalId) {
        console.error('[App] Cannot complete learning goal step: goal ID is missing.');
        return; // Prevent moving forward without selection
    }

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
  // --- END ADD BACK ---

  // --- Model Setup Completion Handlers (Keep as is) ---
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
    setCurrentStep('redirects');
  };

  // --- Redirects Handlers (Keep as is) ---
  const handleRedirectsComplete = async () => {
    // Use the passed redirectSettings accessor
    const currentRedirects = props.redirectSettings();
    const currentConfig = await userConfigurationStorage.getValue() || {};
    const finalConfig = {
      ...currentConfig,
      redirectSettings: currentRedirects, // Save the latest state
      onboardingComplete: true,
    };
    console.log('[App] Attempting to save final config:', finalConfig); // Added log
    await userConfigurationStorage.setValue(finalConfig);
    console.log('[App] Final config save complete.'); // Added log
    // window.close(); // Close the onboarding tab - Replaced below
    window.location.href = 'newtab.html'; // Navigate to newtab.html
  };

  const handleRedirectSettingChange = (serviceName: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => {
     // Use the setRedirectSettings from props
     props.setRedirectSettings(prev => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName], // Keep existing settings for the service
        ...update, // Apply the update (isEnabled)
      }
     }));
     console.log(`[App] handleRedirectSettingChange: Updated signal for ${serviceName}. New state:`, props.redirectSettings());
  };

  // Back Handler (Keep as is)
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
        setCurrentStep('setupLLM'); 
        break;
      case 'redirects': 
        setCurrentStep('setupEmbedding');
        break;
      default:
        console.warn('[App] Back requested from unhandled step:', step);
        break;
    }
  };

  // --- Footer Button Logic (Remove Reader references) --- 
  const getCurrentTransientState = () => {
    const step = currentStep();
    switch (step) {
      case 'setupLLM': return settingsContext.getTransientState('LLM');
      case 'setupEmbedding': return settingsContext.getTransientState('Embedding');
      default: return null; 
    }
  };

  const getCurrentConfig = (): FunctionConfig | null | undefined => {
      const step = currentStep();
      switch (step) {
          case 'setupLLM': return settingsContext.config.llmConfig;
          case 'setupEmbedding': return settingsContext.config.embeddingConfig;
          default: return undefined;
      }
  };

  // Dynamic Button Label
  const footerButtonLabel = () => {
    const step = currentStep();
    const state = getCurrentTransientState();
    const config = getCurrentConfig();

    if (step === 'language' || step === 'learningGoal') {
      return i18n().get('onboardingContinue', 'Continue');
    }
    if (step === 'setupLLM' || step === 'setupEmbedding') { 
      if (!config?.providerId) return i18n().get('onboardingContinue', 'Continue'); 
      if (state?.fetchStatus() === 'success' && config?.modelId) {
        if (state?.testStatus() === 'idle' || state?.testStatus() === 'error') {
          return i18n().get('onboardingTest', 'Test');
        } else if (state?.testStatus() === 'testing') {
          return i18n().get('onboardingConnecting', 'Connecting...');
        } else { // testStatus === 'success'
          return i18n().get('onboardingContinue', 'Continue');
        }
      }
    }
    if (step === 'redirects') return i18n().get('onboardingFinishSetup', 'Finish Setup');
    return i18n().get('onboardingContinue', 'Continue');
  };

  // Dynamic Button Disabled State
  const isFooterButtonDisabled = () => {
    const step = currentStep();
    const state = getCurrentTransientState();
    const config = getCurrentConfig();

    switch (step) {
      case 'language':
        return !selectedTargetLangValue(); 
      case 'learningGoal':
        return !selectedGoalId(); 
      case 'setupLLM':
      case 'setupEmbedding':
        if (!config?.providerId) return true; 
        if (state?.fetchStatus() === 'loading') return true; 
        if (state?.fetchStatus() === 'success' && !config?.modelId) return true; 
        if (state?.testStatus() === 'testing') return true; 
        return false;
      case 'redirects':
        return props.initialRedirectLoading();
      default:
        return true; 
    }
  };

  // Dynamic Button onClick Action
  const handleFooterButtonClick = () => {
    const step = currentStep();
    const state = getCurrentTransientState();
    const config = getCurrentConfig();

    switch (step) {
      case 'language':
        handleLanguageComplete(); 
        break;
      case 'learningGoal':
        handleLearningGoalComplete(); 
        break;
      case 'setupLLM':
      case 'setupEmbedding':
        if (config && state && (state.testStatus() === 'idle' || state.testStatus() === 'error')) {
          settingsContext.testConnection(step.substring(5) as 'LLM' | 'Embedding', config);
        } else if (config && state && state.testStatus() === 'success') {
          if (step === 'setupLLM') handleLLMComplete(config);
          else if (step === 'setupEmbedding') handleEmbeddingComplete(config);
        }
        break;
      case 'redirects':
        handleRedirectsComplete();
        break;
    }
  };
  // --- End Footer Button Logic ---

  // --- Render Step Logic (Remove Reader Case) --- 
  const renderStep = () => {
    const step = currentStep();
    switch (step) {
      case 'language':
        return (
          <Language
            onTargetLangChange={(value: string, label: string) => { setSelectedTargetLangValue(value); setTargetLangLabel(label); }}
            onNativeLangChange={handleNativeLanguageSelect}
            iSpeakLabel={i18n().get('onboardingISpeak', 'I speak')}
            selectLanguagePlaceholder={i18n().get('onboardingSelectLanguage', 'Select language')}
            wantToLearnLabel={i18n().get('onboardingIWantToLearn', 'and I want to learn...')}
            initialNativeLangValue={uiLangCode()}
            availableNativeLanguages={nativeLanguagesList}
            availableTargetLanguages={allTargetLanguagesList}
            messages={messagesData() || {}}
            messagesLoading={messagesData.loading}
          />
        );
      case 'learningGoal':
        return (
          <LearningGoal
            onGoalChange={setSelectedGoalId}
            onBack={handleBack}
            targetLanguageLabel={targetLangLabel()}
            questionPrefix={i18n().get('onboardingLearningGoalQuestionPrefix', 'Why are you learning')}
            questionSuffix={i18n().get('onboardingLearningGoalQuestionSuffix', '?')}
            fallbackLabel={i18n().get('onboardingTargetLanguageFallback', 'your selected language')}
            messages={messagesData() || {}}
          />
        );

      // --- REPLACE SetupFunction with Panels --- 
      case 'setupLLM': { // Use block scope for constants
        const funcType = 'LLM';
        const transientState = settingsContext.getTransientState(funcType);
        const config = settingsContext.config.llmConfig;
        return (
          <div class="w-full max-w-lg">
             {/* Add Title and Description */}
             <p class="text-xl md:text-2xl mb-2">
               {i18n().get('onboardingSetupLLMTitle', 'Choose an LLM')}
             </p>
             <p class="text-lg text-muted-foreground mb-6">
               {i18n().get('onboardingSetupLLMDescription', 'Cant run a 4B+ model locally like Gemma3 or Qwen3? Use Jan with an OpenRouter model, many are free!')}
             </p>
            {/* Provider Panel */}
             <div class="mb-6">
                <ProviderSelectionPanel
                  providerOptions={availableLLMProviders}
                  selectedProviderId={() => config?.providerId}
                  onSelectProvider={(provider) => settingsContext.handleSelectProvider(funcType, provider)}
                />
            </div>
            {/* Model/Test Panels */} 
            <Show when={config?.providerId !== undefined}>
              <div class="space-y-6"> {/* Wrap model/test panels for spacing */}
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
                </Show>
              </div>
            </Show>
          </div>
        );
      }
      
      case 'setupEmbedding': {
        const funcType = 'Embedding';
        const transientState = settingsContext.getTransientState(funcType);
        const config = settingsContext.config.embeddingConfig;
        return (
          <div class="w-full max-w-lg">
            <p class="text-xl md:text-2xl mb-2">
              {i18n().get('onboardingSetupEmbeddingTitle', 'Choose Embedding')}
            </p>
             <p class="text-lg text-muted-foreground mb-6">
               {i18n().get('onboardingSetupEmbeddingDescription', 'Bge-m3 or bge-large are best due to multi-language support.')}
             </p>
            <div class="mb-6">
              <ProviderSelectionPanel
                providerOptions={availableEmbeddingProviders}
                selectedProviderId={() => config?.providerId}
                onSelectProvider={(provider) => settingsContext.handleSelectProvider(funcType, provider)}
              />
            </div>
            <Show when={config?.providerId !== undefined}>
              <div class="space-y-6">
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
                </Show>
              </div>
            </Show>
          </div>
        );
      }

      case 'redirects':
        return (
          <div class="w-full max-w-lg">
            <Redirects
              allRedirectSettings={props.redirectSettings} // Pass signal accessor from props
              isLoading={props.initialRedirectLoading} // Pass loading state from props
              onSettingChange={handleRedirectSettingChange}
              onBack={handleBack}
              title={i18n().get('onboardingRedirectsTitle', 'Bypass Censorship & Paywalls')}
              description={i18n().get('onboardingRedirectsDescription', 'Use privacy-preserving frontends with many mirrors.')}
            />
          </div>
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  // Main return for OnboardingContent
  return (
    <div class="relative flex flex-col h-full bg-background text-foreground">
        {/* Progress Bar */}
        <div class="fixed top-0 left-0 right-0 z-20 bg-background/80 backdrop-blur-sm">
            <Progress value={progressValue()} maxValue={progressMax()} />
        </div>
        {/* Back Button */}
        <Show when={currentStep() !== 'language'}>
            <Button 
                onClick={handleBack} 
                variant="ghost"
                size="icon"
                class="absolute top-12 left-4 text-muted-foreground hover:text-foreground z-10 p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Go back"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"></path></svg>
            </Button>
        </Show>
        
        {/* Step Content Area */}
        <div class="flex-grow flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24 overflow-y-auto pb-24 md:pb-28">
            {renderStep()}
        </div>

        {/* ADD BACK Fixed Footer with Dynamic Button */} 
        {/* Show footer only for relevant steps */} 
        <div class="fixed bottom-0 left-0 right-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center z-10">
          <div class="w-full max-w-xs">
            <Button
              size="lg"
              class="w-full"
              onClick={handleFooterButtonClick} // Use the dynamic handler
              disabled={isFooterButtonDisabled()} // Use the dynamic disabled state
            >
              {footerButtonLabel()} {/* Use the dynamic label */}
            </Button>
          </div>
        </div>
    </div>
  );
};

export default App;
