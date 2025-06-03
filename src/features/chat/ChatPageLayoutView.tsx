import { Component, Show, createEffect, onCleanup, createSignal, createResource, createRenderEffect, onMount } from 'solid-js';
import { CaretLeft } from 'phosphor-solid';
import { Switch, SwitchControl, SwitchThumb, SwitchLabel } from '../../components/ui/switch';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessageArea } from './ChatMessageArea';
import { TextInputControls } from './TextInputControls';
import { SpeechInputControls } from './SpeechInputControls';
import { MicVisualizer } from '../../components/ui/MicVisualizer';
import { SpeechVisualizer } from '../../components/ui/SpeechVisualizer';
import type { Thread, ChatMessage } from './types';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BackgroundProtocolMap } from '../../shared/messaging-types';
import { EmbeddingProcessingPanel } from '../embedding/EmbeddingProcessingPanel';
import { getEmbedding, type EmbeddingResult } from '../../services/llm/embedding';
import { useSettings } from '../../context/SettingsContext';
import type { Messages } from '../../types/i18n';

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
  isVoiceConversationActive: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  onStartVoiceConversation: () => void;
  onStartVAD: () => void;
  onStopVAD: () => void;
  // New props for pagination
  onLoadOlderMessages?: () => void;
  hasOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  // Localization
  i18nMessages?: Messages;
}

const MESSAGES_PER_PAGE = 50;
const SCROLL_THRESHOLD = 100; // px from top to trigger loading older messages

