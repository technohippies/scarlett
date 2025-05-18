import { Component, For, createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Button } from '../../components/ui/button';
import { TextField, TextFieldInput } from '../../components/ui/text-field';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../components/ui/sheet';
import type { ChatMessage, Thread } from './types';
import { ChatMessageItem } from './ChatMessageItem';
import { Switch, SwitchControl, SwitchThumb, SwitchLabel } from '../../components/ui/switch';
import { MicVAD } from '@ricky0123/vad-web';
import { pcmToWavBlob } from '../../lib/utils';
import { userConfigurationStorage } from '../../services/storage/storage';
import { browser } from 'wxt/browser';
import { generateElevenLabsSpeechWithTimestamps, ElevenLabsVoiceSettings } from '../../services/tts/elevenLabsService';
// Placeholder for STT service - will be properly imported later
// import { transcribeElevenLabsAudio } from '../../services/stt/elevenLabsSttService'; 

const JUST_CHAT_THREAD_ID = '__just_chat_speech_mode__';

// --- Word Data Structure (for highlighting from RoleplayPage) ---
interface WordInfo {
    word: string;    // Changed from text
    start: number;   // Changed from startTime
    end: number;     // Changed from endTime
    index: number;   // Kept, as it's used internally by processTTSAlignment and updateTTSHighlightLoop
}

// --- Constants for Highlighting (from RoleplayPage) ---
const HIGHLIGHT_STYLE_ID = "scarlett-unified-word-highlight-styles";
const HIGHLIGHT_CSS = `
  .scarlett-unified-word-span {
    background-color: transparent;
    border-radius: 3px;
    display: inline-block;
    transition: background-color 0.2s ease-out;
  }
  .scarlett-unified-word-highlight {
    background-color: hsl(240, 5%, 25%);
  }
`;

// Define a more specific type for TTS Config if possible, or use 'any' if too complex for now
interface TTSConfigForView {
    apiKey?: string;
    modelId?: string;
    voiceId?: string;
    voiceSettings?: ElevenLabsVoiceSettings;
}

interface UnifiedConversationViewProps {
  threads: Thread[];
  onSendMessage: (text: string, threadId: string, isUserMessage: boolean, ttsLangForAiResponse?: string) => Promise<void>; 
  onSelectThread: (threadId: string) => void;
  onNavigateBack: () => void;
  currentSelectedThreadId?: string | null;
  onCreateNewThread: (title: string, systemPrompt: string) => Promise<string>; 
  // onUpdateThreadMessages: (threadId: string, messages: ChatMessage[]) => void; // Messages are part of Thread now
}

