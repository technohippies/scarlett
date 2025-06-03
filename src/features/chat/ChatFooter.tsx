import { Component, Show } from 'solid-js';
import { TextInputControls } from './TextInputControls';
import { SpeechInputControls } from './SpeechInputControls';
import type { Messages } from '../../types/i18n';

interface ChatFooterProps {
  isSpeechModeActive: boolean;
  userInput: string;
  onInputChange: (text: string) => void;
  onSendMessage: () => void;
  isDisabled: boolean;
  isVADListening: boolean;
  isVoiceConversationActive: boolean;
  isSpeaking: boolean;
  vadError?: string | null;
  sttError?: string | null;
  onStartVoiceConversation: () => void;
  onStopVAD: () => void;
  messages?: Messages;
}

export const ChatFooter: Component<ChatFooterProps> = (props) => {
  return (
    <div class="p-2 md:p-4 border-t border-border/40 bg-background sticky bottom-0">
      <Show
        when={props.isSpeechModeActive}
        fallback={
          <TextInputControls
            userInput={props.userInput}
            onInputChange={props.onInputChange}
            onSendMessage={props.onSendMessage}
            isDisabled={props.isDisabled}
          />
        }
      >
        <SpeechInputControls
          isVADListening={props.isVADListening}
          isVoiceConversationActive={props.isVoiceConversationActive}
          isSpeaking={props.isSpeaking}
          vadError={props.vadError}
          sttError={props.sttError}
          onStartVoiceConversation={props.onStartVoiceConversation}
          onStopVAD={props.onStopVAD}
          messages={props.messages}
        />
      </Show>
    </div>
  );
}; 