import type { ChatMessage, Thread } from '../../../src/features/chat/types';
import { createContext, ParentComponent, Component, Show, createEffect, onCleanup, createRenderEffect, createSignal } from 'solid-js';
import { CaretLeft } from 'phosphor-solid';
import { Switch, SwitchControl, SwitchThumb, SwitchLabel } from '../../../src/components/ui/switch';
import { Motion } from 'solid-motionone';

const MOCK_THREAD_ID_1 = 'view-1';
const MOCK_THREAD_ID_2 = 'view-2';

// Mock SettingsContext for Storybook
const mockSettingsContext = {
  config: {
    embeddingConfig: { provider: 'local', model: 'test' },
    llmConfig: null,
    ttsConfig: null,
    targetLanguage: 'en',
    nativeLanguage: 'en',
    onboardingComplete: true,
    redirectSettings: {},
    enableFocusMode: false,
    focusModeBlockedDomains: [],
    learningMotivation: null,
  },
  loadStatus: () => 'ready' as const,
  llmProviderOptions: [],
  embeddingProviderOptions: [],
  ttsProviderOptions: [],
  updateLlmConfig: async () => {},
  updateEmbeddingConfig: async () => {},
  updateTtsConfig: async () => {},
  updateRedirectSetting: async () => {},
  updateFullRedirectSettings: async () => {},
  updateUserConfiguration: async () => {},
  handleSelectProvider: async () => {},
  handleSelectModel: async () => {},
  fetchModels: async () => [],
  getTransientState: () => ({
    localModels: () => [],
    remoteModels: () => [],
    fetchStatus: () => 'idle' as const,
    fetchError: () => null,
    testStatus: () => 'idle' as const,
    testError: () => null,
    showSpinner: () => false,
  }),
  testConnection: async () => {},
};

const MockSettingsContext = createContext(mockSettingsContext);

const MockSettingsProvider: ParentComponent = (props) => {
  return (
    <MockSettingsContext.Provider value={mockSettingsContext}>
      {props.children}
    </MockSettingsContext.Provider>
  );
};

// Mock components that match the real ones but avoid browser extension dependencies

