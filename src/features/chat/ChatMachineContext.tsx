import { createContext, useContext, ParentComponent, createEffect } from 'solid-js';
import { useMachine } from '@xstate/solid';
import { chatOrchestratorMachine, ChatOrchestratorEvent, ChatOrchestratorContext } from './chatOrchestratorMachine'; // Assuming ChatOrchestratorContext is exported
import type { UserConfiguration } from '../../services/storage/types';
import type { StateFrom, ActorRefFrom } from 'xstate';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BackgroundProtocolMap, NewChatThreadDataForRpc } from '../../shared/messaging-types';
import type { Thread } from './types';

// Messaging client for RPC
const messaging = defineExtensionMessaging<BackgroundProtocolMap>();
const JUST_CHAT_THREAD_ID = '__just_chat_speech_mode__';

// Default threads to seed
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

interface ChatMachineContextValue {
  state: StateFrom<typeof chatOrchestratorMachine>;
  send: (event: ChatOrchestratorEvent) => void;
  actorRef: ActorRefFrom<typeof chatOrchestratorMachine>;
}

export interface ChatMachineProviderProps {
  initialUserConfig: UserConfiguration;
}

const ChatMachineContext = createContext<ChatMachineContextValue>();

export const ChatMachineProvider: ParentComponent<ChatMachineProviderProps> = (props) => {
  // We instantiate the machine with its default context here.
  // We'll send events to update it based on props in createEffect.
  const [state, send, actorRef] = useMachine(chatOrchestratorMachine);

  // Sync user configuration into machine
  createEffect(() => {
    send({ type: 'SET_USER_CONFIG', userConfig: props.initialUserConfig });
  });

  // On mount: load or seed threads, then fetch first thread's messages
  createEffect(() => {
    (async () => {
      try {
        let threads = await messaging.sendMessage('getAllChatThreads', undefined);
        if (threads.length === 0) {
          const intro = await messaging.sendMessage('addChatThread', defaultIntroThread);
          const sharing = await messaging.sendMessage('addChatThread', defaultSharingThread);
          const justChat = await messaging.sendMessage('addChatThread', defaultJustChatThread);
          threads = [intro, sharing, justChat].filter(Boolean) as Thread[];
        } else if (!threads.some(t => t.id === JUST_CHAT_THREAD_ID)) {
          const justChat = await messaging.sendMessage('addChatThread', defaultJustChatThread);
          threads.push(justChat);
        }
        send({ type: 'SET_THREADS', threads });
        const primary = threads.find(t => t.id !== JUST_CHAT_THREAD_ID) || threads[0];
        if (primary) {
          send({ type: 'SET_CURRENT_THREAD_ID', threadId: primary.id });
          const msgs = await messaging.sendMessage('getChatMessages', { threadId: primary.id });
          send({ type: 'SET_MESSAGES', messages: msgs });
        }
      } catch (e) {
        console.error('[ChatMachineContext] Error initializing threads:', e);
      }
    })();
  });

  const contextValue: ChatMachineContextValue = {
    state,
    send,
    actorRef,
  };

  return (
    <ChatMachineContext.Provider value={contextValue}>
      {props.children}
    </ChatMachineContext.Provider>
  );
};

export const useChatMachine = () => {
  const context = useContext(ChatMachineContext);
  if (!context) {
    throw new Error('useChatMachine must be used within a ChatMachineProvider');
  }
  return context;
}; 