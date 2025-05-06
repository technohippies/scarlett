import { Component, Show, For, Match, Switch, Accessor } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { TextField, TextFieldInput, TextFieldLabel } from '../../components/ui/text-field'; // Assuming TextField exists
import { Progress } from '../../components/ui/progress';
// import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group'; // Removed RadioGroup import
import { Label } from '../../components/ui/label';
import { Spinner } from '../../components/ui/spinner';
import { SpeakerSimpleHigh, CheckCircle, XCircle, DownloadSimple } from 'phosphor-solid';
import { cn } from '../../lib/utils'; // Import cn utility

// --- Prop Types ---

export interface TtsProviderOption {
    id: string;
    name: string;
    logoUrl?: string;
}

export interface TtsModelOption {
    id: string;
    name: string;
}

export type KokoroDownloadStatus = 'not-downloaded' | 'downloading' | 'downloaded' | 'error';

export interface TtsProviderPanelProps {
    availableProviders: TtsProviderOption[];
    selectedProviderId: Accessor<string | undefined>;
    onSelectProvider: (providerId: string | undefined) => void;

    // ElevenLabs specific
    elevenLabsApiKey: Accessor<string>;
    onElevenLabsApiKeyChange: (apiKey: string) => void;
    elevenLabsModels: TtsModelOption[];
    selectedElevenLabsModelId: Accessor<string | undefined>;
    onSelectElevenLabsModel: (modelId: string | undefined) => void;
    isElevenLabsTesting: Accessor<boolean>;
    onTestElevenLabs: () => void;

    // Kokoro specific
    kokoroDownloadStatus: Accessor<KokoroDownloadStatus>;
    kokoroDownloadProgress: Accessor<number>; // Percentage 0-100
    onDownloadKokoroModel: () => void;
    kokoroDevicePreference: Accessor<'cpu' | 'webgpu'>;
    onKokoroDevicePreferenceChange: (device: 'cpu' | 'webgpu') => void;
    isKokoroTesting: Accessor<boolean>;
    onTestKokoro: () => void;
    isWebGPUSupported?: Accessor<boolean>;

    // General Test/Audio Playback
    testAudioData: Accessor<Blob | null>;
    onPlayTestAudio: () => void;
    testError: Accessor<Error | null>;
}


// --- Component --- 

