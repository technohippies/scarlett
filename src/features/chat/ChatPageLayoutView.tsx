import { Component, Show, createEffect, onCleanup, createSignal, createResource, createRenderEffect } from 'solid-js';
import { CaretLeft } from 'phosphor-solid';
import { Switch, SwitchControl, SwitchThumb, SwitchLabel } from '../../components/ui/switch';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessageArea } from './ChatMessageArea';
import { TextInputControls } from './TextInputControls';
import { MicVisualizer } from '../../components/ui/MicVisualizer';
import { SpeechVisualizer } from '../../components/ui/SpeechVisualizer';
import type { Thread, ChatMessage } from './types';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BackgroundProtocolMap } from '../../shared/messaging-types';
import { EmbeddingProcessingPanel } from '../embedding/EmbeddingProcessingPanel';
import { getEmbedding, type EmbeddingResult } from '../../services/llm/embedding';
import { useSettings } from '../../context/SettingsContext';

export interface ChatPageLayoutViewProps {
  threads: Thread[];
  currentThreadId: string | null;
  onNavigateBack: () => void;
  onSelectThread: (threadId: string) => void;
  isSpeechModeActive: boolean;
  onToggleMode: () => void;
  onCreateThread: () => void;
  onGenerateRoleplay: () => void;
  onDeleteThread: (threadId: string) => void;
  isRoleplayLoading: boolean;
  threadSystemPrompt?: string;
  messages: ChatMessage[];
  userInput: string;
  onInputChange: (text: string) => void;
  onSendText: () => void;
  isIdle: boolean;
  isVADListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  onStartVAD: () => void;
  onStopVAD: () => void;
}

