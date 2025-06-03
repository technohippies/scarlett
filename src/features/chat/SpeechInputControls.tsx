import { Component, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Microphone, Stop } from 'phosphor-solid';
import { MicVisualizer } from '../../components/ui/MicVisualizer';
import type { Messages } from '../../types/i18n';

interface SpeechInputControlsProps {
  isVADListening: boolean;
  isVoiceConversationActive: boolean;
  isSpeaking: boolean;
  vadError?: string | null;
  sttError?: string | null;
  onStartVoiceConversation: () => void;
  onStopVAD: () => void;
  messages?: Messages;
}

export const SpeechInputControls: Component<SpeechInputControlsProps> = (props) => {
  // Localization helper
  const getLocalizedString = (key: string, fallback: string) => {
    return props.messages?.[key]?.message || fallback;
  };

  const isVADListening = () => props.isVADListening;
  const isVoiceConversationActive = () => props.isVoiceConversationActive;
  const isSpeaking = () => props.isSpeaking;
  const hasError = () => (props.vadError !== null && props.vadError !== undefined) || 
                         (props.sttError !== null && props.sttError !== undefined);
  
  console.log('[SpeechInputControls] Render - isVADListening:', isVADListening(), 'isVoiceConversationActive:', isVoiceConversationActive(), 'isSpeaking:', isSpeaking());
  
  // Button text is ONLY Start/Stop - never changes based on internal states
  const getButtonText = () => {
    if (!isVoiceConversationActive()) {
      return getLocalizedString('chatPageStartVoiceChat', 'Start Voice Chat');
    }
    return getLocalizedString('chatPageStopVoiceChat', 'Stop Voice Chat');
  };

  // Status text shows the internal conversation state
  const getStatusMessage = () => {
    if (props.vadError) return `Microphone: ${props.vadError}`;
    if (props.sttError) return `Speech-to-text: ${props.sttError}`;
    
    if (!isVoiceConversationActive()) {
      return null; // No status when not in voice conversation
    }
    
    // Show current conversation state
    if (isSpeaking()) return getLocalizedString('chatPageResponding', 'Responding...');
    return getLocalizedString('chatPageListening', 'Listening...'); // Always show listening when voice conversation active and not responding
  };

  // Show mic visualizer when status says "Listening..."
  const shouldShowMicVisualizer = () => {
    return isVoiceConversationActive() && !isSpeaking();
  };

  const handleButtonClick = () => {
    console.log('[SpeechInputControls] Button clicked - isVoiceConversationActive:', isVoiceConversationActive());
    
    if (!isVoiceConversationActive()) {
      console.log('[SpeechInputControls] Starting voice conversation');
      props.onStartVoiceConversation();
    } else {
      console.log('[SpeechInputControls] Stopping voice conversation');
      props.onStopVAD(); // This will stop current VAD and the toggleSpeech will handle full stop
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div class="flex flex-col items-center justify-center space-y-6">
      {/* Mic Visualizer - show when status says "Listening..." */}
      <Show when={shouldShowMicVisualizer()}>
        <div class="w-full max-w-xs h-12">
          <MicVisualizer active={isVADListening()} />
        </div>
      </Show>

      {/* Main Control Button - ONLY Start/Stop */}
      <div class="flex flex-col items-center space-y-3">
        <Button
          onClick={handleButtonClick}
          variant={isVoiceConversationActive() ? "destructive" : "default"}
          size="lg"
          class="flex items-center space-x-2 min-w-40"
          disabled={hasError()}
        >
          <Show when={isVoiceConversationActive()} fallback={<Microphone class="w-4 h-4" />}>
            <Stop class="w-4 h-4" />
          </Show>
          <span>{getButtonText()}</span>
        </Button>

        {/* Status Text - shows Listening.../Responding... */}
        <Show when={statusMessage}>
          <p class={`text-sm text-center max-w-xs ${
            hasError() ? 'text-destructive' : 'text-muted-foreground'
          }`}>
            {statusMessage}
          </p>
        </Show>
      </div>
    </div>
  );
}; 