export const ChatPageLayoutView: Component<ChatPageLayoutViewProps> = (props) => {
  // Localization helper
  const getLocalizedString = (key: string, fallback: string) => {
    return props.i18nMessages?.[key]?.message || fallback;
  };

  createEffect(() => {
    console.log('[ChatPageLayoutView EFFECT] isRoleplayLoading prop:', props.isRoleplayLoading);
  });
  createEffect(() => {
    console.log('[ChatPageLayoutView EFFECT] isSpeechModeActive prop:', props.isSpeechModeActive);
  });
  createEffect(() => {
    console.log('[ChatPageLayoutView] threadSystemPrompt prop:', props.threadSystemPrompt);
  });
  createEffect(() => {
    console.log('[ChatPageLayoutView] Voice conversation props - isVoiceConversationActive:', props.isVoiceConversationActive, 'onStartVoiceConversation:', typeof props.onStartVoiceConversation);
  });

  // Scroll container ref for auto-scrolling
  let mainScrollRef!: HTMLElement;
  
  // Track if this is the initial load to force scroll to bottom
  const [isInitialLoad, setIsInitialLoad] = createSignal(true);
  const [shouldScrollToBottom, setShouldScrollToBottom] = createSignal(false);

  // Handle initial scroll to bottom when messages first load
  onMount(() => {
    if (mainScrollRef && props.messages.length > 0) {
      // Use setTimeout to ensure DOM is fully rendered
      setTimeout(() => {
        if (mainScrollRef) {
          mainScrollRef.scrollTop = mainScrollRef.scrollHeight;
          console.log('[ChatPageLayoutView] Initial scroll to bottom completed');
          setIsInitialLoad(false);
        }
      }, 100);
    } else {
      setIsInitialLoad(false);
    }
  });

  // Store scroll state for smooth restoration
  const [scrollRestoreData, setScrollRestoreData] = createSignal<{
    previousScrollHeight: number;
    previousScrollTop: number;
  } | null>(null);

  // Handle scroll events for loading older messages
  const handleScroll = () => {
    if (!mainScrollRef || !props.onLoadOlderMessages || props.isLoadingOlderMessages) return;
    
    const scrollTop = mainScrollRef.scrollTop;
    
    // If user scrolls near the top and there are older messages, load them
    if (scrollTop < SCROLL_THRESHOLD && props.hasOlderMessages) {
      console.log('[ChatPageLayoutView] Loading...');
      
      // Store current scroll position to maintain it after loading
      const previousScrollHeight = mainScrollRef.scrollHeight;
      const previousScrollTop = mainScrollRef.scrollTop;
      
      setScrollRestoreData({
        previousScrollHeight,
        previousScrollTop
      });
      
      props.onLoadOlderMessages();
    }
  };

  // Watch for loading completion to restore scroll position smoothly
  createEffect(() => {
    if (!props.isLoadingOlderMessages && scrollRestoreData()) {
      // Use requestAnimationFrame for smooth scroll restoration
      requestAnimationFrame(() => {
        if (mainScrollRef && scrollRestoreData()) {
          const data = scrollRestoreData()!;
          const newScrollHeight = mainScrollRef.scrollHeight;
          const heightDifference = newScrollHeight - data.previousScrollHeight;
          const newScrollTop = data.previousScrollTop + heightDifference;
          
          // Use smooth scrolling for better UX
          mainScrollRef.scrollTo({
            top: newScrollTop,
            behavior: 'auto' // Keep auto for instant positioning, but smooth DOM updates
          });
          
          console.log('[ChatPageLayoutView] Smoothly restored scroll position after loading older messages');
          setScrollRestoreData(null);
        }
      });
    }
  });

  // Auto-scroll to bottom when messages change
  createRenderEffect(() => {
    const messageCount = props.messages.length;
    const hasStreamingMessage = props.messages.some(m => m.isStreaming);
    
    console.log('[ChatPageLayoutView] Auto-scroll trigger - messageCount:', messageCount, 'hasStreaming:', hasStreamingMessage, 'isInitialLoad:', isInitialLoad());
    
    if (mainScrollRef && (messageCount > 0 || hasStreamingMessage)) {
      queueMicrotask(() => {
        const scrollHeight = mainScrollRef.scrollHeight;
        const clientHeight = mainScrollRef.clientHeight;
        const currentScrollTop = mainScrollRef.scrollTop;
        
        console.log('[ChatPageLayoutView] Scroll metrics - scrollHeight:', scrollHeight, 'clientHeight:', clientHeight, 'currentScrollTop:', currentScrollTop);
        
        // Always scroll to bottom on initial load, or when streaming, or when user is near bottom
        const isNearBottom = (scrollHeight - clientHeight - currentScrollTop) < 150;
        
        if (isInitialLoad() || hasStreamingMessage || isNearBottom || shouldScrollToBottom()) {
          // Scroll to bottom with a small buffer to ensure content isn't cut off
          mainScrollRef.scrollTop = scrollHeight;
          console.log('[ChatPageLayoutView] Auto-scrolled to bottom - new scrollTop:', mainScrollRef.scrollTop);
          setShouldScrollToBottom(false);
        } else {
          console.log('[ChatPageLayoutView] Skipped auto-scroll - user scrolled up');
        }
      });
    }
  });

  // Watch for thread changes to scroll to bottom
  createEffect(() => {
    const currentThreadId = props.currentThreadId;
    if (currentThreadId) {
      console.log('[ChatPageLayoutView] Thread changed, scheduling scroll to bottom');
      setShouldScrollToBottom(true);
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
        {/* Flexible spacer to always push Switch to the right */}
        <div class="flex-1"></div>
        <Switch
          checked={props.isSpeechModeActive} // This can also come from machineContext if preferred
          onChange={props.onToggleMode} // This sends TOGGLE_INPUT_MODE
          class="flex items-center space-x-2"
        >
          <SwitchControl class="relative"><SwitchThumb /></SwitchControl>
          <SwitchLabel>{getLocalizedString('chatPageSpeechMode', 'Speech Mode')}</SwitchLabel>
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
                // Embedding props
                pendingEmbeddingCount={() => pendingEmbeddingData()?.count || 0}
                isEmbedding={isEmbedding}
                embedStatusMessage={embedStatusMessage}
                processedCount={processedCount}
                totalCount={totalCount}
                onEmbedClick={handleEmbedClick}
                showEmbeddingPanel={(pendingEmbeddingData()?.count || 0) > 0 || isEmbedding()}
                messages={props.i18nMessages}
              />
            );
          })()}
        </Show>
        <div class="flex flex-col flex-1 overflow-hidden">
          <main ref={mainScrollRef} class="flex-1 overflow-y-auto" onScroll={handleScroll}>
            <div class="max-w-4xl mx-auto px-2 md:px-4">
              <Show when={!props.isSpeechModeActive} fallback={
                <div class="flex items-center justify-center h-full pt-24">
                  <SpeechVisualizer
                    listening={props.isVADListening}
                    processing={!props.isIdle}
                    speaking={props.isSpeaking}
                    audioLevel={props.audioLevel}
                  />
                </div>
              }>
                {/* Loading indicator for older messages */}
                <Show when={props.isLoadingOlderMessages}>
                  <div class="flex justify-center py-4 animate-in fade-in duration-200">
                    <div class="text-sm text-muted-foreground flex items-center bg-background/80 backdrop-blur-sm px-3 py-2 rounded-full border border-border/40">
                      <span class="mr-2 animate-spin">⟳</span>
                      {getLocalizedString('chatPageLoadingOlderMessages', 'Loading...')}
                    </div>
                  </div>
                </Show>
                <ChatMessageArea messages={props.messages} description={props.threadSystemPrompt} i18nMessages={props.i18nMessages} />
              </Show>
            </div>
          </main>
          <div class="p-2 md:p-4 border-t border-border/40 bg-background">
            <div class="max-w-4xl mx-auto px-2 md:px-4">
              <Show when={!props.isSpeechModeActive} fallback={
                <SpeechInputControls
                  isVADListening={props.isVADListening}
                  isVoiceConversationActive={props.isVoiceConversationActive}
                  isSpeaking={props.isSpeaking}
                  onStartVoiceConversation={props.onStartVoiceConversation}
                  onStopVAD={props.onStopVAD}
                  messages={props.i18nMessages}
                />
              }>
                <TextInputControls
                  userInput={props.userInput}
                  onInputChange={props.onInputChange}
                  onSendMessage={props.onSendText}
                  isDisabled={!props.isIdle}
                  messages={props.i18nMessages}
                />
              </Show>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 