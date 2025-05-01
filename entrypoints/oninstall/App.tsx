import { Component, createSignal, createResource } from 'solid-js';
import { Language, LanguageOptionStub } from '../../src/features/oninstall/Language';
import { LearningGoal } from '../../src/features/oninstall/LearningGoal';
import { userConfigurationStorage } from '../../src/services/storage';
// Import the shared Messages type
import type { Messages } from '../../src/types/i18n';
// Import LLM Setup components and types
import { SetupLLM } from '../../src/features/oninstall/SetupLLM';
// Import the LLM component for provider selection
import { LLM, LLMProviderOption } from '../../src/features/oninstall/LLM'; 
import type { LLMConfig } from '../../src/services/llm/types'; // Import LLMConfig

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

// Define available LLM Providers
const availableProviders: LLMProviderOption[] = [
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
];


type Step = 'language' | 'providerSelect' | 'llmSetup' | 'learningGoal'; // Added providerSelect and llmSetup

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


const App: Component = () => {
  const [currentStep, setCurrentStep] = createSignal<Step>('language');
  const [targetLangLabel, setTargetLangLabel] = createSignal<string>('');
  const [uiLangCode, setUiLangCode] = createSignal<string>(getBestInitialLangCode());
  // State for selected LLM provider
  const [selectedProvider, setSelectedProvider] = createSignal<LLMProviderOption | null>(null);
  
  const [messagesData] = createResource(uiLangCode, fetchMessages);
  const initialNativeValue = uiLangCode(); 

  const i18n = () => {
    const messages = messagesData();
    console.log(
      `[App] Recalculating i18n object. Loading: ${messagesData.loading}, Error: ${!!messagesData.error}, Has Data: ${!!messages}, Lang: ${uiLangCode()}`
    );
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

  // New handler: Store selected provider and move to LLM setup
  const handleProviderSelectComplete = (provider: LLMProviderOption) => {
    console.log('[App] Provider Selected:', provider);
    setSelectedProvider(provider);
    console.log('[App] Proceeding to LLM setup step.');
    setCurrentStep('llmSetup'); 
  };

  // Updated handler: Now the FINAL step. Save LLM config, mark complete, close tab.
  const handleLLMSetupComplete = async (config: LLMConfig) => {
    console.log('[App] LLM Setup Complete (Final Step):', config);
    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig = {
      ...currentConfig,
      llmProvider: config.provider,
      llmModel: config.model,
      llmBaseUrl: config.baseUrl,
      onboardingComplete: true, // Mark complete here
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Final config after saving LLM settings:', updatedConfig);
    
    // Close tab logic moved here
    console.log('[App] Onboarding complete, attempting to close tab.');
    browser.tabs.getCurrent().then(tab => {
      if (tab?.id) {
        console.log(`[App] Closing tab with ID: ${tab.id}`);
        browser.tabs.remove(tab.id);
      } else {
        console.log('[App] Could not get current tab ID to close.');
      }
    }).catch(error => {
      console.error('[App] Error getting current tab:', error);
    });
  };

  // Updated handler: Save goal and move to PROVIDER selection. Do NOT close tab.
  const handleLearningGoalComplete = async (goalId: string) => {
    console.log('[App] Learning Goal Complete:', goalId);
    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig = {
      ...currentConfig,
      learningGoal: goalId,
      // onboardingComplete: true, // Moved to LLM setup complete
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Config after saving goal:', updatedConfig);
    
    console.log('[App] Proceeding to provider selection step.');
    setCurrentStep('providerSelect'); // Go to provider select next
  };


  const renderStep = () => {
    const currentMessages = i18n();
    const provider = selectedProvider(); // Get potentially selected provider

    switch (currentStep()) {
      case 'language':
        return <Language 
                   onComplete={handleLanguageComplete} 
                   onNativeLangChange={handleNativeLanguageSelect} 
                   iSpeakLabel={currentMessages.get('onboardingISpeak', 'I speak')}
                   selectLanguagePlaceholder={currentMessages.get('onboardingSelectLanguage', 'Select language')}
                   wantToLearnLabel={currentMessages.get('onboardingIWantToLearn', 'and I want to learn...')}
                   continueLabel={currentMessages.get('onboardingContinue', 'Continue')}
                   initialNativeLangValue={initialNativeValue} 
                   availableNativeLanguages={nativeLanguagesList}
                   availableTargetLanguages={allTargetLanguagesList}
                   messages={messagesData() || {}} 
               />;
       case 'providerSelect': // Use the LLM component for provider selection
         return <LLM 
                    onComplete={handleProviderSelectComplete}
                    selectProviderLabel={currentMessages.get('onboardingLLMProviderTitle', 'Choose your Local LLM Provider')}
                    continueLabel={currentMessages.get('onboardingContinue', 'Continue')}
                    availableProviders={availableProviders}
                    messages={messagesData() || {}}
                 />;
       case 'llmSetup': // New Step: Configure Selected Provider
         if (!provider) {
            console.error("[App] Error: Reached llmSetup step without a selected provider.");
            // Maybe redirect back or show an error message
            return <div>Error: No LLM provider selected. Please go back.</div>;
         }
         return <SetupLLM
                    selectedProvider={provider}
                    onComplete={handleLLMSetupComplete}
                    messages={messagesData() || {}}
                 />;
      case 'learningGoal':
        return <LearningGoal 
                   onComplete={handleLearningGoalComplete} 
                   targetLanguageLabel={targetLangLabel()} 
                   questionPrefix={currentMessages.get('onboardingLearningGoalQuestionPrefix', 'Why are you learning')}
                   questionSuffix={currentMessages.get('onboardingLearningGoalQuestionSuffix', '?')}
                   fallbackLabel={currentMessages.get('onboardingTargetLanguageFallback', 'your selected language')}
                   continueLabel={currentMessages.get('onboardingContinue', 'Continue')}
                   messages={messagesData() || {}} 
               />;
      default:
        console.error('Unknown onboarding step:', currentStep());
        return <div>Error: Unknown step</div>;
    }
  };

  return (
    <div class="bg-background text-foreground min-h-screen">
      {messagesData.loading ? <div>Loading...</div> : renderStep()} 
    </div>
  );
};

export default App;
