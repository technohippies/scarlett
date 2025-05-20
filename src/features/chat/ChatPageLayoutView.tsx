import { Component } from 'solid-js';
import { CaretLeft } from 'phosphor-solid';
import { Switch, SwitchControl, SwitchThumb, SwitchLabel } from '../../components/ui/switch';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessageArea } from './ChatMessageArea';
import { TextInputControls } from './TextInputControls';
import { SpeechInputControls } from './SpeechInputControls';
import type { Thread, ChatMessage } from './types';
import type { ChatOrchestratorContext, ChatOrchestratorEvent, ChatOrchestratorState } from './chatOrchestratorMachine'; // For types

export interface ChatPageLayoutViewProps {
  threads: Thread[];
  currentThreadId: string | null;
  onNavigateBack: () => void;
  onSelectThread: (threadId: string) => void;
  isSpeechModeActive: boolean;
  onToggleMode: () => void;
  messages: ChatMessage[];
  userInput: string;
  onInputChange: (text: string) => void;
  onSendText: () => void;
  isIdle: boolean;
  // onStartSpeech: () => void; // Will be handled by sendToMachine
  // onCancelSpeech: () => void; // Will be handled by sendToMachine
  // isRecording: boolean; // Will come from machineContext

  // New props for machine state and dispatcher
  machineStateValue: ChatOrchestratorState['value'];
  machineContext: ChatOrchestratorContext;
  sendToMachine: (event: ChatOrchestratorEvent) => void;
}

export const ChatPageLayoutView: Component<ChatPageLayoutViewProps> = (props) => {
  return (
    <div class="flex flex-col h-screen bg-background text-foreground">
      <header class="flex items-center p-2 md:p-4 border-b border-border/40 bg-background z-10">
        <button onClick={props.onNavigateBack} class="mr-2 p-2">
          <CaretLeft class="size-6" />
        </button>
        <Switch
          checked={!props.isSpeechModeActive} // This can also come from machineContext if preferred
          onChange={props.onToggleMode} // This sends TOGGLE_INPUT_MODE
          class="ml-auto flex items-center space-x-2"
        >
          <SwitchControl class="relative"><SwitchThumb /></SwitchControl>
          <SwitchLabel>Text Mode</SwitchLabel>
        </Switch>
      </header>

      <div class="flex flex-1 overflow-hidden">
        <ChatSidebar
          threads={props.threads}
          currentThreadId={props.currentThreadId}
          onSelectThread={props.onSelectThread}
        />
        <div class="flex flex-col flex-1 overflow-hidden">
          <main class="flex-1 overflow-y-auto">
            <ChatMessageArea messages={props.messages} />
          </main>
          <div class="p-2 md:p-4 border-t border-border/40 bg-background">
            {props.machineContext.isSpeechModeActive ? (
              <SpeechInputControls
                // Pass necessary parts of the machine state and the send function
                // SpeechInputControls will need its own props interface updated
                stateValue={props.machineStateValue} 
                context={props.machineContext} // Pass relevant context parts or whole context
                send={props.sendToMachine}
              />
            ) : (
              <TextInputControls
                userInput={props.userInput}
                onInputChange={props.onInputChange}
                onSendMessage={props.onSendText}
                isDisabled={!props.isIdle} // isIdle comes from machine.matches('idle')
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 