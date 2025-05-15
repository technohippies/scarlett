import { Component, Show, For, Accessor } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { Microphone } from 'phosphor-solid';
import { Spinner } from '../../components/ui/spinner';


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

    // UI Customization props
    hideSelector?: Accessor<boolean>;
    hideTestHeader?: Accessor<boolean>;
    testButtonFullWidth?: Accessor<boolean>;
    testButtonLarge?: Accessor<boolean>;
    hideTestButtonIcon?: Accessor<boolean>;
    statusMessageClass?: Accessor<string>;
    hideAudioLabel?: Accessor<boolean>;
}


// --- Component ---

export const VadPanel: Component<VadPanelProps> = (props) => {
    const selectedVad = () => props.selectedVadId();
    const isLoading = () => props.isVadLoading && props.isVadLoading();
    const canPlayRecording = () => !!props.lastRecordedAudioUrl();

    const showSelector = () => !(props.hideSelector && props.hideSelector());
    const showTestHeader = () => !(props.hideTestHeader && props.hideTestHeader());
    const showTestButtonIcon = () => !(props.hideTestButtonIcon && props.hideTestButtonIcon());

    return (
        <div class="w-full max-w-lg space-y-6">
            {/* --- VAD Option Selection (conditionally rendered) --- */}
            <Show when={showSelector()}>
                <div>
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
            </Show>

            {/* --- Silero VAD Specific Controls --- */}
            <Show when={selectedVad() === 'silero_vad'}> 
                <div class="space-y-4 rounded-md">
                    <Show when={showTestHeader()}>
                        <div class="flex justify-between items-center">
                            <h3 class="text-lg font-medium text-foreground">Speech to Text</h3>
                            <Show when={isLoading()}>
                                <Spinner class="h-4 w-4" />
                            </Show>
                        </div>
                    </Show>
                    
                    <div class={cn(
                        props.testButtonFullWidth && props.testButtonFullWidth() 
                            ? "w-full mt-2" 
                            : "flex items-center gap-4 mt-2"
                    )}>
                        <Button 
                            onClick={() => {
                                if (props.isVadTesting()) {
                                    props.onStopVadTest ? props.onStopVadTest() : props.onTestVad();
                                } else {
                                    props.onTestVad();
                                }
                            }} 
                            variant="outline"
                            size={props.testButtonLarge && props.testButtonLarge() ? "lg" : "default"}
                            class={cn(
                                props.testButtonFullWidth && props.testButtonFullWidth() ? "w-full" : ""
                            )}
                            disabled={selectedVad() !== 'silero_vad' || isLoading() || props.isTranscribing() || (props.isVadTesting() && props.isTranscribing())}
                        >
                            <Show when={showTestButtonIcon()}>
                                <Microphone class="h-4 w-4 mr-1.5" />
                            </Show>
                            {isLoading() ? 'Initializing...' 
                                : props.isTranscribing() ? 'Transcribing...' 
                                : props.isVadTesting() ? 'Listening...' 
                                : 'Test'}
                        </Button>
                    </div>

                    <Show when={props.vadStatusMessage() && !props.vadTestError() && !isLoading() && !props.isVadTesting() && !props.isTranscribing()}>
                        <p class={cn(
                            "text-sm text-muted-foreground",
                            props.statusMessageClass ? props.statusMessageClass() : ""
                        )}>Status: {props.vadStatusMessage()}</p>
                    </Show>
                    
                    <Show when={canPlayRecording() && !props.isVadTesting() && !isLoading() && !props.isTranscribing()}>
                        <div class="mt-2 space-y-2">
                            <audio controls src={props.lastRecordedAudioUrl()!} class="w-full h-10"></audio>
                        </div>
                    </Show>

                    {/* STT Status and Results */}
                    <Show when={props.transcribedText() && !props.isTranscribing()}> 
                        <div class="mt-2 space-y-1">
                            <p class="text-sm p-2 border border-neutral-700 rounded-md bg-neutral-800 whitespace-pre-wrap">{props.transcribedText()}</p>
                        </div>
                    </Show>

                    <Show when={props.sttError() && !props.isTranscribing()}> 
                        <p class="text-destructive mt-2">STT Error: {props.sttError()?.message}</p>
                    </Show>

                    {/* Show only VAD test errors directly. Other statuses are on button or implicit. */}
                    <Show when={props.vadTestError() && !isLoading() && !props.isTranscribing() && !props.isVadTesting()}>
                        <p class={cn(
                            "text-sm text-destructive", // Make it clear it's an error
                            props.statusMessageClass ? props.statusMessageClass() : "" // Allow override if needed, but default to error styling
                        )}>Error: {props.vadTestError()?.message}</p>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

export default VadPanel; 