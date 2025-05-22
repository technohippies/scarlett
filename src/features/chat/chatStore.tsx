import { createStore } from 'solid-js/store';
import { createContext, ParentComponent, useContext, createEffect } from 'solid-js';
import { getAiChatResponseStream } from '../../services/llm/llmChatService';
import type { LLMConfig, StreamedChatResponsePart } from '../../services/llm/types';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BackgroundProtocolMap, NewChatThreadDataForRpc } from '../../shared/messaging-types';
import type { Thread, ChatMessage } from './types';
import type { UserConfiguration } from '../../services/storage/types';
import type { LLMProviderId } from '../../services/llm/types';

// RPC client for background storage
const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

// Default threads to seed
const JUST_CHAT_THREAD_ID = '__just_chat_speech_mode__';
const defaultIntroThread: NewChatThreadDataForRpc = {
  id: 'thread-welcome-introductions',
  title: 'Introductions',
  systemPrompt: "I'm Scarlett, your friendly AI language companion. I'd love to get to know you a bit! Tell me about yourself - what are your interests, what languages are you learning, or anything else you'd like to share?"
};
const defaultSharingThread: NewChatThreadDataForRpc = {
  id: 'thread-welcome-sharing',
  title: 'Sharing Thoughts',
  systemPrompt: "It's great to connect on a deeper level. As an AI, I have a unique perspective. I can share some 'AI thoughts' or how I learn if you're curious, and I'm always here to listen to yours. What's on your mind, or what would you like to ask me?"
};
const defaultJustChatThread: NewChatThreadDataForRpc = {
  id: JUST_CHAT_THREAD_ID,
  title: 'Just Chat (Speech)',
  systemPrompt: 'You are a friendly AI assistant for voice chat. Keep responses concise for speech.'
};

export interface ChatState {
  threads: Thread[];
  currentThreadId: string | null;
  messages: ChatMessage[];
  userInput: string;
  isSpeechMode: boolean;
  isLoading: boolean;
  lastError: string | null;
}

export interface ChatActions {
  loadThreads: () => Promise<void>;
  selectThread: (id: string) => Promise<void>;
  sendText: () => Promise<void>;
  setInput: (text: string) => void;
  toggleSpeech: () => void;
}

// Props for ChatProvider now include userConfig
export interface ChatProviderProps { initialUserConfig: UserConfiguration; }

// Default empty state and no-op actions for context fallback
const defaultState: ChatState = {
  threads: [],
  currentThreadId: null,
  messages: [],
  userInput: '',
  isSpeechMode: false,
  isLoading: false,
  lastError: null
};
const defaultActions: ChatActions = {
  loadThreads: async () => {},
  selectThread: async () => {},
  sendText: async () => {},
  setInput: () => {},
  toggleSpeech: () => {}
};
// @ts-ignore: suppress createContext overload mismatch
const ChatContext = createContext<[ChatState, ChatActions]>([defaultState, defaultActions]);

