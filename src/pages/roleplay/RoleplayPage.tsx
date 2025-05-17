import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import { Button } from '../../components/ui/button';
import { RoleplaySelectionView, type ScenarioOption } from '../../features/roleplay/RoleplaySelectionView';
import { RoleplayConversationView, type ChatMessage as UiChatMessage, type AlignmentData as ElevenLabsAlignmentData } from '../../features/roleplay/RoleplayConversationView';
import { generateRoleplayScenarios } from '../../services/roleplay/generateRoleplayScenarios';
import { userConfigurationStorage } from '../../services/storage/storage';
import { MicVAD } from '@ricky0123/vad-web';
import { pcmToWavBlob } from '../../lib/utils';
import { transcribeElevenLabsAudio } from '../../services/stt/elevenLabsSttService';
import { browser } from 'wxt/browser';
import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import type { LLMConfig, ChatMessage as LLMChatMessage } from '../../services/llm/types';
import { generateElevenLabsSpeechWithTimestamps, ElevenLabsVoiceSettings } from '../../services/tts/elevenLabsService';
import { Dynamic } from 'solid-js/web';

// --- Word Data Structure (for highlighting) ---
interface WordInfo {
    text: string;
    startTime: number;
    endTime: number;
    index: number;
}

// --- Constants for Highlighting ---
const HIGHLIGHT_STYLE_ID = "scarlett-roleplay-word-highlight-styles";
const HIGHLIGHT_CSS = `
  .scarlett-roleplay-word-span {
    background-color: transparent;
    border-radius: 3px;
    display: inline-block;
    transition: background-color 0.2s ease-out;
  }
  .scarlett-roleplay-word-highlight {
    background-color: hsl(240, 5%, 25%); /* Example highlight color */
  }
`;


interface RoleplayPageProps {
  onNavigateBack: () => void;
}

// Store the promise for ongoing VAD initialization
let vadInitializationPromise: Promise<MicVAD | null> | null = null;