export const TtsProviderPanel: Component<TtsProviderPanelProps> = (props) => {

    return (
        <div class="w-full max-w-lg space-y-6">
            {/* --- Provider Selection Cards (Updated Styling & Image Paths) --- */}
            <div>
                <Label class="mb-2 block">TTS Provider</Label>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4"> 
                    <For each={props.availableProviders}>
                        {(provider) => {
                             const isSelected = () => props.selectedProviderId() === provider.id;
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
            <Show when={props.selectedProviderId() === 'elevenlabs'}>
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

                    {/* Model/Voice Selection */}
                    <Show when={props.elevenLabsApiKey().length > 0}> 
                        <div>
                             <Label for="elevenlabs-model-select">Voice/Model</Label>
                             <Select<TtsModelOption>
                                id="elevenlabs-model-select"
                                options={props.elevenLabsModels}
                                value={props.elevenLabsModels.find(m => m.id === props.selectedElevenLabsModelId())}
                                onChange={(selected) => props.onSelectElevenLabsModel(selected?.id)}
                                optionValue="id"
                                optionTextValue="name"
                                placeholder="Select Voice/Model..."
                                itemComponent={(itemProps) => (
                                    <SelectItem item={itemProps.item}>{itemProps.item.rawValue.name}</SelectItem>
                                )}
                             >
                                 <SelectTrigger aria-label="ElevenLabs Voice/Model">
                                     <SelectValue<TtsModelOption>>
                                         {(state) => state.selectedOption()?.name ?? 'Select Voice/Model...'}
                                     </SelectValue>
                                 </SelectTrigger>
                                 <SelectContent />
                             </Select>
                        </div>
                    </Show>
                    
                    {/* Test Button & Play */}
                    <Show when={props.selectedElevenLabsModelId()}> 
                        <div class="flex items-center gap-4 mt-4">
                             <Button onClick={props.onTestElevenLabs} disabled={props.isElevenLabsTesting()}> 
                                 <Show when={props.isElevenLabsTesting()} fallback={<>Test Connection</>}>
                                     <Spinner class="h-4 w-4 mr-2"/> Testing...
                                 </Show>
                             </Button>
                             <Show when={props.testAudioData() && !props.isElevenLabsTesting() && props.selectedProviderId() === 'elevenlabs'}>
                                 <Button onClick={props.onPlayTestAudio} variant="outline" size="sm">
                                     <SpeakerSimpleHigh class="h-4 w-4 mr-1" /> Play Test Audio
                                 </Button>
                             </Show>
                        </div>
                    </Show>
                    
                    {/* General Error Display */}
                    <Show when={props.testError() && props.selectedProviderId() === 'elevenlabs'}>
                        <p class="text-destructive">Error: {props.testError()?.message}</p>
                    </Show>
                </div>
            </Show>

            {/* Kokoro Panel */}
            <Show when={props.selectedProviderId() === 'kokoro'}>
                <div class="space-y-4">
                    <Switch fallback={<p class="text-muted-foreground">Invalid download state.</p>}>
                        <Match when={props.kokoroDownloadStatus() === 'not-downloaded'}>
                            <div class="text-left space-y-3">
                                <p class="text-muted-foreground">Kokoro is a 350MB model that runs locally in your browser. It requires WebGPU to be enabled in your browser.</p>
                                <Button onClick={props.onDownloadKokoroModel}>
                                    <DownloadSimple class="h-4 w-4 mr-2"/> Download Model
                                </Button>
                            </div>
                        </Match>
                        <Match when={props.kokoroDownloadStatus() === 'downloading'}>
                            <div class="space-y-2 text-left">
                                <p class="text-muted-foreground">
                                    Downloading... {((props.kokoroDownloadProgress() / 100) * 350).toFixed(0)} / 350 MB
                                </p>
                                <Progress value={props.kokoroDownloadProgress()} />
                            </div>
                        </Match>
                        <Match when={props.kokoroDownloadStatus() === 'error'}>
                             <p class="text-destructive text-left">Error downloading Kokoro model. Please try again.</p>
                             {/* Optionally add a retry button here */}
                        </Match>
                        <Match when={props.kokoroDownloadStatus() === 'downloaded'}>
                             <p class="text-green-500 flex items-center gap-2 justify-start mb-4"><CheckCircle size={16}/> Model Downloaded</p>
                             {/* Device Preference */}
                             <div>
                                 <Label class="mb-2 block">Processing Device</Label>
                                 <div class="flex gap-2">
                                    {/* WebGPU Button (now first) */}
                                    <Button 
                                        variant={props.kokoroDevicePreference() === 'webgpu' ? 'secondary' : 'outline'}
                                        onClick={() => props.onKokoroDevicePreferenceChange('webgpu')}
                                        size="sm"
                                        class="flex-1 text-md"
                                        disabled={props.isWebGPUSupported && !props.isWebGPUSupported()} 
                                        title={props.isWebGPUSupported && !props.isWebGPUSupported() ? "WebGPU not available in your browser" : "Use WebGPU for processing"}
                                    >
                                        WebGPU
                                    </Button>
                                    {/* CPU Button (now second) */}
                                    <Button 
                                        variant={props.kokoroDevicePreference() === 'cpu' ? 'secondary' : 'outline'}
                                        onClick={() => props.onKokoroDevicePreferenceChange('cpu')}
                                        size="sm"
                                        class="flex-1 text-md"
                                        title="Use CPU (WASM) for processing"
                                    >
                                        CPU
                                    </Button>
                                 </div>
                                 {/* Informational text if WebGPU is not supported */}
                                 <Show when={props.isWebGPUSupported && !props.isWebGPUSupported()}>
                                     <p class="text-xs text-muted-foreground mt-2">
                                         WebGPU is not detected or supported in your browser. CPU will be used. Performance may be degraded. <br />
                                         Consider enabling WebGPU in browser flags (e.g., Chrome: <code>chrome://flags/#enable-unsafe-webgpu</code>, Firefox: <code>about:config</code> and set <code>dom.webgpu.enabled</code> to <code>true</code>).
                                     </p>
                                 </Show>
                             </div>
                             {/* Test Button & Play */}
                             <div class="flex items-center gap-4 mt-6">
                                 <Button onClick={props.onTestKokoro} disabled={props.isKokoroTesting()}> 
                                     <Show when={props.isKokoroTesting()} fallback={<>Test Generation</>}>
                                         <Spinner class="h-4 w-4 mr-2"/> Testing...
                                     </Show>
                                 </Button>
                                 <Show when={props.testAudioData() && !props.isKokoroTesting() && props.selectedProviderId() === 'kokoro'}>
                                     <Button onClick={props.onPlayTestAudio} variant="outline" size="sm">
                                         <SpeakerSimpleHigh class="h-4 w-4 mr-1" /> Play Test Audio
                                     </Button>
                                 </Show>
                             </div>
                             {/* General Error Display */}
                            <Show when={props.testError() && props.selectedProviderId() === 'kokoro'}>
                                <p class="text-destructive mt-4">Error: {props.testError()?.message}</p>
                            </Show>
                        </Match>
                    </Switch>
                </div>
            </Show>
        </div>
    );
};

export default TtsProviderPanel; // Add default export 