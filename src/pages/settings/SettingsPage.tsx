import { Component, createSignal, createEffect } from 'solid-js';
import SettingsPageView from './SettingsPageView';
import { useSettings } from '../../context/SettingsContext';
import type { TtsProviderOption } from '../../features/models/TtsProviderPanel';
import type { FunctionConfig /*, DomainDetail*/ } from '../../services/storage/types';
import { DEFAULT_ELEVENLABS_MODEL_ID } from '../../shared/constants';

// Assume mock provider options are fetched or defined elsewhere if needed for the container
// For now, we rely on the context providing the actual config and the View receiving static options

interface SettingsPageProps {
  onNavigateBack?: () => void;
}

const SettingsPage: Component<SettingsPageProps> = (props) => {
  const settings = useSettings();

  // State for the active section within the page
  const [activeSection, setActiveSection] = createSignal<string | null>('tts');

  // Effect to potentially set initial active section based on config/load status
  createEffect(() => {
    if (settings.loadStatus() === 'ready' && !activeSection()) {
      // Optionally set a default section if none is active after load
      // setActiveSection('llm');
    }
    // Or navigate based on onboarding state if needed
  });

  // --- Get Transient States via Context Function --- 
  const llmTransientState = settings.getTransientState('LLM');
  const embeddingTransientState = settings.getTransientState('Embedding');
  const ttsTestAudio = settings.ttsTestAudio; // Get the audio signal accessor

  // --- Define TTS Provider Options --- 
  const availableTtsProviders: TtsProviderOption[] = [
      { id: 'elevenlabs', name: 'ElevenLabs', logoUrl: '/images/tts-providers/elevenlabs.png' },
      // { id: 'kokoro', name: 'Kokoro (Local)', logoUrl: '/images/tts-providers/kokoro.png' },
  ];

  // --- State Management for TTS Panel --- 
  const selectedTtsProviderId = () => settings.config.ttsConfig?.providerId;
  const [elevenLabsApiKeySignal, setElevenLabsApiKeySignal] = createSignal(settings.config.ttsConfig?.apiKey || '');
  
  // Testing State 
  const [isElTesting /*, setIsElTesting */] = createSignal(false);
  const [ttsError, setTtsError] = createSignal<Error | null>(null);

  // --- Handlers for TTS Panel --- 

  const handleSelectTtsProvider = (providerId: string | undefined) => {
      console.log(`[SettingsPage] TTS Provider selected: ${providerId}`);
      // Only EL is possible now, so config update can be simpler or removed if selection is fixed
      const newConfig: Partial<FunctionConfig> = { 
          providerId: providerId, 
          modelId: providerId === 'elevenlabs' ? DEFAULT_ELEVENLABS_MODEL_ID : undefined,
          apiKey: providerId === 'elevenlabs' ? elevenLabsApiKeySignal() : undefined
      };
      settings.updateTtsConfig(newConfig as FunctionConfig); 
      setTtsError(null);
  };

  const handleElevenLabsApiKeyChange = (apiKey: string) => {
      setElevenLabsApiKeySignal(apiKey);
      // Save API key using the default model ID
      settings.updateTtsConfig({ 
          providerId: 'elevenlabs', 
          modelId: DEFAULT_ELEVENLABS_MODEL_ID, // Save default model ID
          apiKey: apiKey 
      });
  };

  const handleTestElevenLabs = () => {
    console.log('[SettingsPage] Testing ElevenLabs...');
    const config = settings.config.ttsConfig;
    if (!config || config.providerId !== 'elevenlabs') {
        console.error("[SettingsPage] Cannot test ElevenLabs: Incorrect or missing config.");
        setTtsError(new Error("ElevenLabs configuration is not selected."));
        return;
    }
    // No need to set local isElTesting state if context handles testStatus
    void settings.testConnection('TTS', config); 
  };

  const playAudioBlob = (blob: Blob | null) => {
    if (!blob) {
      console.warn("playAudioBlob called with null blob.");
      return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url); // Clean up object URL
      audio.onerror = (e) => {
        console.error("Error playing audio:", e);
        URL.revokeObjectURL(url); // Clean up even on error
      };
      void audio.play(); // Play the audio
      console.log("Attempting to play audio blob...");
    } catch (error) {
      console.error("Error creating audio object URL or playing:", error);
    }
  };

  // --- Focus Mode State and Handlers ---
  const isFocusModeActiveSignal = () => settings.config.enableFocusMode ?? false;
  const focusModeBlockedDomainsSignal = () => settings.config.focusModeBlockedDomains ?? [];
  // For now, use general loading status. Can be refined if needed.
  const isFocusModeLoadingSignal = () => settings.loadStatus() === 'pending'; 

  const handleToggleFocusMode = (isEnabled: boolean) => {
    console.log(`[SettingsPage] Focus Mode Toggled: ${isEnabled}`);
    // Assuming a context method like this exists or will be added:
    settings.updateUserConfiguration({ enableFocusMode: isEnabled });
  };

  const handleAddFocusDomain = (domainName: string) => {
    console.log(`[SettingsPage] Add Blocked Domain: ${domainName}`);
    const currentDomains = settings.config.focusModeBlockedDomains ?? [];
    if (!currentDomains.some(d => d.name.toLowerCase() === domainName.toLowerCase())) {
      const updatedDomains = [...currentDomains, { name: domainName }];
      // Assuming a context method like this exists or will be added:
      settings.updateUserConfiguration({ focusModeBlockedDomains: updatedDomains });
    } else {
      console.warn("[SettingsPage] Domain already exists:", domainName);
    }
  };

  const handleRemoveFocusDomain = (domainName: string) => {
    console.log(`[SettingsPage] Remove Blocked Domain: ${domainName}`);
    const currentDomains = settings.config.focusModeBlockedDomains ?? [];
    const updatedDomains = currentDomains.filter(d => d.name.toLowerCase() !== domainName.toLowerCase());
    // Assuming a context method like this exists or will be added:
    settings.updateUserConfiguration({ focusModeBlockedDomains: updatedDomains });
  };
  // --- End Focus Mode ---

  return (
    <SettingsPageView
      // Standard Props
      loadStatus={settings.loadStatus} 
      config={settings.config} 
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onBackClick={props.onNavigateBack ?? (() => { console.warn("onBackClick called but no handler provided"); })}
      
      // LLM Props
      llmTransientState={llmTransientState}
      llmProviderOptions={settings.llmProviderOptions}
      onLlmSelectProvider={(provider) => { void settings.handleSelectProvider('LLM', provider); }}
      onLlmSelectModel={(modelId) => { void settings.handleSelectModel('LLM', modelId); }}
      onLlmTestConnection={(config: FunctionConfig) => { void settings.testConnection('LLM', config); }}
      
      // Embedding Props
      embeddingTransientState={embeddingTransientState}
      embeddingProviderOptions={settings.embeddingProviderOptions}
      onEmbeddingSelectProvider={(provider) => { void settings.handleSelectProvider('Embedding', provider); }}
      onEmbeddingSelectModel={(modelId) => { void settings.handleSelectModel('Embedding', modelId); }}
      onEmbeddingTestConnection={(config: FunctionConfig) => { void settings.testConnection('Embedding', config); }}

      // TTS Props
      availableTtsProviders={availableTtsProviders}
      selectedTtsProviderId={selectedTtsProviderId} 
      onSelectTtsProvider={handleSelectTtsProvider}
      elevenLabsApiKey={elevenLabsApiKeySignal} 
      onElevenLabsApiKeyChange={handleElevenLabsApiKeyChange}
      isElevenLabsTesting={isElTesting}
      onTestElevenLabs={handleTestElevenLabs}
      ttsTestAudioData={ttsTestAudio} 
      onTtsPlayAudio={() => playAudioBlob(ttsTestAudio())}
      ttsTestError={ttsError}

      // Redirects Props
      onRedirectSettingChange={(service, update) => settings.handleRedirectSettingChange(service, update)}

      // Focus Mode Props
      isFocusModeActive={isFocusModeActiveSignal}
      isFocusModeLoading={isFocusModeLoadingSignal}
      focusModeBlockedDomains={focusModeBlockedDomainsSignal}
      onFocusModeToggle={handleToggleFocusMode}
      onFocusModeAddDomain={handleAddFocusDomain}
      onFocusModeRemoveDomain={handleRemoveFocusDomain}
    />
  );
};

export default SettingsPage;
