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
// --- Import DeckSelectionPanel ---
import DeckSelectionPanel, { type DeckInfo } from '../../src/features/decks/DeckSelectionPanel';
// Import the constants
import { REDIRECT_SERVICES, DEFAULT_REDIRECT_INSTANCES } from '../../src/shared/constants';
// --- Import TtsProviderPanel and related types ---
import { TtsProviderPanel, type TtsProviderOption as OnboardingTtsProviderOption } from '../../src/features/models/TtsProviderPanel';
import { generateElevenLabsSpeechStream } from '../../src/services/tts/elevenLabsService';
import { DEFAULT_ELEVENLABS_VOICE_ID, DEFAULT_ELEVENLABS_MODEL_ID } from '../../src/shared/constants'; // Assuming ELEVENLABS_TEST_TEXT might be moved here or defined locally

// --- VAD and STT related imports ---
import { VadPanel, type VadOption } from '../../src/features/models/VadPanel';
import { MicVAD } from '@ricky0123/vad-web';
import { pcmToWavBlob } from '../../src/lib/utils';
import { transcribeElevenLabsAudio } from '../../src/services/stt/elevenLabsSttService';
import { browser } from 'wxt/browser'; // For browser.runtime.getURL in VAD ortConfig

// --- Import messaging types and function ---
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BackgroundProtocolMap, DeckInfoForFiltering } from '../../src/shared/messaging-types'; // Corrected import path for both types
// --- Import analytics ---
import { analytics } from '../../src/utils/analytics';

// --- Import personality service ---

// --- Define messaging for the frontend context ---
// Use the same protocol map as the background
const { sendMessage: sendBackgroundMessage } = defineExtensionMessaging<BackgroundProtocolMap>();
// Stub helper functions for onboarding language flow
const getBestInitialLangCode = (): string => 'en';
const fetchMessages = async (_langCode: string): Promise<Messages> => ({});
// We rename sendMessage to avoid conflicts if App.tsx used a variable named sendMessage elsewhere

const ONBOARDING_ELEVENLABS_TEST_TEXT = "Hello from Scarlett! This is an onboarding test.";

// Define language lists here (could also be moved)
const nativeLanguagesList: LanguageOptionStub[] = [
  { value: 'en', emoji: '🇺🇸', name: 'English' },
  { value: 'zh', emoji: '🇨🇳', name: 'Chinese' },
  { value: 'vi', emoji: '🇻🇳', name: 'Vietnamese' }
];

