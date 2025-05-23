import { Component, Show, createEffect, onCleanup, createSignal, createResource } from 'solid-js';
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
      const res = await messaging.sendMessage('getPagesNeedingEmbedding', undefined);
      const pages = res.pages ?? [];
      const total = pages.length;
      setTotalCount(total);
      setProcessedCount(0);
      const embedCfg = settings.config.embeddingConfig;
      if (!embedCfg) {
        console.error('[Chat] Embedding configuration is missing.');
        setEmbedStatusMessage('Embedding not configured.');
        setIsEmbedding(false);
        return;
      }
      for (const [idx, page] of pages.entries()) {
        const current = idx + 1;
        setProcessedCount(current);
        setEmbedStatusMessage(`Embedding ${current} of ${total}...`);
        try {
          const result: EmbeddingResult | null = await getEmbedding(
            page.markdownContent,
            embedCfg
          );
          if (result) {
            await messaging.sendMessage('finalizePageVersionEmbedding', {
              versionId: page.versionId,
              embeddingInfo: result
            });
          } else {
            console.error('[Chat] Embedding returned null for version:', page.versionId);
          }
        } catch (e) {
          console.error('[Chat] Error during embedding for version:', page.versionId, e);
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
        <button onClick={props.onNavigateBack} class="mr-2 p-2">
          <CaretLeft class="size-6" />
        </button>
        <Switch
          checked={props.isSpeechModeActive} // This can also come from machineContext if preferred
          onChange={props.onToggleMode} // This sends TOGGLE_INPUT_MODE
          class="ml-auto flex items-center space-x-2"
        >
          <SwitchControl class="relative"><SwitchThumb /></SwitchControl>
          <SwitchLabel>Speech Mode</SwitchLabel>
        </Switch>
        <Show when={(pendingEmbeddingData()?.count || 0) > 0 || isEmbedding()} fallback={<></>}>
          <EmbeddingProcessingPanel
            pendingEmbeddingCount={() => pendingEmbeddingData()?.count || 0}
            isEmbedding={isEmbedding}
            embedStatusMessage={embedStatusMessage}
            processedCount={processedCount}
            totalCount={totalCount}
            onProcessClick={handleEmbedClick}
            class="ml-2"
          />
        </Show>
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
                isRoleplayLoading={props.isRoleplayLoading}
              />
            );
          })()}
        </Show>
        <div class="flex flex-col flex-1 overflow-hidden">
          <main class="flex-1 overflow-y-auto">
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
          </main>
          <div class="p-2 md:p-4 border-t border-border/40 bg-background">
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
  );
}; 