import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import { Button } from '../../components/ui/button';
import { RoleplaySelectionView, type ScenarioOption } from '../../features/roleplay/RoleplaySelectionView';
import { RoleplayConversationView, type ChatMessage as UiChatMessage, type AlignmentData } from '../../features/roleplay/RoleplayConversationView';
import { generateRoleplayScenarios } from '../../services/roleplay/generateRoleplayScenarios';
import { userConfigurationStorage } from '../../services/storage/storage';
import { MicVAD } from '@ricky0123/vad-web';
import { pcmToWavBlob } from '../../lib/utils';
import { transcribeElevenLabsAudio } from '../../services/stt/elevenLabsSttService';
import { browser } from 'wxt/browser';
import { ollamaChat } from '../../services/llm/providers/ollama/chat';
import type { LLMConfig, ChatMessage as LLMChatMessage } from '../../services/llm/types';

interface RoleplayPageProps {
  onNavigateBack: () => void;
}

const RoleplayPage: Component<RoleplayPageProps> = (props) => {
  const [scenarios, setScenarios] = createSignal<ScenarioOption[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [selectedScenario, setSelectedScenario] = createSignal<ScenarioOption | null>(null);
  const [targetLanguage, setTargetLanguage] = createSignal('en');
  const [isTTSSpeaking, setIsTTSSpeaking] = createSignal(false);
  const [currentHighlightIndex, setCurrentHighlightIndex] = createSignal<number | null>(null);
  const [vadInstance, setVadInstance] = createSignal<MicVAD | null>(null);
  const [isVadLoading, setIsVadLoading] = createSignal(false);

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

  const handleBackToSelection = () => {
    setSelectedScenario(null);
  };

  const handleEndRoleplay = () => {
    console.log("%c[RoleplayPage] handleEndRoleplay TRIGGERED!", "color: red; font-weight: bold;");
    console.log('[RoleplayPage] Roleplay ended.');
    // Optionally, navigate back or reset further state
    setSelectedScenario(null); // For example, go back to selection screen
    // props.onNavigateBack(); // Or use the main navigation back if that's desired
  };

  const initVad = async () => {
    if (vadInstance()) return;
    setIsVadLoading(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
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
        onSpeechStart: () => {
          console.log('[RoleplayPage VAD] onSpeechStart');
        },
        onSpeechEnd: async (_audio) => {
          console.log('[RoleplayPage VAD] onSpeechEnd');
          const sampleRate = 16000;
          const wavBlob = pcmToWavBlob(_audio, sampleRate);
          // Perform STT
          const { ttsConfig } = await userConfigurationStorage.getValue();
          const apiKey = ttsConfig?.apiKey;
          let text: string | null = null;
          if (apiKey) {
            try {
              const result = await transcribeElevenLabsAudio(apiKey, wavBlob);
              text = result.text;
            } catch (e) {
              console.error('[RoleplayPage VAD] STT error', e);
              text = null;
            }
          }
          // Pass transcription to conversation view
          (window as any).triggerUserSpeechProcessed(text);
        },
      });
      setVadInstance(newVad);
    } catch (e) {
      console.error('[RoleplayPage VAD] initialization error', e);
    } finally {
      setIsVadLoading(false);
    }
  };

  const handleStartRecording = async () => {
    if (!vadInstance() && !isVadLoading()) {
      await initVad();
    }
    const vad = vadInstance();
    if (!vad) return false;
    try {
      await vad.start();
      return true;
    } catch (e) {
      console.error('[RoleplayPage] VAD start error', e);
      return false;
    }
  };

  const handleStopRecording = async (): Promise<string | null> => {
    const vad = vadInstance();
    if (vad) vad.pause();
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

  onMount(() => {
    void initVad();
  });

  // Cleanup VAD when the component is unmounted
  onCleanup(() => {
    const vad = vadInstance();
    if (vad) {
      console.log('[RoleplayPage VAD] Cleaning up VAD instance.');
      vad.destroy(); // Destroy the VAD instance to release resources
      setVadInstance(null);
    }
  });

  return (
    <div class="p-0 font-sans h-full flex flex-col">
      {selectedScenario() ? (
        <RoleplayConversationView
          scenario={selectedScenario()!}
          onNavigateBack={handleBackToSelection}
          onEndRoleplay={handleEndRoleplay}
          targetLanguage={targetLanguage()}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onPlayTTS={async (text: string, lang: string, alignment?: AlignmentData | null) => { console.log(`[RoleplayPage] onPlayTTS called for lang ${lang}:`, text, alignment); setIsTTSSpeaking(true); setTimeout(() => setIsTTSSpeaking(false), 2000); }}
          onStopTTS={() => { console.log('[RoleplayPage] onStopTTS called'); setIsTTSSpeaking(false); }}
          isTTSSpeaking={isTTSSpeaking}
          currentHighlightIndex={currentHighlightIndex}
          onSendMessage={async (spokenText: string, chatHistory: UiChatMessage[]) => {
            console.log('[RoleplayPage] onSendMessage called with:', spokenText, chatHistory);
            const llmCfg = await getActiveLLMConfig();
            if (!llmCfg) {
              return { aiResponse: '', error: 'Missing LLM configuration' };
            }
            const systemPrompt = `You are a helpful partner in the following scenario: "${selectedScenario()!.title}": ${selectedScenario()!.description}. Continue the conversation naturally.`;
            
            // chatHistory comes from RoleplayConversationView and already includes the latest user message.
            // So, we just need to map it to the LLM message format.
            const llmMessages: LLMChatMessage[] = [
              { role: 'system', content: systemPrompt },
              ...chatHistory.map(m => ({
                role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                content: m.text,
              })),
            ];

            try {
              console.log('[RoleplayPage] Sending to LLM with history count:', llmMessages.length -1, 'Full messages:', JSON.stringify(llmMessages, null, 2));
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