import { Component, createSignal, createResource } from 'solid-js';
import { Language, LanguageOptionStub } from '../../src/features/oninstall/Language';
import { LearningGoal } from '../../src/features/oninstall/LearningGoal';
import { userConfigurationStorage } from '../../src/services/storage';
// Import the shared Messages type
import type { Messages } from '../../src/types/i18n';
// Import the new SetupFunction component and its types
import { SetupFunction, ProviderOption } from '../../src/features/oninstall/SetupFunction';
// No longer need specific LLMConfig type here, handled by SetupFunction's onComplete
// Import the Progress component
import { Progress } from '../../src/components/ui/progress';

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
    { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
    { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' }, // Add Jan for embeddings
];

// Define available Reader Providers (likely subset of LLM providers)
const availableReaderProviders: ProviderOption[] = [
    { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
    // Add others capable of running the reader model
];

// Define types for function configuration (Can be expanded later)
interface FunctionConfig {
    providerId: string;
    modelId: string;
    baseUrl: string;
}

// Simplified Step type for the new flow
type Step = 'language' | 'learningGoal' | 'setupLLM' | 'setupEmbedding' | 'setupReader';

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
const onboardingSteps: Step[] = ['language', 'learningGoal', 'setupLLM', 'setupEmbedding', 'setupReader'];

const App: Component = () => {
  const [currentStep, setCurrentStep] = createSignal<Step>('language');
  const [targetLangLabel, setTargetLangLabel] = createSignal<string>('');
  const [uiLangCode, setUiLangCode] = createSignal<string>(getBestInitialLangCode());
  
  const [messagesData] = createResource(uiLangCode, fetchMessages);

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

   // Handler for Reader setup step (FINAL STEP)
   const handleReaderComplete = async (config: FunctionConfig) => {
    console.log('[App] Reader Setup Complete (Final Step). Saving config.', config);

    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig = {
      ...currentConfig,
      readerProvider: config.providerId, // Assuming keys like readerProvider etc.
      readerModel: config.modelId,
      readerBaseUrl: config.baseUrl,
      onboardingComplete: true, // Mark complete HERE
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Final config after saving Reader:', updatedConfig);

    // Close tab logic
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
        setCurrentStep('setupEmbedding'); // Go back to Embedding setup
        break;
      // Add cases for other steps if needed
      default:
        console.warn('[App] Back requested from unhandled step:', step);
        // Optionally go back to a default previous step like language
        // setCurrentStep('language');
        break;
    }
  };

  const renderStep = () => {
    const currentMessages = i18n();

    switch (currentStep()) {
      case 'language':
        return <Language 
                   onComplete={handleLanguageComplete} 
                   onNativeLangChange={handleNativeLanguageSelect} 
                   iSpeakLabel={currentMessages.get('onboardingISpeak', 'I speak')}
                   selectLanguagePlaceholder={currentMessages.get('onboardingSelectLanguage', 'Select language')}
                   wantToLearnLabel={currentMessages.get('onboardingIWantToLearn', 'and I want to learn...')}
                   continueLabel={currentMessages.get('onboardingContinue', 'Continue')}
                   initialNativeLangValue={uiLangCode()} 
                   availableNativeLanguages={nativeLanguagesList}
                   availableTargetLanguages={allTargetLanguagesList}
                   messages={messagesData() || {}} 
               />;
       case 'setupLLM':
         return <SetupFunction
                    functionName="LLM"
                    providerOptions={availableLLMProviders}
                    onComplete={handleLLMComplete}
                    onBack={handleBack}
                    continueLabel={i18n().get('onboardingNext', 'Next')}
                    messages={messagesData()}
                    title={i18n().get('onboardingSetupLLMTitle', 'Choose an LLM')} 
                    description={i18n().get('onboardingSetupLLMDescription', 'Can\'t run a 4B+ model locally like Gemma3 or Qwen3? Use Jan with an OpenRouter model, many are free!')}
                 />;
       case 'setupEmbedding':
         return <SetupFunction
                    functionName="Embedding"
                    providerOptions={availableEmbeddingProviders}
                    onComplete={handleEmbeddingComplete}
                    onBack={handleBack}
                    continueLabel={i18n().get('onboardingNext', 'Next')}
                    messages={messagesData()}
                    title={i18n().get('onboardingSetupEmbeddingTitle', 'Choose Embedding')}
                    description={i18n().get('onboardingSetupEmbeddingDescription', 'Bge-m3 or bge-large are best due to multi-language support.')}
                 />;
        case 'setupReader':
         return <SetupFunction
                    functionName="Reader"
                    providerOptions={availableReaderProviders}
                    onComplete={handleReaderComplete}
                    onBack={handleBack}
                    title="Go Faster with ReaderLM"
                    description="ReaderLM 1.5B converts webpages to Markdown text."
                    continueLabel={currentMessages.get('onboardingFinishSetup', 'Finish Setup')}
                    messages={messagesData() || {}}
                   />;
       case 'learningGoal':
         return <LearningGoal 
                    onComplete={handleLearningGoalComplete} 
                    onBack={handleBack}
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
    // Switch back to a simpler layout
    // Enforce strict viewport height and prevent main container scroll
    <div class="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Progress Bar Container */}
      <div class="w-full p-0 flex-shrink-0"> {/* Added flex-shrink-0 */}
        <Progress 
          value={progressValue()} 
          maxValue={progressMax()}
          // Removed labels, using only the track
        />
      </div>

      {/* Main Content Area - takes remaining space and scrolls */}
      <div class="flex-grow overflow-y-auto">
         {renderStep()}
      </div>
    </div>
  );
};

export default App;