const RoleplayPage: Component<RoleplayPageProps> = (props) => {
  const [scenarios, setScenarios] = createSignal<ScenarioOption[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [selectedScenario, setSelectedScenario] = createSignal<ScenarioOption | null>(null);
  const [targetLanguage, setTargetLanguage] = createSignal('en');
  
  // VAD state
  const [vadInstance, setVadInstance] = createSignal<MicVAD | null>(null);

  // TTS State
  const [isTTSSpeaking, setIsTTSSpeaking] = createSignal(false);
  const [currentTTSAudioInfo, setCurrentTTSAudioInfo] = createSignal<{audio: HTMLAudioElement, url: string} | null>(null);
  const [ttsWordMap, setTtsWordMap] = createSignal<WordInfo[]>([]);
  const [currentTTSHighlightIndex, setCurrentTTSHighlightIndex] = createSignal<number | null>(null);
  const [ttsError, setTtsError] = createSignal<string | null>(null);
  const [ttsAnimationFrameId, setTtsAnimationFrameId] = createSignal<number | null>(null);
  const [activeSpokenMessageId, setActiveSpokenMessageId] = createSignal<string | null>(null);


  const fetchScenarios = async () => {
    setIsLoading(true);
    const userCfg = await userConfigurationStorage.getValue();
    const langCode = userCfg.targetLanguage || 'en';
    setTargetLanguage(langCode);

    const opts = await generateRoleplayScenarios("user's current learning focus or recent topics");
    setScenarios(opts);
    setIsLoading(false);
  };

  onMount(fetchScenarios);

  const handleScenarioSelect = (scenarioId: string | number) => {
    const scenario = scenarios().find(s => s.id === scenarioId);
    if (scenario) {
      console.log('[RoleplayPage] Scenario selected:', scenario);
      setSelectedScenario(scenario);
    } else {
      console.warn('[RoleplayPage] Selected scenario ID not found:', scenarioId);
    }
  };

  const destroyVadInstance = () => {
    const currentVad = vadInstance();
    if (currentVad) {
      console.log('[RoleplayPage VAD] Destroying VAD instance.');
      try {
        currentVad.destroy();
        console.log('[RoleplayPage VAD] VAD instance destroyed successfully.');
        
        setVadInstance(null);
      } catch (error) {
        console.error('[RoleplayPage VAD] Error during VAD destruction process:', error);
      }
    }
    vadInitializationPromise = null;
  };

  const stopAndClearTTS = () => {
    const audioInfo = currentTTSAudioInfo();
    if (audioInfo) {
      const { audio, url } = audioInfo;
      // Detach handlers to prevent them from firing after we're done with this audio object
      audio.onplay = null;
      audio.onpause = null;
      audio.onended = null;
      audio.onerror = null;

      audio.pause();
      
      URL.revokeObjectURL(url); // Explicitly revoke the URL when stopping
      setCurrentTTSAudioInfo(null);
    }

    if (ttsAnimationFrameId()) {
      cancelAnimationFrame(ttsAnimationFrameId()!);
      setTtsAnimationFrameId(null);
    }
    setIsTTSSpeaking(false);
    setTtsError(null);
  };

  const handleBackToSelection = () => {
    destroyVadInstance();
    stopAndClearTTS();
    setSelectedScenario(null);
  };

  const handleEndRoleplay = () => {
    console.log("%c[RoleplayPage] handleEndRoleplay TRIGGERED!", "color: red; font-weight: bold;");
    console.log('[RoleplayPage] Roleplay ended.');
    destroyVadInstance();
    stopAndClearTTS();
    setSelectedScenario(null);
  };

  const initVad = async (): Promise<MicVAD | null> => {
    if (vadInstance()) {
      console.log('[RoleplayPage VAD] Already initialized, returning existing instance.');
      return vadInstance();
    }

    if (vadInitializationPromise) {
      console.log('[RoleplayPage VAD] Initialization already in progress, awaiting existing promise...');
      return await vadInitializationPromise;
    }

    let resolveInit: (instance: MicVAD | null) => void = () => {};
    vadInitializationPromise = new Promise<MicVAD | null>(r => resolveInit = r);
    
    console.log('[RoleplayPage VAD] Starting new VAD initialization...');

    try {
      const newVad = await MicVAD.new({
        baseAssetPath: '/vad-assets/',
        onnxWASMBasePath: '/vad-assets/',
        model: 'v5',
        ortConfig: (ort) => {
          // @ts-ignore
          ort.env.wasm.proxy = false;
          // @ts-ignore
          ort.env.wasm.simd = false;
          // @ts-ignore
          ort.env.wasm.numThreads = 1;
          // @ts-ignore
          ort.env.wasm.workerPath = browser.runtime.getURL('/vad-assets/ort-wasm.js' as any);
        },
        onSpeechStart: () => console.log('[RoleplayPage VAD] onSpeechStart'),
        onSpeechEnd: async (_audio) => {
          console.log('[RoleplayPage VAD] onSpeechEnd');
          const sampleRate = 16000;
          const wavBlob = pcmToWavBlob(_audio, sampleRate);
          const { ttsConfig } = await userConfigurationStorage.getValue();
          const apiKey = ttsConfig?.apiKey;
          let text: string | null = null;
          if (apiKey) {
            try {
              const result = await transcribeElevenLabsAudio(apiKey, wavBlob);
              text = result.text;
            } catch (e) {
              console.error('[RoleplayPage VAD] STT error', e);
            }
          }
          (window as any).triggerUserSpeechProcessed(text);
        },
      });
      setVadInstance(newVad);
      console.log('[RoleplayPage VAD] VAD Initialized successfully (new instance).');
      resolveInit(newVad);
      vadInitializationPromise = null;
      return newVad;
    } catch (e) {
      console.error('[RoleplayPage VAD] VAD initialization error', e);
      setVadInstance(null);
      resolveInit(null);
      vadInitializationPromise = null;
      return null;
    }
  };

  const handleStartRecording = async (): Promise<boolean> => {
    console.log('[RoleplayPage] handleStartRecording called.');
    if (!selectedScenario()) {
        console.warn("[RoleplayPage VAD] handleStartRecording: No scenario selected, VAD start aborted.");
        return false;
    }
    
    const currentVad = await initVad();

    if (!currentVad) {
      console.warn('[RoleplayPage] VAD not available to start recording (initVad returned null or failed).');
      return false; 
    }

    try {
      await currentVad.start();
      console.log('[RoleplayPage VAD] VAD started successfully.');
      return true;
    } catch (e) {
      console.error('[RoleplayPage VAD] VAD start error (after init)', e);
      return false;
    }
  };
  
  const handleStopRecording = async (): Promise<string | null> => {
    const vad = vadInstance();
    if (vad) {
        console.log('[RoleplayPage VAD] Pausing VAD.');
        vad.pause();
    }
    return null;
  };

  // --- LLM Chat Configuration Helper ---
  const getActiveLLMConfig = async (): Promise<LLMConfig | null> => {
    const userCfg = await userConfigurationStorage.getValue();
    if (userCfg.llmConfig) {
      const fc = userCfg.llmConfig;
      if (!fc.providerId || !fc.modelId) {
        console.warn('[RoleplayPage] Incomplete LLM config in user settings:', fc);
        return null;
      }
      return {
        provider: fc.providerId as LLMConfig['provider'],
        model: fc.modelId,
        baseUrl: fc.baseUrl ?? '',
        apiKey: fc.apiKey ?? undefined,
        stream: false,
      };
    }
    console.warn('[RoleplayPage] No LLM config found in settings. Please configure LLM provider.');
    return null;
  };
  
  // --- TTS Helper Functions (adapted from TranslatorWidget) ---
  const processTTSAlignment = (text: string, alignmentData: ElevenLabsAlignmentData | null, lang: string): WordInfo[] => {
    console.log(`[RoleplayPage TTS processAlignment] lang: ${lang}, text: "${text.substring(0, 20)}...", alignment chars: ${alignmentData?.characters?.length ?? 'N/A'}`);
    const words: WordInfo[] = [];

    if (alignmentData && alignmentData.characters && alignmentData.character_start_times_seconds && alignmentData.character_end_times_seconds &&
        alignmentData.characters.length === alignmentData.character_start_times_seconds.length &&
        alignmentData.characters.length === alignmentData.character_end_times_seconds.length) {
        
        for (let i = 0; i < alignmentData.characters.length; i++) {
            words.push({
                text: alignmentData.characters[i],
                startTime: alignmentData.character_start_times_seconds[i],
                endTime: alignmentData.character_end_times_seconds[i],
                index: i 
            });
        }
    } else { 
        console.warn('[RoleplayPage TTS processAlignment] Character alignment data missing or invalid. Falling back to splitting input text by character.');
        for (let i = 0; i < text.length; i++) {
            words.push({ text: text[i], startTime: 0, endTime: 0, index: i });
        }
    }
    return words;
  };

  const updateTTSHighlightLoop = () => {
    const audioInfo = currentTTSAudioInfo();
    if (!audioInfo) return;
    const audio = audioInfo.audio;
    const wordMap = ttsWordMap();

    if (!audio || audio.paused || audio.ended || !wordMap || wordMap.length === 0) {
      if (ttsAnimationFrameId()) {
        cancelAnimationFrame(ttsAnimationFrameId()!);
        setTtsAnimationFrameId(null);
      }
      // If audio stopped not due to natural end (e.g., paused by user or error),
      // we might want to keep the highlight or clear it based on `isPlayingAudio` state.
      // `onended` handler already clears highlight.
      return;
    }

    const currentTime = audio.currentTime;
    let activeIndex = -1;

    for (const word of wordMap) {
      if (currentTime >= word.startTime && currentTime < word.endTime) {
        activeIndex = word.index;
        break;
      }
    }
    
    if (activeIndex !== -1 && currentTTSHighlightIndex() !== activeIndex) {
      setCurrentTTSHighlightIndex(activeIndex);
    } else if (activeIndex === -1 && currentTTSHighlightIndex() !== null) {
      // If current time is past the end of the last word, clear highlight
      if (wordMap.length > 0 && currentTime >= (wordMap.at(-1)?.endTime ?? Infinity)) {
        setCurrentTTSHighlightIndex(null);
      }
      // If current time is before the first word, also clear (though less common once playback starts)
      else if (wordMap.length > 0 && currentTime < (wordMap[0]?.startTime ?? 0)) {
         setCurrentTTSHighlightIndex(null);
      }
    }
    setTtsAnimationFrameId(requestAnimationFrame(updateTTSHighlightLoop));
  };

  const handlePlayTTS = async (messageId: string, text: string, lang: string, alignmentDataParam?: ElevenLabsAlignmentData | null) => {
    let alignmentInput: ElevenLabsAlignmentData | null | undefined = alignmentDataParam;

    console.log(`[RoleplayPage] handlePlayTTS called for messageId: ${messageId}, lang ${lang}:`, text.substring(0,50) + "...");
    stopAndClearTTS();
    setIsTTSSpeaking(true);
    setTtsError(null);
    setActiveSpokenMessageId(messageId);

    try {
      const userCfg = await userConfigurationStorage.getValue() as any; // Using any due to UserConfiguration export issue
      
      // Corrected access to TTS configuration from userCfg.ttsConfig
      const elevenLabsApiKey = userCfg.ttsConfig?.apiKey;
      const elevenLabsModelId = userCfg.ttsConfig?.modelId || 'eleven_multilingual_v2';
      const elevenLabsVoiceId = userCfg.ttsConfig?.voiceId;
      const voiceSettings: ElevenLabsVoiceSettings = userCfg.ttsConfig?.voiceSettings || {};

      if (!elevenLabsApiKey) {
        // Updated error message to reflect the correct path
        throw new Error("ElevenLabs API key not configured in userCfg.ttsConfig.apiKey");
      }

      const { audioBlob, alignmentData: fetchedAlignmentData } = await generateElevenLabsSpeechWithTimestamps(
        elevenLabsApiKey,
        text,
        elevenLabsModelId,
        elevenLabsVoiceId,
        voiceSettings,
        undefined, 
        lang
      );
      
      const finalAlignmentData = alignmentInput || fetchedAlignmentData;
      if (!finalAlignmentData) {
          console.warn("[RoleplayPage TTS] No alignment data available after TTS generation.");
      }
      
      const processedWords = processTTSAlignment(text, finalAlignmentData, lang);
      setTtsWordMap(processedWords);

      const localAudioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(localAudioUrl);
      setCurrentTTSAudioInfo({ audio, url: localAudioUrl });

      audio.onplay = () => {
        console.log('[RoleplayPage TTS] Audio playing.');
        if (ttsAnimationFrameId()) cancelAnimationFrame(ttsAnimationFrameId()!);
        setTtsAnimationFrameId(requestAnimationFrame(updateTTSHighlightLoop));
      };
      audio.onpause = () => {
        console.log('[RoleplayPage TTS] Audio paused.');
        if (ttsAnimationFrameId()) cancelAnimationFrame(ttsAnimationFrameId()!);
        setTtsAnimationFrameId(null);
      };
      audio.onended = () => {
        console.log('[RoleplayPage TTS] Audio ended. URL:', localAudioUrl);
        setIsTTSSpeaking(false);
        setCurrentTTSHighlightIndex(null);
        if (ttsAnimationFrameId()) cancelAnimationFrame(ttsAnimationFrameId()!);
        setTtsAnimationFrameId(null);

        // Check if this audio instance is still the current one we are tracking
        const latestAudioInfo = currentTTSAudioInfo();
        if (latestAudioInfo && latestAudioInfo.audio === audio) {
            setCurrentTTSAudioInfo(null); // It was current, now it ended.
        }
        URL.revokeObjectURL(localAudioUrl); // Revoke this specific instance's URL
      };
      audio.onerror = (e) => {
        console.error('[RoleplayPage TTS] Audio playback error:', e, 'URL:', localAudioUrl);
        if (audio && audio.error) {
            console.error('[RoleplayPage TTS] HTMLMediaElement error code:', audio.error.code, 'message:', audio.error.message);
        }
        setTtsError('Error playing TTS audio.');
        setIsTTSSpeaking(false);

        const latestAudioInfo = currentTTSAudioInfo();
        if (latestAudioInfo && latestAudioInfo.audio === audio) {
            setCurrentTTSAudioInfo(null); // It was current and errored.
        }
        URL.revokeObjectURL(localAudioUrl); // Revoke this specific instance's URL
      };
      
      await audio.play();

    } catch (error: any) {
      console.error('[RoleplayPage TTS] Error in handlePlayTTS:', error);
      setTtsError(error.message || 'Failed to generate or play TTS.');
      setIsTTSSpeaking(false);
      setActiveSpokenMessageId(null);
      setTtsWordMap([]);
    }
  };

  onCleanup(() => {
    console.log("%c[RoleplayPage] ONCLEANUP TRIGGERED!", "color: orange; font-size: 14px; font-weight: bold;");
    destroyVadInstance();
    stopAndClearTTS();
  });

  return (
    <div class="p-0 font-sans h-full flex flex-col">
      <Dynamic component="style" id={HIGHLIGHT_STYLE_ID}>{HIGHLIGHT_CSS}</Dynamic>
      {selectedScenario() ? (
        <RoleplayConversationView
          scenario={selectedScenario()!}
          onNavigateBack={handleBackToSelection}
          onEndRoleplay={handleEndRoleplay}
          targetLanguage={targetLanguage()}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onPlayTTS={handlePlayTTS}
          onStopTTS={stopAndClearTTS}
          isTTSSpeaking={isTTSSpeaking}
          ttsWordMap={ttsWordMap()}
          currentHighlightIndex={currentTTSHighlightIndex}
          ttsPlaybackError={ttsError}
          activeSpokenMessageId={activeSpokenMessageId}
          onSendMessage={async (spokenText: string, chatHistory: UiChatMessage[]) => {
            console.log('[RoleplayPage] onSendMessage called with:', spokenText, `History items: ${chatHistory.length}`);
            const llmCfg = await getActiveLLMConfig();
            if (!llmCfg) {
              return { aiResponse: '', error: 'Missing LLM configuration' };
            }
            const systemPrompt = `You are a helpful partner in the following scenario: "${selectedScenario()!.title}": ${selectedScenario()!.description}. 
Your role is to respond as the other character in this scenario. 
Keep your responses concise and natural, typically 1-2 sentences, as if you are having a real conversation. 
Do NOT include any out-of-character commentary, instructions, or explanations. Only provide your character's dialogue for this turn. 
Continue the conversation naturally based on the user's last message.`;
            
            const llmMessages: LLMChatMessage[] = [
              { role: 'system', content: systemPrompt },
              ...chatHistory.map(m => ({
                role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                content: m.text,
              })),
            ];

            try {
              console.log(`[RoleplayPage] Sending to LLM. System prompt + ${llmMessages.length -1} history messages.`);
              const response = await ollamaChat(llmMessages, llmCfg);
              const aiContent = response.choices[0]?.message?.content ?? '';
              return { aiResponse: aiContent, alignment: null };
            } catch (err: any) {
              console.error('[RoleplayPage] LLM chat error', err);
              return { aiResponse: '', error: err.message || 'LLM error' };
            }
          }}
        />
      ) : (
        <>
          <div class="p-4 border-b border-border/20 flex items-center">
            <Button variant="ghost" onClick={() => props.onNavigateBack()} class="mr-2">
              &lt;- Back
            </Button>
            <h1 class="text-xl font-semibold">Roleplay Practice</h1>
          </div>
          <RoleplaySelectionView
            scenarios={scenarios()}
            isLoading={isLoading()}
            onScenarioSelect={handleScenarioSelect}
            onGenerateNewSet={fetchScenarios}
          />
        </>
      )}
    </div>
  );
};

export default RoleplayPage; 