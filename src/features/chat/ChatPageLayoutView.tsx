import { Component, Show } from 'solid-js';
import { CaretLeft } from 'phosphor-solid';
import { Switch, SwitchControl, SwitchThumb, SwitchLabel } from '../../components/ui/switch';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessageArea } from './ChatMessageArea';
import { TextInputControls } from './TextInputControls';
import { MicVisualizer } from '../../components/ui/MicVisualizer';
import { SpeechVisualizer } from '../../components/ui/SpeechVisualizer';
import type { Thread, ChatMessage } from './types';

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
  isVADListening: boolean;
  onStartVAD: () => void;
  onStopVAD: () => void;
}

export const ChatPageLayoutView: Component<ChatPageLayoutViewProps> = (props) => {
  return (
    <div class="flex flex-col h-screen bg-background text-foreground">
      <header class="flex items-center p-2 md:p-4 border-b border-border/40 bg-background z-10">
        <button onClick={props.onNavigateBack} class="mr-2 p-2">
          <CaretLeft class="size-6" />
        </button>
        <Switch
          checked={props.isSpeechModeActive} // This can also come from machineContext if preferred
          onChange={props.onToggleMode} // This sends TOGGLE_INPUT_MODE
          class="ml-auto flex items-center space-x-2"
        >
          <SwitchControl class="relative"><SwitchThumb /></SwitchControl>
          <SwitchLabel>Speech Mode</SwitchLabel>
        </Switch>
      </header>

      <div class="flex flex-1 overflow-hidden">
        <Show when={!props.isSpeechModeActive} fallback={<></>}>
          <ChatSidebar
            threads={props.threads}
            currentThreadId={props.currentThreadId}
            onSelectThread={props.onSelectThread}
          />
        </Show>
        <div class="flex flex-col flex-1 overflow-hidden">
          <main class="flex-1 overflow-y-auto">
            <Show when={!props.isSpeechModeActive} fallback={
              <div class="flex items-center justify-center h-full">
                <SpeechVisualizer />
              </div>
            }>
              <ChatMessageArea messages={props.messages} />
            </Show>
          </main>
          <div class="p-2 md:p-4 border-t border-border/40 bg-background">
            <Show when={!props.isSpeechModeActive} fallback={
              <>
                <div class="flex items-center space-x-2">
                  <button
                    class="btn btn-outline"
                    onClick={props.onStartVAD}
                    disabled={props.isVADListening}
                  >Start Recording</button>
                  <button
                    class="btn btn-outline"
                    onClick={props.onStopVAD}
                    disabled={!props.isVADListening}
                  >Stop Recording</button>
                </div>
                <MicVisualizer active={props.isVADListening} />
              </>
            }>
              <TextInputControls
                userInput={props.userInput}
                onInputChange={props.onInputChange}
                onSendMessage={props.onSendText}
                isDisabled={!props.isIdle}
              />
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}; 