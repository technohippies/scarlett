import { createSignal, createEffect } from 'solid-js';
import { VadPanel, type VadOption, type VadPanelProps } from '../../../src/features/models/VadPanel'; // Adjust path as needed

// --- Mock Data ---
const mockSileroVadOption: VadOption = {
    id: 'silero_vad',
    name: 'Silero VAD (Local)',
    // logoUrl: '/images/vad/silero.png' // Example if we add a logo
};

// --- Story Definition (Default Export) ---
export default {
  title: 'Features/Models/VadPanel',
  component: VadPanel,
  tags: ['autodocs'],
  argTypes: {
    availableVadOptions: { control: 'object', description: 'List of available VAD options' },
    selectedVadId: { control: 'object', description: 'Accessor for the selected VAD ID' },
    onSelectVad: { action: 'onSelectVad', description: 'Handler for VAD option selection' },

    isVadTesting: { control: 'object', description: 'Accessor for VAD test status (true if testing)' },
    onTestVad: { action: 'onTestVad', description: 'Handler to toggle VAD test (start/stop)' },
    onStopVadTest: { action: 'onStopVadTest', description: 'Handler to explicitly stop VAD test' },

    vadStatusMessage: { control: 'object', description: 'Accessor for VAD status message' },
    vadTestError: { control: 'object', description: 'Accessor for VAD test error' },
    isVadLoading: { control: 'object', description: 'Accessor for VAD loading state' },

    // New props for playback
    lastRecordedAudioUrl: { control: 'object', description: 'Accessor for the URL of the last recorded audio' },
    onPlayLastRecording: { action: 'onPlayLastRecording', description: 'Handler to play the last recorded audio' },
  },
  args: { // Default args
    availableVadOptions: [mockSileroVadOption],
    selectedVadId: () => undefined, // No VAD selected initially
    isVadTesting: () => false,
    vadStatusMessage: () => null,
    vadTestError: () => null,
    isVadLoading: () => false,
    lastRecordedAudioUrl: () => null, // Initially no audio recorded
  },
};

// --- Base Render Function --- 
const BaseRender = (args: VadPanelProps) => {
    // Create signals for props that can change
    const [selectedVad, setSelectedVad] = createSignal<string | undefined>(args.selectedVadId());
    const [isTesting, setIsTesting] = createSignal<boolean>(args.isVadTesting());
    const [statusMsg, setStatusMsg] = createSignal<string | null>(args.vadStatusMessage());
    const [error, setError] = createSignal<Error | null>(args.vadTestError());
    const [isLoading, setIsLoading] = createSignal<boolean>(args.isVadLoading ? args.isVadLoading() : false);
    const [audioUrl, setAudioUrl] = createSignal<string | null>(args.lastRecordedAudioUrl());

    // Effects to update signals if Storybook controls change them
    createEffect(() => setSelectedVad(args.selectedVadId()));
    createEffect(() => setIsTesting(args.isVadTesting()));
    createEffect(() => setStatusMsg(args.vadStatusMessage()));
    createEffect(() => setError(args.vadTestError()));
    createEffect(() => setIsLoading(args.isVadLoading ? args.isVadLoading() : false));
    createEffect(() => setAudioUrl(args.lastRecordedAudioUrl()));

    const handleSelectVad = (vadId: string | undefined) => {
        args.onSelectVad(vadId);
        setSelectedVad(vadId);
        // Reset audio URL when VAD option changes
        setAudioUrl(null);
        args.lastRecordedAudioUrl = () => null; // Also update the arg for Storybook control consistency
    };

    const handleTestVad = () => {
        args.onTestVad();
        const currentlyTesting = isTesting();
        setIsTesting(!currentlyTesting);
        if (!currentlyTesting) {
            setStatusMsg("Listening...");
            setAudioUrl(null); // Clear previous audio when starting a new test
            args.lastRecordedAudioUrl = () => null;
            // Simulate receiving speech or no speech after a delay
            setTimeout(() => {
                if (isTesting()) {
                    const gotSpeech = Math.random() > 0.3;
                    setStatusMsg(gotSpeech ? "Speech detected. Ready for playback." : "No speech detected during test.");
                    if (gotSpeech) {
                        // Simulate audio being captured by providing a test URL
                        setAudioUrl('/audio/test-voice.mp3'); 
                        args.lastRecordedAudioUrl = () => '/audio/test-voice.mp3';
                    }
                }
            }, 2500);
        } else {
            setStatusMsg("Test stopped.");
        }
    };
    
    const handleStopVadTest = () => {
        if (args.onStopVadTest) args.onStopVadTest();
        setIsTesting(false);
        setStatusMsg("Test explicitly stopped.");
    };

    const handlePlayLastRecording = () => {
        // This will be logged by Storybook's action logger if onPlayLastRecording is set in args
        if (args.onPlayLastRecording) {
            args.onPlayLastRecording(); 
        }
        // For actual playback in the story, the <audio controls> element will handle it.
        // If direct playback via this function is needed, one could:
        // const audio = new Audio(audioUrl()); audio.play();
        // But this might conflict with the user interacting with the <audio> element itself.
        // It's often better to let the native controls handle it or have a single source of truth for playback state.
        console.log("Story: Play last recording called. URL:", audioUrl());
    };

    return (
        <div class="p-4 bg-background max-w-xl mx-auto">
            <VadPanel
                availableVadOptions={args.availableVadOptions}
                selectedVadId={selectedVad} 
                onSelectVad={handleSelectVad}
                
                isVadTesting={isTesting} 
                onTestVad={handleTestVad} 
                onStopVadTest={handleStopVadTest}

                vadStatusMessage={statusMsg} 
                vadTestError={error}
                isVadLoading={isLoading}

                lastRecordedAudioUrl={audioUrl} // Pass signal accessor
                onPlayLastRecording={handlePlayLastRecording} // Pass mock handler
            />
        </div>
    );
};

// --- Stories ---

export const DefaultNoSelection = {
  render: BaseRender,
  args: {
    selectedVadId: () => undefined,
    lastRecordedAudioUrl: () => null,
  }
};

export const SileroVadSelectedNoAudio = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    lastRecordedAudioUrl: () => null,
  }
};

export const SileroVadTesting = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => true,
    vadStatusMessage: () => "Listening... (simulated)",
    lastRecordedAudioUrl: () => null,
  }
};

export const SileroVadCapturedAudio = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => false, 
    vadStatusMessage: () => "Audio captured. Ready for playback.",
    lastRecordedAudioUrl: () => '/audio/test-voice.mp3', // Provide a test audio URL
  }
};

export const SileroVadError = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    vadTestError: () => new Error("Simulated VAD initialization failed."),
    lastRecordedAudioUrl: () => null,
  }
};

export const SileroVadLoading = {
    render: BaseRender,
    args: {
        selectedVadId: () => mockSileroVadOption.id,
        isVadLoading: () => true,
        vadStatusMessage: () => "Initializing VAD...",
        lastRecordedAudioUrl: () => null,
    }
}; 