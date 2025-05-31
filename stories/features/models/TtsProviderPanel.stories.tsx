import { createSignal, createEffect } from 'solid-js';
import { TtsProviderPanel, type TtsProviderOption } from '../../../src/features/models/TtsProviderPanel'; // Adjust path as needed

// --- Locally Defined Types for Story ---
// This type was previously imported but not exported from the component.
// Define it here if it's only for storybook mock data.
export interface TtsModelOption {
    id: string;
    name: string;
}

// This type was previously imported but not exported from the component.
// Define it here if it's only for storybook mock data.
export type KokoroDownloadStatus = 'not-downloaded' | 'downloading' | 'downloaded' | 'error';

// --- Mock Data ---
const mockElevenLabsProvider: TtsProviderOption = { 
    id: 'elevenlabs', 
    name: 'ElevenLabs', 
    logoUrl: '/images/elevenlabs.png' // Assuming a logo path
};
const mockKokoroProvider: TtsProviderOption = { 
    id: 'kokoro', 
    name: 'Kokoro (Local)', 
    logoUrl: '/images/kokoro.png' // Assuming a logo path
};

const mockElevenLabsModels: TtsModelOption[] = [
    { id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2' },
    { id: 'eleven_english_v1', name: 'Eleven English v1' },
    // Add more voice/model options if needed
];

// --- Story Definition (Default Export) ---
export default {
  title: 'Features/Models/TtsProviderPanel',
  component: TtsProviderPanel,
  tags: ['autodocs'],
  argTypes: {
    availableProviders: { control: 'object', description: 'List of available TTS providers' },
    selectedProviderId: { control: 'object', description: 'Accessor for the selected provider ID' },
    onSelectProvider: { action: 'onSelectProvider', description: 'Handler for provider selection' },
    
    // ElevenLabs specific
    elevenLabsApiKey: { control: 'object', description: 'Accessor for ElevenLabs API key' },
    onElevenLabsApiKeyChange: { action: 'onElevenLabsApiKeyChange', description: 'Handler for API key change' },
    elevenLabsModels: { control: 'object', description: 'List of ElevenLabs models/voices' },
    selectedElevenLabsModelId: { control: 'object', description: 'Accessor for selected ElevenLabs model ID' },
    onSelectElevenLabsModel: { action: 'onSelectElevenLabsModel', description: 'Handler for ElevenLabs model selection' },
    isElevenLabsTesting: {control: 'object', description: 'Accessor for ElevenLabs test status'},
    onTestElevenLabs: {action: 'onTestElevenLabs', description: 'Handler for testing ElevenLabs'},

    // Kokoro specific
    kokoroDownloadStatus: { control: 'object', description: 'Accessor for Kokoro model download status' },
    kokoroDownloadProgress: { control: 'object', description: 'Accessor for Kokoro download progress' },
    onDownloadKokoroModel: { action: 'onDownloadKokoroModel', description: 'Handler to start Kokoro model download' },
    kokoroDevicePreference: { control: 'object', description: 'Accessor for Kokoro device preference (cpu/webgpu)' },
    onKokoroDevicePreferenceChange: { action: 'onKokoroDevicePreferenceChange', description: 'Handler for Kokoro device preference change' },
    isKokoroTesting: { control: 'object', description: 'Accessor for Kokoro test status' },
    onTestKokoro: { action: 'onTestKokoro', description: 'Handler for testing Kokoro' },
    
    // General Test/Audio Playback (can be shared or provider-specific)
    testAudioData: { control: 'object', description: 'Accessor for test audio Blob' },
    onPlayTestAudio: { action: 'onPlayTestAudio', description: 'Handler to play test audio' },
    testError: {control: 'object', description: 'Accessor for test error'},
  },
  args: { // Default args: No provider selected initially
    availableProviders: [mockElevenLabsProvider, mockKokoroProvider],
    selectedProviderId: () => undefined,
    
    elevenLabsApiKey: () => '',
    elevenLabsModels: mockElevenLabsModels,
    selectedElevenLabsModelId: () => undefined,
    isElevenLabsTesting: () => false,

    kokoroDownloadStatus: () => 'not-downloaded',
    kokoroDownloadProgress: () => 0,
    kokoroDevicePreference: () => 'cpu',
    isKokoroTesting: () => false,

    testAudioData: () => null,
    testError: () => null,
  },
};

// --- Base Render Function ---
const BaseRender = (args: any) => {
    const [selectedProvider, setSelectedProvider] = createSignal<string | undefined>(args.selectedProviderId());
    const [apiKey, setApiKey] = createSignal<string>(args.elevenLabsApiKey());
    const [isElTesting, setIsElTesting] = createSignal<boolean>(args.isElevenLabsTesting());
    const [audio, setAudio] = createSignal<Blob | null>(args.testAudioData());
    const [error, setError] = createSignal<Error | null>(args.testError());

    // Effects to update signals if Storybook controls change
    createEffect(() => setSelectedProvider(args.selectedProviderId()));
    createEffect(() => setApiKey(args.elevenLabsApiKey()));
    createEffect(() => setIsElTesting(args.isElevenLabsTesting()));
    createEffect(() => setAudio(args.testAudioData()));
    createEffect(() => setError(args.testError()));

    const handleProviderSelect = (providerId: string | undefined) => {
        args.onSelectProvider(providerId);
        setSelectedProvider(providerId);
    };

    const handleApiKeyChange = (newKey: string) => {
        args.onElevenLabsApiKeyChange(newKey);
        setApiKey(newKey);
    };

    const handleTestElevenLabs = () => {
        args.onTestElevenLabs();
        setIsElTesting(true);
        setTimeout(() => {
            setIsElTesting(false);
            // Simulate success or error for story
            // setAudio(new Blob(["dummy audio"], {type: "audio/mpeg"})); 
        }, 2000);
    };

    const handlePlayAudio = () => {
        args.onPlayTestAudio();
        if (audio()) {
            const url = URL.createObjectURL(audio()!);
            const audioPlayer = new Audio(url);
            audioPlayer.play();
            audioPlayer.onended = () => URL.revokeObjectURL(url);
        }
    };

    return (
        <div class="p-4 bg-background max-w-xl mx-auto">
            <TtsProviderPanel
                availableProviders={args.availableProviders}
                selectedProviderId={selectedProvider} // Pass signal accessor
                onSelectProvider={handleProviderSelect}
                
                elevenLabsApiKey={apiKey} // Pass signal accessor
                onElevenLabsApiKeyChange={handleApiKeyChange}
                isElevenLabsTesting={isElTesting} // Pass signal accessor
                onTestElevenLabs={handleTestElevenLabs}

                testAudioData={audio} // Pass signal accessor
                onPlayTestAudio={handlePlayAudio}
                testError={error} // Pass signal accessor
            />
        </div>
    );
};

// --- Stories ---

export const DefaultNoSelection = {
  render: BaseRender,
  args: {
    selectedProviderId: () => undefined,
  }
};

export const ElevenLabsSelected = {
  render: BaseRender,
  args: {
    selectedProviderId: () => mockElevenLabsProvider.id,
    elevenLabsApiKey: () => 'test_api_key_123',
    selectedElevenLabsModelId: () => mockElevenLabsModels[0].id,
  }
};

export const ElevenLabsTesting = {
    render: BaseRender,
    args: {
        selectedProviderId: () => mockElevenLabsProvider.id,
        elevenLabsApiKey: () => 'test_api_key_123',
        selectedElevenLabsModelId: () => mockElevenLabsModels[0].id,
        isElevenLabsTesting: () => true,
    }
};

export const KokoroSelectedNotDownloaded = {
  render: BaseRender,
  args: {
    selectedProviderId: () => mockKokoroProvider.id,
    kokoroDownloadStatus: () => 'not-downloaded',
  }
};

export const KokoroDownloading = {
  render: BaseRender,
  args: {
    selectedProviderId: () => mockKokoroProvider.id,
    kokoroDownloadStatus: () => 'downloading',
    kokoroDownloadProgress: () => 40, // Simulate 40% progress
  }
};

export const KokoroDownloaded = {
  render: BaseRender,
  args: {
    selectedProviderId: () => mockKokoroProvider.id,
    kokoroDownloadStatus: () => 'downloaded',
    kokoroDevicePreference: () => 'webgpu',
  }
};

export const KokoroTesting = {
    render: BaseRender,
    args: {
        selectedProviderId: () => mockKokoroProvider.id,
        kokoroDownloadStatus: () => 'downloaded',
        isKokoroTesting: () => true,
    }
};

export const TestAudioAvailable = {
    render: BaseRender,
    args: {
        selectedProviderId: () => mockElevenLabsProvider.id, // or kokoro if downloaded
        testAudioData: () => new Blob(["dummy part 1", "dummy part 2"], {type: "audio/mpeg"}),
    }
};

export const TestError = {
    render: BaseRender,
    args: {
        selectedProviderId: () => mockElevenLabsProvider.id,
        testError: () => new Error("Simulated API connection failed."),
    }
}; 