// Master list of all possible target languages we might offer
const masterTargetLanguagesList: LanguageOptionStub[] = [
  { value: 'en', emoji: '🇺🇸', name: 'English' }, 
  { value: 'zh', emoji: '🇨🇳', name: 'Chinese' }, 
  { value: 'ja', emoji: '🇯🇵', name: 'Japanese' },
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
    // In-Browser ONNX Embedding comes first
    { id: 'in-browser', name: 'In Browser', defaultBaseUrl: '', logoUrl: '/images/llm-providers/local.png'},
    { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
    { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' },
    { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
];

// Define available TTS Providers for Onboarding (Kokoro removed)
const onboardingTtsProviderOptions: OnboardingTtsProviderOption[] = [
    { id: 'elevenlabs', name: 'ElevenLabs', logoUrl: '/images/tts-providers/elevenlabs.png' }, 
    // { id: 'kokoro', name: 'Kokoro (Local)', logoUrl: '/images/tts-providers/kokoro.png' }, 
];

// Simplified Step type for the new flow - remove choosePlan
type Step = 'language' | 'learningGoal' | 'deckSelection' | 'setupLLM' | 'setupEmbedding' | 'setupTTS' | 'setupVAD' | 'redirects';

// Keep steps definition for progress calculation - remove choosePlan
const onboardingSteps: Step[] = ['language', 'learningGoal', 'deckSelection', 'setupLLM', 'setupEmbedding', 'setupTTS', 'setupVAD', 'redirects'];

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
  // Initialize at language selection instead of plan selection
  const [currentStep, setCurrentStep] = createSignal<Step>('language');
  // Remove subscription plan tracking
  // const [subscriptionPlan, setSubscriptionPlan] = createSignal<SubscriptionPlan | null>(null);

  // Keep targetLangLabel for goal step display
  const [targetLangLabel, setTargetLangLabel] = createSignal<string>('');
  // Add signals for selections made in child components
  const [selectedNativeLangValue, setSelectedNativeLangValue] = createSignal<string>(''); // Store selected native language
  const [selectedTargetLangValue, setSelectedTargetLangValue] = createSignal<string>('');
  const [selectedGoalId, setSelectedGoalId] = createSignal<string>('');
  const [uiLangCode, setUiLangCode] = createSignal<string>(getBestInitialLangCode());

  // Signal for dynamically filtered target languages
  const [filteredTargetLanguages, setFilteredTargetLanguages] = createSignal<LanguageOptionStub[]>([]);

  // --- State for Deck Selection ---
  // const [allAvailableDecks, setAllAvailableDecks] = createSignal<DeckInfo[]>([]); // Raw list from background
  const [recommendedDecks, setRecommendedDecks] = createSignal<DeckInfo[]>([]); // Filtered list for the panel
  const [isLoadingDecks, setIsLoadingDecks] = createSignal(false);
  const [selectedDeckIdentifiers, setSelectedDeckIdentifiers] = createSignal<string[]>([]);

  const [messagesData] = createResource(uiLangCode, fetchMessages);

  // Effect to update filteredTargetLanguages based on uiLangCode (native language)
  createEffect(() => {
    const nativeLang = uiLangCode();
    // Store native language when uiLangCode changes (it's our source of truth for native lang)
    setSelectedNativeLangValue(nativeLang); 

    let targets: LanguageOptionStub[] = [];
    if (nativeLang === 'zh' || nativeLang === 'vi') {
      targets = masterTargetLanguagesList.filter(lang => lang.value === 'en');
    } else if (nativeLang === 'en') {
      targets = masterTargetLanguagesList.filter(lang => lang.value === 'zh' || lang.value === 'ja');
    } else {
      // Default or fallback: offer English if native is not en/zh/vi (should not happen with new nativeLanguagesList)
      targets = masterTargetLanguagesList.filter(lang => lang.value === 'en');
    }
    setFilteredTargetLanguages(targets);

    // Reset selected target language when the list of available targets changes
    // to prevent an invalid state if the previously selected target is no longer available.
    if (targets.length > 0 && !targets.some(t => t.value === selectedTargetLangValue())) {
        setSelectedTargetLangValue('');
        setTargetLangLabel('');
    }
  });

  // --- Use Settings Context --- 
  const settingsContext = useSettings(); // Now we can use the context!
  const ttsTestAudio = settingsContext.ttsTestAudio; // Get audio signal

  // --- Track step changes for analytics ---
  createEffect(() => {
    const step = currentStep();
    // Only log step changes, don't track every page view
    console.log(`[Analytics] Onboarding step: ${step}`);
  });

  // --- TTS State Management for Onboarding (Kokoro state removed) ---
  const [selectedTtsProviderIdOnboarding, setSelectedTtsProviderIdOnboarding] = createSignal<string | undefined>(undefined);
  const [elevenLabsApiKeyOnboarding, setElevenLabsApiKeyOnboarding] = createSignal('');
  
  // REMOVE Kokoro state signals
  // const [kokoroStatusOnboarding, setKokoroStatusOnboarding] = createSignal<OnboardingKokoroDownloadStatus>('not-downloaded');
  // const [kokoroProgressOnboarding, setKokoroProgressOnboarding] = createSignal(0);
  // const [isWebGPUSupportedOnboarding, setIsWebGPUSupportedOnboarding] = createSignal(false);
  // const [kokoroDeviceOnboarding, setKokoroDeviceOnboarding] = createSignal<'cpu' | 'webgpu'>('cpu');
  
  const [isTtsTestingOnboarding, setIsTtsTestingOnboarding] = createSignal(false); 
  const [ttsErrorOnboarding, setTtsErrorOnboarding] = createSignal<Error | null>(null);

  // REMOVE onMount for WebGPU check
  // onMount(() => { ... });

  // --- VAD & STT State for Onboarding ---
  const availableVadOptionsOnboarding: VadOption[] = [
    { id: 'silero_vad', name: 'Silero VAD (Local)' }
  ];
  const [selectedVadIdOnboarding, setSelectedVadIdOnboarding] = createSignal<string | undefined>(availableVadOptionsOnboarding[0].id);
  const [vadInstanceOnboarding, setVadInstanceOnboarding] = createSignal<MicVAD | null>(null);
  const [isVadLoadingOnboarding, setIsVadLoadingOnboarding] = createSignal(false);
  const [isVadTestingOnboarding, setIsVadTestingOnboarding] = createSignal(false);
  const [vadStatusMessageOnboarding, setVadStatusMessageOnboarding] = createSignal<string | null>(null);
  const [vadTestErrorOnboarding, setVadTestErrorOnboarding] = createSignal<Error | null>(null);
  const [lastRecordedBlobOnboarding, setLastRecordedBlobOnboarding] = createSignal<Blob | null>(null);
  const lastRecordedAudioUrlOnboarding = () => {
    const blob = lastRecordedBlobOnboarding();
    return blob ? URL.createObjectURL(blob) : null;
  };
  // STT State for Onboarding VAD
  const [transcribedTextOnboarding, setTranscribedTextOnboarding] = createSignal<string | null>(null);
  const [sttErrorOnboarding, setSttErrorOnboarding] = createSignal<Error | null>(null);
  const [isTranscribingOnboarding, setIsTranscribingOnboarding] = createSignal(false);

  const cleanupLastRecordingOnboarding = () => {
    const currentUrl = lastRecordedAudioUrlOnboarding();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    setLastRecordedBlobOnboarding(null);
    setTranscribedTextOnboarding(null);
    setSttErrorOnboarding(null);
  };
  
  // --- End VAD & STT State ---

  // --- TTS Panel Handlers for Onboarding (Kokoro handlers removed) ---
  const handleSelectTtsProviderOnboarding = (providerId: string | undefined) => {
    console.log(`[App Onboarding] TTS Provider selected: ${providerId}`);
    setSelectedTtsProviderIdOnboarding(providerId);
    setTtsErrorOnboarding(null);
    // Reset specific provider states if necessary (only EL relevant now)
    // if (providerId !== 'elevenlabs') { ... }
    // REMOVE Kokoro reset
    // if (providerId !== 'kokoro') { ... }
  };

  const handleElevenLabsApiKeyChangeOnboarding = (apiKey: string) => {
    console.log(`[App Onboarding] handleElevenLabsApiKeyChangeOnboarding called with key (length ${apiKey.length}):`, apiKey);
    setElevenLabsApiKeyOnboarding(apiKey);
  };
  const handleTestElevenLabsOnboarding: () => Promise<void> = async () => {
    console.log("[App Onboarding] handleTestElevenLabsOnboarding triggered (explicit type).");
    console.log(`[App Onboarding] Inside test handler - API Key length: ${elevenLabsApiKeyOnboarding().length}, Is TTS Testing: ${isTtsTestingOnboarding()}`);

    if (!elevenLabsApiKeyOnboarding()) { 
      console.warn("[App Onboarding] ElevenLabs API key is missing for test.");
      setTtsErrorOnboarding(new Error("API key is required."));
      return;
    }
    
    if (isTtsTestingOnboarding()) { 
      console.log("[App Onboarding] ElevenLabs test already in progress.");
      return; 
    }

    console.log("[App Onboarding] Passed initial checks, preparing for try block...");
    setIsTtsTestingOnboarding(true);
    setTtsErrorOnboarding(null);
    settingsContext.setTtsTestAudio(null);

    try {
      console.log("[App Onboarding] Entered try block for ElevenLabs test.");
      const apiKey = elevenLabsApiKeyOnboarding();
      
      console.log(`[App Onboarding] Calling generateElevenLabsSpeechStream with apiKey (len: ${apiKey.length}), text: ${ONBOARDING_ELEVENLABS_TEST_TEXT}`);

      const audioBlob = await generateElevenLabsSpeechStream(
        apiKey,
        ONBOARDING_ELEVENLABS_TEST_TEXT,
        DEFAULT_ELEVENLABS_MODEL_ID,
        DEFAULT_ELEVENLABS_VOICE_ID
      );

      if (audioBlob) {
        console.log("[App Onboarding] ElevenLabs test successful, audio received.");
        settingsContext.setTtsTestAudio(audioBlob);
      } else {
        console.error("[App Onboarding] ElevenLabs test failed: No audio blob received.");
        setTtsErrorOnboarding(new Error("Test failed: No audio data received from ElevenLabs."));
      }
    } catch (error) {
      console.error("[App Onboarding] Error during ElevenLabs test:", error);
      setTtsErrorOnboarding(error instanceof Error ? error : new Error("An unknown error occurred during the ElevenLabs test."));
    } finally {
      console.log("[App Onboarding] ElevenLabs test finished.");
      setIsTtsTestingOnboarding(false);
    }
  };

  // REMOVE Kokoro Handlers
  // const handleDownloadKokoroModelOnboarding = () => { ... };
  // const handleKokoroDeviceChangeOnboarding = (device: 'cpu' | 'webgpu') => { ... };
  // const handleTestKokoroOnboarding = () => { ... };

  // Calculate progress values (Keep as is)
  const progressValue = () => onboardingSteps.indexOf(currentStep()) + 1;
  const progressMax = () => onboardingSteps.length;

  const i18n = () => {
    const messages = messagesData();
    return {
      get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
    };
  };

  // --- ADD BACK handlers inside OnboardingContent ---
  // Language Complete Handler (Update to use signals)
  const handleLanguageComplete = async () => {
    const nativeLang = selectedNativeLangValue(); // Use signal
    const targetValue = selectedTargetLangValue();
    const targetLabel = targetLangLabel();

    console.log('[App] Language Complete:', { targetValue, targetLabel, nativeLang });

    if (!targetValue) {
      console.error('[App] Cannot complete language step: target language value is missing.');
      return; // Prevent moving forward without selection
    }

    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig: UserConfiguration = {
      ...(currentConfig || {}), // Ensure currentConfig is not null, provide empty object if it is
      nativeLanguage: nativeLang,
      targetLanguage: targetValue,
    };
    // ADDED LOGGING BEFORE SETVALUE
    console.log(`[App] About to save languages. currentConfig was: ${JSON.stringify(currentConfig, null, 2)}, updatedConfig is: ${JSON.stringify(updatedConfig, null, 2)}`);
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

    console.log('[App] Proceeding to Choose Plan step.');
    setCurrentStep('deckSelection'); // <- Change to deckSelection
  };

  // --- Fetch and Filter Decks when DeckSelection step is active ---
  createEffect(async () => {
    if (currentStep() === 'deckSelection') {
      setIsLoadingDecks(true);
      setRecommendedDecks([]); // Clear previous recommendations
      try {
        // Fetch available decks (Using new sendBackgroundMessage)
        console.log('[App deckSelection Effect] Attempting to send message fetchAvailableDeckFiles...');
        const response = await sendBackgroundMessage('fetchAvailableDeckFiles', undefined); // Pass undefined as data
        console.log('[App deckSelection Effect] Received response from fetchAvailableDeckFiles:', response);
        
        if (response && response.success && Array.isArray(response.decks)) {
          // setAllAvailableDecks(response.decks);
          const nativeLang = selectedNativeLangValue();
          const targetLang = selectedTargetLangValue();

          if (!nativeLang || !targetLang) {
            console.warn('[App] Native or target language not selected. Cannot filter decks.');
            setRecommendedDecks([]); // Or show all, or show an error
          } else {
            console.log(`[App] Filtering decks for native: ${nativeLang}, target: ${targetLang}`);
            const filtered = response.decks.filter((deck: DeckInfoForFiltering) => { // Use DeckInfoForFiltering type
              // Check for only direct match
              const directMatch = deck.sourceLanguage === nativeLang && deck.targetLanguage === targetLang;
              // const reverseMatch = deck.sourceLanguage === targetLang && deck.targetLanguage === nativeLang; // REMOVED
              return directMatch; // Keep only direct match
            });
            console.log(`[App] Found ${filtered.length} recommended decks:`, filtered);
            setRecommendedDecks(filtered);
          }
        } else {
          console.error('Failed to fetch available decks or invalid format:', response?.error);
          // setAllAvailableDecks([]);
          setRecommendedDecks([]);
        }
      } catch (err) {
        console.error('Error fetching available decks:', err);
        // setAllAvailableDecks([]);
        setRecommendedDecks([]);
      } finally {
        setIsLoadingDecks(false);
      }
    }
  });

  // --- Handler for DeckSelectionPanel ---
  const handleDeckToggleInOnboarding = async (deckIdentifier: string, isEnabled: boolean) => {
    if (isEnabled) {
      setSelectedDeckIdentifiers(prev => [...new Set([...prev, deckIdentifier])]);
      try {
          // Use await with sendBackgroundMessage
          const response = await sendBackgroundMessage('addLearningDeck', { deckIdentifier });
          if (response.success) {
            console.log(`[App] Deck ${deckIdentifier} successfully added to learning queue.`);
          } else {
            console.error(`[App] Failed to add deck ${deckIdentifier}:`, response.error);
            // Revert selection state on failure
            setSelectedDeckIdentifiers(prev => prev.filter(id => id !== deckIdentifier)); 
          }
      } catch (err) {
          console.error(`[App] Error messaging addLearningDeck for ${deckIdentifier}:`, err);
          // Revert selection state on error
          setSelectedDeckIdentifiers(prev => prev.filter(id => id !== deckIdentifier));
      }
    } else {
      setSelectedDeckIdentifiers(prev => prev.filter(id => id !== deckIdentifier));
      // TODO: Implement removeLearningDeck message if needed
      console.log(`[App] Deck ${deckIdentifier} de-selected.`);
    }
  };

  // --- Handler to proceed from Deck Selection ---
  const handleDecksComplete = async () => {
    console.log('[App] Deck Selection Complete. Selected identifiers:', selectedDeckIdentifiers());
    
    // User selections are already processed by handleDeckToggleInOnboarding calling addLearningDeck.
    // No specific config needs to be saved here for *which* decks were added to user_learning,
    // as that's managed in the database directly.
    // We just proceed to the next step.
    setCurrentStep('setupLLM');
  };

  // --- Model Setup Completion Handlers (Keep as is) ---
  // Option A: Keep direct storage manipulation (simpler for now, might diverge from settings page)
  const handleLLMComplete = async (config: FunctionConfig) => {
    console.log('[App] LLM Setup Complete:', config);
    
    if (!config.providerId || !config.modelId) {
        console.warn('[App] LLM setup skipped or incomplete. Proceeding without saving LLM config.');
    } else {
        const currentConfig = await userConfigurationStorage.getValue() || {};
        const updatedConfig = { ...currentConfig, llmConfig: { ...config } }; // Spread to clone
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
      const updatedConfig = { ...currentConfig, embeddingConfig: { ...config } };
      await userConfigurationStorage.setValue(updatedConfig);
      console.log('[App] Config after saving Embedding setup:', updatedConfig);
    }
    setCurrentStep('setupTTS');
  };

  // --- Add TTS Handler --- (Update to remove Kokoro case)
  const handleTTSComplete = async () => {
    const providerId = selectedTtsProviderIdOnboarding();
    let ttsConfig: FunctionConfig | null = null;

    if (providerId === 'elevenlabs') {
      const apiKey = elevenLabsApiKeyOnboarding();
      const modelId = DEFAULT_ELEVENLABS_MODEL_ID;
      if (providerId && modelId && apiKey) { 
        ttsConfig = { providerId, modelId, apiKey };
      }
    } 
    // REMOVE Kokoro case
    // else if (providerId === 'kokoro') { ... }

    if (ttsConfig) {
      console.log('[App Onboarding] TTS Setup Complete with config:', ttsConfig);
      const currentConfig = await userConfigurationStorage.getValue() || {};
      const updatedConfig = { ...currentConfig, ttsConfig: ttsConfig }; 
      await userConfigurationStorage.setValue(updatedConfig);
      console.log('[App Onboarding] Config after saving TTS setup:', updatedConfig);
    } else {
      console.warn('[App Onboarding] TTS setup skipped or incomplete. No valid TTS config to save.');
      // Optionally, save a null ttsConfig if user proceeds without completing TTS setup
      const currentConfig = await userConfigurationStorage.getValue() || {};
      if (currentConfig.ttsConfig !== undefined) { // Only update if it was previously set
        const updatedConfig = { ...currentConfig, ttsConfig: null };
        await userConfigurationStorage.setValue(updatedConfig);
        console.log('[App Onboarding] Cleared TTS config as setup was incomplete.');
      }
    }
    setCurrentStep('setupVAD'); // Proceed to VAD setup
  };

  // --- New Handler for Skipping TTS Setup ---
  const handleSkipTTS = async () => {
    console.log('[App Onboarding] TTS setup skipped by user.');
    
    // Clear any transient TTS selections for this onboarding session
    setSelectedTtsProviderIdOnboarding(undefined);
    setElevenLabsApiKeyOnboarding('');
    setTtsErrorOnboarding(null);
    if (settingsContext) { // Ensure context is available
        settingsContext.setTtsTestAudio(null); // Clear any test audio
    }

    // Explicitly save null for ttsConfig when skipping
    const currentConfigVal = await userConfigurationStorage.getValue() || {};
    // Ensure ttsConfig is explicitly set to null
    const configWithSkippedTTS = { ...currentConfigVal, ttsConfig: null };
    await userConfigurationStorage.setValue(configWithSkippedTTS);
    console.log('[App Onboarding] TTS configuration explicitly set to null due to skip.');

    setCurrentStep('setupVAD'); // Proceed to VAD setup
  };
  // --- End New Handler ---

  // --- VAD Handlers for Onboarding ---
  const handleTranscriptionOnboarding = async () => {
    const apiKey = elevenLabsApiKeyOnboarding(); // Use the API key from TTS setup
    const audioBlob = lastRecordedBlobOnboarding();

    if (!apiKey) {
      setSttErrorOnboarding(new Error("ElevenLabs API key is not set. Please configure it in the TTS step."));
      setVadStatusMessageOnboarding("STT disabled: API key missing.");
      return;
    }
    if (!audioBlob) {
      setSttErrorOnboarding(new Error("No audio has been recorded to transcribe."));
      return;
    }

    setIsTranscribingOnboarding(true);
    setTranscribedTextOnboarding(null);
    setSttErrorOnboarding(null);
    setVadStatusMessageOnboarding("Transcribing audio...");

    try {
      const result = await transcribeElevenLabsAudio(apiKey, audioBlob);
      setTranscribedTextOnboarding(result.text);
      setVadStatusMessageOnboarding("Transcription successful.");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setSttErrorOnboarding(new Error("Transcription failed: " + errorMsg));
      setVadStatusMessageOnboarding("Transcription failed.");
    } finally {
      setIsTranscribingOnboarding(false);
    }
  };

  const initVadOnboarding = async () => {
    if (vadInstanceOnboarding()) return;
    console.log("[App Onboarding VAD] Initializing VAD...");
    try {
      setVadStatusMessageOnboarding("Initializing VAD...");
      setIsVadLoadingOnboarding(true);
      setVadTestErrorOnboarding(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("MediaDevices API or getUserMedia not supported.");
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const newVad = await MicVAD.new({
        baseAssetPath: "/vad-assets/",
        onnxWASMBasePath: "/vad-assets/",
        model: "v5",
        ortConfig: (ortInstance: any) => {
          ortInstance.env.wasm.proxy = false;
          ortInstance.env.wasm.simd = false;
          ortInstance.env.wasm.numThreads = 1;
          ortInstance.env.wasm.workerPath = browser.runtime.getURL("/vad-assets/ort-wasm.js" as any);
        },
        onSpeechStart: () => {
          setVadStatusMessageOnboarding("Listening...");
          cleanupLastRecordingOnboarding();
        },
        onSpeechEnd: (audio) => {
          setVadStatusMessageOnboarding("Speech ended. Processing audio...");
          setIsVadTestingOnboarding(false);
          const wavBlob = pcmToWavBlob(audio, 16000);
          cleanupLastRecordingOnboarding();
          setLastRecordedBlobOnboarding(wavBlob);
          setVadStatusMessageOnboarding("Audio captured. Starting transcription...");
          void handleTranscriptionOnboarding(); // Auto-transcribe
        },
        onVADMisfire: () => setVadStatusMessageOnboarding("VAD misfire."),
      });
      setVadInstanceOnboarding(newVad);
      setVadStatusMessageOnboarding(null); // Explicitly set to null on successful VAD init
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setVadTestErrorOnboarding(new Error("Failed to initialize VAD: " + errorMsg));
      setVadStatusMessageOnboarding("VAD Error: " + errorMsg);
    } finally {
      setIsVadLoadingOnboarding(false);
    }
  };
  
  // Effect to initialize VAD when the step becomes active or Silero VAD is selected (default)
  createEffect(() => {
    if (currentStep() === 'setupVAD' && selectedVadIdOnboarding() === 'silero_vad' && !vadInstanceOnboarding() && !isVadLoadingOnboarding()) {
      void initVadOnboarding();
    }
  });

  const handleTestVadOnboarding = async () => {
    if (selectedVadIdOnboarding() !== 'silero_vad') {
      setVadTestErrorOnboarding(new Error("Silero VAD not selected."));
      return;
    }
    let currentVad = vadInstanceOnboarding();
    if (!currentVad && !isVadLoadingOnboarding()) {
      await initVadOnboarding();
      currentVad = vadInstanceOnboarding();
      if (!currentVad) return;
    } else if (isVadLoadingOnboarding() || !currentVad) return;

    if (isVadTestingOnboarding()) {
      currentVad.pause();
      setIsVadTestingOnboarding(false);
      setVadStatusMessageOnboarding("Test stopped.");
    } else {
      try {
        setVadTestErrorOnboarding(null); // Clear previous errors
        await currentVad.start();
        setIsVadTestingOnboarding(true);
        setVadStatusMessageOnboarding("Listening for speech...");
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setVadTestErrorOnboarding(new Error("Error starting VAD: " + errorMsg));
        setVadStatusMessageOnboarding("VAD Error: " + errorMsg);
        setIsVadTestingOnboarding(false);
      }
    }
  };
  
  const handleStopVadTestOnboarding = () => {
      if (vadInstanceOnboarding() && isVadTestingOnboarding()) {
          vadInstanceOnboarding()!.pause();
          setIsVadTestingOnboarding(false);
          setVadStatusMessageOnboarding("Test explicitly stopped.");
      }
  };

  // Cleanup VAD instance when component unmounts or step changes
  createEffect(() => {
    const step = currentStep();
    const vadInstance = vadInstanceOnboarding();
    if (step !== 'setupVAD' && vadInstance) {
      console.log("[App Onboarding VAD] Cleaning up VAD instance due to step change.");
      vadInstance.pause();
      setVadInstanceOnboarding(null);
      cleanupLastRecordingOnboarding(); // Also clear any recording
      // Reset VAD state signals if needed
      setIsVadTestingOnboarding(false);
      setVadStatusMessageOnboarding(null);
      setVadTestErrorOnboarding(null);
      setIsVadLoadingOnboarding(false);
    }
  });
  // --- End VAD Handlers ---

  // --- Handler for completing VAD step ---
  const handleVADComplete = () => {
    // No specific VAD config to save to userConfigurationStorage for this step.
    // User has seen the panel and potentially tested it.
    console.log("[App Onboarding] VAD setup/test step complete.");
    setCurrentStep('redirects');
  };

  // --- Handler for skipping VAD step ---
  const handleSkipVAD = () => {
    console.log("[App Onboarding] VAD setup skipped by user.");
    if (vadInstanceOnboarding()) {
        vadInstanceOnboarding()!.pause();
        setVadInstanceOnboarding(null);
    }
    cleanupLastRecordingOnboarding();
    // Reset other VAD state if necessary
    setIsVadTestingOnboarding(false);
    setVadStatusMessageOnboarding(null);
    setVadTestErrorOnboarding(null);
    setIsVadLoadingOnboarding(false);
    setTranscribedTextOnboarding(null);
    setSttErrorOnboarding(null);
    setCurrentStep('redirects');
  };

  // --- Redirects Handlers (Keep as is) ---
  const handleRedirectsComplete = async () => {
    // Use the passed redirectSettings accessor
    const currentRedirects = props.redirectSettings();
    const currentConfig = await userConfigurationStorage.getValue() || {};
    // ADDED DETAILED LOG HERE
    console.log(`[App handleRedirectsComplete] Value of currentConfig JUST BEFORE final save: ${JSON.stringify(currentConfig, null, 2)}`);

    const finalConfig = {
      ...currentConfig,
      redirectSettings: currentRedirects,
      onboardingComplete: true,
    };
    console.log('[App] Attempting to save final config:', finalConfig); // Existing log
    await userConfigurationStorage.setValue(finalConfig);
    console.log('[App] Final config save complete.'); // Added log
    
    // Track onboarding completion
    try {
      await analytics.track('onboarding-completed', {
        llmProvider: finalConfig.llmConfig?.providerId || 'none',
        llmModel: finalConfig.llmConfig?.modelId || 'none',
        embeddingProvider: finalConfig.embeddingConfig?.providerId || 'none',
        embeddingModel: finalConfig.embeddingConfig?.modelId || 'none',
        hasElevenLabsKey: finalConfig.ttsConfig?.providerId === 'elevenlabs' ? 'true' : 'false'
      });
    } catch (error) {
      console.warn('[Analytics] Failed to track onboarding completion:', error);
    }
    
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
      case 'deckSelection':
        setCurrentStep('learningGoal'); // Fixed: should go back to learningGoal
        break;
      case 'setupLLM':
        setCurrentStep('deckSelection');
        break;
      case 'setupEmbedding':
        setCurrentStep('setupLLM'); 
        break;
      case 'setupTTS':
        setCurrentStep('setupEmbedding');
        break;
      case 'setupVAD': // New back navigation
        setCurrentStep('setupTTS');
        break;
      case 'redirects': 
        setCurrentStep('setupVAD'); // Updated from setupTTS to setupVAD
        break;
      default:
        console.warn('[App] Back requested from unhandled step:', step);
        break;
    }
  };

  // --- Footer Button Logic (Adjusted for TTS Panel) --- 
  const getCurrentTransientState = () => {
    const step = currentStep();
    switch (step) {
      case 'setupLLM': return settingsContext.getTransientState('LLM');
      case 'setupEmbedding': return settingsContext.getTransientState('Embedding');
      default: return null; 
    }
  };

  // Dynamic Button Label
  const footerButtonLabel = () => {
    const step = currentStep();
    const state = getCurrentTransientState(); // For LLM/Embedding

    if (step === 'language' || step === 'learningGoal') {
      return i18n().get('onboardingContinue', 'Continue');
    }
    if (step === 'deckSelection') {
      return i18n().get('onboardingContinue', 'Continue');
    }
    if (step === 'setupLLM' || step === 'setupEmbedding') {
      const llmOrEmbeddingConfig = step === 'setupLLM'
        ? settingsContext.config.llmConfig
        : settingsContext.config.embeddingConfig;
      if (!llmOrEmbeddingConfig?.providerId) {
        return i18n().get('onboardingContinue', 'Continue');
      }
      if (state?.fetchStatus() === 'loading') {
        return i18n().get('onboardingFetchingModels', 'Fetching models...');
      }
      if (state?.fetchStatus() === 'success' && !llmOrEmbeddingConfig?.modelId) {
        return i18n().get('onboardingContinue', 'Continue');
      }
      if (state?.testStatus() === 'idle' || state?.testStatus() === 'error') {
        return i18n().get('onboardingTest', 'Test Connection');
      }
      if (state?.testStatus() === 'testing') {
        return i18n().get('onboardingConnecting', 'Connecting...');
      }
      return i18n().get('onboardingContinue', 'Continue');
    }
    if (step === 'setupTTS') {
      const provider = selectedTtsProviderIdOnboarding();
      if (provider === 'elevenlabs') {
        if (isTtsTestingOnboarding()) {
          return i18n().get('onboardingConnecting', 'Testing...');
        }
        if (ttsTestAudio()) {
          return i18n().get('onboardingContinue', 'Continue');
        }
        return i18n().get('onboardingTest', 'Test Connection');
      }
      return i18n().get('onboardingContinue', 'Continue');
    }
    if (step === 'setupVAD') {
      if (isVadLoadingOnboarding()) return i18n().get('onboardingInitializing', 'Initializing...');
      if (isVadTestingOnboarding()) return i18n().get('onboardingStopTest', 'Stop Test');
      if (lastRecordedAudioUrlOnboarding() && isTranscribingOnboarding()) return i18n().get('onboardingTranscribing', 'Transcribing...');
      if ((vadInstanceOnboarding() && !isVadTestingOnboarding()) || lastRecordedAudioUrlOnboarding()) {
        if (lastRecordedAudioUrlOnboarding() || transcribedTextOnboarding() || sttErrorOnboarding()) {
          return i18n().get('onboardingContinue', 'Continue');
        }
        return i18n().get('onboardingTest', 'Test');
      }
      return i18n().get('onboardingTest', 'Test');
    }
    if (step === 'redirects') return i18n().get('onboardingFinishSetup', 'Finish Setup');
    return i18n().get('onboardingContinue', 'Continue');
  };

  // Dynamic Button Disabled State
  const isFooterButtonDisabled = () => {
    const step = currentStep();
    const state = getCurrentTransientState(); // For LLM/Embedding

    switch (step) {
      case 'language':
        return !selectedTargetLangValue(); 
      case 'learningGoal':
        return !selectedGoalId();
      // Add case for deckSelection
      case 'deckSelection':
        return isLoadingDecks(); // Disabled while loading. Can add other conditions if needed.
      case 'setupLLM':
      case 'setupEmbedding': {
        const llmOrEmbeddingConfig = step === 'setupLLM' ? settingsContext.config.llmConfig : settingsContext.config.embeddingConfig;
        if (!llmOrEmbeddingConfig?.providerId) return true; 
        if (state?.fetchStatus() === 'loading') return true; 
        if (state?.fetchStatus() === 'success' && !llmOrEmbeddingConfig?.modelId) return true; 
        if (state?.testStatus() === 'testing') return true; 
        return false;
      }
      // --- Updated TTS Logic for isFooterButtonDisabled ---
      case 'setupTTS': {
        const provider = selectedTtsProviderIdOnboarding();
        if (!provider) return true; // Disabled if no provider selected
        if (provider === 'elevenlabs') {
          if (!elevenLabsApiKeyOnboarding()) { // Disabled if EL selected but no API key
            return true;
          }
        }
        if (isTtsTestingOnboarding()) return true; // Disabled if currently testing
        // No other specific disabling condition here, footerButtonLabel handles "Test" vs "Continue"
        return false; 
      }
      // --- VAD Step Disable Logic ---
      case 'setupVAD': {
        if (isVadLoadingOnboarding()) return true; // Disabled while VAD is loading
        // No explicit disable during transcription for the main button, status is shown elsewhere.
        // Button actions (Test/Stop/Continue) are handled by footerButtonLabel logic.
        // If VAD init failed, testing should be disabled (though initVadOnboarding sets error message)
        if (vadTestErrorOnboarding() && !vadInstanceOnboarding()) return true; 
        return false;
      }
      case 'redirects':
        return props.initialRedirectLoading();
      default:
        return true; 
    }
  };

  // Dynamic Button onClick Action
  const handleFooterButtonClick = () => {
    const step = currentStep();
    const state = getCurrentTransientState(); // For LLM/Embedding
    const llmConfig = settingsContext.config.llmConfig;
    const embeddingConfig = settingsContext.config.embeddingConfig;

    switch (step) {
      case 'language':
        handleLanguageComplete(); 
        break;
      case 'learningGoal':
        handleLearningGoalComplete(); 
        break;
      // Add case for deckSelection
      case 'deckSelection':
        handleDecksComplete();
        break;
      case 'setupLLM':
        if (llmConfig && state && (state.testStatus() === 'idle' || state.testStatus() === 'error')) {
          settingsContext.testConnection('LLM', llmConfig);
        } else if (llmConfig && state && state.testStatus() === 'success') {
          handleLLMComplete(llmConfig);
        }
        break;
      case 'setupEmbedding':
        if (embeddingConfig && state && (state.testStatus() === 'idle' || state.testStatus() === 'error')) {
          settingsContext.testConnection('Embedding', embeddingConfig);
        } else if (embeddingConfig && state && state.testStatus() === 'success') {
          handleEmbeddingComplete(embeddingConfig);
        }
        break;
      // --- Updated TTS Logic for handleFooterButtonClick ---
      case 'setupTTS':
        const provider = selectedTtsProviderIdOnboarding();
        if (provider === 'elevenlabs' && elevenLabsApiKeyOnboarding().length > 0 && !ttsTestAudio() && !isTtsTestingOnboarding()) {
          // If API key is present, no successful test yet, and not currently testing -> perform test
          handleTestElevenLabsOnboarding();
        } else {
          // Otherwise (test successful, or user wants to skip test, or different provider) -> proceed to complete
          handleTTSComplete();
        }
        break;
      // --- VAD Step Footer Button Action ---
      case 'setupVAD':
        if (isVadTestingOnboarding()) {
          handleStopVadTestOnboarding();
        } else if (vadInstanceOnboarding() || !vadTestErrorOnboarding()) { // Allow test if instance exists or no critical init error
            // If there's audio or transcription result, "Continue" was pressed
            if (lastRecordedAudioUrlOnboarding() || transcribedTextOnboarding() || sttErrorOnboarding()) {
                handleVADComplete();
            } else { // Otherwise, "Test" was pressed
                handleTestVadOnboarding();
            }
        }
        // If VAD failed to initialize and instance is null with an error, button might be "Test" but disabled.
        // Or, if user clicks "Continue" directly without testing (e.g. if audio was somehow present from a quick succession of interactions)
        else if (lastRecordedAudioUrlOnboarding() || transcribedTextOnboarding() || sttErrorOnboarding()){
             handleVADComplete(); // Allow continue if there's some state to proceed from
        }
        break;
      case 'redirects':
        handleRedirectsComplete();
        break;
    }
  };
  // --- End Footer Button Logic ---

  // --- Audio Playback Helper --- (ensure this is defined before renderStep or accessible)
  const playAudioBlob = (blob: Blob | null) => {
    if (!blob) {
      console.warn("[App Onboarding] playAudioBlob called with null blob.");
      return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = (e) => { console.error("[App Onboarding] Error playing audio:", e); URL.revokeObjectURL(url); };
      void audio.play();
      console.log("[App Onboarding] Attempting to play audio blob...");
    } catch (error) {
      console.error("[App Onboarding] Error creating/playing audio:", error);
    }
  };

  // --- Render Step Logic (Remove Reader Case) --- 
  const renderStep = () => {
    const step = currentStep();
    switch (step) {
      case 'language':
        return (
          <Language
            onTargetLangChange={(value, label) => { setSelectedTargetLangValue(value); setTargetLangLabel(label); }}
            onNativeLangChange={(newLangCode) => {
              if (newLangCode !== uiLangCode()) {
                setUiLangCode(newLangCode);
              }
              setSelectedNativeLangValue(newLangCode);
            }}
            iSpeakLabel={i18n().get('onboardingISpeak', 'I speak')}
            selectLanguagePlaceholder={i18n().get('onboardingSelectLanguage', 'Select language')}
            wantToLearnLabel={i18n().get('onboardingIWantToLearn', 'and I want to learn...')}
            initialNativeLangValue={uiLangCode()}
            availableNativeLanguages={nativeLanguagesList}
            availableTargetLanguages={filteredTargetLanguages()}
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

      // --- Add Deck Selection Step ---
      case 'deckSelection':
        return (
          <div class="w-full max-w-lg">
            <p class="text-xl md:text-2xl mb-2">
              {i18n().get('deckSelectionPanelTitle', "Add Flashcards to Learn")}
            </p>
            <p class="text-lg text-muted-foreground mb-6">
              {i18n().get('deckSelectionPanelDescription', "Like Anki web, you can create, use, and share our community's flashcards.")}
            </p>
            <DeckSelectionPanel
              availableDecks={recommendedDecks} // Pass the filtered list
              isLoading={isLoadingDecks}
              onDeckToggle={handleDeckToggleInOnboarding}
              initiallySelectedDeckIds={selectedDeckIdentifiers}
              // Pass messages and necessary fallbacks to DeckSelectionPanel
              messages={messagesData() || {}}
              fallbackNoDecks={i18n().get('deckSelectionPanelNoDecks', "No recommended decks available for this learning goal.")}
            />
          </div>
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
          <div class="w-full max-w-lg"> {/* Changed from max-w-screen-xl mx-auto px-4 */}
            <p class="text-xl md:text-2xl mb-2">
              {i18n().get('onboardingSetupEmbeddingTitle', 'Choose Embedding')}
            </p>
             <p class="text-lg text-muted-foreground mb-6">
               {i18n().get('onboardingSetupEmbeddingDescription', 'Bge-m3 or bge-large are best due to multi-language support.')}
             </p>
            <div class="mb-6"> {/* Removed flex justify-center */}
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

      case 'setupTTS': {
        return (
          <div class="w-full max-w-lg">
            <p class="text-xl md:text-2xl mb-2">
              {i18n().get('onboardingSetupTTSTitle', 'Choose TTS (Optional)')}
            </p>
             <p class="text-lg text-muted-foreground mb-6">
               {/* Update description slightly */}
               {i18n().get('onboardingSetupTTSDescription', 'Configure ElevenLabs Text-to-Speech.')}
             </p>
            <TtsProviderPanel
                availableProviders={onboardingTtsProviderOptions} // Will only contain EL now
                selectedProviderId={selectedTtsProviderIdOnboarding}
                onSelectProvider={handleSelectTtsProviderOnboarding}
                
                // Pass ElevenLabs props 
                elevenLabsApiKey={elevenLabsApiKeyOnboarding}
                onElevenLabsApiKeyChange={handleElevenLabsApiKeyChangeOnboarding}
                isElevenLabsTesting={isTtsTestingOnboarding} 
                onTestElevenLabs={handleTestElevenLabsOnboarding}

                // REMOVE Kokoro props
                // kokoroDownloadStatus={...}
                // kokoroDownloadProgress={...}
                // onDownloadKokoroModel={...}
                // kokoroDevicePreference={...}
                // onKokoroDevicePreferenceChange={...}
                // isKokoroTesting={...} 
                // onTestKokoro={...}
                // isWebGPUSupported={...}
                
                // Pass General Test/Audio props
                testAudioData={ttsTestAudio} 
                onPlayTestAudio={() => playAudioBlob(ttsTestAudio())}
                testError={ttsErrorOnboarding}
            />
          </div>
        );
      }

      case 'setupVAD': {
        // Ensure API key is passed for STT functionality within VadPanel
        const sttEnabled = () => elevenLabsApiKeyOnboarding().length > 0;
        return (
          <div class="w-full max-w-lg">
            <p class="text-xl md:text-2xl mb-2">
              {i18n().get('onboardingSetupVADTitle', 'Test Voice Input & Transcription')}
            </p>
            <p class="text-lg text-muted-foreground mb-6">
              {i18n().get('onboardingSetupVADDescription', 'Test your microphone and ElevenLabs speech to text.')}
              <Show when={!sttEnabled()}>
                <span class="block mt-1 text-sm text-amber-500">{i18n().get('onboardingVADNoApiKeyForSTT', 'ElevenLabs API key not provided in TTS step; transcription will be disabled.')}</span>
              </Show>
            </p>
            <VadPanel
              availableVadOptions={availableVadOptionsOnboarding}
              selectedVadId={selectedVadIdOnboarding}
              onSelectVad={(id) => { /* Silero is only option for now */ setSelectedVadIdOnboarding(id); }}
              isVadTesting={isVadTestingOnboarding}
              onTestVad={handleTestVadOnboarding}
              onStopVadTest={handleStopVadTestOnboarding}
              vadStatusMessage={vadStatusMessageOnboarding}
              vadTestError={vadTestErrorOnboarding}
              isVadLoading={isVadLoadingOnboarding}
              lastRecordedAudioUrl={lastRecordedAudioUrlOnboarding}
              onPlayLastRecording={() => { /* Playback is via HTML5 controls */ }}
              // STT Props for Onboarding
              onTranscribe={async () => {if(sttEnabled()) await handleTranscriptionOnboarding(); }} // Manual call not used due to auto-transcribe
              transcribedText={transcribedTextOnboarding}
              isTranscribing={isTranscribingOnboarding}
              sttError={sttErrorOnboarding}
            />
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
        return <div>{i18n().get('onboardingUnknownStep', 'Unknown step')}</div>;
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
                class="absolute top-12 left-4 text-muted-foreground hover:text-foreground z-10 p-2 rounded-md hover:bg-muted transition-colors"
                aria-label={i18n().get('onboardingBackButtonAriaLabel', 'Go back')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"></path></svg>
            </Button>
        </Show>
        
        {/* Skip Button for TTS Step */}
        <Show when={currentStep() === 'setupTTS'}>
            <Button
                onClick={handleSkipTTS}
                variant="ghost"
                size="default"
                class="absolute top-12 right-4 text-muted-foreground hover:text-foreground z-10"
                aria-label={i18n().get('onboardingSkipTTSAriaLabel', 'Skip TTS setup and continue')}
            >
                {i18n().get('onboardingSkipButton', 'Skip')}
            </Button>
        </Show>
        
        {/* Skip Button for VAD Step */}
        <Show when={currentStep() === 'setupVAD'}>
            <Button
                onClick={handleSkipVAD}
                variant="ghost"
                size="default"
                class="absolute top-12 right-4 text-muted-foreground hover:text-foreground z-10"
                aria-label={i18n().get('onboardingSkipVADAriaLabel', 'Skip VAD setup and continue')}
            >
                {i18n().get('onboardingSkipButton', 'Skip')}
            </Button>
        </Show>
        
        {/* Step Content Area */}
        <div class="flex-grow flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24 overflow-y-auto pb-24 md:pb-28">
            {renderStep()}
        </div>

        {/* FIXED Footer */}
        <Show when={true}>
        <div class="fixed bottom-0 left-0 right-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center z-10">
          <div class="w-full max-w-xs">
            <Button
              size="lg"
              class="w-full"
                onClick={handleFooterButtonClick}
                disabled={isFooterButtonDisabled()}
            >
                {footerButtonLabel()}
            </Button>
          </div>
        </div>
        </Show>
    </div>
  );
};

export default App;
