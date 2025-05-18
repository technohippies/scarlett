import { Component, For, createSignal, createEffect, onCleanup } from 'solid-js';
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
  
  const handleCreateNewThread = async () => {
    const newSysPrompt = window.prompt("Enter system prompt for new roleplay:", "You are a helpful French tutor.") || "You are a helpful French tutor.";
    const newTitle = window.prompt("Enter title for new thread:", "French Practice") || "French Practice";
    const newThreadId = await props.onCreateNewThread(newTitle, newSysPrompt);
    props.onSelectThread(newThreadId);
    // Optional: AI kickoff for new thread
    // await props.onSendMessage("Bonjour! Comment ça va?", newThreadId, false, 'fr');
  };

  return (
    <div class="flex flex-col h-screen bg-background text-foreground">
      <Dynamic component="style" id={HIGHLIGHT_STYLE_ID}>{HIGHLIGHT_CSS}</Dynamic>
      <header class="flex items-center p-2 md:p-4 border-b border-border/40 sticky top-0 bg-background z-10">
        <Sheet>
          <SheetTrigger as={Button} variant="ghost" class="mr-1 p-2 md:hidden" disabled={isSpeechModeActive()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </SheetTrigger>
          <SheetContent position="left" class="w-full sm:max-w-xs p-0 flex flex-col">
            <div class="p-2 pt-4 overflow-y-auto flex-grow">
              <For each={props.threads.filter(t => t.id !== JUST_CHAT_THREAD_ID)}>
                {(thread) => (
                  <Button
                    variant={props.currentSelectedThreadId === thread.id && !isSpeechModeActive() ? "secondary" : "ghost"}
                    class="w-full justify-start mb-1 text-sm p-2 h-auto text-left"
                    onClick={() => { if (!isSpeechModeActive()) props.onSelectThread(thread.id); }}
                    title={thread.title}
                    disabled={isSpeechModeActive()}
                  >
                    <span class="block w-full truncate">
                      {thread.title}
                    </span>
                  </Button>
                )}
              </For>
            </div>
            <div class="p-2 border-t border-border/40">
              <Button variant="outline" class="w-full" onClick={handleCreateNewThread} disabled={isSpeechModeActive()}>
                New Thread
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <Button variant="ghost" onClick={props.onNavigateBack} class="mr-2 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </Button>
        
        <div class="flex-1 truncate pr-2">
           <Show when={currentThread() && !isSpeechModeActive()}>
             <span class="text-sm font-medium truncate">{currentThread()?.title}</span>
           </Show>
           <Show when={isSpeechModeActive()}>
             <span class="text-sm font-medium">Just Chat (Speech Mode)</span>
           </Show>
        </div>

        <div class="flex items-center mr-2">
          <Switch 
            id="speech-mode-toggle" 
            class="flex items-center"
            checked={isSpeechModeActive()}
            onChange={(checked) => {
                stopAndClearTTS();
                if (isRecording()) handleStopRecording();
                setIsSpeechModeActive(checked);
            }}
          >
            <SwitchLabel class="mr-2 text-sm whitespace-nowrap">Speech Mode</SwitchLabel>
            <SwitchControl>
              <SwitchThumb />
            </SwitchControl>
          </Switch>
        </div>
      </header>

      <div class="flex flex-1 overflow-hidden">
        <Show when={!isSpeechModeActive()}>
          <aside class="hidden md:flex flex-col w-64 lg:w-72 border-r border-border/40 bg-muted/20">
            <div class="p-2 pt-4 overflow-y-auto flex-grow">
              <For each={props.threads.filter(t => t.id !== JUST_CHAT_THREAD_ID)}>
                {(thread) => (
                  <Button
                    variant={props.currentSelectedThreadId === thread.id ? "secondary" : "ghost"}
                    class="w-full justify-start mb-1 text-sm p-2 h-auto text-left"
                    onClick={() => props.onSelectThread(thread.id)}
                    title={thread.title}
                  >
                    <span class="block w-full truncate">
                      {thread.title}
                    </span>
                  </Button>
                )}
              </For>
            </div>
            <div class="p-2 border-t border-border/40">
              <Button variant="outline" class="w-full" onClick={handleCreateNewThread}>
                New Thread
              </Button>
            </div>
          </aside>
        </Show>

        <div ref={scrollHostRef} class="flex-1 flex flex-col overflow-y-auto bg-background">
          <main class="w-full max-w-4xl mx-auto flex flex-col flex-grow">
            <div 
              class="flex-grow p-4 space-y-6"
              id="message-list-container"
            >
              <For each={currentMessages()}>
                {(message) => (
                  <ChatMessageItem 
                    message={message} 
                    isCurrentSpokenMessage={isSpeechModeActive() && activeSpokenMessageId() === message.id}
                    wordMap={isSpeechModeActive() && activeSpokenMessageId() === message.id ? ttsWordMap() : undefined}
                    currentHighlightIndex={isSpeechModeActive() && activeSpokenMessageId() === message.id ? currentTTSHighlightIndex() : undefined}
                  />
                )}
              </For>
            </div>

            <Show when={!isSpeechModeActive()}>
              <div class="p-2 md:p-4 border-t border-border/40 bg-background sticky bottom-0">
                <div class="flex items-center space-x-2">
                  <TextField class="w-full">
                    <TextFieldInput type="text" placeholder="Type your message..." value={inputText()} 
                      onInput={(e) => setInputText(e.currentTarget.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                      class="text-md md:text-base h-10" />
                  </TextField>
                  <Button onClick={handleSendText} class="h-10 px-4 w-24">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </Button>
                </div>
              </div>
            </Show>

            <Show when={isSpeechModeActive()}>
              <div class="p-2 md:p-4 border-t border-border/40 bg-background sticky bottom-0 flex flex-col items-center justify-center space-y-2">
                <Show when={ttsError()}><p class="text-destructive text-xs text-center">TTS Error: {ttsError()}</p></Show>
                <div class="flex items-center justify-center space-x-3">
                  <Show when={!isRecording() && !isTTSSpeaking()}>
                      <Button onClick={handleStartRecording} title="Start Recording" class="p-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 aspect-square w-16 h-16 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                      </Button>
                  </Show>
                  <Show when={isRecording() && !isTTSSpeaking()}>
                      <Button onClick={handleStopRecording} title="Stop Recording" class="p-0 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 aspect-square w-16 h-16 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>
                      </Button>
                  </Show>
                  <Show when={isTTSSpeaking()}>
                     <Button onClick={stopAndClearTTS} title="Stop Speech" class="p-0 rounded-full bg-amber-500 text-white hover:bg-amber-600 aspect-square w-16 h-16 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                     </Button>
                  </Show>
                </div>
              </div>
            </Show>

          </main>
        </div>
      </div>
    </div>
  );
}; 