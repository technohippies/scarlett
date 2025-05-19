import { Component, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Microphone, StopCircle } from 'phosphor-solid'; // Example icons
import { MicVisualizer } from '../../components/ui/MicVisualizer'; // Reusable component
import { SpeechVisualizer } from '../../components/ui/SpeechVisualizer'; // Reusable component
import type { StateFrom } from 'xstate';
import type { chatOrchestratorMachine, ChatOrchestratorEvent, ChatOrchestratorState } from './chatOrchestratorMachine';

interface SpeechInputControlsProps {
  state: ChatOrchestratorState; // Use the more specific exported State type
  send: (event: ChatOrchestratorEvent) => void;
}

export const SpeechInputControls: Component<SpeechInputControlsProps> = (props) => {
  // If state.can is unavailable (e.g., in pure-view stubs), default to allowing listening
  const canStartListening = () => props.state.can?.({ type: 'ACTIVATE_SPEECH_MODE' } as ChatOrchestratorEvent) ?? true;
  const isListening = () => props.state.matches('speechInput.listening');
  const isTranscribing = () => props.state.matches('speechInput.transcribing');
  const isProcessingLLM = () => props.state.matches('processingUserRequest.callingLLM');
  const isPlayingTTS = () => props.state.matches('respondingToUser.playingTTS');

  const isLoading = () => isTranscribing() || isProcessingLLM() || isPlayingTTS();

  return (
    <div class="flex flex-col items-center justify-center p-4 space-y-4">
      {/* Mic Visualizer for live audio input */}
      <div class="w-full h-12"> {/* Fixed height for MicVisualizer */}
        <MicVisualizer active={props.state.context.isVADListening} />
      </div>

      {/* Microphone button */}
      <Button
        onClick={() => props.send({ type: 'ACTIVATE_SPEECH_MODE' })}
        variant="default"
        class="w-16 h-16 rounded-full text-2xl"
        disabled={!canStartListening()}
      >
        <Microphone />
      </Button>
      <Show when={props.state.context.sttError}>
        <p class="text-xs text-destructive">STT Error: {props.state.context.sttError}</p>
      </Show>
      <Show when={props.state.context.vadError}>
        <p class="text-xs text-destructive">VAD Error: {props.state.context.vadError}</p>
      </Show>
    </div>
  );
}; 