export const ChatProvider: ParentComponent<ChatProviderProps> = (props) => {
  const [state, setState] = createStore<ChatState>({
    threads: [],
    currentThreadId: null,
    messages: [],
    userInput: '',
    isSpeechMode: false,
    isLoading: false,
    lastError: null,
  });

  const actions: ChatActions = {
    async loadThreads() {
      console.log('[chatStore] loadThreads called');
      try {
        let threads = await messaging.sendMessage('getAllChatThreads', undefined);
        console.log('[chatStore] fetched threads:', threads);
        // seed defaults if empty
        if (!threads || threads.length === 0) {
          console.log('[chatStore] no threads found, seeding defaults');
          const created = await Promise.all([
            defaultIntroThread,
            defaultSharingThread,
            defaultJustChatThread
          ].map(d => messaging.sendMessage('addChatThread', d)));
          console.log('[chatStore] default threads created:', created);
          threads = (created.filter(Boolean) as any);
          // seed systemPrompts
          for (const th of threads) {
            console.log('[chatStore] seeding message for thread', th.id);
            if ((th as any).systemPrompt) {
              await messaging.sendMessage('addChatMessage', {
                id: `msg-ai-seed-${th.id}-${Date.now()}`,
                thread_id: th.id,
                sender: 'ai',
                text_content: (th as any).systemPrompt
              });
            }
          }
        }
        console.log('[chatStore] final thread list:', threads);
        setState('threads', threads || []);
        // select first non-just-chat as primary, else first
        if (threads && threads.length > 0) {
          console.log('[chatStore] selecting initial thread');
          const primary = threads.find((t: any) => t.id !== JUST_CHAT_THREAD_ID) || threads[0];
          await actions.selectThread(primary.id);
        }
      } catch (e: any) {
        setState('lastError', e.message || String(e));
      }
    },

    async selectThread(id) {
      console.log('[chatStore] selectThread called, id=', id);
      setState({ currentThreadId: id, isLoading: true, lastError: null });
      try {
        const msgs: ChatMessage[] = await messaging.sendMessage('getChatMessages', { threadId: id });
        console.log('[chatStore] fetched messages for', id, msgs);
        setState({ messages: msgs || [] });
      } catch (e: any) {
        setState('lastError', e.message || String(e));
      } finally {
        setState('isLoading', false);
      }
    },

    async sendText() {
      console.log('[chatStore] sendText called, userInput=', state.userInput);
      const text = state.userInput.trim();
      if (!text || !state.currentThreadId) return;
      setState('isLoading', true);
      setState('lastError', null);

      const userMsg: ChatMessage = {
        id: `${state.currentThreadId}-user-${Date.now()}`,
        thread_id: state.currentThreadId,
        sender: 'user',
        text_content: text,
        timestamp: new Date().toISOString(),
      };
      const aiPlaceholder: ChatMessage = {
        id: `${state.currentThreadId}-ai-${Date.now()}`,
        thread_id: state.currentThreadId,
        sender: 'ai',
        text_content: '',
        timestamp: new Date().toISOString(),
      };
      // Capture placeholder metadata for later persistence
      const placeholderId = aiPlaceholder.id;
      const placeholderTs = aiPlaceholder.timestamp;
      setState('messages', msgs => {
        console.log('[chatStore] appending user and placeholder', userMsg, aiPlaceholder);
        return [...msgs, userMsg, aiPlaceholder];
      });
      // Persist the user's message
      try {
        await messaging.sendMessage('addChatMessage', userMsg);
      } catch (e: any) {
        console.error('[chatStore] failed to persist user message', e);
      }

      // Buffer for AI response
      let full = '';
      try {
        // build LLMConfig from user-provided configuration
        const fc = props.initialUserConfig.llmConfig;
        if (!fc) {
          setState('lastError', 'LLM not configured in settings');
          return;
        }
        const llmConfig: LLMConfig = {
          provider: fc.providerId as LLMProviderId,
          model: fc.modelId,
          baseUrl: fc.baseUrl || '',
          apiKey: fc.apiKey || undefined,
          stream: true
        };
        // Map our ChatMessage type to LLM ChatMessage format
        const historyForLLM = state.messages.map(m => ({
          role: m.sender === 'ai' ? 'assistant' : 'user',
          content: m.text_content
        }));
        console.log('[chatStore] historyForLLM:', historyForLLM);
        const stream = getAiChatResponseStream(
          historyForLLM as any,
          text,
          llmConfig,
          {}
        ) as AsyncGenerator<StreamedChatResponsePart>;
        for await (const part of stream) {
          console.log('[chatStore] received stream part', part);
          if (part.type === 'content') {
            full += part.content;
          } else if (part.type === 'error') {
            setState('lastError', part.error);
            break;
          }
          // Patch the last AI message text via path-based setter
          const lastIndex = state.messages.length - 1;
          if (lastIndex >= 0) {
            setState('messages', lastIndex, 'text_content', full);
          }
          console.log('[chatStore] updated AI message to', full);
        }
      } catch (e: any) {
        setState('lastError', e.message || String(e));
      } finally {
        // Persist the AI's completed response (DB will timestamp)
        try {
          await messaging.sendMessage('addChatMessage', {
            id: placeholderId,
            thread_id: aiPlaceholder.thread_id,
            sender: aiPlaceholder.sender,
            text_content: full
          });
        } catch (e: any) {
          console.error('[chatStore] failed to persist AI message', e);
        }
        setState({ isLoading: false, userInput: '' });
        console.log('[chatStore] sendText complete');
      }
    },

    setInput(text) {
      setState('userInput', text);
    },

    toggleSpeech() {
      setState('isSpeechMode', mode => !mode);
    }
  };

  createEffect(() => {
    actions.loadThreads();
  });

  return (
    <ChatContext.Provider value={[state, actions]}>
      {props.children}
    </ChatContext.Provider>
  );
};

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
} 