const MockChatSidebar: Component<{
  threads: Thread[];
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onGenerateRoleplay: () => void;
  onDeleteThread: (threadId: string) => void;
  isRoleplayLoading: boolean;
}> = (props) => {
  const [hoveredThreadId, setHoveredThreadId] = createSignal<string | null>(null);

  const handleDeleteClick = (e: Event, threadId: string) => {
    e.stopPropagation();
    const thread = props.threads.find(t => t.id === threadId);
    const threadTitle = thread?.title || `Thread ${threadId.substring(0, 8)}`;
    if (confirm(`Are you sure you want to delete "${threadTitle}"?\n\nThis will permanently delete the conversation and cannot be undone.`)) {
      props.onDeleteThread(threadId);
    }
  };

  return (
    <aside class="hidden md:flex flex-col w-64 lg:w-72 border-r border-border/40 bg-muted/20">
      <div class="p-2 pt-4 overflow-y-auto flex-grow">
        <button
          class={`w-full justify-center mb-1 text-sm p-2 h-auto rounded flex items-center ${props.currentThreadId === null ? 'bg-secondary text-secondary-foreground' : 'bg-transparent hover:bg-accent'}`}
          onClick={props.onCreateThread}
          title="New Thread"
        >
          <span class="text-lg">+</span>
        </button>
        {props.threads.map(thread => (
          <div 
            class="relative group mb-1"
            onMouseEnter={() => setHoveredThreadId(thread.id)}
            onMouseLeave={() => setHoveredThreadId(null)}
          >
            <button
              class={`w-full justify-start text-sm p-2 h-auto text-left pr-10 rounded ${props.currentThreadId === thread.id ? 'bg-secondary text-secondary-foreground' : 'bg-transparent hover:bg-accent'}`}
              onClick={() => props.onSelectThread(thread.id)}
              title={thread.title}
            >
              <span class="block w-full truncate">
                {thread.title || `Thread ${thread.id.substring(0, 8)}`}
              </span>
            </button>
            {hoveredThreadId() === thread.id && (
              <button
                class="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 opacity-70 hover:opacity-100"
                onClick={(e) => handleDeleteClick(e, thread.id)}
                title="Delete thread"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div class="p-2 border-t border-border/40">
        <button
          class={`w-full flex justify-center p-2 rounded border ${props.isRoleplayLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'}`}
          onClick={props.onGenerateRoleplay}
          disabled={props.isRoleplayLoading}
        >
          {props.isRoleplayLoading ? <span class="animate-spin">⟳</span> : 'Generate Roleplay'}
        </button>
      </div>
    </aside>
  );
};

const MockChatMessageArea: Component<{
  messages: ChatMessage[];
  description?: string;
}> = (props) => (
  <div class="py-4 space-y-6 bg-background pb-20">
    {props.description && (
      <div class="mb-4 p-3 bg-muted/30 rounded border-l-4 border-primary/50 text-sm">
        {props.description}
      </div>
    )}
    <div class="space-y-4">
      {props.messages.map(message => (
        <div class={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
          <div class={`max-w-[75%] md:max-w-[70%] p-2 px-3 rounded-lg break-words ${
            message.sender === 'user' 
              ? 'bg-neutral-700 text-neutral-50 shadow-sm' 
              : 'bg-transparent text-foreground'
          } ${message.isStreaming ? 'animate-pulse' : ''}`}>
            <div class="text-md whitespace-pre-wrap break-words">{message.text_content}</div>
            {message.isStreaming && <div class="text-xs opacity-70 mt-1">Streaming...</div>}
          </div>
          {/* Minimal TTS icon for AI messages (like ChatGPT) */}
          {message.sender === 'ai' && !message.isStreaming && (
            <Motion
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, easing: 'ease-out' }}
            >
              <div class="mt-1 w-full max-w-[75%] md:max-w-[70%] px-3">
                <button 
                  class="inline-flex items-center justify-center rounded-md w-6 h-6 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  onClick={() => console.log('[Story] TTS dropdown clicked for message:', message.id)}
                  title="Play audio (dropdown available in real app)"
                >
                  <svg class="size-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
            </Motion>
          )}
        </div>
      ))}
    </div>
  </div>
);

const MockTextInputControls: Component<{
  userInput: string;
  onInputChange: (text: string) => void;
  onSendMessage: () => void;
  isDisabled?: boolean;
}> = (props) => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      props.onSendMessage();
    }
  };

  return (
    <div class="flex items-center space-x-2">
      <div class="w-full">
        <input
          type="text"
          placeholder="Ask anything..."
          value={props.userInput}
          onInput={(e) => props.onInputChange(e.currentTarget.value)}
          onKeyPress={handleKeyPress}
          disabled={props.isDisabled}
          class="w-full text-md md:text-base h-10 px-3 rounded border border-input bg-background"
        />
      </div>
      <button 
        onClick={props.onSendMessage} 
        class="h-10 w-10 p-0 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center"
        disabled={props.isDisabled || !props.userInput.trim()}
        aria-label="Send message"
      >
        <span class="text-sm">✈</span>
      </button>
    </div>
  );
};

const MockSpeechVisualizer: Component<{
  listening: boolean;
  processing: boolean;
  speaking: boolean;
  audioLevel: number;
}> = (props) => (
  <div class="w-16 h-16 rounded-full flex items-center justify-center text-white" style={{
    background: props.speaking ? '#22d3ee' : props.listening ? '#3b82f6' : props.processing ? '#f59e0b' : '#9ca3af',
    transform: props.speaking ? `scale(${1 + props.audioLevel * 0.3})` : 'scale(1)',
    transition: 'all 0.1s ease-out'
  }}>
    {props.listening ? '🎤' : props.processing ? '⚡' : props.speaking ? '🔊' : '●'}
  </div>
);

const MockMicVisualizer: Component<{
  active: boolean;
}> = (props) => (
  <div class="w-full h-8 bg-muted rounded flex items-center justify-center mt-2">
    <div class="text-sm">{props.active ? 'Recording...' : 'Ready'}</div>
  </div>
);

const MockEmbeddingProcessingPanel: Component<{
  pendingEmbeddingCount: () => number;
  isEmbedding: () => boolean;
  embedStatusMessage: () => string | null;
  processedCount: () => number;
  totalCount: () => number;
  onProcessClick: () => void;
  class?: string;
}> = (props) => {
  // Hide the panel when there's nothing to embed and not currently embedding
  if (!props.isEmbedding() && props.pendingEmbeddingCount() === 0) {
    return null;
  }

  // Determine button text and state
  const buttonContent = () => {
    const processed = props.processedCount();
    const total = props.totalCount();

    if (props.isEmbedding()) {
      return (
        <span class="flex items-center justify-center w-full">
          <span class="mr-2 animate-spin">⟳</span>
          Embedding...
          {(total > 0) && <span class="ml-2 text-sm">({processed}/{total})</span>}
        </span>
      );
    } else if (props.pendingEmbeddingCount() > 0) {
      return (
        <span class="flex items-center justify-center w-full">
          <span class="mr-2 font-bold">↻</span>
          Update Memory ({props.pendingEmbeddingCount()})
        </span>
      );
    } else {
      return (
        <span class="flex items-center justify-center w-full">
          Update Memory
        </span>
      );
    }
  };

  const isDisabled = () => {
    return props.isEmbedding() || props.pendingEmbeddingCount() === 0;
  };

  return (
    <button
      onClick={props.onProcessClick}
      disabled={isDisabled()}
      class={`w-[180px] px-3 py-2 text-sm rounded border ${props.pendingEmbeddingCount() > 0 && !props.isEmbedding() ? 'border-input hover:bg-accent' : 'bg-secondary text-secondary-foreground'} disabled:opacity-50 ${props.class ?? ''}`}
    >
      {buttonContent()}
    </button>
  );
};

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

// Mock ChatPageLayoutView that matches the real structure exactly
const MockChatPageLayoutView: Component<ChatPageLayoutViewProps> = (props) => {
  createEffect(() => {
    console.log('[MockChatPageLayoutView EFFECT] isRoleplayLoading prop:', props.isRoleplayLoading);
  });
  createEffect(() => {
    console.log('[MockChatPageLayoutView EFFECT] isSpeechModeActive prop:', props.isSpeechModeActive);
  });
  createEffect(() => {
    console.log('[MockChatPageLayoutView] threadSystemPrompt prop:', props.threadSystemPrompt);
  });

  // Scroll container ref for auto-scrolling (moved to the correct element)
  let mainScrollRef!: HTMLElement;

  // Auto-scroll to bottom when messages change - on the main element that actually scrolls
  createRenderEffect(() => {
    const messageCount = props.messages.length;
    const hasStreamingMessage = props.messages.some(m => m.isStreaming);
    
    console.log('[MockChatPageLayoutView] Auto-scroll trigger - messageCount:', messageCount, 'hasStreaming:', hasStreamingMessage);
    
    if (mainScrollRef && (messageCount > 0 || hasStreamingMessage)) {
      queueMicrotask(() => {
        const scrollHeight = mainScrollRef.scrollHeight;
        const clientHeight = mainScrollRef.clientHeight;
        const currentScrollTop = mainScrollRef.scrollTop;
        
        console.log('[MockChatPageLayoutView] Scroll metrics - scrollHeight:', scrollHeight, 'clientHeight:', clientHeight, 'currentScrollTop:', currentScrollTop);
        
        // For streaming messages, be more aggressive about auto-scrolling to prevent cutoff
        // Only auto-scroll if user is near the bottom (within 150px) or when streaming
        const isNearBottom = (scrollHeight - clientHeight - currentScrollTop) < 150;
        
        if (isNearBottom || hasStreamingMessage) {
          // Scroll to bottom with a small buffer to ensure content isn't cut off
          mainScrollRef.scrollTop = scrollHeight;
          console.log('[MockChatPageLayoutView] Auto-scrolled to bottom - new scrollTop:', mainScrollRef.scrollTop);
        } else {
          console.log('[MockChatPageLayoutView] Skipped auto-scroll - user scrolled up');
        }
      });
    }
  });

  // Stop VAD when speech mode is disabled
  createEffect(() => {
    if (!props.isSpeechModeActive && props.isVADListening) {
      console.log('[MockChatPageLayoutView] speech mode disabled, stopping VAD');
      props.onStopVAD();
    }
  });
  
  // Ensure VAD stops when component unmounts
  onCleanup(() => {
    if (props.isVADListening) {
      console.log('[MockChatPageLayoutView] component unmount, stopping VAD');
      props.onStopVAD();
    }
  });

  // Mock embedding state - start with 0 to be more realistic
  const [isEmbedding, setIsEmbedding] = createSignal(false);
  const [embedStatusMessage, setEmbedStatusMessage] = createSignal<string | null>(null);
  const [processedCount, setProcessedCount] = createSignal(0);
  const [totalCount, setTotalCount] = createSignal(0);
  const [pendingCount, setPendingCount] = createSignal(0); // Start with 0 like real app

  const handleEmbedClick = async () => {
    setIsEmbedding(true);
    setTotalCount(pendingCount());
    setProcessedCount(0);
    setEmbedStatusMessage('Starting embedding process...');
    
    // Simulate embedding process
    for (let i = 1; i <= pendingCount(); i++) {
      setProcessedCount(i);
      setEmbedStatusMessage(`Embedding ${i} of ${pendingCount()}...`);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    setEmbedStatusMessage('Embedding complete.');
    setPendingCount(0);
    setIsEmbedding(false);
    setTimeout(() => setEmbedStatusMessage(null), 3000);
  };

  return (
    <div class="flex flex-col h-screen bg-background text-foreground">
      <header class="flex items-center p-2 md:p-4 border-b border-border/40 bg-background z-10">
        <button onClick={props.onNavigateBack} class="mr-2 p-2 hover:cursor-pointer">
          <CaretLeft class="size-6" />
        </button>
        <Switch
          checked={props.isSpeechModeActive}
          onChange={props.onToggleMode}
          class="ml-auto flex items-center space-x-2"
        >
          <SwitchControl class="relative"><SwitchThumb /></SwitchControl>
          <SwitchLabel>Speech Mode</SwitchLabel>
        </Switch>
        <Show when={pendingCount() > 0 || isEmbedding()} fallback={<></>}>
          <MockEmbeddingProcessingPanel
            pendingEmbeddingCount={pendingCount}
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
            console.log('[MockChatPageLayoutView] Rendering ChatSidebar. isSpeechModeActive:', props.isSpeechModeActive, 'isRoleplayLoading:', props.isRoleplayLoading);
            return (
              <MockChatSidebar
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
            <div class="max-w-4xl mx-auto">
              <Show when={!props.isSpeechModeActive} fallback={
                <div class="flex items-center justify-center h-full">
                  <MockSpeechVisualizer
                    listening={props.isVADListening}
                    processing={!props.isIdle}
                    speaking={props.isSpeaking}
                    audioLevel={props.audioLevel}
                  />
                </div>
              }>
                <MockChatMessageArea messages={props.messages} description={props.threadSystemPrompt} />
              </Show>
            </div>
          </main>
          <div class="p-2 md:p-4 border-t border-border/40 bg-background">
            <div class="max-w-4xl mx-auto">
              <Show when={!props.isSpeechModeActive} fallback={
                <>
                  <div class="flex items-center space-x-2">
                    <Show when={!props.isVADListening} fallback={<button class="btn btn-outline" onClick={props.onStopVAD}>Stop Recording</button>}>
                      <button class="btn btn-outline" onClick={props.onStartVAD}>Start Recording</button>
                    </Show>
                  </div>
                  <MockMicVisualizer active={props.isVADListening} />
                </>
              }>
                <MockTextInputControls
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

const mockThreads: Thread[] = [
  { id: MOCK_THREAD_ID_1, title: 'SolidJS Discussion - A very long title to test truncation', lastActivity: '10m ago', messages: [] },
  { id: MOCK_THREAD_ID_2, title: 'Recipe Ideas', lastActivity: '2h ago', messages: [] },
];

const mockMessagesShort: ChatMessage[] = [
  { id: 'view-m1', thread_id: MOCK_THREAD_ID_1, sender: 'ai', text_content: 'Welcome to the chat! How can I assist?', timestamp: new Date().toISOString(), isStreaming: false },
  { id: 'view-m2', thread_id: MOCK_THREAD_ID_1, sender: 'user', text_content: 'Tell me more about SolidJS!', timestamp: new Date().toISOString(), isStreaming: false },
];

const generateLongMessages = (threadId: string): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < 15; i++) {
    messages.push({ id: `view-ai-${i}`, thread_id: threadId, sender: 'ai', text_content: `AI message ${i + 1} in a longer conversation. This message contains more text to demonstrate the auto-scroll functionality working correctly with longer content that spans multiple lines and requires the user to scroll down to see new messages as they arrive.`, timestamp: new Date(Date.now() - (20 - i) * 60000).toISOString(), isStreaming: false });
    messages.push({ id: `view-user-${i}`, thread_id: threadId, sender: 'user', text_content: `User reply ${i + 1} in a longer conversation. This is also a longer message to test the layout and scrolling behavior.`, timestamp: new Date(Date.now() - (19 - i) * 60000).toISOString(), isStreaming: false });
  }
  return messages;
};

const baseArgs: ChatPageLayoutViewProps = {
  threads: mockThreads,
  currentThreadId: MOCK_THREAD_ID_1,
  isSpeechModeActive: false,
  onNavigateBack: () => console.log('[Story] Navigate Back'),
  onSelectThread: (id: string) => console.log('[Story] Select Thread', id),
  onToggleMode: () => console.log('[Story] Toggle Mode'),
  onCreateThread: () => console.log('[Story] Create Thread'),
  onGenerateRoleplay: () => console.log('[Story] Generate Roleplay'),
  onDeleteThread: (id: string) => console.log('[Story] Delete Thread', id),
  isRoleplayLoading: false,
  messages: mockMessagesShort,
  userInput: '',
  onInputChange: (text: string) => console.log('[Story] Input Change', text),
  onSendText: () => console.log('[Story] Send Text'),
  isIdle: true,
  isVADListening: false,
  isSpeaking: false,
  audioLevel: 0,
  onStartVAD: () => console.log('[Story] Start VAD'),
  onStopVAD: () => console.log('[Story] Stop VAD'),
};

export default {
  title: 'Features/Chat/ChatPageLayoutView',
  component: MockChatPageLayoutView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story: any) => (
      <MockSettingsProvider>
        <Story />
      </MockSettingsProvider>
    ),
  ],
  args: baseArgs,
  argTypes: {
    threads: { control: 'object' },
    currentThreadId: { control: 'text' },
    isSpeechModeActive: { control: 'boolean' },
    messages: { control: 'object' },
    userInput: { control: 'text' },
    isIdle: { control: 'boolean' },
    onNavigateBack: { action: 'onNavigateBack' },
    onSelectThread: { action: 'onSelectThread' },
    onToggleMode: { action: 'onToggleMode' },
    onInputChange: { action: 'onInputChange' },
    onSendText: { action: 'onSendText' },
  },
};

export const TextMode = {
  render: (args: ChatPageLayoutViewProps) => <MockChatPageLayoutView {...args} />,
  args: {
    ...baseArgs,
    isSpeechModeActive: false,
  },
};


export const LongConversation = {
  render: (args: ChatPageLayoutViewProps) => <MockChatPageLayoutView {...args} />,
  args: {
    ...baseArgs,
    messages: generateLongMessages(MOCK_THREAD_ID_1),
  },
  parameters: {
    docs: {
      description: {
        story: 'This story shows a long conversation to test scrolling behavior. Messages should auto-scroll to the bottom when new messages arrive. **Test the auto-scroll:** 1) Scroll up manually 2) The auto-scroll should not interfere 3) Scroll near the bottom (within 100px) and it should auto-scroll to new messages.'
      }
    }
  }
};

export const NoThreads = {
  render: (args: ChatPageLayoutViewProps) => <MockChatPageLayoutView {...args} />,
  args: {
    ...baseArgs,
    threads: [],
    currentThreadId: null,
    messages: [],
  },
};

export const NoActiveThread = {
  render: (args: ChatPageLayoutViewProps) => <MockChatPageLayoutView {...args} />,
  args: {
    ...baseArgs,
    currentThreadId: null,
    messages: [],
  },
}; 