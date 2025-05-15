import { Component, createSignal, createEffect, onCleanup } from 'solid-js';
import SettingsPageView from './SettingsPageView';
import { useSettings } from '../../context/SettingsContext';
import type { TtsProviderOption } from '../../features/models/TtsProviderPanel';
import type { VadOption } from '../../features/models/VadPanel';
import { MicVAD } from '@ricky0123/vad-web';
import type { FunctionConfig } from '../../services/storage/types';
import { DEFAULT_ELEVENLABS_MODEL_ID } from '../../shared/constants';
import { browser } from "wxt/browser";
// import { IconMicrophone, IconSettings, IconSpeakerHigh, IconPalette, IconWrench, IconLink, IconFocus, IconBookOpen, IconMoodHappy, IconSparkle, IconBookmark, IconTag, IconClock } from "@/components/icons/AllIcons"; // Commented out due to persistent error
import { useNavigate } from "@solidjs/router";
import { pcmToWavBlob } from '../../lib/utils'; // Import the new utility
import { transcribeElevenLabsAudio, type ElevenLabsTranscriptionResponse } from '../../services/stt/elevenLabsSttService'; // Import STT service

interface SettingsPageProps {
  onNavigateBack?: () => void;
}

const SettingsPage: Component<SettingsPageProps> = (props) => {
  const settings = useSettings();
  const [activeSection, setActiveSection] = createSignal<string | null>('tts');

  createEffect(() => {
    if (settings.loadStatus() === 'ready' && !activeSection()) {
      // setActiveSection('llm');
    }
  });

  const llmTransientState = settings.getTransientState('LLM');
  const embeddingTransientState = settings.getTransientState('Embedding');
  const ttsTestAudio = settings.ttsTestAudio;

  const availableTtsProviders: TtsProviderOption[] = [
      { id: 'elevenlabs', name: 'ElevenLabs', logoUrl: '/images/tts-providers/elevenlabs.png' },
  ];

  const selectedTtsProviderId = () => settings.config.ttsConfig?.providerId;
  const [elevenLabsApiKeySignal, setElevenLabsApiKeySignal] = createSignal(settings.config.ttsConfig?.apiKey || '');
  const [isElTesting] = createSignal(false);
  const [ttsError, setTtsError] = createSignal<Error | null>(null);

  const handleSelectTtsProvider = (providerId: string | undefined) => {
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
      settings.updateTtsConfig({ 
          providerId: 'elevenlabs', 
          modelId: DEFAULT_ELEVENLABS_MODEL_ID,
          apiKey: apiKey 
      });
  };

  const handleTestElevenLabs = () => {
    const config = settings.config.ttsConfig;
    if (!config || config.providerId !== 'elevenlabs') {
        setTtsError(new Error("ElevenLabs configuration is not selected."));
        return;
    }
    void settings.testConnection('TTS', config); 
  };

  const playAudioBlob = (blob: Blob | null) => {
    if (!blob) return;
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      void audio.play();
    } catch (error) {
      console.error("Error playing audio blob:", error);
    }
  };

  const isFocusModeActiveSignal = () => settings.config.enableFocusMode ?? false;
  const focusModeBlockedDomainsSignal = () => settings.config.focusModeBlockedDomains ?? [];
  const isFocusModeLoadingSignal = () => settings.loadStatus() === 'pending'; 

  const handleToggleFocusMode = (isEnabled: boolean) => {
    settings.updateUserConfiguration({ enableFocusMode: isEnabled });
  };

  const handleAddFocusDomain = (domainName: string) => {
    const currentDomains = settings.config.focusModeBlockedDomains ?? [];
    if (!currentDomains.some(d => d.name.toLowerCase() === domainName.toLowerCase())) {
      const updatedDomains = [...currentDomains, { name: domainName }];
      settings.updateUserConfiguration({ focusModeBlockedDomains: updatedDomains });
    }
  };

  const handleRemoveFocusDomain = (domainName: string) => {
    const currentDomains = settings.config.focusModeBlockedDomains ?? [];
    const updatedDomains = currentDomains.filter(d => d.name.toLowerCase() !== domainName.toLowerCase());
    settings.updateUserConfiguration({ focusModeBlockedDomains: updatedDomains });
  };

  // --- VAD State and Handlers ---
  const availableVadOptions: VadOption[] = [
    { id: 'silero_vad', name: 'Silero VAD (Local)' } 
  ];
  const [selectedVadId, setSelectedVadId] = createSignal<string | undefined>(availableVadOptions[0].id);
  const [vadInstance, setVadInstance] = createSignal<MicVAD | null>(null);
  const [isVadLoading, setIsVadLoading] = createSignal(false);
  const [isVadTestingSignal, setIsVadTestingSignal] = createSignal(false);
  const [vadStatusMessage, setVadStatusMessage] = createSignal<string | null>(null);
  const [vadTestError, setVadTestError] = createSignal<Error | null>(null);
  // Store the Blob directly, and derive URL when needed
  const [lastRecordedBlob, setLastRecordedBlob] = createSignal<Blob | null>(null);
  const lastRecordedAudioUrl = () => {
    const blob = lastRecordedBlob();
    return blob ? URL.createObjectURL(blob) : null;
  };

  // STT State
  const [transcribedText, setTranscribedText] = createSignal<string | null>(null);
  const [sttError, setSttError] = createSignal<Error | null>(null);
  const [isTranscribing, setIsTranscribing] = createSignal(false);

  const cleanupLastRecording = () => {
    const currentUrl = lastRecordedAudioUrl();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    setLastRecordedBlob(null);
    setTranscribedText(null); // Clear transcription when recording is cleared
    setSttError(null);
  };

  const initVad = async () => {
    if (vadInstance()) {
      console.log("[SettingsPage VAD] VAD instance already exists.");
      return;
    }
    console.log("[SettingsPage VAD] Initializing VAD...");
    try {
      setVadStatusMessage("Initializing VAD...");
      setIsVadLoading(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "MediaDevices API or getUserMedia not supported in this browser.",
        );
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[SettingsPage VAD] Microphone permission obtained.");

      const newVad = await MicVAD.new({
        baseAssetPath: "/vad-assets/",
        onnxWASMBasePath: "/vad-assets/",
        model: "v5",
        // Configure ONNX runtime inside vad-web to avoid blob workers
        ortConfig: (ortInstance) => {
          // @ts-ignore
          ortInstance.env.wasm.proxy = false;
          // @ts-ignore
          ortInstance.env.wasm.simd = false;
          // @ts-ignore
          ortInstance.env.wasm.numThreads = 1;
          // @ts-ignore
          ortInstance.env.wasm.workerPath = browser.runtime.getURL("/vad-assets/ort-wasm.js" as any);
        },
        // Speech callbacks
        onSpeechStart: () => {
          setVadStatusMessage("Listening...");
          cleanupLastRecording(); // Clear previous recording & STT text
        },
        onSpeechEnd: (_audio) => { 
          setVadStatusMessage("Speech ended. Processing audio...");
          setIsVadTestingSignal(false);
          
          const sampleRate = 16000;
          const wavBlob = pcmToWavBlob(_audio, sampleRate);
          
          cleanupLastRecording(); // Clean up any existing blob/URL before setting new one
          setLastRecordedBlob(wavBlob);
          setVadStatusMessage("Audio captured. Starting transcription...");
          
          // Automatically start transcription
          void handleTranscription(); // Call handleTranscription here
        },
        onVADMisfire: () => {
          setVadStatusMessage("VAD misfire (potential non-speech sound).");
        },
      });
      setVadInstance(newVad);
      setVadStatusMessage('VAD initialized. Ready to test.');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setVadTestError(new Error("Failed to initialize VAD: " + errorMsg));
      setVadStatusMessage("Error: " + errorMsg);
    } finally {
      setIsVadLoading(false);
    }
  };

  const handleSelectVad = (vadId: string | undefined) => {
    setSelectedVadId(vadId);
    setVadStatusMessage(null);
    setVadTestError(null);
    if (vadInstance()) {
        vadInstance()?.pause();
        setIsVadTestingSignal(false);
    }
    if (vadId === 'silero_vad' && !vadInstance() && !isVadLoading()) {
        void initVad();
    }
  };

  createEffect(() => {
    if (selectedVadId() === 'silero_vad' && !vadInstance() && !isVadLoading()) {
      void initVad();
    }
  });
  
  const handleTestVad = async () => {
    if (selectedVadId() !== 'silero_vad') {
      setVadTestError(new Error("Silero VAD not selected."));
      return;
    }
    let currentVad = vadInstance();
    if (!currentVad && !isVadLoading()) {
      await initVad();
      currentVad = vadInstance();
      if (!currentVad) {
        setVadStatusMessage("VAD could not be initialized for testing.");
        return;
      }
    } else if (isVadLoading()) {
        setVadStatusMessage("VAD is still initializing...");
        return;
    } else if (!currentVad) {
        setVadStatusMessage("VAD instance not available.");
        return;
    }

    if (isVadTestingSignal()) { 
      currentVad.pause();
      setIsVadTestingSignal(false);
      setVadStatusMessage("Test stopped.");
    } else {
      try {
        await currentVad.start();
        setIsVadTestingSignal(true);
        setVadStatusMessage("Listening for speech...");
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setVadTestError(new Error("Error starting VAD: " + errorMsg));
        setVadStatusMessage("Error: " + errorMsg);
        setIsVadTestingSignal(false);
      }
    }
  };
  
  const handleStopVadTest = () => {
    if (vadInstance() && isVadTestingSignal()) { 
      vadInstance()!.pause();
      setIsVadTestingSignal(false);
      setVadStatusMessage("Test explicitly stopped.");
    }
  };

  onCleanup(() => {
    if (vadInstance()) {
      vadInstance()!.pause();
      setVadInstance(null); 
    }
    cleanupLastRecording(); // Use the centralized cleanup
  });

  const playLastRecordedAudio = () => {
    const url = lastRecordedAudioUrl();
    if (url) {
      const audio = new Audio(url);
      audio.play().catch(e => console.error("Error playing recorded audio:", e));
    } else {
      console.log("No recorded audio to play.");
    }
  };

  const handleTranscription = async () => {
    const apiKey = settings.config.ttsConfig?.apiKey; // Assuming STT uses same API key as TTS
    const audioBlob = lastRecordedBlob();

    if (!apiKey) {
      setSttError(new Error("ElevenLabs API key is not set. Please configure it in TTS settings."));
      return;
    }
    if (!audioBlob) {
      setSttError(new Error("No audio has been recorded to transcribe."));
      return;
    }

    setIsTranscribing(true);
    setTranscribedText(null);
    setSttError(null);

    try {
      // Using default model 'scribe_v1' for now. Can be made configurable.
      const result: ElevenLabsTranscriptionResponse = await transcribeElevenLabsAudio(apiKey, audioBlob);
      setTranscribedText(result.text);
      setVadStatusMessage("Transcription successful.");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setSttError(new Error("Transcription failed: " + errorMsg));
      setVadStatusMessage("Transcription failed.");
      console.error("[SettingsPage STT] Transcription error:", e);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <SettingsPageView
      loadStatus={settings.loadStatus} 
      config={settings.config} 
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onBackClick={props.onNavigateBack ?? (() => {})}
      llmTransientState={llmTransientState}
      llmProviderOptions={settings.llmProviderOptions}
      onLlmSelectProvider={(provider) => { void settings.handleSelectProvider('LLM', provider); }}
      onLlmSelectModel={(modelId) => { void settings.handleSelectModel('LLM', modelId); }}
      onLlmTestConnection={(config: FunctionConfig) => { void settings.testConnection('LLM', config); }}
      embeddingTransientState={embeddingTransientState}
      embeddingProviderOptions={settings.embeddingProviderOptions}
      onEmbeddingSelectProvider={(provider) => { void settings.handleSelectProvider('Embedding', provider); }}
      onEmbeddingSelectModel={(modelId) => { void settings.handleSelectModel('Embedding', modelId); }}
      onEmbeddingTestConnection={(config: FunctionConfig) => { void settings.testConnection('Embedding', config); }}
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
      onRedirectSettingChange={(service, update) => settings.handleRedirectSettingChange(service, update)}
      isFocusModeActive={isFocusModeActiveSignal}
      isFocusModeLoading={isFocusModeLoadingSignal}
      focusModeBlockedDomains={focusModeBlockedDomainsSignal}
      onFocusModeToggle={handleToggleFocusMode}
      onFocusModeAddDomain={handleAddFocusDomain}
      onFocusModeRemoveDomain={handleRemoveFocusDomain}
      availableVadOptions={availableVadOptions}
      selectedVadId={selectedVadId}
      onSelectVad={handleSelectVad}
      isVadTesting={isVadTestingSignal}
      onTestVad={handleTestVad}
      onStopVadTest={handleStopVadTest}
      vadStatusMessage={vadStatusMessage}
      vadTestError={vadTestError}
      isVadLoading={isVadLoading}
      lastRecordedAudioUrl={lastRecordedAudioUrl} 
      onPlayLastRecording={playLastRecordedAudio}
      // STT Props
      onTranscribe={handleTranscription}
      transcribedText={transcribedText}
      isTranscribing={isTranscribing}
      sttError={sttError}
    />
  );
};

export default SettingsPage;
