import { Component, For, createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Button } from '../../components/ui/button';
import { TextField, TextFieldInput } from '../../components/ui/text-field';
import type { Thread } from './types';
import { ChatMessageItem } from './ChatMessageItem';
import { Switch, SwitchControl, SwitchThumb, SwitchLabel } from '../../components/ui/switch';
import { MicVAD } from '@ricky0123/vad-web';
import { userConfigurationStorage } from '../../services/storage/storage';
import { browser } from 'wxt/browser';
import { generateElevenLabsSpeechWithTimestamps } from '../../services/tts/elevenLabsService';
import { DEFAULT_ELEVENLABS_VOICE_ID, LANGUAGE_NAME_MAP } from '../../shared/constants';
// Placeholder for STT service - will be properly imported later
// import { transcribeElevenLabsAudio } from '../../services/stt/elevenLabsSttService'; 
import { Spinner, Sparkle } from 'phosphor-solid';
import { generateRoleplayScenariosLLM, type RoleplayScenario } from '../../services/llm/llmChatService';
import type { UserConfiguration } from '../../services/storage/types';
import type { ChatMessage } from './types';

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

interface UnifiedConversationViewProps {
  threads: Thread[];
  onSendMessage: (text: string, threadId: string, isUserMessage: boolean, ttsLangForAiResponse?: string) => Promise<void>; 
  onSelectThread: (threadId: string) => void;
  onNavigateBack: () => void;
  currentSelectedThreadId?: string | null;
  onCreateNewThread: (title: string, systemPrompt: string, newMessages?: ChatMessage[], metadata?: any) => Promise<string>; 
  userConfig: UserConfiguration;
}

