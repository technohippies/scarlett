import { Component, createEffect, onCleanup } from 'solid-js';
import { useChatMachine } from './ChatMachineContext';
import { ChatPageLayoutView } from './ChatPageLayoutView';
// import { servicios } from '../../services'; // Removed problematic import
import type { ChatOrchestratorEvent, ChatOrchestratorState } from './chatOrchestratorMachine';

interface ChatPageLayoutProps {
  onNavigateBack: () => void;
}

export const ChatPageLayout: Component<ChatPageLayoutProps> = (props) => {
  const machine = useChatMachine();
  const machineState = machine.state;

  createEffect(() => {
    const currentState = machineState as ChatOrchestratorState;
    console.log('[ChatPageLayout] Machine state (from context):', currentState.value);
    console.log('[ChatPageLayout] Machine context (from context):', currentState.context);
  });
  
  onCleanup(() => machine.actorRef?.stop?.());

  // Derive props from machine context
  const threads = () => machineState.context.threads;
  const messages = machineState.context.currentChatMessages;

  return (
    <ChatPageLayoutView
      threads={threads()}
      currentThreadId={machineState.context.currentThreadId}
      onNavigateBack={props.onNavigateBack}
      onSelectThread={(threadId) => {
        machine.send({ type: 'SET_CURRENT_THREAD_ID', threadId } as ChatOrchestratorEvent);
        machine.send({ type: 'CLEAR_ERROR' } as ChatOrchestratorEvent);
      }}
      isSpeechModeActive={machineState.context.isSpeechModeActive}
      onToggleMode={() => machine.send({ type: 'TOGGLE_INPUT_MODE' } as ChatOrchestratorEvent)}
      messages={messages}
      userInput={machineState.context.userInput}
      onInputChange={(text) => machine.send({ type: 'TEXT_INPUT_CHANGE', text } as ChatOrchestratorEvent)}
      onSendText={() => machine.send({ type: 'SEND_TEXT_MESSAGE' } as ChatOrchestratorEvent)}
      machineStateValue={machineState.value}
      machineContext={machineState.context}
      sendToMachine={machine.send}
      isIdle={machineState.matches('idle')}
    />
  );
}; 