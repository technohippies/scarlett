import { Component, For, createSignal, createEffect, onCleanup } from 'solid-js';
import { Button } from '../../components/ui/button';
import { TextField, TextFieldInput } from '../../components/ui/text-field'; 
import { Sheet, SheetContent, SheetTrigger } from '../../components/ui/sheet';
import type { ChatMessage, Thread } from './types';
import { ChatMessageItem } from './ChatMessageItem';
import { Switch, SwitchControl, SwitchThumb, SwitchLabel } from '../../components/ui/switch';
import { MicVAD } from '@ricky0123/vad-web';
import { browser } from 'wxt/browser';
import { transcribeElevenLabsAudio } from '../../services/stt/elevenLabsSttService';
import { Spinner } from '../../components/ui/spinner';
import { Pause, Microphone } from 'phosphor-solid';
import { MicVisualizer } from '../../components/ui/MicVisualizer';

interface ChatPageViewProps {
  threads: Thread[];
  currentChatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSelectThread: (threadId: string) => void;
  onNavigateBack: () => void;
  currentThreadId?: string | null;
}

export const ChatPageView: Component<ChatPageViewProps> = (props) => {
  const [inputText, setInputText] = createSignal('');
  let scrollHostRef: HTMLDivElement | undefined;

  // --- Speech Mode & VAD State ---
  const [isSpeechMode, setIsSpeechMode] = createSignal(false);
  const [isRecording, setIsRecording] = createSignal(false);
  const [isLLMGenerating, setIsLLMGenerating] = createSignal(false);
  const [isTTSSpeaking, setIsTTSSpeaking] = createSignal(false);
  const [vadInstance, setVadInstance] = createSignal<MicVAD | null>(null);
  let vadInitPromise: Promise<MicVAD | null> | null = null;
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
        onSpeechStart: () => console.log('[ChatPage] VAD onSpeechStart'),
        onSpeechEnd: async (_audio) => {
          console.log('[ChatPage] VAD onSpeechEnd');
          setIsRecording(false);
          // Perform STT when speech ends
          try {
            const result = await transcribeElevenLabsAudio('', new Blob());
            const text = result?.text?.trim();
            if (text) props.onSendMessage(text);
          } catch (e) {
            console.error('[ChatPage] VAD STT error', e);
          }
        }
      });
      setVadInstance(v);
      resolveInit(v);
    } catch (e) {
      console.error('[ChatPage] VAD init error', e);
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
    vadInitPromise = null;
  };
  const handleStartRecording = async () => {
    if (!isSpeechMode() || isRecording() || isLLMGenerating() || isTTSSpeaking()) return;
    const v = await initVad();
    if (v) {
      try { await v.start(); setIsRecording(true); } catch (e) { console.error('[VAD] start error', e); }
    }
  };
  const handleStopRecording = () => {
    if (vadInstance() && isRecording()) {
      vadInstance()!.pause();
      setIsRecording(false);
    }
  };
  createEffect(() => {
    if (isSpeechMode()) initVad(); else destroyVadInstance();
  });
  onCleanup(destroyVadInstance);
  // --- End VAD Setup ---

  const handleSend = () => {
    if (inputText().trim()) {
      props.onSendMessage(inputText().trim());
      setInputText('');
    }
  };

  createEffect(() => {
    props.currentChatMessages;
    if (scrollHostRef) {
      scrollHostRef.scrollTop = scrollHostRef.scrollHeight;
    }
  });

  // Helper to get last AI message
  const lastAIMessage = () => props.currentChatMessages.filter(m => m.sender === 'ai').pop() || null;

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
                            handleSend();
                          }
                        }}
                        class="text-md md:text-base h-10"
                      />
                    </TextField>
                    <Button onClick={handleSend} class="h-10 px-4 w-24">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </Button>
                  </div>
                </div>
              </main>
            ) : (
              <main class="flex-1 flex flex-col bg-background overflow-hidden">
                <div class="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                  <Show when={lastAIMessage()} fallback={<Spinner class="h-12 w-12" />}>
                    {(msg) => {
                      const message = msg();
                      return (
                        <div class="max-w-[75%] md:max-w-[70%] text-xl whitespace-pre-wrap">
                          <ChatMessageItem
                            message={message}
                            isCurrentSpokenMessage={false}
                            wordMap={[]}
                            currentHighlightIndex={null}
                            // onPlayTTS to be implemented
                          />
                        </div>
                      );
                    }}
                  </Show>
                </div>
                <div class="px-4">
                  <MicVisualizer
                    active={isRecording()}
                    barCount={60}
                    maxHeight={48}
                    interval={80}
                  />
                </div>
                <div class="p-4 border-t flex justify-center items-center">
                  <Button
                    onClick={() => isRecording() ? handleStopRecording() : handleStartRecording()}
                    variant="default"
                    class="w-16 h-16 rounded-full text-2xl"
                    disabled={isLLMGenerating() || isTTSSpeaking()}
                  >
                    {isRecording() ? <Pause /> : <Microphone />}
                  </Button>
                </div>
              </main>
            )
          }
        </div>
      </div>
    </div>
  );
};
