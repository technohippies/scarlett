import { Component, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Microphone } from 'phosphor-solid'; // StopCircle removed
import { MicVisualizer } from '../../components/ui/MicVisualizer'; // Reusable component
// import { SpeechVisualizer } from '../../components/ui/SpeechVisualizer'; // Not used currently
// import type { StateFrom } from 'xstate'; // Not directly needed if using specific state parts
import type { ChatOrchestratorEvent, ChatOrchestratorContext, ChatOrchestratorState } from './chatOrchestratorMachine';

interface SpeechInputControlsProps {
  // state: ChatOrchestratorState; // Changed to stateValue and context
  stateValue: ChatOrchestratorState['value'];
  context: ChatOrchestratorContext; // Corrected type
  send: (event: ChatOrchestratorEvent) => void;
}

// Helper to check state matches, simplified version
function stateMatches(stateValue: ChatOrchestratorState['value'], path: string): boolean {
  if (typeof stateValue === 'string') {
    return stateValue === path;
  }
  if (typeof stateValue === 'object') {
    const keys = path.split('.');
    let current: any = stateValue;
    for (const key of keys) {
      if (typeof current !== 'object' || current === null || !current.hasOwnProperty(key)) {
        return false;
      }
      current = current[key];
    }
    return typeof current === 'string'; // Final part of path should be a string state value
  }
  return false;
}

export const SpeechInputControls: Component<SpeechInputControlsProps> = (props) => {
  // Simplified disabled logic for now. A full state.can() check would require the whole state object.
  const canStartListening = () => !props.context.isVADListening; // Example: enable if not already listening

  // Using the stateMatches helper or direct context checks
  const isListening = () => stateMatches(props.stateValue, 'speechInput.listening');
  // const isTranscribing = () => stateMatches(props.stateValue, 'processingSpeech.transcribing'); // Example for other states
  // const isProcessingLLM = () => stateMatches(props.stateValue, 'processingSpeech.generatingResponse'); // Example
  // const isPlayingTTS = () => stateMatches(props.stateValue, 'processingSpeech.speakingResponse'); // Example

  // const isLoading = () => isTranscribing() || isProcessingLLM() || isPlayingTTS(); // Update if these checks are needed

  return (
    <div class="flex flex-col items-center justify-center p-4 space-y-4">
      {/* Mic Visualizer for live audio input */}
      <div class="w-full h-12"> {/* Fixed height for MicVisualizer */}
        <MicVisualizer active={props.context.isVADListening} />
      </div>

      {/* Microphone button */}
      <Button
        onClick={() => props.send({ type: 'ACTIVATE_SPEECH_MODE' })}
        variant="default"
        class="w-16 h-16 rounded-full text-2xl"
        disabled={!canStartListening() || props.context.vadError !== null} // Disable if VAD error or already listening
      >
        <Microphone />
      </Button>
      <Show when={props.context.sttError}>
        <p class="text-xs text-destructive">STT Error: {props.context.sttError}</p>
      </Show>
      <Show when={props.context.vadError}>
        <p class="text-xs text-destructive">VAD Error: {props.context.vadError}</p>
      </Show>
      <Show when={isListening()}>
        <Button onClick={() => props.send({ type: 'CANCEL_SPEECH_INPUT' })} variant="outline" size="sm">
          Cancel
        </Button>
      </Show>
    </div>
  );
}; 