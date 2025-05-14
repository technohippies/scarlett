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

// Helper function (can be placed inside the component or outside)
const getModelTypeLabel = (funcName: string): string => {
  switch (funcName) {
    case 'Embedding': return 'Embedding Model';
    case 'Reader': return 'Reader Model';
    case 'LLM': // Fallthrough intended
    default: return 'LLM'; // Default to LLM
  }
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
        <Presence>
          <Show when={props.selectedProvider() && props.fetchStatus() === 'success'}>
              <Motion.div
                class="w-full max-w-lg space-y-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, easing: "ease-out" }}
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
                  
                  {/* --- Local Model Selection --- */}
                  <Show when={props.fetchedModels().length > 0}>
                    <Label for="local-model-select" class="mb-2">Local {getModelTypeLabel(props.functionName)}</Label>
                    <Select<ModelOption>
                      id="local-model-select"
                      value={props.fetchedModels().find(m => m.id === props.selectedModelId())}
                      onChange={(selectedOption: ModelOption | null) => {
                        props.onSelectModel(selectedOption?.id);
                      }}
                      options={props.fetchedModels()}
                      optionValue="id"
                      optionTextValue="name"
                      placeholder="Select model"
                      itemComponent={(itemProps) => (
                        <SelectItem item={itemProps.item}>{itemProps.item.rawValue.name}</SelectItem>
                      )}
                    >
                      <SelectTrigger aria-label="Model">
                        <SelectValue<ModelOption>>
                          {(state) => state.selectedOption()?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                  </Show>

                  {/* --- Remote Model Selection (Jan specific) --- */}
                  <Show when={props.remoteModels().length > 0}>
                      <Label for="remote-model-combobox" class="mb-2">Remote LLM</Label>
                      <Combobox<ModelOption>
                          id="remote-model-combobox"
                          options={props.remoteModels()}
                          optionValue="id"
                          optionTextValue="name"
                          placeholder={`Search downloadable LLMs...`}
                          onChange={(selectedOption: ModelOption | null) => {
                            console.log(`[ModelSelectionPanel] Remote model selected via Combobox: ${selectedOption?.id}`);
                            props.onSelectModel(selectedOption?.id);
                          }}
                          itemComponent={(itemProps) => (
                            <ComboboxItem item={itemProps.item}>
                              <ComboboxItemLabel>{itemProps.item.rawValue.name}</ComboboxItemLabel>
                              <ComboboxItemIndicator />
                            </ComboboxItem>
                          )}
                      >
                          <ComboboxControl<ModelOption>
                              aria-label={`Select remote LLM`}>
                              {(state) => (
                                  <>
                                      <ComboboxInput value={state.selectedOptions().length > 0 ? state.selectedOptions()[0].name : ''} />
                                      <ComboboxTrigger />
                                  </>
                              )}
                          </ComboboxControl>
                          <ComboboxContent class="combobox__content max-h-72 overflow-y-auto">
                          </ComboboxContent>
                      </Combobox>
                  </Show>

                  {/* --- No Models Found Message --- */}
                  <Show when={props.fetchStatus() === 'success' && props.fetchedModels().length === 0 && props.remoteModels().length === 0}>
                      <p class="text-muted-foreground text-center py-4">
                          No {getModelTypeLabel(props.functionName).toLowerCase()} models found for {props.selectedProvider()?.name || 'this provider'}.
                      </p>
                  </Show>
              </Motion.div>
          </Show>
        </Presence>
    </div>
  );
};

export default ModelSelectionPanel; 