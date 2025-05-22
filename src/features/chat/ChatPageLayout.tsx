import { Component, createEffect } from 'solid-js';
import { fromActorRef } from '@xstate/solid';
import { chatService } from './chatOrchestratorMachine';
import { ChatPageLayoutView } from './ChatPageLayoutView';
// import { servicios } from '../../services'; // Removed problematic import
import type { ChatOrchestratorEvent, ChatOrchestratorState } from './chatOrchestratorMachine';

interface ChatPageLayoutProps {
  onNavigateBack: () => void;
}

export const ChatPageLayout: Component<ChatPageLayoutProps> = (props) => {
  // Use singleton chat service actor
  const actorRef = chatService;
  const state = fromActorRef(actorRef) as () => ChatOrchestratorState;
  const send = actorRef.send;

  createEffect(() => {
    const currentState = state();
    console.log('[ChatPageLayout] Machine state (from context):', currentState.value);
    console.log('[ChatPageLayout] Machine context (from context):', currentState.context);
  });
  
  // Derive props from machine context
  const threads = () => state().context.threads;
  const messages = state().context.currentChatMessages;

  return (
    <ChatPageLayoutView
      threads={threads()}
      currentThreadId={state().context.currentThreadId}
      onNavigateBack={props.onNavigateBack}
      onSelectThread={(threadId) => {
        send({ type: 'SET_CURRENT_THREAD_ID', threadId } as ChatOrchestratorEvent);
        send({ type: 'CLEAR_ERROR' } as ChatOrchestratorEvent);
      }}
      isSpeechModeActive={state().context.isSpeechModeActive}
      onToggleMode={() => send({ type: 'TOGGLE_INPUT_MODE' } as ChatOrchestratorEvent)}
      messages={messages}
      userInput={state().context.userInput}
      onInputChange={(text) => send({ type: 'TEXT_INPUT_CHANGE', text } as ChatOrchestratorEvent)}
      onSendText={() => {
        console.log('[ChatPageLayout] onSendText triggered');
        console.log('[ChatPageLayout] actorRef:', actorRef);
        console.log('[ChatPageLayout] current userInput:', state().context.userInput);
        send({ type: 'SEND_TEXT_MESSAGE', text: state().context.userInput } as ChatOrchestratorEvent);
      }}
      machineStateValue={state().value}
      machineContext={state().context}
      sendToMachine={send}
      isIdle={state().matches('idle')}
    />
  );
}; 