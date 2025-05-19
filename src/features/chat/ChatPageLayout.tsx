import { Component, createEffect, onCleanup } from 'solid-js';
import { useActor } from '@xstate/solid';
import { chatOrchestratorMachine, ChatOrchestratorEvent, ChatOrchestratorActorRef, ChatOrchestratorState } from './chatOrchestratorMachine';
import { ChatPageLayoutView } from './ChatPageLayoutView';
import type { Thread, ChatMessage } from './types';
import type { UserConfiguration } from '../../services/storage/types';

interface ChatPageLayoutProps {
  // Props that might be needed to initialize the machine's context
  initialThreads: Thread[];
  initialMessages: ChatMessage[];
  initialUserConfig: UserConfiguration;
  initialCurrentThreadId: string | null;
  
  // Callbacks for actions that the machine might not directly handle,
  // or that need to interact with services outside the machine's scope.
  // For instance, if messages are managed by a parent store/service.
  onSendMessage: (text: string, threadId: string, isUserMessage: boolean) => Promise<void>;
  onSelectThread: (threadId: string) => void;
  onNavigateBack: () => void;
}

export const ChatPageLayout: Component<ChatPageLayoutProps> = (props) => {
  const [state, send, actorRef] = useActor(chatOrchestratorMachine as any);

  createEffect(() => {
    const currentState = state as ChatOrchestratorState;
    console.log('[ChatPageLayout] Machine state:', currentState.value);
    console.log('[ChatPageLayout] Machine context:', currentState.context);
  });
  
  // Example of how to handle side effects that the machine itself might trigger
  // or react to external prop changes.
  // createEffect(() => {
  //   if (state.matches('processingUserRequest.callingLLM')) {
  //     // Perhaps call props.onSendMessage here if it's not fully handled by the machine's services
  //     // props.onSendMessage(state.context.userInput, state.context.currentThreadId!, true);
  //   }
  // });

  onCleanup(() => {
    (actorRef as ChatOrchestratorActorRef)?.stop?.();
  });

  // Render the pure view, passing in all necessary props from machine context
  return (
    <ChatPageLayoutView
      threads={props.initialThreads}
      currentThreadId={(state as ChatOrchestratorState).context.currentThreadId}
      onNavigateBack={props.onNavigateBack}
      onSelectThread={(threadId) => { send({ type: 'CLEAR_ERROR' } as ChatOrchestratorEvent); props.onSelectThread(threadId); }}
      isSpeechModeActive={(state as ChatOrchestratorState).context.isSpeechModeActive}
      onToggleMode={() => send({ type: 'TOGGLE_INPUT_MODE' } as ChatOrchestratorEvent)}
      messages={(state as ChatOrchestratorState).context.currentChatMessages}
      userInput={(state as ChatOrchestratorState).context.userInput}
      onInputChange={(text) => send({ type: 'TEXT_INPUT_CHANGE', text } as ChatOrchestratorEvent)}
      onSendText={() => send({ type: 'SEND_TEXT_MESSAGE' } as ChatOrchestratorEvent)}
      isIdle={(state as ChatOrchestratorState).matches('idle')}
      onStartSpeech={() => send({ type: 'ACTIVATE_SPEECH_MODE' } as ChatOrchestratorEvent)}
      onCancelSpeech={() => send({ type: 'CANCEL_SPEECH_INPUT' } as ChatOrchestratorEvent)}
      isRecording={(state as ChatOrchestratorState).context.isVADListening}
    />
  );
}; 