const [isGeneratingRoleplays, setIsGeneratingRoleplays] = createSignal(false);

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
  const [currentPlaybackRate, setCurrentPlaybackRate] = createSignal(1.0);

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
    
    // If this message is already playing, and we click again, treat as pause.
    // If it's paused (and is this message), treat as play.
    const currentAudio = currentTTSAudioInfo()?.audio;
    if (activeSpokenMessageId() === messageId && currentAudio) {
        if (!currentAudio.paused) {
            currentAudio.pause();
            setIsTTSSpeaking(false); // No longer actively playing
            // Highlight loop will stop due to audio.paused
            return;
        } else {
            await currentAudio.play();
            currentAudio.playbackRate = currentPlaybackRate(); // Ensure rate is set on resume
            setIsTTSSpeaking(true); // Actively playing again
            // Highlight loop will restart on audio.onplay
            return;
        }
    }

    // If different message or no audio, proceed to generate/play new
    stopAndClearTTS(); // Stop any currently playing audio
    setActiveSpokenMessageId(messageId);
    setIsTTSSpeaking(true); // Set to true as we are initiating TTS
    setTtsError(null); 
    
    try {
      // Determine if we need to fetch new audio or use existing
      let audioSrc: string;
      let alignmentToUse = alignmentDataParam;

      if (alignmentDataParam && currentTTSAudioInfo()?.url) {
        // This path is less common now with stopAndClearTTS before new plays for different messages
        // but could be relevant if replaying the *same* message without forcing regenerate
        console.log("[TTS] Using existing alignment data for message:", messageId);
        audioSrc = currentTTSAudioInfo()!.url; // Assume audio is already loaded
      } else {
        const userCfg = await userConfigurationStorage.getValue();
        const ttsConfigObj = userCfg?.ttsConfig;
        // Determine the TTS provider: preference given to ttsConfig.providerId, fallback to selectedTtsVendor
        const providerId = ttsConfigObj?.providerId ?? userCfg?.selectedTtsVendor;
        console.log(`[TTS] Selected TTS provider: ${providerId}`);
        if (providerId === 'elevenlabs') {
          const apiKey = ttsConfigObj?.apiKey;
          if (!apiKey) {
            throw new Error('ElevenLabs API key missing in ttsConfig.');
          }
          const selectedModelId = ttsConfigObj?.modelId || 'eleven_multilingual_v2';
          // Voice ID comes from top-level config or default
          const voiceId = userCfg?.elevenLabsVoiceId || DEFAULT_ELEVENLABS_VOICE_ID;
          console.log(`[TTS] Generating ElevenLabs speech: Model=${selectedModelId}, Voice=${voiceId}, Lang=${effectiveLang}, Speed=${currentPlaybackRate()}`);
          const { audioBlob, alignmentData: newAlignmentData } = await generateElevenLabsSpeechWithTimestamps(
            apiKey,
            text,
            selectedModelId,
            voiceId,
            undefined, // No custom voiceSettings
            currentPlaybackRate(),
            effectiveLang
          );
          audioSrc = URL.createObjectURL(audioBlob);
          alignmentToUse = newAlignmentData;
        } else if (providerId === 'browser') {
          // Browser TTS fallback
          console.log('[TTS] Using browser SpeechSynthesis for TTS');
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = effectiveLang;
          utterance.rate = currentPlaybackRate();
          utterance.onend = () => {
            setIsTTSSpeaking(false);
            setActiveSpokenMessageId(null);
          };
          speechSynthesis.speak(utterance);
          // No audioSrc for browser TTS; skip alignment
          return;
        } else {
          throw new Error('TTS provider not configured or unsupported: ' + providerId);
        }
      }

      const wordMapData = processTTSAlignment(text, alignmentToUse, effectiveLang);
      setTtsWordMap(wordMapData);

      const audio = new Audio(audioSrc);
      audio.playbackRate = currentPlaybackRate(); // Apply current playback rate
      setCurrentTTSAudioInfo({ audio, url: audioSrc });

      audio.onplay = () => {
        setIsTTSSpeaking(true);
        updateTTSHighlightLoop(); 
      };
      audio.onpause = () => {
        setIsTTSSpeaking(false);
        if (ttsAnimationFrameId()) { cancelAnimationFrame(ttsAnimationFrameId()!); setTtsAnimationFrameId(null); }
      };
      audio.onended = () => {
        stopAndClearTTS();
        setActiveSpokenMessageId(null); // Clear active message ID when playback finishes
      };
      audio.onerror = (e) => {
        console.error('[TTS] Audio playback error:', e);
        setTtsError(`Audio playback error: ${typeof e === 'string' ? e : (e as Event).type}`);
        stopAndClearTTS();
        setActiveSpokenMessageId(null);
      };

      await audio.play();
      console.log(`[TTS] Started playing audio for ${messageId}. Set playbackRate to: ${audio.playbackRate}`);
    } catch (error: any) {
      console.error('[TTS] handlePlayTTS error:', error);
      setTtsError(`TTS generation error: ${error.message}`);
      stopAndClearTTS();
      setActiveSpokenMessageId(null);
    }
  };

  const handleChangePlaybackSpeed = (messageId: string, newRate: number) => {
    console.log(`[UnifiedConversationView] Requested playback speed change to: ${newRate} for message: ${messageId}`);
    setCurrentPlaybackRate(newRate);

    const targetMessage = currentMessages().find(m => m.id === messageId);

    if (!targetMessage) {
      console.error(`[UnifiedConversationView] handleChangePlaybackSpeed: Target message with id ${messageId} not found.`);
      return;
    }

    // Stop any currently playing audio before starting the new one or restarting the current one.
    stopAndClearTTS(); 
    
    console.log(`[UnifiedConversationView] Re-initiating TTS for message ${messageId} at new speed ${newRate}.`);
    // handlePlayTTS will use the new currentPlaybackRate internally.
    // It will also set activeSpokenMessageId.
    handlePlayTTS(targetMessage.id, targetMessage.text_content, targetMessage.ttsLang || 'en', targetMessage.alignmentData)
      .catch(error => console.error("[UnifiedConversationView] Error during TTS re-initiation after speed change:", error));
  };
  
  onCleanup(stopAndClearTTS);
  
  createEffect(() => {
    const messages = currentMessages();
    const thread = currentThread();
    if (isSpeechModeActive() && thread && thread.id === JUST_CHAT_THREAD_ID && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.sender === 'ai' && activeSpokenMessageId() !== lastMessage.id && !isTTSSpeaking()) {
            // In speech mode, always play at normal speed.
            setCurrentPlaybackRate(1.0); 
            handlePlayTTS(lastMessage.id, lastMessage.text_content, lastMessage.ttsLang || 'en', lastMessage.alignmentData);
        }
    }
  });
  
  const handleCreateNewGeneralChat = async () => {
    // Pass empty string for systemPrompt
    await props.onCreateNewThread("New Chat", "", []);
  };

  const handleGenerateRoleplays = async () => {
    setIsGeneratingRoleplays(true);
    try {
      const rawLang = props.userConfig?.targetLanguage ?? 'en'; // Default to 'en' if not set
      const code = rawLang.toLowerCase();
      const targetLanguageName = LANGUAGE_NAME_MAP[code] ?? rawLang; // Fallback to rawLang if no map entry

      // Use targetLanguageName instead of userLang
      const scenarios: RoleplayScenario[] | null = await generateRoleplayScenariosLLM(targetLanguageName, "");

      if (scenarios && scenarios.length > 0) {
        for (const scenario of scenarios) {
          const sceneMessage: ChatMessage = {
            id: crypto.randomUUID(),
            thread_id: '', 
            text_content: scenario.description, 
            timestamp: new Date().toISOString(),
            sender: 'ai'
            // metadata: { roleplay_scene: true } // Removed as ChatMessage type doesn't have metadata
          };
          
          const newThreadId = await props.onCreateNewThread(
            scenario.title, 
            scenario.description, 
            [sceneMessage], 
            { roleplay_scenario: scenario } // Thread metadata contains the scenario info
          );

          if (newThreadId && scenario.ai_opening_line) {
            await props.onSendMessage(scenario.ai_opening_line, newThreadId, false);
          }
        }
        if (scenarios.length > 0) {
          // Placeholder for potential future logic, e.g. auto-selecting the new thread
        }
      } else {
        console.warn('[RoleplayGen] No scenarios generated or an error occurred.');
        // TODO: Display error to user more gracefully
      }
    } catch (error) {
      console.error('[RoleplayGen] Error generating roleplay scenarios:', error);
      // TODO: Display error to user more gracefully
    } finally {
      setIsGeneratingRoleplays(false);
    }
  };

  return (
    <div class="flex flex-col h-screen bg-bg-primary text-fg-primary relative">
      <Dynamic component="style" id={HIGHLIGHT_STYLE_ID}>{HIGHLIGHT_CSS}</Dynamic>
      <header class="flex items-center p-2 border-b border-border-secondary sticky top-0 z-10 bg-bg-primary">
        <Button variant="ghost" size="icon" onClick={props.onNavigateBack} class="mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </Button>
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

          <div class="mt-auto pt-2">
            <Button 
              variant="outline" 
              class="w-full" 
              onClick={handleGenerateRoleplays}
              disabled={isGeneratingRoleplays()}
            >
              {isGeneratingRoleplays() ? (
                <>
                  <Spinner class="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkle class="mr-2 h-4 w-4" />
                  Generate Roleplay
                </>
              )}
            </Button>
          </div>
        </aside>

        <main class="flex-1 flex flex-col bg-bg-primary overflow-hidden">
          <div ref={scrollHostRef} class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            <Show
              when={currentMessages().length > 0 || isSpeechModeActive()}
              fallback={
                <div class="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <img 
                    src="/images/scarlett-supercoach/scarlett-proud-512x512.png" 
                    alt="Scarlett Supercoach" 
                    class="w-32 h-32 mb-4 opacity-80" 
                  />
                  <p class="text-lg font-medium">Let's chat!</p>
                  <p class="text-sm">I have context of your browsing history, recent songs, and your mood.</p>
                </div>
              }
            >
              <For each={currentMessages()} /* Removed fallback from For, it's handled by Show */>
                {(message, index) => (
                  <ChatMessageItem
                    message={message}
                    isLastInGroup={index() === currentMessages().length - 1 || currentMessages()[index() + 1]?.sender !== message.sender}
                    isCurrentSpokenMessage={activeSpokenMessageId() === message.id}
                    wordMap={activeSpokenMessageId() === message.id ? ttsWordMap() : (message.ttsWordMap || [])}
                    currentHighlightIndex={activeSpokenMessageId() === message.id ? currentTTSHighlightIndex() : null}
                    onPlayTTS={handlePlayTTS}
                    isStreaming={message.isStreaming}
                    isGlobalTTSSpeaking={isTTSSpeaking()} // Kept as is from user's file
                    onChangeSpeed={handleChangePlaybackSpeed}
                  />
                )}
              </For>
            </Show>
            <Show when={ttsError()}>
              <div class="text-red-500 text-sm p-2 bg-red-100 rounded-md">TTS Error: {ttsError()}</div>
            </Show>
          </div>

          <Show when={!isSpeechModeActive() && currentThread()?.id !== JUST_CHAT_THREAD_ID}>
            <div class="p-2 bg-bg-primary">
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