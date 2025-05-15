import { createSignal, createEffect } from 'solid-js';
import { VadPanel, type VadOption, type VadPanelProps } from '../../../src/features/models/VadPanel'; // Adjust path as needed

// --- Mock Data ---
const mockSileroVadOption: VadOption = {
    id: 'silero_vad',
    name: 'ElevenLabs', // Changed name
};

// --- Story Definition (Default Export) ---
export default {
  title: 'Features/Models/VadPanel',
  component: VadPanel,
  tags: ['autodocs'],
  argTypes: {
    availableVadOptions: { control: 'object' },
    selectedVadId: { control: 'object' },
    onSelectVad: { action: 'onSelectVad' },
    isVadTesting: { control: 'object' },
    onTestVad: { action: 'onTestVad' },
    onStopVadTest: { action: 'onStopVadTest' },
    vadStatusMessage: { control: 'object' },
    vadTestError: { control: 'object' },
    isVadLoading: { control: 'object' },
    lastRecordedAudioUrl: { control: 'object' },
    onPlayLastRecording: { action: 'onPlayLastRecording' }, // Kept for consistency, though button removed
    // STT Props
    onTranscribe: { action: 'onTranscribe', description: 'Handler to initiate transcription' },
    transcribedText: { control: 'object', description: 'Accessor for the transcribed text' },
    isTranscribing: { control: 'object', description: 'Accessor for STT loading state' },
    sttError: { control: 'object', description: 'Accessor for STT error' },
    // Add hideAudioLabel to argTypes
    hideAudioLabel: { control: 'boolean', description: 'Hide the "Last Captured Audio:" label' },
  },
  args: { // Default args
    availableVadOptions: [mockSileroVadOption], // Only Silero VAD
    selectedVadId: () => mockSileroVadOption.id, // Default to Silero VAD selected for most stories
    isVadTesting: () => false,
    vadStatusMessage: () => null, // Ensures no default status message like "VAD initialized"
    vadTestError: () => null,
    isVadLoading: () => false,
    lastRecordedAudioUrl: () => null,
    // STT Default Args
    transcribedText: () => null,
    isTranscribing: () => false,
    sttError: () => null,
    // Default hideAudioLabel to true for stories, as per typical onboarding usage
    hideAudioLabel: true, 
  },
};

