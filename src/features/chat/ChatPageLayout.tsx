import { Component, createEffect, onCleanup } from 'solid-js';
import { useChatMachine } from './ChatMachineContext';
import { ChatPageLayoutView } from './ChatPageLayoutView';
import type { Thread } from './types';
import type { ChatOrchestratorEvent, ChatOrchestratorState } from './chatOrchestratorMachine';

interface ChatPageLayoutProps {
  initialThreads: Thread[];
  onSendMessage: (text: string, threadId: string, isUserMessage: boolean) => Promise<void>;
  onSelectThread: (threadId: string) => void;
  onNavigateBack: () => void;
}

export const ChatPageLayout: Component<ChatPageLayoutProps> = (props) => {
  const { state, send, actorRef } = useChatMachine();

  createEffect(() => {
    const currentState = state as ChatOrchestratorState;
    console.log('[ChatPageLayout] Machine state (from context):', currentState.value);
    console.log('[ChatPageLayout] Machine context (from context):', currentState.context);
  });
  
  onCleanup(() => {
    actorRef?.stop?.();
  });

  const machineState = state as ChatOrchestratorState;

  return (
    <ChatPageLayoutView
      threads={props.initialThreads}
      currentThreadId={machineState.context.currentThreadId}
      onNavigateBack={props.onNavigateBack}
      onSelectThread={(threadId) => {
        send({ type: 'SET_CURRENT_THREAD_ID', threadId } as ChatOrchestratorEvent);
        send({ type: 'CLEAR_ERROR' } as ChatOrchestratorEvent);
        props.onSelectThread(threadId);
      }}
      isSpeechModeActive={machineState.context.isSpeechModeActive}
      onToggleMode={() => send({ type: 'TOGGLE_INPUT_MODE' } as ChatOrchestratorEvent)}
      messages={machineState.context.currentChatMessages}
      userInput={machineState.context.userInput}
      onInputChange={(text) => send({ type: 'TEXT_INPUT_CHANGE', text } as ChatOrchestratorEvent)}
      onSendText={() => send({ type: 'SEND_TEXT_MESSAGE' } as ChatOrchestratorEvent)}
      machineStateValue={machineState.value}
      machineContext={machineState.context}
      sendToMachine={send}
      isIdle={machineState.matches('idle')}
    />
  );
}; 