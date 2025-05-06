import { Component, Show, For, Accessor, createEffect } from 'solid-js';
import { Button } from '../../components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '../../components/ui/text-field'; // Assuming TextField exists
// import { Progress } from '../../components/ui/progress'; // Removed Progress
// import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group'; // Removed RadioGroup import
import { Label } from '../../components/ui/label';
import { SpeakerSimpleHigh } from 'phosphor-solid';
import { cn } from '../../lib/utils'; // Import cn utility

// --- Prop Types ---

export interface TtsProviderOption {
    id: string;
    name: string;
    logoUrl?: string;
}

export interface TtsProviderPanelProps {
    availableProviders: TtsProviderOption[];
    selectedProviderId: Accessor<string | undefined>;
    onSelectProvider: (providerId: string | undefined) => void;

    // ElevenLabs specific
    elevenLabsApiKey: Accessor<string>;
    onElevenLabsApiKeyChange: (apiKey: string) => void;
    isElevenLabsTesting: Accessor<boolean>;
    onTestElevenLabs: () => void;

    // General Test/Audio Playback
    testAudioData: Accessor<Blob | null>;
    onPlayTestAudio: () => void;
    testError: Accessor<Error | null>;
}


// --- Component --- 

export const TtsProviderPanel: Component<TtsProviderPanelProps> = (props) => {
    // --- Debug Log for API Key Prop ---
    createEffect(() => {
        console.log('[TtsProviderPanel] elevenLabsApiKey prop updated:', props.elevenLabsApiKey());
    });

    const selectedProvider = () => props.selectedProviderId();

    return (
        <div class="w-full max-w-lg space-y-6">
            {/* --- Provider Selection Cards (Updated Styling & Image Paths) --- */}
            <div>
                <Label class="mb-2 block">TTS Provider</Label>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4"> 
                    <For each={props.availableProviders}>
                        {(provider) => {
                             const isSelected = () => selectedProvider() === provider.id;
                             // --->>> Define the correct image source based on provider ID <<<---
                             const imageSrc = () => {
                                 if (provider.id === 'elevenlabs') return '/images/llm-providers/11-labs.png';
                                 if (provider.id === 'kokoro') return '/images/llm-providers/kokoro.png';
                                 return provider.logoUrl; // Fallback to provided logoUrl if any
                             };
                             return (
                                <Button
                                    variant="outline" 
                                    class={cn(
                                        'h-auto p-4 flex flex-col items-center justify-center space-y-2 text-base border relative',
                                        'transition-colors duration-150 ease-in-out',
                                        'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0 border-neutral-700',
                                        isSelected()
                                            ? 'bg-neutral-700 text-foreground border-neutral-500 ring-2 ring-primary ring-offset-2 ring-offset-background' 
                                            : ''
                                    )}
                                    onClick={() => props.onSelectProvider(provider.id)}
                                    aria-pressed={isSelected()}
                                >
                                    {/* Use the determined imageSrc */}
                                    <Show when={imageSrc()} fallback={
                                        <div class="w-16 h-16 mb-2 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                            ? 
                                        </div>
                                    }>
                                        {(src) => (
                                            <img 
                                                src={src()} // Use the derived image source
                                                alt={`${provider.name} Logo`}
                                                class="w-16 h-16 mb-2 object-contain rounded-full"
                                            />
                                        )}
                                    </Show>
                                    <span class="mb-1.5">{provider.name}</span> 
                                </Button>
                            )
                        }}
                    </For>
                </div>
            </div>
            {/* End Provider Selection Cards */}

            {/* ElevenLabs Panel */}
            <Show when={selectedProvider() === 'elevenlabs'}>
                <div class="space-y-4">
                    {/* API Key Input */}
                    <TextField>
                        <TextFieldLabel for="elevenlabs-api-key">API Key</TextFieldLabel>
                        <TextFieldInput 
                            id="elevenlabs-api-key" 
                            type="password" 
                            placeholder="Enter your ElevenLabs API Key"
                            value={props.elevenLabsApiKey()}
                            onInput={(e) => props.onElevenLabsApiKeyChange(e.currentTarget.value)}
                        />
                    </TextField>
                    
                    {/* Play Test Audio Button - Test Connection button is removed, logic moves to footer */}
                    <Show when={props.testAudioData() && selectedProvider() === 'elevenlabs'}>
                        <div class="flex items-center gap-4 mt-4">
                            <Button onClick={props.onPlayTestAudio} variant="outline" >
                                <SpeakerSimpleHigh class="h-4 w-4 mr-1" /> Play Test Audio
                            </Button>
                        </div>
                    </Show>
                    
                    {/* General Error Display */}
                    <Show when={props.testError() && selectedProvider() === 'elevenlabs'}>
                        <p class="text-destructive">Error: {props.testError()?.message}</p>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

export default TtsProviderPanel; // Add default export 