import { Component, For, createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { TextField, TextFieldInput } from '../../components/ui/text-field'; 
import { Sheet, SheetContent, SheetTrigger } from '../../components/ui/sheet';
import type { ChatMessage, Thread, WordInfo } from './types';
import { ChatMessageItem } from './ChatMessageItem';
import { Switch, SwitchControl, SwitchThumb, SwitchLabel } from '../../components/ui/switch';
import { MicVAD } from '@ricky0123/vad-web';
import { browser } from 'wxt/browser';
import { transcribeElevenLabsAudio } from '../../services/stt/elevenLabsSttService';
import { Spinner } from '../../components/ui/spinner';
import { Pause, Microphone } from 'phosphor-solid';
import { MicVisualizer } from '../../components/ui/MicVisualizer';
import type { UserConfiguration } from '../../services/storage/types';
import { pcmToWavBlob } from '../../lib/utils';
import { useActor } from '@xstate/solid';
import { speechMachine } from './speechMachine';
import { ELEVENLABS_API_BASE_URL, DEFAULT_ELEVENLABS_VOICE_ID, DEFAULT_ELEVENLABS_MODEL_ID } from '../../shared/constants';
import { SpeechVisualizer } from '../../components/ui/SpeechVisualizer';

interface ChatPageViewProps {
  threads: Thread[];
  currentChatMessages: ChatMessage[];
  onSendMessage: (text: string, threadId: string, isUserMessage: boolean, ttsLangForAiResponse?: string) => Promise<void>;
  onSelectThread: (threadId: string) => void;
  onNavigateBack: () => void;
  currentThreadId: string | null;

  activeSpokenMessageId: string | null;
  isUnifiedTTSSpeaking: boolean;
  isUnifiedLLMGenerating: boolean;
  ttsWordMap: WordInfo[];
  currentTTSHighlightIndex: number | null;
  userConfig: UserConfiguration;
}

export const ChatPageView: Component<ChatPageViewProps> = (props) => {
  const [inputText, setInputText] = createSignal('');
  let scrollHostRef: HTMLDivElement | undefined;

  // --- Speech Mode & VAD State ---
  const [isSpeechMode, setIsSpeechMode] = createSignal(true);
  const [isRecording, setIsRecording] = createSignal(false);
  const [isInSpeech, setIsInSpeech] = createSignal(false);
  const [vadInstance, setVadInstance] = createSignal<MicVAD | null>(null);
  let vadInitPromise: Promise<MicVAD | null> | null = null;
  const [hasVADStarted, setHasVADStarted] = createSignal(false);

  const [speechState, speechSend] = useActor(speechMachine);
  // Buffer to hold recorded audio for STT
  let latestAudioData: Float32Array | null = null;
  let audioRef: HTMLAudioElement | undefined;

  const initVad = async (): Promise<MicVAD | null> => {
    if (vadInstance()) return vadInstance();
    if (vadInitPromise) return await vadInitPromise;
    let resolveInit: (v: MicVAD | null) => void = () => {};
    vadInitPromise = new Promise<MicVAD | null>(r => resolveInit = r);
    try {
      const v = await MicVAD.new({
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
          console.log('[ChatPageView] VAD onSpeechStart');
          setIsInSpeech(true);
        },
        onSpeechEnd: async (audioData) => {
          console.log('[ChatPageView] VAD onSpeechEnd');
          setIsInSpeech(false);
          // Stop recording
          vadInstance()?.pause();
          setIsRecording(false);
          // Store audio data and advance state
          latestAudioData = audioData;
          speechSend({ type: 'SPEECH_END' });
        }
      });
      setVadInstance(v);
      resolveInit(v);
    } catch (e) {
      console.error('[ChatPageView] VAD init error', e);
      setVadInstance(null);
      resolveInit(null);
      vadInitPromise = null;
      return null;
    }
    vadInitPromise = null;
    return vadInstance();
  };
  
  const destroyVadInstance = () => {
    vadInstance()?.destroy();
    setVadInstance(null);
    setIsRecording(false);
    setIsInSpeech(false);
    vadInitPromise = null;
  };

  const handleStartRecording = async () => {
    if (!isSpeechMode() || isRecording() || props.isUnifiedLLMGenerating || props.isUnifiedTTSSpeaking) return;
    const v = await initVad();
    if (v) {
      try { 
        await v.start(); 
        setIsRecording(true); 
        console.log('[ChatPageView] VAD started recording');
      } catch (e) { 
        console.error('[ChatPageView] VAD start error', e); 
        setIsRecording(false);
      }
    }
  };

  const handleStopRecording = () => {
    if (vadInstance() && isRecording()) {
      console.log('[ChatPageView] VAD pausing/stopping recording');
      vadInstance()!.pause();
      setIsRecording(false);
      setIsInSpeech(false);
    }
  };
  
  const handleManualStart = async () => {
    if (!isSpeechMode() || props.isUnifiedLLMGenerating || props.isUnifiedTTSSpeaking) return;
    setHasVADStarted(true);
    await handleStartRecording();
  };

  createEffect(() => {
    if (isSpeechMode()) {
    } else {
      destroyVadInstance();
      setHasVADStarted(false);
    }
  });

  createEffect(() => {
    props.currentThreadId;
    console.log(`[ChatPageView] Thread changed to: ${props.currentThreadId}. Resetting VAD manual start.`);
    setHasVADStarted(false);
    if (isRecording()) {
        handleStopRecording();
    }
  });

  onCleanup(() => {
    destroyVadInstance();
  });

  createEffect(() => {
    if (hasVADStarted() && isSpeechMode() && !isRecording() && !props.isUnifiedLLMGenerating && !props.isUnifiedTTSSpeaking) {
      console.log('[ChatPageView] Continuous listen: attempting to start VAD.');
      handleStartRecording();
    }
  });

  createEffect(() => {
    if (isRecording() && (props.isUnifiedLLMGenerating || props.isUnifiedTTSSpeaking || !isSpeechMode())) {
      console.log('[ChatPageView] Auto-stopping VAD due to LLM/TTS/SpeechMode change.');
      handleStopRecording();
    }
  });

  const handleSendInputText = () => {
    if (inputText().trim() && props.currentThreadId) {
      props.onSendMessage(inputText().trim(), props.currentThreadId!, true);
      setInputText('');
    }
  };

  createEffect(() => {
    props.currentChatMessages;
    if (scrollHostRef) {
      scrollHostRef.scrollTop = scrollHostRef.scrollHeight;
    }
  });
  
  const messageForSpeechDisplay = () => {
    if (props.activeSpokenMessageId) {
      const msg = props.currentChatMessages.find(m => m.id === props.activeSpokenMessageId);
      if (msg) return msg;
    }
    if (props.isUnifiedLLMGenerating) {
        const streamingMsg = props.currentChatMessages.slice().reverse().find(m => m.sender === 'ai' && m.isStreaming);
        if (streamingMsg) return streamingMsg;
    }
    return props.currentChatMessages.filter(m => m.sender === 'ai').pop() || null;
  };
  
  createEffect(() => {
    const msg = messageForSpeechDisplay();
    console.log(`[ChatPageView SpeechDisplay] Message ID: ${msg?.id}, Text: "${msg?.text_content.substring(0,30)}", Streaming: ${msg?.isStreaming}, ActiveSpokenID: ${props.activeSpokenMessageId}`);
  });

  // When machine enters 'listening', start recording
  createEffect(() => {
    if (speechState.matches('listening')) {
      handleStartRecording();
    }
  });

  // When machine enters 'recognizing', run STT
  createEffect(() => {
    if (!speechState.matches('recognizing') || !latestAudioData) return;
    (async () => {
      try {
        const apiKey = props.userConfig?.ttsConfig?.apiKey ?? props.userConfig.elevenLabsApiKey ?? '';
        const wavBlob = pcmToWavBlob(latestAudioData, 16000);
        let transcript = '';
        if (apiKey) {
          const result = await transcribeElevenLabsAudio(apiKey, wavBlob);
          transcript = result.text?.trim() || '';
        }
        speechSend({ type: 'TRANSCRIBE_SUCCESS', transcript });
      } catch (e) {
        console.error('[ChatPageView] STT error', e);
        speechSend({ type: 'TRANSCRIBE_ERROR' });
      }
    })();
  });

  // When machine enters 'waitingLLM', call onSendMessage
  createEffect(() => {
    const transcript = speechState.context.transcript;
    if (!speechState.matches('waitingLLM') || !transcript || !props.currentThreadId) return;
    const threadId = props.currentThreadId!;
    (async () => {
      try {
        await props.onSendMessage(
          transcript!,
          threadId,
          true
        );
      } catch (e) {
        console.error('[ChatPageView] LLM error', e);
      } finally {
        speechSend({ type: 'LLM_DONE' });
      }
    })();
  });

  // When machine enters 'speaking', start streaming TTS audio
  createEffect(() => {
    if (!speechState.matches('speaking') || !audioRef) return;
    (async () => {
      try {
        const apiKey = props.userConfig?.ttsConfig?.apiKey ?? props.userConfig.elevenLabsApiKey ?? '';
        const modelId = props.userConfig.ttsConfig?.modelId || DEFAULT_ELEVENLABS_MODEL_ID;
        const voiceId = props.userConfig.elevenLabsVoiceId || DEFAULT_ELEVENLABS_VOICE_ID;
        const text = speechState.context.transcript;
        if (!text) {
          speechSend({ type: 'TTS_END' });
          return;
        }
        const res = await fetch(
          `${ELEVENLABS_API_BASE_URL}/text-to-speech/${voiceId}/stream`,
          {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': apiKey,
            },
            body: JSON.stringify({ text, model_id: modelId }),
          }
        );
        const mediaSource = new MediaSource();
        audioRef.src = URL.createObjectURL(mediaSource);
        mediaSource.addEventListener('sourceopen', () => {
          const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          const reader = res.body!.getReader();
          (async function pump() {
            const { value, done } = await reader.read();
            if (value) sourceBuffer.appendBuffer(value);
            if (!done) return pump();
            mediaSource.endOfStream();
          })();
        });
        audioRef.onended = () => speechSend({ type: 'TTS_END' });
        await audioRef.play();
      } catch (e) {
        console.error('[ChatPageView] TTS stream error', e);
        speechSend({ type: 'TTS_END' });
      }
    })();
  });

  return (
    <div class="flex flex-col h-screen bg-background text-foreground">
      <header class="flex items-center p-2 md:p-4 border-b border-border/40 sticky top-0 bg-background z-10">
        <Sheet>
          <SheetTrigger as={Button} variant="ghost" class="mr-1 p-2 md:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </SheetTrigger>
          <SheetContent position="left" class="w-full sm:max-w-xs p-0 flex flex-col">
            <div class="p-2 pt-4 overflow-y-auto flex-grow">
              <For each={props.threads}>
                {(thread) => (
                  <Button
                    variant={props.currentThreadId === thread.id ? "secondary" : "ghost"}
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
              <Button variant="outline" class="w-full">
                Generate Roleplays
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <Button variant="ghost" onClick={props.onNavigateBack} class="mr-2 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </Button>
        <div class="flex-1"></div>
        <div class="flex items-center mr-4">
          <Switch checked={isSpeechMode()} onChange={setIsSpeechMode} class="flex items-center">
            <SwitchLabel class="mr-2">Speech Mode</SwitchLabel>
            <SwitchControl>
              <SwitchThumb />
            </SwitchControl>
          </Switch>
        </div>
      </header>

      <div class="flex flex-1 overflow-hidden">
        <aside class="hidden md:flex flex-col w-64 lg:w-72 border-r border-border/40 bg-muted/20">
          <div class="p-2 pt-4 overflow-y-auto flex-grow">
            <For each={props.threads}>
              {(thread) => (
                <Button
                  variant={props.currentThreadId === thread.id ? "secondary" : "ghost"}
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
            <Button variant="outline" class="w-full">
              Generate Roleplays
            </Button>
          </div>
        </aside>

        <div ref={scrollHostRef} class="flex-1 flex flex-col overflow-y-auto">
          {
            !isSpeechMode() ? (
              <main class="w-full max-w-4xl mx-auto flex flex-col flex-grow">
                <div class="flex-grow p-4 space-y-6 bg-background" id="message-list-container">
                  <For each={props.currentChatMessages}>
                    {(message) => (
                      <ChatMessageItem message={message} />
                    )}
                  </For>
                </div>

                <div class="p-2 md:p-4 border-t border-border/40 bg-background sticky bottom-0">
                  <div class="flex items-center space-x-2">
                    <TextField class="w-full">
                      <TextFieldInput
                        type="text"
                        placeholder="Type your message..."
                        value={inputText()}
                        onInput={(e) => setInputText(e.currentTarget.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendInputText();
                          }
                        }}
                        class="text-md md:text-base h-10"
                      />
                    </TextField>
                    <Button onClick={handleSendInputText} class="h-10 px-4 w-24">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </Button>
                  </div>
                </div>
              </main>
            ) : (
              <main class="flex-1 flex flex-col bg-background overflow-hidden">
                <audio ref={el => audioRef = el} />
                <div class="flex-1 flex items-center justify-center">
                  <SpeechVisualizer />
                </div>
                <div class="px-4">
                  <MicVisualizer active={isInSpeech()} barCount={60} maxHeight={48} interval={80} />
                </div>
                {!hasVADStarted() && (
                  <div class="p-4 border-t flex justify-center items-center">
                    <Button
                      onClick={() => speechSend({ type: 'START' })}
                      variant="default"
                      class="w-16 h-16 rounded-full text-2xl flex items-center justify-center"
                      disabled={!speechState.matches('idle') || props.isUnifiedLLMGenerating || props.isUnifiedTTSSpeaking}
                    >
                      <Microphone />
                    </Button>
                  </div>
                )}
                 {hasVADStarted() && (isRecording() || isInSpeech()) && (
                  <div class="p-4 border-t flex justify-center items-center">
                     <div class="w-16 h-16 flex items-center justify-center text-muted-foreground">
                       (Listening...)
                     </div>
                  </div>
                )}
              </main>
            )
          }
        </div>
      </div>
    </div>
  );
};
