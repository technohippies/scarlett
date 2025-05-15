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
  },
  args: { // Default args
    availableVadOptions: [mockSileroVadOption],
    selectedVadId: () => undefined, // No VAD selected initially
    isVadTesting: () => false,
    vadStatusMessage: () => null,
    vadTestError: () => null,
  },
};

// --- Base Render Function --- 
const BaseRender = (args: VadPanelProps) => {
    // Create signals for props that can change
    const [selectedVad, setSelectedVad] = createSignal<string | undefined>(args.selectedVadId());
    const [isTesting, setIsTesting] = createSignal<boolean>(args.isVadTesting());
    const [statusMsg, setStatusMsg] = createSignal<string | null>(args.vadStatusMessage());
    const [error, setError] = createSignal<Error | null>(args.vadTestError());

    // Effects to update signals if Storybook controls change them
    createEffect(() => setSelectedVad(args.selectedVadId()));
    createEffect(() => setIsTesting(args.isVadTesting()));
    createEffect(() => setStatusMsg(args.vadStatusMessage()));
    createEffect(() => setError(args.vadTestError()));

    const handleSelectVad = (vadId: string | undefined) => {
        args.onSelectVad(vadId); // Propagate action for Storybook logging
        setSelectedVad(vadId);
    };

    const handleTestVad = () => {
        args.onTestVad(); // Propagate action
        const currentlyTesting = isTesting();
        setIsTesting(!currentlyTesting);
        if (!currentlyTesting) {
            setStatusMsg("Listening..."); // Simulate starting test
            // Simulate receiving speech or no speech after a delay
            setTimeout(() => {
                if (isTesting()) { // Check if still testing
                    setStatusMsg(Math.random() > 0.5 ? "Speech detected" : "No speech detected");
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

    return (
        <div class="p-4 bg-background max-w-xl mx-auto">
            <VadPanel
                availableVadOptions={args.availableVadOptions}
                selectedVadId={selectedVad} // Use signal accessor
                onSelectVad={handleSelectVad}
                
                isVadTesting={isTesting} // Use signal accessor
                onTestVad={handleTestVad} 
                onStopVadTest={handleStopVadTest} // Pass explicit stop handler

                vadStatusMessage={statusMsg} // Use signal accessor
                vadTestError={error} // Use signal accessor
            />
        </div>
    );
};

// --- Stories ---

export const DefaultNoSelection = {
  render: BaseRender,
  args: {
    selectedVadId: () => undefined,
  }
};

export const SileroVadSelected = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
  }
};

export const SileroVadTesting = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => true,
    vadStatusMessage: () => "Listening... (simulated)",
  }
};

export const SileroVadSpeechDetected = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    isVadTesting: () => false, // Test might have stopped after detection
    vadStatusMessage: () => "Speech detected (simulated)",
  }
};

export const SileroVadError = {
  render: BaseRender,
  args: {
    selectedVadId: () => mockSileroVadOption.id,
    vadTestError: () => new Error("Simulated VAD initialization failed."),
  }
}; 