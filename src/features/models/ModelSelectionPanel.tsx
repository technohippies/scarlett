import { Component, Show, For, Switch, Match } from 'solid-js';
import { Callout, CalloutContent } from '../../components/ui/callout';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { Label } from '../../components/ui/label';
import { Spinner } from '../../components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Combobox, 
  ComboboxContent, 
  ComboboxControl, 
  ComboboxInput, 
  ComboboxItem, 
  ComboboxItemIndicator, 
  ComboboxItemLabel, 
  ComboboxTrigger 
} from '../../components/ui/combobox';
import type { ProviderOption } from './ProviderSelectionPanel'; // Import from sibling
import { getOS } from '../../lib/os';
import { Motion, Presence } from 'solid-motionone';

// --- Import the new external component --- 
import OllamaCorsInstructions from './OllamaCorsInstructions';

// Re-use or import ModelOption
export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  status?: string; // Keep for Jan filtering logic if needed here
}

// Helper types
type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

// Helper function (can be imported or defined locally)
const shouldShowCorsHelp = (error: Error | null): boolean => {
  if (!error) return false;
  const status = (error as any)?.status;
  return (
    error instanceof TypeError ||
    error.message?.includes('fetch') ||
    status === 403 // Explicitly include 403 Forbidden
  );
};

// --- Ollama CORS Instructions Component (Remove this internal definition) ---
// interface OllamaCorsInstructionsProps {
//   _forceOS?: 'linux' | 'macos' | 'windows' | 'unknown';
// }
// const OllamaCorsInstructions: Component<OllamaCorsInstructionsProps> = (props) => {
//   const os = props._forceOS || getOS();
//   return (
//     <div class="w-full max-w-lg">
//        <Switch fallback={<p class="text-xs text-muted-foreground">Instructions not available.</p>}>
//         <Match when={os === 'linux'}>
//           {/* Linux instructions */}
//           <div class="space-y-2">
//             <p>1. Copy paste into Terminal</p>
//             <CodeBlock language="bash" code="sudo systemctl edit ollama.service" />
//             <p>2. Copy and paste this under [Service]</p>
//             <CodeBlock language="plaintext" code={'Environment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_ORIGINS=*"'} />
//             <p>3. Save, exit, restart</p>
//             <CodeBlock language="bash" code="sudo systemctl restart ollama" />
//           </div>
//         </Match>
//         <Match when={os === 'macos'}>
//           {/* macOS instructions */}
//           <div class="space-y-2">
//                 <p>1. Copy paste into Terminal</p>
//                 <div>
//                   <CodeBlock language="bash" code={'launchctl setenv OLLAMA_HOST "0.0.0.0" && launchctl setenv OLLAMA_ORIGINS "*"'} /> 
//                 </div>
//                 <p>2. Restart Ollama (quit and open)</p>
//             </div>
//         </Match>
//         <Match when={os === 'windows'}>
//           {/* Windows instructions */}
//           <div class="space-y-2">
//                 <p>1. Open System Properties &gt; Environment Variables</p>
//                 <p>2. Under "System variables", click "New...".</p>
//                 <p>3. Add Variable name: <code class="bg-neutral-700 px-1 py-0.5 rounded">OLLAMA_HOST</code>, Value: <code class="bg-neutral-700 px-1 py-0.5 rounded">0.0.0.0</code></p>
//                 <p>4. Add Variable name: <code class="bg-neutral-700 px-1 py-0.5 rounded">OLLAMA_ORIGINS</code>, Value: <code class="bg-neutral-700 px-1 py-0.5 rounded">*</code></p>
//                 <p>5. Click OK, then restart Ollama</p>
//                 <img 
//                     src="/images/llm-providers/ollama-cors-windows.png"
//                     alt="Ollama Windows Environment Variables settings"
//                     class="mt-4 rounded border border-neutral-700"
//                 />
//             </div>
//         </Match>
//         <Match when={os === 'unknown'}>
//           <p class="text-xs text-muted-foreground">Could not detect OS for specific Ollama instructions. Please consult Ollama documentation for enabling CORS.</p>
//         </Match>
//       </Switch>
//     </div>
//   );
// };

