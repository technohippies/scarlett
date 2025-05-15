import { Component, Show, For, Accessor, createSignal, createEffect } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { cn } from '../../lib/utils';
import { SpeakerSimpleHigh, Record as RecordIcon, StopCircle, PlayCircle, TextAa } from 'phosphor-solid';
import { Spinner } from '../../components/ui/spinner';
// import * as ort from 'onnxruntime-web'; // Commented out
// import { browser } from 'wxt/browser'; // Commented out

// This should be placed at the beginning of the file or before ONNX is used.
/* // Commenting out the entire block
if (typeof ort !== 'undefined' && ort.env && ort.env.wasm) {
  // Ensure this path matches exactly where your ONNX worker scripts are located
  // relative to your 'public' or 'assets' folder, and that 'vad-assets'
  // is correctly listed in `web_accessible_resources` in your wxt.config.ts.
  // @ts-ignore
  ort.env.wasm.workerPath = browser.runtime.getURL('vad-assets/ort-wasm-threaded.js' as string); // Or ort-wasm.js if not using threads

  // Optional: If you want to explicitly disable threading and SIMD to try and avoid workers
  // (though setting workerPath is generally the more robust solution for CSP)
  // @ts-ignore
  // ort.env.wasm.numThreads = 1;
  // @ts-ignore
  // ort.env.wasm.simd = false;

  // @ts-ignore
  console.log('ONNX Runtime WASM worker path set to:', ort.env.wasm.workerPath);
} else {
  console.warn("ONNX Runtime (ort) or ort.env.wasm is not available. Worker path not set. This might lead to CSP issues if workers are used.");
}
*/

// --- Prop Types ---

export interface VadOption {
    id: string;
    name: string;
    logoUrl?: string;
}

export interface VadPanelProps {
    availableVadOptions: VadOption[];
    selectedVadId: Accessor<string | undefined>;
    onSelectVad: (vadId: string | undefined) => void;

    isVadTesting: Accessor<boolean>;
    onTestVad: () => void;
    onStopVadTest?: () => void;

    vadStatusMessage: Accessor<string | null>;
    vadTestError: Accessor<Error | null>;
    isVadLoading?: Accessor<boolean>;

    // Playback props
    lastRecordedAudioUrl: Accessor<string | null>;
    onPlayLastRecording: () => void;

    // STT props
    onTranscribe: () => Promise<void>;
    transcribedText: Accessor<string | null>;
    isTranscribing: Accessor<boolean>;
    sttError: Accessor<Error | null>;
}


// --- Component ---

export const VadPanel: Component<VadPanelProps> = (props) => {
    const selectedVad = () => props.selectedVadId();
    const isSileroSelected = () => selectedVad() === 'silero_vad';
    const isLoading = () => props.isVadLoading && props.isVadLoading();
    const canPlayRecording = () => !!props.lastRecordedAudioUrl();
    const canTranscribe = () => canPlayRecording() && !props.isTranscribing() && !props.isVadTesting();

    return (
        <div class="w-full max-w-lg space-y-6">
            {/* --- VAD Option Selection (disabled while loading) --- */}
            <div>
                <Label class="mb-2 block">VAD Option</Label>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <For each={props.availableVadOptions}>
                        {(vadOption) => {
                             const isSelected = () => selectedVad() === vadOption.id;
                             const imageSrc = () => vadOption.logoUrl;
                             return (
                                <Button
                                    variant="outline"
                                    disabled={isLoading()}
                                    class={cn(
                                        'h-auto p-4 flex flex-col items-center justify-center space-y-2 text-base border relative',
                                        'transition-colors duration-150 ease-in-out',
                                        'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0 border-neutral-700',
                                        isSelected()
                                            ? 'bg-neutral-700 text-foreground border-neutral-500 ring-2 ring-primary ring-offset-2 ring-offset-background'
                                            : ''
                                    )}
                                    onClick={() => props.onSelectVad(vadOption.id)}
                                    aria-pressed={isSelected()}
                                >
                                    <Show when={imageSrc()} fallback={
                                        <div class="w-16 h-16 mb-2 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                            {vadOption.name.substring(0,1)}
                                        </div>
                                    }>
                                        {(src) => (
                                            <img
                                                src={src()}
                                                alt={`${vadOption.name} Logo`}
                                                class="w-16 h-16 mb-2 object-contain rounded-full"
                                            />
                                        )}
                                    </Show>
                                    <span class="mb-1.5">{vadOption.name}</span>
                                </Button>
                            )
                        }}
                    </For>
                </div>
            </div>

            {/* --- Silero VAD Specific Controls --- */}
            <Show when={isSileroSelected()}>
                <div class="space-y-4 p-4 border border-neutral-700 rounded-md">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-medium text-foreground">Silero VAD Test</h3>
                        <Show when={isLoading()}>
                            <Spinner class="h-4 w-4" />
                        </Show>
                    </div>
                    
                    <div class="flex items-center gap-4 mt-2">
                        <Button 
                            onClick={() => {
                                if (props.isVadTesting()) {
                                    props.onStopVadTest ? props.onStopVadTest() : props.onTestVad();
                                } else {
                                    props.onTestVad();
                                }
                            }} 
                            variant="outline"
                            disabled={!isSileroSelected() || isLoading() || props.isTranscribing()}
                        >
                            <Show when={props.isVadTesting()} fallback={<RecordIcon class="h-4 w-4 mr-1.5" />}>
                                <StopCircle class="h-4 w-4 mr-1.5" />
                            </Show>
                            {props.isVadTesting() ? 'Stop Test' : (isLoading() ? 'Initializing...' : 'Start Test')}
                        </Button>
                    </div>

                    <Show when={props.vadStatusMessage() && !isLoading() && !props.isTranscribing()}>
                        <p class="text-sm text-muted-foreground">Status: {props.vadStatusMessage()}</p>
                    </Show>
                    
                    <Show when={canPlayRecording() && !props.isVadTesting() && !isLoading() && !props.isTranscribing()}>
                        <div class="mt-2 space-y-2">
                            <Label class="text-xs mb-1 block">Last Captured Audio:</Label>
                            <audio controls src={props.lastRecordedAudioUrl()!} class="w-full h-10"></audio>
                        </div>
                    </Show>

                    {/* STT Status and Results */}
                    <Show when={props.isTranscribing()}> 
                        <div class="mt-2 flex items-center space-x-2 text-sm text-muted-foreground">
                            <Spinner class="h-4 w-4" />
                            <span>Transcribing audio...</span>
                        </div>
                    </Show>

                    <Show when={props.transcribedText() && !props.isTranscribing()}> 
                        <div class="mt-2 space-y-1">
                            <Label class="text-xs mb-1 block">Transcription:</Label>
                            <p class="text-sm p-2 border border-neutral-700 rounded-md bg-neutral-800 whitespace-pre-wrap">{props.transcribedText()}</p>
                        </div>
                    </Show>

                    <Show when={props.sttError() && !props.isTranscribing()}> 
                        <p class="text-destructive mt-2">STT Error: {props.sttError()?.message}</p>
                    </Show>

                    <Show when={props.vadTestError() && !isLoading() && !props.isTranscribing()}> 
                        <p class="text-destructive">VAD Error: {props.vadTestError()?.message}</p>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

export default VadPanel; 