export const ChatPageLayoutView: Component<ChatPageLayoutViewProps> = (props) => {
  createEffect(() => {
    console.log('[ChatPageLayoutView EFFECT] isRoleplayLoading prop:', props.isRoleplayLoading);
  });
  createEffect(() => {
    console.log('[ChatPageLayoutView EFFECT] isSpeechModeActive prop:', props.isSpeechModeActive);
  });
  createEffect(() => {
    console.log('[ChatPageLayoutView] threadSystemPrompt prop:', props.threadSystemPrompt);
  });

  // Scroll container ref for auto-scrolling
  let mainScrollRef!: HTMLElement;

  // Auto-scroll to bottom when messages change - on the main element that actually scrolls
  createRenderEffect(() => {
    const messageCount = props.messages.length;
    const hasStreamingMessage = props.messages.some(m => m.isStreaming);
    
    console.log('[ChatPageLayoutView] Auto-scroll trigger - messageCount:', messageCount, 'hasStreaming:', hasStreamingMessage);
    
    if (mainScrollRef && (messageCount > 0 || hasStreamingMessage)) {
      queueMicrotask(() => {
        const scrollHeight = mainScrollRef.scrollHeight;
        const clientHeight = mainScrollRef.clientHeight;
        const currentScrollTop = mainScrollRef.scrollTop;
        
        console.log('[ChatPageLayoutView] Scroll metrics - scrollHeight:', scrollHeight, 'clientHeight:', clientHeight, 'currentScrollTop:', currentScrollTop);
        
        // For streaming messages, be more aggressive about auto-scrolling to prevent cutoff
        // Only auto-scroll if user is near the bottom (within 150px) or when streaming
        const isNearBottom = (scrollHeight - clientHeight - currentScrollTop) < 150;
        
        if (isNearBottom || hasStreamingMessage) {
          // Scroll to bottom with a small buffer to ensure content isn't cut off
          mainScrollRef.scrollTop = scrollHeight;
          console.log('[ChatPageLayoutView] Auto-scrolled to bottom - new scrollTop:', mainScrollRef.scrollTop);
        } else {
          console.log('[ChatPageLayoutView] Skipped auto-scroll - user scrolled up');
        }
      });
    }
  });

  // Stop VAD when speech mode is disabled
  createEffect(() => {
    if (!props.isSpeechModeActive && props.isVADListening) {
      console.log('[ChatPageLayoutView] speech mode disabled, stopping VAD');
      props.onStopVAD();
    }
  });
  // Ensure VAD stops when component unmounts
  onCleanup(() => {
    if (props.isVADListening) {
      console.log('[ChatPageLayoutView] component unmount, stopping VAD');
      props.onStopVAD();
    }
  });

  // --- Embedding Processing State & Handlers ---
  const messaging = defineExtensionMessaging<BackgroundProtocolMap>();
  const [pendingEmbeddingData, { refetch: refetchPendingEmbeddingCount }] = createResource(
    async () => {
      const res = await messaging.sendMessage('getPendingEmbeddingCount', undefined);
      return res ?? { count: 0 };
    },
    { initialValue: { count: 0 } }
  );
  const [isEmbedding, setIsEmbedding] = createSignal(false);
  const [embedStatusMessage, setEmbedStatusMessage] = createSignal<string | null>(null);
  const [processedCount, setProcessedCount] = createSignal(0);
  const [totalCount, setTotalCount] = createSignal(0);
  const settings = useSettings();

  const handleEmbedClick = async () => {
    setIsEmbedding(true);
    setEmbedStatusMessage('Starting embedding process...');
    try {
      const res = await messaging.sendMessage('getItemsNeedingEmbedding', undefined);
      const items = res.items ?? [];
      const total = items.length;
      setTotalCount(total);
      setProcessedCount(0);
      const embedCfg = settings.config.embeddingConfig;
      if (!embedCfg) {
        console.error('[Chat] Embedding configuration is missing.');
        setEmbedStatusMessage('Embedding not configured.');
        setIsEmbedding(false);
        return;
      }
      for (const [idx, item] of items.entries()) {
        const current = idx + 1;
        setProcessedCount(current);
        const itemType = item.type === 'page' ? 'page' : 'bookmark';
        setEmbedStatusMessage(`Embedding ${current} of ${total}...`);
        try {
          const result: EmbeddingResult | null = await getEmbedding(
            item.content,
            embedCfg
          );
          if (result) {
            await messaging.sendMessage('finalizeItemEmbedding', {
              type: item.type,
              id: item.id,
              embeddingInfo: result
            });
            console.log(`[Chat] Successfully embedded ${itemType} ${item.id}`);
          } else {
            console.error(`[Chat] Embedding returned null for ${itemType}:`, item.id);
          }
        } catch (e) {
          console.error(`[Chat] Error during embedding for ${itemType}:`, item.id, e);
        }
      }
      setEmbedStatusMessage('Embedding complete.');
      refetchPendingEmbeddingCount();
    } catch (e: any) {
      console.error('[Chat] Embedding pipeline error:', e);
      setEmbedStatusMessage(`Error: ${e.message || e}`);
    } finally {
      setIsEmbedding(false);
      setTimeout(() => setEmbedStatusMessage(null), 7000);
    }
  };

  return (
    <div class="flex flex-col h-screen bg-background text-foreground">
      <header class="flex items-center p-2 md:p-4 border-b border-border/40 bg-background z-10">
        <button onClick={props.onNavigateBack} class="mr-2 p-2 hover:cursor-pointer">
          <CaretLeft class="size-6" />
        </button>
        <Show when={(pendingEmbeddingData()?.count || 0) > 0 || isEmbedding()} fallback={<></>}>
          <EmbeddingProcessingPanel
            pendingEmbeddingCount={() => pendingEmbeddingData()?.count || 0}
            isEmbedding={isEmbedding}
            embedStatusMessage={embedStatusMessage}
            processedCount={processedCount}
            totalCount={totalCount}
            onProcessClick={handleEmbedClick}
            class="ml-auto"
          />
        </Show>
        <Switch
          checked={props.isSpeechModeActive} // This can also come from machineContext if preferred
          onChange={props.onToggleMode} // This sends TOGGLE_INPUT_MODE
          class="ml-2 flex items-center space-x-2"
        >
          <SwitchControl class="relative"><SwitchThumb /></SwitchControl>
          <SwitchLabel>Speech Mode</SwitchLabel>
        </Switch>
      </header>

      <div class="flex flex-1 overflow-hidden">
        <Show when={!props.isSpeechModeActive} fallback={<></>}>
          {(() => {
            console.log('[ChatPageLayoutView] Rendering ChatSidebar. isSpeechModeActive:', props.isSpeechModeActive, 'isRoleplayLoading:', props.isRoleplayLoading);
            return (
              <ChatSidebar
                threads={props.threads}
                currentThreadId={props.currentThreadId}
                onSelectThread={props.onSelectThread}
                onCreateThread={props.onCreateThread}
                onGenerateRoleplay={props.onGenerateRoleplay}
                onDeleteThread={props.onDeleteThread}
                isRoleplayLoading={props.isRoleplayLoading}
              />
            );
          })()}
        </Show>
        <div class="flex flex-col flex-1 overflow-hidden">
          <main ref={mainScrollRef} class="flex-1 overflow-y-auto">
            <div class="max-w-4xl mx-auto px-2 md:px-4">
              <Show when={!props.isSpeechModeActive} fallback={
                <div class="flex items-center justify-center h-full">
                  <SpeechVisualizer
                    listening={props.isVADListening}
                    processing={!props.isIdle}
                    speaking={props.isSpeaking}
                    audioLevel={props.audioLevel}
                  />
                </div>
              }>
                <ChatMessageArea messages={props.messages} description={props.threadSystemPrompt} />
              </Show>
            </div>
          </main>
          <div class="p-2 md:p-4 border-t border-border/40 bg-background">
            <div class="max-w-4xl mx-auto px-2 md:px-4">
              <Show when={!props.isSpeechModeActive} fallback={
                <>
                  <div class="flex items-center space-x-2">
                    <Show when={!props.isVADListening} fallback={<button class="btn btn-outline" onClick={props.onStopVAD}>Stop Recording</button>}>
                      <button class="btn btn-outline" onClick={props.onStartVAD}>Start Recording</button>
                    </Show>
                  </div>
                  <MicVisualizer active={props.isVADListening} />
                </>
              }>
                <TextInputControls
                  userInput={props.userInput}
                  onInputChange={props.onInputChange}
                  onSendMessage={props.onSendText}
                  isDisabled={!props.isIdle}
                />
              </Show>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 