// --- ModelSelectionPanel Props ---
export interface ModelSelectionPanelProps {
  functionName: string; // "LLM", "Embedding", "Reader"
  selectedProvider: () => ProviderOption | undefined; // Accessor
  fetchStatus: () => FetchStatus; // Accessor
  showSpinner: () => boolean; // Accessor for delayed spinner
  fetchError: () => Error | null; // Accessor
  fetchedModels: () => ModelOption[]; // Accessor for local/primary models
  remoteModels: () => ModelOption[]; // Accessor for Jan remote models
  selectedModelId: () => string | undefined; // Accessor
  onSelectModel: (modelId: string | undefined) => void;
  // Prop specifically for Storybook control
  _forceOSForOllamaInstructions?: 'linux' | 'macos' | 'windows' | 'unknown'; 
  // Messages for i18n - can be optional or required based on needs
  // messages?: Accessor<Messages | undefined>;
}

export const ModelSelectionPanel: Component<ModelSelectionPanelProps> = (props) => {
    
  // Simplified i18n getter for internal use if needed
  // const i18n = () => {
  //   const messages = props.messages ? props.messages() : undefined;
  //   return {
  //     get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
  //   };
  // };

  return (
    <div class="w-full max-w-lg space-y-4">
        {/* --- Spinner --- */}
        <Show when={props.showSpinner()}>
            <div class="flex justify-center items-center space-x-2 text-muted-foreground">
                <Spinner class="h-6 w-6"/>
            </div>
        </Show>

        {/* --- Initial Fetch Error Handling --- */}
        <Show when={props.fetchStatus() === 'error' && props.fetchError()}>
            <Callout variant="error">
                <CalloutContent>
                    {/* Simplified error message logic, assuming parent passes formatted message or handles i18n */}
                    {(props.fetchError() instanceof TypeError || (props.fetchError() as any)?.message?.includes('fetch')) ? (
                        <p class="text-lg">
                            Error: Is the server running on {props.selectedProvider()?.defaultBaseUrl || ''}? Is CORS enabled?
                        </p>
                    ) : (props.fetchError() as any)?.status ? (
                        <p class="text-lg">
                            Server responded with error: {(props.fetchError() as any).status}. Please check the API endpoint.
                        </p>
                    ) : (
                        <p class="text-lg">An unknown error occurred: {props.fetchError()?.message || ''}</p>
                    )}
                </CalloutContent>
            </Callout>

            {/* Show CORS Help based on error and provider */} 
            {shouldShowCorsHelp(props.fetchError()) && (
                <Switch fallback={<p class="text-muted-foreground">Ensure CORS is enabled on your LLM server.</p>}>
                    <Match when={props.selectedProvider()?.id === 'ollama'}>
                        <OllamaCorsInstructions _forceOS={props._forceOSForOllamaInstructions} />
                    </Match>
                    <Match when={props.selectedProvider()?.id === 'jan'}>
                        <img 
                            src="/images/llm-providers/Jan-help.png" 
                            alt="Jan CORS setting location" 
                            class="rounded border border-neutral-700"
                        />
                    </Match>
                    <Match when={props.selectedProvider()?.id === 'lmstudio'}>
                        <img 
                            src="/images/llm-providers/LMStudio-help.png" 
                            alt="LM Studio CORS setting location" 
                            class="rounded border border-neutral-700"
                        />
                    </Match>
                </Switch>
            )}
        </Show>

        {/* --- Model Selection UI --- */}
        {/* Wrap with Presence for solid-motionone */}
        {/* Keying the Presence/Motion on selectedProviderId helps trigger animations on provider change */}
        <Presence>
          <Show when={props.selectedProvider()}>
              <Motion.div
                class="w-full max-w-lg"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, easing: "ease-out" }}
                // Use exitBeforeEnter if providers change rapidly and animations overlap
                // exitBeforeEnter 
              >
                  {/* --- Download Instructions (Ollama specific) --- */}
                  <Show when={props.functionName === 'Reader' && props.selectedProvider()?.id === 'ollama'}>
                    <div class="w-full max-w-lg mt-4 mb-4 space-y-2">
                      <CodeBlock language="bash" code="ollama run milkey/reader-lm-v2" label="Download"/>
                    </div>
                  </Show>
                  <Show when={props.functionName === 'Embedding' && props.selectedProvider()?.id === 'ollama'}>
                    <div class="w-full max-w-lg mt-4 mb-4 space-y-2">
                      <CodeBlock language="bash" code="ollama pull bge-m3" label="Download"/>
                    </div>
                  </Show>
                  
                  {/* --- Selectors (Conditional on successful fetch) --- */}
                  <Show when={props.fetchStatus() === 'success'}>
                      <div class="mt-6 space-y-4"> {/* Added margin top */}
                          <Switch>
                              {/* --- Jan Provider UI --- */}
                              <Match when={props.selectedProvider()?.id === 'jan'}>
                                  <Motion.div 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }} 
                                    transition={{ delay: 0.15, duration: 0.2 }}
                                  >
                                    {/* Local Models */}
                                    <div>
                                      <Label for="local-model-select" class="font-medium text-muted-foreground mb-1 block">Local LLM</Label>
                                      <Select<ModelOption>
                                        options={props.fetchedModels()}
                                        optionValue="id"
                                        optionTextValue="name"
                                        onChange={(value) => { 
                                            console.log('[ModelSelectionPanel] Local Select onChange fired. Value:', value);
                                            props.onSelectModel(value?.id);
                                        }}
                                        value={props.fetchedModels().find(m => m.id === props.selectedModelId()) || null}
                                        itemComponent={(itemProps) => (
                                          <SelectItem item={itemProps.item}>{itemProps.item.rawValue.name}</SelectItem>
                                        )}
                                      >
                                        <SelectTrigger id="local-model-select">
                                          <SelectValue>
                                            {props.fetchedModels().find(m => m.id === props.selectedModelId())?.name || 
                                             <span class="text-muted-foreground">Select Local Model</span>}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <Show when={!props.fetchedModels() || props.fetchedModels().length === 0}>
                                            <div class="px-2 py-1.5 text-muted-foreground">No local models found.</div>
                                          </Show>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Remote/Downloadable Models */}
                                    <Show when={props.remoteModels().length > 0}>
                                      <div class="text-left text-muted-foreground my-2">or</div>
                                      <div class="w-full">
                                        <Label for="remote-model-combo" class="font-medium text-muted-foreground mb-1 block">Remote LLM</Label>
                                        <Combobox<ModelOption>
                                          id="remote-model-combo"
                                          options={[...props.remoteModels()].sort((a, b) => a.name.localeCompare(b.name))}
                                          optionValue="id"
                                          optionTextValue="name"
                                          placeholder="Search"
                                          value={props.remoteModels().find(m => m.id === props.selectedModelId()) || null}
                                          onChange={(value) => props.onSelectModel(value?.id)}
                                          itemComponent={(itemProps) => (
                                            <ComboboxItem item={itemProps.item}>
                                              <ComboboxItemLabel>{itemProps.item.rawValue.name}</ComboboxItemLabel>
                                              <ComboboxItemIndicator />
                                            </ComboboxItem>
                                          )}
                                        >
                                          <ComboboxControl aria-label="Remote Model">
                                            <ComboboxInput value={props.remoteModels().find(m => m.id === props.selectedModelId())?.name || ''}/>
                                            <ComboboxTrigger />
                                          </ComboboxControl>
                                          <ComboboxContent class="max-h-72 overflow-y-auto">
                                            <Show when={!props.remoteModels() || props.remoteModels().length === 0}>
                                                <div class="px-2 py-1.5 text-muted-foreground">No remote models found.</div>
                                            </Show>
                                          </ComboboxContent>
                                        </Combobox>
                                      </div>
                                    </Show>
                                  </Motion.div>
                              </Match>

                              {/* --- Other Providers UI --- */}
                              <Match when={props.selectedProvider()?.id !== 'jan'}>
                                  <div>
                                    <Label for="model-select-other" class="font-medium text-muted-foreground mb-1 block">{props.functionName}</Label>
                                    <Select<ModelOption>
                                      options={props.fetchedModels()}
                                      optionValue="id"
                                      optionTextValue="name"
                                      onChange={(value) => props.onSelectModel(value?.id)}
                                      value={props.fetchedModels().find(m => m.id === props.selectedModelId()) || null}
                                      itemComponent={(itemProps) => (
                                        <SelectItem item={itemProps.item}>{itemProps.item.rawValue.name}</SelectItem>
                                      )}
                                    >
                                      <SelectTrigger id="model-select-other">
                                        <SelectValue>
                                          {props.fetchedModels().find(m => m.id === props.selectedModelId())?.name ||
                                           <span class="text-muted-foreground">Select Model</span>}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent class="max-h-72 overflow-y-auto">
                                        <Show when={!props.fetchedModels() || props.fetchedModels().length === 0}>
                                            <div class="px-2 py-1.5 text-muted-foreground">No models found for this provider.</div>
                                        </Show>
                                      </SelectContent>
                                    </Select>
                                  </div>
                              </Match>
                          </Switch>
                      </div>
                  </Show>
              </Motion.div>
          </Show>
        </Presence>
    </div>
  );
};

export default ModelSelectionPanel; 