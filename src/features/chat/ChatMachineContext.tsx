import { createContext, useContext, ParentComponent, createEffect } from 'solid-js';
import { useMachine } from '@xstate/solid';
import { chatOrchestratorMachine, ChatOrchestratorEvent, ChatOrchestratorContext } from './chatOrchestratorMachine'; // Assuming ChatOrchestratorContext is exported
import type { Thread, ChatMessage } from './types';
import type { UserConfiguration } from '../../services/storage/types';
import type { StateFrom, ActorRefFrom } from 'xstate';

interface ChatMachineContextValue {
  state: StateFrom<typeof chatOrchestratorMachine>;
  send: (event: ChatOrchestratorEvent) => void;
  actorRef: ActorRefFrom<typeof chatOrchestratorMachine>;
}

export interface ChatMachineProviderProps {
  initialThreads: Thread[];
  initialCurrentThreadId: string | null;
  initialMessages: ChatMessage[];
  initialUserConfig: UserConfiguration;
  // Add any other initial data the machine might need from App.tsx
}

const ChatMachineContext = createContext<ChatMachineContextValue>();

export const ChatMachineProvider: ParentComponent<ChatMachineProviderProps> = (props) => {
  // We instantiate the machine with its default context here.
  // We'll send events to update it based on props in createEffect.
  const [state, send, actorRef] = useMachine(chatOrchestratorMachine);

  // Effect to update machine context when initial props change
  createEffect(() => {
    console.log('[ChatMachineContext] Props changed, sending SYNC_INITIAL_DATA');
    send({
      type: 'SYNC_INITIAL_DATA',
      threads: props.initialThreads,
      currentThreadId: props.initialCurrentThreadId,
      messages: props.initialMessages,
      userConfig: props.initialUserConfig,
    });
  });

  // Potentially, more specific effects if only certain props trigger certain events
  createEffect(() => {
    if (props.initialCurrentThreadId && props.initialCurrentThreadId !== state.context.currentThreadId) {
      console.log('[ChatMachineContext] initialCurrentThreadId prop changed, sending SET_CURRENT_THREAD_ID');
      send({ type: 'SET_CURRENT_THREAD_ID', threadId: props.initialCurrentThreadId });
    }
  });

  createEffect(() => {
    // This might be too aggressive if messages update frequently from other sources within the machine.
    // Consider if this is only for initial hydration or if App.tsx truly is the single source of truth for messages displayed.
    // console.log('[ChatMachineContext] initialMessages prop changed, sending SET_MESSAGES');
    // send({ type: 'SET_MESSAGES', messages: props.initialMessages });
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