export const UnifiedConversationView: Component<UnifiedConversationViewProps> = (props) => {
  const [inputText, setInputText] = createSignal('');
  const [isSpeechModeActive, setIsSpeechModeActive] = createSignal(false);
  let scrollHostRef: HTMLDivElement | undefined;

  const [vadInstance, setVadInstance] = createSignal<MicVAD | null>(null);
  const [isRecording, setIsRecording] = createSignal(false);

  const [currentThread, setCurrentThread] = createSignal<Thread | null>(null);

  createEffect(() => {
    const id = isSpeechModeActive() ? JUST_CHAT_THREAD_ID : props.currentSelectedThreadId;
    if (!id) {
      setCurrentThread(null);
      return;
    }
    let thread = props.threads.find(t => t.id === id);
    if (isSpeechModeActive() && id === JUST_CHAT_THREAD_ID && !thread) {
        console.warn("[UnifiedConversationView] JUST_CHAT_THREAD_ID not found in props.threads. Creating temporary.");
        setCurrentThread({
            id: JUST_CHAT_THREAD_ID,
            title: "Just Chat (Speech)",
            systemPrompt: "You are a friendly AI assistant for voice chat.", 
            messages: [],
            lastActivity: new Date().toISOString(),
        });
    } else {
        setCurrentThread(thread ?? null);
    }
  });

  const currentMessages = () => currentThread()?.messages ?? [];

  const handleSendText = () => {
    const thread = currentThread();
    if (inputText().trim() && thread && !isSpeechModeActive()) {
      props.onSendMessage(inputText().trim(), thread.id, true);
      setInputText('');
    }
  };

  createEffect(() => {
    currentMessages(); 
    if (scrollHostRef) {
      scrollHostRef.scrollTop = scrollHostRef.scrollHeight;
    }
  });

  let vadInitializationPromise: Promise<MicVAD | null> | null = null;
  const initVad = async (): Promise<MicVAD | null> => {
    if (vadInstance()) return vadInstance();
    if (vadInitializationPromise) return await vadInitializationPromise;
    let resolveInit: (instance: MicVAD | null) => void = () => {};
    vadInitializationPromise = new Promise<MicVAD | null>(r => resolveInit = r);
    try {
      const newVad = await MicVAD.new({
        baseAssetPath: browser.runtime.getURL('/vad-assets/' as any),
        onnxWASMBasePath: browser.runtime.getURL('/vad-assets/ort-wasm-simd.wasm' as any),
        onSpeechStart: () => console.log('[VAD] onSpeechStart'),
        onSpeechEnd: async (audio) => {
          console.log('[VAD] onSpeechEnd');
          setIsRecording(false);
          const wavBlob = pcmToWavBlob(audio, 16000);
          let transcribedText: string | null = "Simulated STT: " + new Date().toLocaleTimeString();
          // Actual STT logic placeholder
          // const userCfg = await userConfigurationStorage.getValue();
          // const sttApiKey = userCfg.sttConfig?.apiKey; // Assuming sttConfig exists
          // if (sttApiKey) { try { const result = await transcribeElevenLabsAudio(sttApiKey, wavBlob); transcribedText = result.text; } catch(e){ console.error(e); transcribedText = "Error in STT"; }} else { transcribedText = "STT API Key not configured"; }
          
          const activeThread = currentThread();
          if (transcribedText && transcribedText.trim() && activeThread) {
            props.onSendMessage(transcribedText, activeThread.id, true, 'en');
          } else {
            console.log('[VAD] STT empty or no active thread.');
          }
        },
      });
      setVadInstance(newVad);
      resolveInit(newVad);
    } catch (e) {
      console.error('[VAD] init error', e);
      setVadInstance(null); resolveInit(null);
    }
    vadInitializationPromise = null;
    return vadInstance();
  };

  const destroyVadInstance = () => {
    vadInstance()?.destroy();
    setVadInstance(null); setIsRecording(false); vadInitializationPromise = null;
  };

  const handleStartRecording = async () => {
    if (!isSpeechModeActive()) return;
    const currentVad = await initVad();
    if (currentVad && !isRecording()) {
      try { await currentVad.start(); setIsRecording(true); } 
      catch (e) { console.error('[VAD] start error:', e); setIsRecording(false); }
    }
  };
  const handleStopRecording = () => {
    if (vadInstance() && isRecording()) { vadInstance()!.pause(); setIsRecording(false); }
  };

  createEffect(() => { isSpeechModeActive() ? initVad() : destroyVadInstance(); });
  onCleanup(destroyVadInstance);

  // --- TTS Logic (Ported from RoleplayPage) ---
  const [isTTSSpeaking, setIsTTSSpeaking] = createSignal(false);
  const [currentTTSAudioInfo, setCurrentTTSAudioInfo] = createSignal<{audio: HTMLAudioElement, url: string} | null>(null);
  const [ttsWordMap, setTtsWordMap] = createSignal<WordInfo[]>([]);
  const [currentTTSHighlightIndex, setCurrentTTSHighlightIndex] = createSignal<number | null>(null);
  const [ttsError, setTtsError] = createSignal<string | null>(null);
  const [activeSpokenMessageId, setActiveSpokenMessageId] = createSignal<string | null>(null);
  const [ttsAnimationFrameId, setTtsAnimationFrameId] = createSignal<number | null>(null);

  const processTTSAlignment = (text: string, alignmentData: any, lang: string): WordInfo[] => {
    const words: WordInfo[] = [];
    if (alignmentData && alignmentData.characters && alignmentData.character_start_times_seconds && alignmentData.character_end_times_seconds &&
        alignmentData.characters.length === alignmentData.character_start_times_seconds.length &&
        alignmentData.characters.length === alignmentData.character_end_times_seconds.length) {
        for (let i = 0; i < alignmentData.characters.length; i++) {
            words.push({ word: alignmentData.characters[i], start: alignmentData.character_start_times_seconds[i], end: alignmentData.character_end_times_seconds[i], index: i });
        }
    } else { 
        console.warn('[TTS processAlignment] Character alignment data missing/invalid. Fallback: splitting by char.');
        for (let i = 0; i < text.length; i++) { words.push({ word: text[i], start: 0, end: 0, index: i }); }
    }
    return words;
  };

  const updateTTSHighlightLoop = () => {
    const audioInfo = currentTTSAudioInfo();
    if (!audioInfo) return;
    const audio = audioInfo.audio;
    const wordMapData = ttsWordMap();
    if (!audio || audio.paused || audio.ended || !wordMapData || wordMapData.length === 0) {
      if (ttsAnimationFrameId()) { cancelAnimationFrame(ttsAnimationFrameId()!); setTtsAnimationFrameId(null); }
      return;
    }
    const currentTime = audio.currentTime;
    let activeIndex = -1;
    for (const word of wordMapData) {
      if (currentTime >= word.start && currentTime < word.end) { activeIndex = word.index; break; }
    }
    if (activeIndex !== -1 && currentTTSHighlightIndex() !== activeIndex) setCurrentTTSHighlightIndex(activeIndex);
    else if (activeIndex === -1 && currentTTSHighlightIndex() !== null) {
      if (wordMapData.length > 0 && (currentTime >= (wordMapData.at(-1)?.end ?? Infinity) || currentTime < (wordMapData[0]?.start ?? 0))) {
        setCurrentTTSHighlightIndex(null);
      }
    }
    setTtsAnimationFrameId(requestAnimationFrame(updateTTSHighlightLoop));
  };

  const stopAndClearTTS = () => {
    const audioInfo = currentTTSAudioInfo();
    if (audioInfo) {
      audioInfo.audio.onplay = audioInfo.audio.onpause = audioInfo.audio.onended = audioInfo.audio.onerror = null;
      audioInfo.audio.pause();
      URL.revokeObjectURL(audioInfo.url);
      setCurrentTTSAudioInfo(null);
    }
    if (ttsAnimationFrameId()) { cancelAnimationFrame(ttsAnimationFrameId()!); setTtsAnimationFrameId(null); }
    setIsTTSSpeaking(false); setTtsError(null); setCurrentTTSHighlightIndex(null);
  };

  const handlePlayTTS = async (messageId: string, text: string, lang: string, alignmentDataParam?: any) => {
    const effectiveLang = lang || 'en';
    stopAndClearTTS();
    setIsTTSSpeaking(true); setTtsError(null); setActiveSpokenMessageId(messageId);
    try {
      const userCfg = await userConfigurationStorage.getValue();
      // Assert ttsConfig to TTSConfigForView or be more specific based on actual UserConfiguration structure
      const ttsConfig = userCfg.ttsConfig as TTSConfigForView | undefined; 

      const elevenLabsApiKey = ttsConfig?.apiKey;
      const elevenLabsModelId = ttsConfig?.modelId || 'eleven_multilingual_v2';
      const elevenLabsVoiceId = ttsConfig?.voiceId;
      const voiceSettings: ElevenLabsVoiceSettings = ttsConfig?.voiceSettings || {};
      if (!elevenLabsApiKey) throw new Error("ElevenLabs API key not found in ttsConfig.");

      const { audioBlob, alignmentData: fetchedAlignmentData } = await generateElevenLabsSpeechWithTimestamps(
        elevenLabsApiKey, text, elevenLabsModelId, elevenLabsVoiceId, voiceSettings, undefined, effectiveLang
      );
      const finalAlignmentData = alignmentDataParam || fetchedAlignmentData;
      const processedWords = processTTSAlignment(text, finalAlignmentData, effectiveLang);
      setTtsWordMap(processedWords);

      const localAudioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(localAudioUrl);
      setCurrentTTSAudioInfo({ audio, url: localAudioUrl });
      audio.onplay = () => { if (ttsAnimationFrameId()) cancelAnimationFrame(ttsAnimationFrameId()!); setTtsAnimationFrameId(requestAnimationFrame(updateTTSHighlightLoop)); };
      audio.onpause = () => { if (ttsAnimationFrameId()) cancelAnimationFrame(ttsAnimationFrameId()!); setTtsAnimationFrameId(null); };
      audio.onended = () => {
        setIsTTSSpeaking(false); setCurrentTTSHighlightIndex(null);
        if (ttsAnimationFrameId()) cancelAnimationFrame(ttsAnimationFrameId()!); setTtsAnimationFrameId(null);
        const latestAudioInfo = currentTTSAudioInfo();
        if (latestAudioInfo && latestAudioInfo.audio === audio) setCurrentTTSAudioInfo(null);
        URL.revokeObjectURL(localAudioUrl);
      };
      audio.onerror = (e) => {
        console.error('[TTS] Audio error:', e, audio.error);
        setTtsError('Error playing TTS audio.'); setIsTTSSpeaking(false);
        const latestAudioInfo = currentTTSAudioInfo();
        if (latestAudioInfo && latestAudioInfo.audio === audio) setCurrentTTSAudioInfo(null);
        URL.revokeObjectURL(localAudioUrl);
      };
      await audio.play();
    } catch (error: any) {
      console.error('[TTS] handlePlayTTS error:', error);
      setTtsError(error.message || 'Failed to generate/play TTS.');
      setIsTTSSpeaking(false); setActiveSpokenMessageId(null); setTtsWordMap([]);
    }
  };
  onCleanup(stopAndClearTTS);
  
  createEffect(() => {
    const messages = currentMessages();
    const thread = currentThread();
    if (isSpeechModeActive() && thread && thread.id === JUST_CHAT_THREAD_ID && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.sender === 'ai' && activeSpokenMessageId() !== lastMessage.id && !isTTSSpeaking()) {
            setActiveSpokenMessageId(lastMessage.id);
            handlePlayTTS(lastMessage.id, lastMessage.text_content, lastMessage.ttsLang || 'en', lastMessage.alignmentData);
        }
    }
  });
  
  const handleCreateNewGeneralChat = async () => {
    // App.tsx will handle default title and empty system prompt for DB
    await props.onCreateNewThread("New Chat", ""); // Pass a placeholder title and empty system prompt
  };

  const handleGenerateRoleplays = () => {
    console.log("[UnifiedConversationView] Generate Roleplays clicked - placeholder");
    // TODO: Implement roleplay generation logic
    // This might involve:
    // 1. Calling a service (like the one in roleplayScenarios.ts) to get a scenario
    // 2. Extracting title and systemPrompt from the scenario
    // 3. Calling props.onCreateNewThread(roleplayTitle, roleplaySystemPrompt)
    // 4. Potentially sending an initial AI message for the roleplay
  };

  return (
    <div class="flex flex-col h-screen bg-bg-primary text-fg-primary relative">
      <Dynamic component="style" id={HIGHLIGHT_STYLE_ID}>{HIGHLIGHT_CSS}</Dynamic>
      <header class="flex items-center p-2 border-b border-border-secondary sticky top-0 z-10 bg-bg-primary">
        <Button variant="ghost" size="icon" onClick={props.onNavigateBack} class="mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </Button>
        <h1 class="text-lg font-semibold">{currentThread()?.title || 'Chat'}</h1>
        <div class="flex-grow"></div>
        <Switch checked={isSpeechModeActive()} onChange={setIsSpeechModeActive} class="ml-auto mr-2">
          <SwitchControl><SwitchThumb /></SwitchControl>
          <SwitchLabel>Speech Mode</SwitchLabel>
        </Switch>
      </header>

      <div class="flex flex-1 overflow-hidden">
        <aside class="w-64 md:w-72 flex flex-col border-r border-border-secondary bg-bg-secondary p-2 overflow-y-auto">
          <div class="mb-2 flex justify-center">
            <Button 
              variant="outline" 
              size="icon"
              class="w-full"
              onClick={handleCreateNewGeneralChat}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
              </svg>
            </Button>
          </div>

          <For each={props.threads.filter(t => t.id !== JUST_CHAT_THREAD_ID)} fallback={<div>No active threads.</div>}>
            {(thread) => (
              <Button
                variant={currentThread()?.id === thread.id ? 'secondary' : 'ghost'}
                class="w-full justify-start mb-1 truncate"
                onClick={() => props.onSelectThread(thread.id)}
              >
                {thread.title}
              </Button>
            )}
          </For>

          <div class="mt-auto pt-2 border-t border-border-tertiary">
            <Button variant="outline" class="w-full" onClick={handleGenerateRoleplays}>
              Generate Roleplays
            </Button>
          </div>
        </aside>

        <main class="flex-1 flex flex-col bg-bg-primary overflow-hidden">
          <div ref={scrollHostRef} class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            <For each={currentMessages()} fallback={<div class="text-center text-fg-muted">No messages yet.</div>}>
              {(message, index) => (
                <ChatMessageItem
                  message={message}
                  isLastInGroup={index() === currentMessages().length - 1 || currentMessages()[index() + 1]?.sender !== message.sender}
                  isCurrentSpokenMessage={activeSpokenMessageId() === message.id}
                  wordMap={activeSpokenMessageId() === message.id ? ttsWordMap() : (message.ttsWordMap || [])}
                  currentHighlightIndex={activeSpokenMessageId() === message.id ? currentTTSHighlightIndex() : null}
                  onPlayTTS={handlePlayTTS}
                />
              )}
            </For>
            <Show when={ttsError()}>
              <div class="text-red-500 text-sm p-2 bg-red-100 rounded-md">TTS Error: {ttsError()}</div>
            </Show>
          </div>

          <Show when={!isSpeechModeActive() && currentThread()?.id !== JUST_CHAT_THREAD_ID}>
            <div class="p-2 border-t border-border-secondary bg-bg-primary">
              <div class="flex items-center space-x-2">
                <TextField class="flex-1">
                  <TextFieldInput 
                    type="text" 
                    placeholder="Type your message..." 
                    value={inputText()} 
                    onInput={(e) => setInputText(e.currentTarget.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendText())}
                  />
                </TextField>
                <Button onClick={handleSendText} disabled={!inputText().trim()}>Send</Button>
              </div>
            </div>
          </Show>

          <Show when={isSpeechModeActive() && currentThread()?.id === JUST_CHAT_THREAD_ID}>
            <div class="p-4 border-t border-border-secondary bg-bg-primary flex justify-center items-center">
              <Button 
                onClick={isRecording() ? handleStopRecording : handleStartRecording}
                variant={isRecording() ? "destructive" : 'default'}
                class="w-16 h-16 rounded-full text-2xl flex items-center justify-center"
              >
                {isRecording() ? 
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg> : 
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>
                }
              </Button>
            </div>
          </Show>
        </main>
      </div>
    </div>
  );
}; 