// --- Base Render Function --- 
const BaseRender = (args: VadPanelProps) => {
    const [selectedVad, setSelectedVad] = createSignal<string | undefined>(args.selectedVadId());
    const [isTesting, setIsTesting] = createSignal<boolean>(args.isVadTesting());
    const [statusMsg, setStatusMsg] = createSignal<string | null>(args.vadStatusMessage());
    const [vadError, setVadError] = createSignal<Error | null>(args.vadTestError());
    const [isLoading, setIsLoading] = createSignal<boolean>(args.isVadLoading ? args.isVadLoading() : false);
    const [audioUrl, setAudioUrl] = createSignal<string | null>(args.lastRecordedAudioUrl());

    // STT State Signals for Story
    const [transcribedTextSignal, setTranscribedTextSignal] = createSignal<string | null>(args.transcribedText());
    const [isTranscribingSignal, setIsTranscribingSignal] = createSignal<boolean>(args.isTranscribing());
    const [sttErrorSignal, setSttErrorSignal] = createSignal<Error | null>(args.sttError());
    // Signal for hideAudioLabel prop
    const getHideAudioLabelValue = () => typeof args.hideAudioLabel === 'function' ? args.hideAudioLabel() : args.hideAudioLabel === true;
    const [getHideAudioLabel, setHideAudioLabel] = createSignal<boolean>(getHideAudioLabelValue());

    createEffect(() => setSelectedVad(args.selectedVadId()));
    createEffect(() => setIsTesting(args.isVadTesting()));
    createEffect(() => setStatusMsg(args.vadStatusMessage()));
    createEffect(() => setVadError(args.vadTestError()));
    createEffect(() => setIsLoading(args.isVadLoading ? args.isVadLoading() : false));
    createEffect(() => setAudioUrl(args.lastRecordedAudioUrl()));
    // Effects for STT props
    createEffect(() => setTranscribedTextSignal(args.transcribedText()));
    createEffect(() => setIsTranscribingSignal(args.isTranscribing()));
    createEffect(() => setSttErrorSignal(args.sttError()));
    createEffect(() => setHideAudioLabel(getHideAudioLabelValue()));

    const handleSelectVad = (vadId: string | undefined) => {
        args.onSelectVad(vadId);
        setSelectedVad(vadId);
        setAudioUrl(null);
        // args.lastRecordedAudioUrl = () => null; // Let signal handle this
        setTranscribedTextSignal(null); // Reset STT text
        setSttErrorSignal(null);
    };

    const handleTestVad = () => {
        args.onTestVad();
        const currentlyTesting = isTesting();
        setIsTesting(!currentlyTesting);
        setTranscribedTextSignal(null); // Clear STT text on new VAD test
        setSttErrorSignal(null);
        setAudioUrl(null); // Ensure no old audio URL is lingering
        // args.lastRecordedAudioUrl = () => null; // Let signal handle this

        if (!currentlyTesting) {
            setStatusMsg(null); // Button will say "Listening..."
            setTimeout(() => {
                if (isTesting()) { // Check if still testing after timeout
                    const gotSpeech = Math.random() > 0.3;
                    if (gotSpeech) {
                        setStatusMsg(null); // No explicit status. Button will show "Transcribing..." (via isTranscribing)
                        setAudioUrl('/audio/test-voice.mp3'); 
                        // args.lastRecordedAudioUrl = () => '/audio/test-voice.mp3'; // Let signal handle this
                        void handleTranscribe(); // Automatically start transcription
                    } else {
                        setStatusMsg(null); // Keep null, feedback is button reverting to "Test" or VAD error shown
                        setVadError(new Error("No speech detected during test."));
                        setIsTesting(false); 
                    }
                }
            }, 1500); 
        } else {
            // If stopping the test
            setStatusMsg(null); // Button reverts to "Test"
        }
    };
    
    const handleStopVadTest = () => {
        if (args.onStopVadTest) args.onStopVadTest();
        setIsTesting(false);
        // setStatusMsg("Test stopped explicitly.");
        setStatusMsg(null); // Button reverts to "Test"
    };

    const handlePlayLastRecording = () => {
        if (args.onPlayLastRecording) args.onPlayLastRecording(); 
        console.log("Story: Play last recording called. URL:", audioUrl());
        // No status message changes here; button state and STT results/errors will provide feedback.

        // Simulate re-transcribing if that's the desired behavior when playing.
        // Or, this could just be for playback if transcription is a separate step post-VAD.
        // For this story, let's assume playing captured audio should allow re-transcription.
        setIsTranscribingSignal(true);
        setTranscribedTextSignal(null);
        setSttErrorSignal(null);

        setTimeout(() => {
            if (Math.random() > 0.25) { 
                setTranscribedTextSignal("This is a simulated transcription of the re-played audio.");
                // setStatusMsg(null); // No direct status message
            } else { 
                setSttErrorSignal(new Error("Simulated STT API error on re-play."));
                // setStatusMsg(null); // No direct status message, error component shows
            }
            setIsTranscribingSignal(false);
        }, 2000);
    };

    const handleTranscribe = async () => {
        if (args.onTranscribe) args.onTranscribe(); // Log action
        setIsTranscribingSignal(true);
        setTranscribedTextSignal(null);
        setSttErrorSignal(null);
        setStatusMsg(null); // Clear status message as button shows current action

        // Simulate API call
        setTimeout(() => {
            if (Math.random() > 0.25) { // Simulate success
                setTranscribedTextSignal("This is a simulated transcription of the captured audio. Hello world!");
                // setStatusMsg(null); // No success status message displayed via vadStatusMessage
            } else { // Simulate error
                setSttErrorSignal(new Error("Simulated STT API error. Failed to transcribe."));
                // setStatusMsg(null); // No failure status message, error component shows
            }
            setIsTranscribingSignal(false);
        }, 2000);
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
                vadTestError={vadError} 
                isVadLoading={isLoading}
                lastRecordedAudioUrl={audioUrl}
                onPlayLastRecording={handlePlayLastRecording}
                // STT Props
                onTranscribe={handleTranscribe} // Pass mock STT handler
                transcribedText={transcribedTextSignal}
                isTranscribing={isTranscribingSignal}
                sttError={sttErrorSignal}
                // Pass hideAudioLabel to the component
                hideAudioLabel={getHideAudioLabel}
            />
        </div>
    );
};

