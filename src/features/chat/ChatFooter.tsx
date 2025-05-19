import { Component, Show } from 'solid-js';
import type { StateFrom } from 'xstate';
import type { chatOrchestratorMachine, ChatOrchestratorEvent, ChatOrchestratorState } from './chatOrchestratorMachine';
import { TextInputControls } from './TextInputControls';
import { SpeechInputControls } from './SpeechInputControls';

interface ChatFooterProps {
  state: ChatOrchestratorState;
  send: (event: ChatOrchestratorEvent) => void;
}

export const ChatFooter: Component<ChatFooterProps> = (props) => {
  return (
    <div class="p-2 md:p-4 border-t border-border/40 bg-background sticky bottom-0">
      <Show
        when={props.state.context.isSpeechModeActive}
        fallback={
          <TextInputControls
            userInput={props.state.context.userInput}
            onInputChange={(text: string) => props.send({ type: 'TEXT_INPUT_CHANGE', text })}
            onSendMessage={() => props.send({ type: 'SEND_TEXT_MESSAGE' })}
            isDisabled={!props.state.matches('idle')}
          />
        }
      >
        <SpeechInputControls
          state={props.state}
          send={props.send}
        />
      </Show>
    </div>
  );
}; 