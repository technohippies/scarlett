import { createSignal, createEffect } from 'solid-js';
import { VadPanel, type VadOption, type VadPanelProps } from '../../../src/features/models/VadPanel'; // Adjust path as needed

// --- Mock Data ---
const mockSileroVadOption: VadOption = {
    id: 'silero_vad',
    name: 'Silero VAD (Local)',
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
  },
  args: { // Default args
    availableVadOptions: [mockSileroVadOption],
    selectedVadId: () => undefined,
    isVadTesting: () => false,
    vadStatusMessage: () => null,
    vadTestError: () => null,
    isVadLoading: () => false,
    lastRecordedAudioUrl: () => null,
    // STT Default Args
    transcribedText: () => null,
    isTranscribing: () => false,
    sttError: () => null,
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

    const handleSelectVad = (vadId: string | undefined) => {
        args.onSelectVad(vadId);
        setSelectedVad(vadId);
        setAudioUrl(null);
        args.lastRecordedAudioUrl = () => null;
        setTranscribedTextSignal(null); // Reset STT text
        setSttErrorSignal(null);
    };

    const handleTestVad = () => {
        args.onTestVad();
        const currentlyTesting = isTesting();
        setIsTesting(!currentlyTesting);
        setTranscribedTextSignal(null); // Clear STT text on new VAD test
        setSttErrorSignal(null);
        // setAudioUrl(null); // Clear previous audio immediately
        // args.lastRecordedAudioUrl = () => null;

        if (!currentlyTesting) {
            setStatusMsg("Listening...");
            setAudioUrl(null); // Ensure no old audio URL is lingering
            args.lastRecordedAudioUrl = () => null;
            // Simulate VAD processing and audio capture
            setTimeout(() => {
                if (isTesting()) { // Check if still in "testing" state (i.e., VAD was started)
                    const gotSpeech = Math.random() > 0.3;
                    if (gotSpeech) {
                        setStatusMsg("Audio captured. Starting transcription...");
                        setAudioUrl('/audio/test-voice.mp3'); 
                        args.lastRecordedAudioUrl = () => '/audio/test-voice.mp3';
                        // Simulate automatic transcription starting immediately after audio capture
                        void handleTranscribe(); // Call the mock transcribe handler
                    } else {
                        setStatusMsg("No speech detected during test.");
                        setIsTesting(false); // Stop VAD test if no speech
                    }
                }
            }, 2500); // Simulate VAD processing time
        } else {
            setStatusMsg("Test stopped.");
            // No need to explicitly stop VAD here, as setIsTesting(false) is handled by onStopVadTest or this branch
        }
    };
    
    const handleStopVadTest = () => {
        if (args.onStopVadTest) args.onStopVadTest();
        setIsTesting(false);
        setStatusMsg("Test explicitly stopped.");
    };

    const handlePlayLastRecording = () => {
        if (args.onPlayLastRecording) args.onPlayLastRecording(); 
        console.log("Story: Play last recording called. URL:", audioUrl());
    };

    const handleTranscribe = async () => {
        if (args.onTranscribe) args.onTranscribe(); // Log action
        setIsTranscribingSignal(true);
        setTranscribedTextSignal(null);
        setSttErrorSignal(null);
        setStatusMsg("Transcription in progress..."); // Update VAD status too

        // Simulate API call
        setTimeout(() => {
            if (Math.random() > 0.25) { // Simulate success
                setTranscribedTextSignal("This is a simulated transcription of the captured audio. Hello world!");
                setStatusMsg("Transcription successful.");
            } else { // Simulate error
                setSttErrorSignal(new Error("Simulated STT API error. Failed to transcribe."));
                setStatusMsg("Transcription failed.");
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
            />
        </div>
    );
};

// --- Stories ---

export const DefaultNoSelection = { render: BaseRender, args: { selectedVadId: () => undefined, lastRecordedAudioUrl: () => null } };
export const SileroVadSelectedNoAudio = { render: BaseRender, args: { selectedVadId: () => mockSileroVadOption.id, lastRecordedAudioUrl: () => null } };
export const SileroVadLoading = { render: BaseRender, args: { selectedVadId: () => mockSileroVadOption.id, isVadLoading: () => true, vadStatusMessage: () => "Initializing VAD...", lastRecordedAudioUrl: () => null } };
export const SileroVadTesting = { render: BaseRender, args: { selectedVadId: () => mockSileroVadOption.id, isVadTesting: () => true, vadStatusMessage: () => "Listening... (simulated)", lastRecordedAudioUrl: () => null } };

// Story for when audio is captured and immediately starts transcription
export const SileroVadAudioCapturedAndTranscribing = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => false, // VAD test itself would have finished
    vadStatusMessage: () => "Audio captured. Starting transcription...",
    lastRecordedAudioUrl: () => '/audio/test-voice.mp3', // Audio is present
    transcribedText: () => null,
    isTranscribing: () => true, // Transcription should be active
    sttError: () => null,
  }
};

// Story for STT success (remains largely the same, but follows automatic flow)
export const SileroVadTranscriptionSuccess = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => false, 
    vadStatusMessage: () => "Transcription successful.",
    lastRecordedAudioUrl: () => '/audio/test-voice.mp3',
    transcribedText: () => "This is the transcribed text from the audio. It was successful!",
    isTranscribing: () => false,
    sttError: () => null,
  }
};

// Story for STT error (remains largely the same, but follows automatic flow)
export const SileroVadTranscriptionError = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => false, 
    vadStatusMessage: () => "Transcription failed.", // VAD status reflects STT failure
    lastRecordedAudioUrl: () => '/audio/test-voice.mp3',
    transcribedText: () => null,
    isTranscribing: () => false,
    sttError: () => new Error("Simulated ElevenLabs STT API Error: The audio format was not recognized."),
  }
};

export const SileroVadDeviceError = { // Renamed from SileroVadError to be more specific
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    vadTestError: () => new Error("Simulated VAD initialization failed due to microphone access."),
    lastRecordedAudioUrl: () => null,
  }
};