// --- Stories ---

export const DefaultNoSelection = { render: BaseRender, args: { selectedVadId: () => undefined, lastRecordedAudioUrl: () => null, vadStatusMessage: () => null } };
export const SileroVadSelectedNoAudio = { render: BaseRender, args: { selectedVadId: () => mockSileroVadOption.id, lastRecordedAudioUrl: () => null, vadStatusMessage: () => null } };
export const SileroVadLoading = { render: BaseRender, args: { selectedVadId: () => mockSileroVadOption.id, isVadLoading: () => true, vadStatusMessage: () => null, lastRecordedAudioUrl: () => null } }; // Button: Initializing...

// Story for when audio is captured and immediately starts transcription
export const SileroVadAudioCapturedAndTranscribing = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => false, // VAD test itself would have finished
    vadStatusMessage: () => null, // No explicit status message here. Button state: "Transcribing..."
    lastRecordedAudioUrl: () => '/audio/test-voice.mp3', // Audio is present
    transcribedText: () => null,
    isTranscribing: () => true, // Transcription should be active
    sttError: () => null,
  }
};

// Story for when VAD is actively listening
export const SileroVadListening = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => true, 
    vadStatusMessage: () => null, // Button says "Listening..."
    lastRecordedAudioUrl: () => null,
    isTranscribing: () => false,
    hideAudioLabel: () => true, // Explicitly hide for this story type
  }
};

// Story for when STT is in progress (button says "Transcribing...")
export const SileroVadTranscribing = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => false, 
    vadStatusMessage: () => null, // Button says "Transcribing..."
    lastRecordedAudioUrl: () => '/audio/test-voice.mp3',
    transcribedText: () => null,
    isTranscribing: () => true, 
    sttError: () => null,
    hideAudioLabel: () => true, // Explicitly hide for this story type
  }
};

// Story for STT success (button reverts to "Test", transcribed text shown)
export const SileroVadTranscriptionSuccess = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => false, 
    vadStatusMessage: () => null, // No explicit status message. Transcribed text is shown.
    lastRecordedAudioUrl: () => '/audio/test-voice.mp3',
    transcribedText: () => "This is the transcribed text from the audio. It was successful!",
    isTranscribing: () => false,
    sttError: () => null,
    hideAudioLabel: () => true, // Explicitly hide for this story type
  }
};

// Story for STT error (button reverts to "Test", STT error shown)
export const SileroVadTranscriptionError = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => false, 
    vadStatusMessage: () => null, // VAD test error will be shown if applicable by component itself
    lastRecordedAudioUrl: () => '/audio/test-voice.mp3',
    transcribedText: () => null,
    isTranscribing: () => false,
    sttError: () => new Error("Simulated ElevenLabs STT API Error: The audio format was not recognized."),
    hideAudioLabel: () => true, // Explicitly hide for this story type
  }
};

export const SileroVadDeviceError = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadLoading: () => false, 
    vadTestError: () => new Error("VAD Error: Mic access denied."), // This error WILL be shown
    vadStatusMessage: () => null, // This won't be shown as vadTestError takes precedence
    lastRecordedAudioUrl: () => null,
    hideAudioLabel: () => true, // Explicitly hide for this story type
  }
};

// Story to specifically test the audio label being visible (if ever needed)
export const SileroVadWithAudioLabel = {
    render: BaseRender,
    args: {
        selectedVadId: () => mockSileroVadOption.id,
        isVadTesting: () => false,
        vadStatusMessage: () => null,
        lastRecordedAudioUrl: () => '/audio/test-voice.mp3',
        transcribedText: () => "Some transcription.",
        isTranscribing: () => false,
        sttError: () => null,
        hideAudioLabel: () => false, // Explicitly show for this story
    }
};