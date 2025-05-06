import { Component, createSignal, createEffect, Accessor, onMount } from 'solid-js';
import SettingsPageView from './SettingsPageView';
import { useSettings } from '../../context/SettingsContext';
import type { ProviderOption } from '../../features/models/ProviderSelectionPanel';
import type { TtsProviderOption, TtsModelOption, KokoroDownloadStatus } from '../../features/models/TtsProviderPanel';
import type { FunctionConfig, RedirectServiceSetting, UserConfiguration } from '../../services/storage/types';
import { checkWebGPUSupport } from '../../lib/utils';

// Assume mock provider options are fetched or defined elsewhere if needed for the container
// For now, we rely on the context providing the actual config and the View receiving static options

interface SettingsPageProps {
  onNavigateBack?: () => void;
}

const SettingsPage: Component<SettingsPageProps> = (props) => {
  const settings = useSettings();

  // State for the active section within the page
  const [activeSection, setActiveSection] = createSignal<string | null>('llm');

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
      { id: 'kokoro', name: 'Kokoro (Local)', logoUrl: '/images/tts-providers/kokoro.png' },
  ];

  // --- Mock data (replace with actual data fetching if needed) ---
  const mockElevenLabsModels: TtsModelOption[] = [
      { id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2' },
      { id: 'eleven_english_v1', name: 'Eleven English v1' },
  ];

  // --- State Management for TTS Panel --- 
  // Derive selected provider from main config
  const selectedTtsProviderId = () => settings.config.ttsConfig?.providerId;

  // API Key - Store directly? Or in ttsConfig?
  // Let's assume ttsConfig might store it. Need to update ttsConfig structure.
  // For now, use a local signal, but this should sync with storage via context.
  const [elevenLabsApiKeySignal, setElevenLabsApiKeySignal] = createSignal(settings.config.ttsConfig?.apiKey || '');
  
  // Selected EL Model - Derive from config
  const selectedElevenLabsModelId = () => {
      if (settings.config.ttsConfig?.providerId === 'elevenlabs') {
          return settings.config.ttsConfig?.modelId;
      }
      return undefined;
  };
  
  // Kokoro State - Need dedicated state signals managed by context or locally
  // These are placeholders - REAL implementation needs context/service interaction
  const [kokoroStatus, setKokoroStatus] = createSignal<KokoroDownloadStatus>('not-downloaded');
  const [kokoroProgress, setKokoroProgress] = createSignal(0);
  // Initialize WebGPU support signal
  const [isWebGPUSupported, setIsWebGPUSupported] = createSignal(false); 
  // Default Kokoro device - will be updated by effect
  const [kokoroDevice, setKokoroDevice] = createSignal<'cpu' | 'webgpu'>('cpu'); 

  // Testing State - These might come from context if context handles individual provider tests
  const [isElTesting, setIsElTesting] = createSignal(false);
  const [isKokoroTesting, setIsKokoroTesting] = createSignal(false);
  const [ttsError, setTtsError] = createSignal<Error | null>(null); // Combined error signal

  // --- Effect to check WebGPU support and set default --- 
  onMount(() => {
      const supported = checkWebGPUSupport();
      setIsWebGPUSupported(supported);
      if (supported) {
          // If supported, set default preference to webgpu
          // We might want to check the actual saved config first if we save this preference
          const savedPreference = settings.config.ttsConfig?.kokoroDevicePreference; // Assuming this might exist
          if (savedPreference) {
             setKokoroDevice(savedPreference); 
          } else {
             setKokoroDevice('webgpu'); 
             console.log("[SettingsPage] WebGPU supported, setting default device to 'webgpu'.");
          }
      } else {
          setKokoroDevice('cpu'); // Explicitly set to cpu if not supported
          console.log("[SettingsPage] WebGPU not supported, setting device to 'cpu'.");
      }
  });

  // --- Handlers for TTS Panel --- 

  const handleSelectTtsProvider = (providerId: string | undefined) => {
      console.log(`[SettingsPage] TTS Provider selected: ${providerId}`);
      // Update the main config via context
      // This needs a new context action or modification of handleSelectProvider
      const newConfig: Partial<FunctionConfig> = { providerId: providerId, modelId: undefined };
      if (providerId !== 'elevenlabs') newConfig.apiKey = undefined; // Clear API key if not EL
      // TODO: Need a settings.updateTtsConfigPartial or similar
      settings.updateTtsConfig({ ...(settings.config.ttsConfig || {}), ...newConfig } as FunctionConfig);
      // Reset specific states
      setTtsError(null);
      setKokoroStatus('not-downloaded'); // Reset kokoro state on provider change
      // setElevenLabsApiKeySignal(''); // Keep API key for now? Or clear?
  };

  const handleElevenLabsApiKeyChange = (apiKey: string) => {
      setElevenLabsApiKeySignal(apiKey);
      // TODO: Debounce and save via context -> settings.updateTtsConfig
      settings.updateTtsConfig({ ...(settings.config.ttsConfig || {}), providerId: 'elevenlabs', apiKey: apiKey } as FunctionConfig);
  };

  const handleSelectElevenLabsModel = (modelId: string | undefined) => {
      // Update via context
      settings.updateTtsConfig({ ...(settings.config.ttsConfig || {}), providerId: 'elevenlabs', modelId: modelId } as FunctionConfig);
  };

  const handleTestElevenLabs = () => {
      console.log('[SettingsPage] Testing ElevenLabs...');
      setIsElTesting(true);
      setTtsError(null);
      // TODO: Call context function settings.testTtsProvider('elevenlabs', config...)
      setTimeout(() => { setIsElTesting(false); /* setTtsError(new Error('EL Test Failed')); */ }, 2000); // Placeholder
  };

  const handleDownloadKokoroModel = () => {
      console.log('[SettingsPage] Downloading Kokoro model...');
      setKokoroStatus('downloading');
      setTtsError(null);
      // TODO: Call actual download service via context
      let progress = 0;
      const interval = setInterval(() => {
          progress += 10;
          setKokoroProgress(progress);
          if (progress >= 100) {
              clearInterval(interval);
              setKokoroStatus('downloaded');
              // TODO: Update main config to reflect Kokoro is usable?
          }
      }, 300); // Simulate download
  };

  const handleKokoroDeviceChange = (device: 'cpu' | 'webgpu') => {
      if (device === 'webgpu' && !isWebGPUSupported()) {
          console.warn("[SettingsPage] Attempted to select WebGPU when not supported.");
          return; // Don't allow selecting unsupported device
      }
      console.log(`[SettingsPage] Setting Kokoro device preference: ${device}`);
      setKokoroDevice(device);
      // TODO: Save preference to config via context
      settings.updateTtsConfig({ 
          ...(settings.config.ttsConfig || { providerId: 'kokoro' }), // Ensure providerId if null
          kokoroDevicePreference: device 
      } as FunctionConfig); // Need to extend FunctionConfig or use a specific type
  };

  const handleTestKokoro = () => {
      console.log('[SettingsPage] Testing Kokoro...');
      setIsKokoroTesting(true);
      setTtsError(null);
      // TODO: Call context function settings.testTtsProvider('kokoro', config...)
      setTimeout(() => { setIsKokoroTesting(false); /* setTtsError(new Error('Kokoro Test Failed')); */ }, 2000); // Placeholder
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
      elevenLabsModels={mockElevenLabsModels} 
      selectedElevenLabsModelId={selectedElevenLabsModelId} 
      onSelectElevenLabsModel={handleSelectElevenLabsModel}
      isElevenLabsTesting={isElTesting}
      onTestElevenLabs={handleTestElevenLabs}
      kokoroDownloadStatus={kokoroStatus}
      kokoroDownloadProgress={kokoroProgress}
      onDownloadKokoroModel={handleDownloadKokoroModel}
      kokoroDevicePreference={kokoroDevice}
      onKokoroDevicePreferenceChange={handleKokoroDeviceChange}
      isKokoroTesting={isKokoroTesting}
      onTestKokoro={handleTestKokoro}
      ttsTestAudioData={ttsTestAudio} 
      onTtsPlayAudio={() => playAudioBlob(ttsTestAudio())}
      ttsTestError={ttsError}
      isWebGPUSupported={isWebGPUSupported}

      // Redirects Props
      onRedirectSettingChange={(service, update) => settings.handleRedirectSettingChange(service, update)}
    />
  );
};

export default SettingsPage;
