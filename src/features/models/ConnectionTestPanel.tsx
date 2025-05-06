import { Component, Show, Switch, Match } from 'solid-js';
import { Spinner } from '../../components/ui/spinner';
import { CheckCircle, WarningCircle, SpeakerSimpleHigh } from 'phosphor-solid';
import type { ProviderOption } from './ProviderSelectionPanel'; // Import from sibling
// Import OllamaCorsInstructions from ModelSelectionPanel
import OllamaCorsInstructions from './OllamaCorsInstructions';
import { Button } from '../../components/ui/button'; // Added Button

// Helper type
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

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

export interface ConnectionTestPanelProps {
  testStatus: () => TestStatus; // Accessor
  testError: () => Error | null; // Accessor
  functionName: string; // To display context in messages if needed
  selectedProvider: () => ProviderOption | undefined; // Accessor, needed for CORS help
  testAudioData?: () => Blob | null; // Optional: Blob for TTS audio
  onPlayAudio?: () => void; // Optional: Handler to play audio
   // Prop specifically for Storybook control
  _forceOSForOllamaInstructions?: 'linux' | 'macos' | 'windows' | 'unknown';
  // Optional i18n messages
  // messages?: Accessor<Messages | undefined>;
}

export const ConnectionTestPanel: Component<ConnectionTestPanelProps> = (props) => {

  // Simplified i18n getter for internal use if needed
  // const i18n = () => {
  //   const messages = props.messages ? props.messages() : undefined;
  //   return {
  //     get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
  //   };
  // };

  return (
    <div class="w-full max-w-lg min-h-[6rem] mt-4"> {/* Add min-height and margin */}
      {/* --- Connection Test Section --- */}
      <div class="flex flex-col space-y-2">
          {/* Test status messages */}
          <Show when={props.testStatus() === 'testing'}>
              <div class="flex items-center text-muted-foreground">
              {/* Use functionName in testing message */}
              <Spinner class="mr-2 h-4 w-4 animate-spin" />
              <span>Connecting...</span>
              </div>
          </Show>
          
          <Show when={props.testStatus() === 'error' && props.testError()}>
              <>
                  {/* Error Message */}
                  <div class="text-destructive flex items-center">
                      <WarningCircle class="mr-2 h-4 w-4 flex-shrink-0" /> {/* Added flex-shrink-0 */}
                      <span class="break-words"> {/* Allow message to wrap */} 
                          {(() => {
                              const error = props.testError();
                              const status = (error as any)?.status;
                              if (status === 403) {
                                  return 'Error: Connection failed (403 Forbidden). Check API key or CORS.';
                              } else if (error?.name === 'TimeoutError') {
                                  return 'Connection failed: Timed out.';
                              } else {
                                  // Provide a more generic message but include the error text
                                  return `Connection test failed: ${error?.message || 'Unknown error'}`;
                              }
                          })()}
                      </span>
                  </div>

                  {/* CORS Help (if applicable) */}
                  {shouldShowCorsHelp(props.testError()) && (
                      <div class="mt-2 pl-6"> {/* Indent CORS help slightly */}
                          <Switch fallback={<p class="text-xs text-muted-foreground">Ensure CORS is enabled on your server.</p>}>
                              <Match when={props.selectedProvider()?.id === 'ollama'}>
                                  <OllamaCorsInstructions _forceOS={props._forceOSForOllamaInstructions} />
                              </Match>
                              <Match when={props.selectedProvider()?.id === 'jan'}>
                                  <img
                                      src="/images/llm-providers/Jan-help.png"
                                      alt="Jan CORS setting location"
                                      class="rounded border border-neutral-700 max-w-sm" // Limit image width
                                  />
                              </Match>
                              <Match when={props.selectedProvider()?.id === 'lmstudio'}>
                                  <img
                                      src="/images/llm-providers/LMStudio-help.png"
                                      alt="LM Studio CORS setting location"
                                      class="rounded border border-neutral-700 max-w-sm" // Limit image width
                                  />
                              </Match>
                          </Switch>
                      </div>
                  )}
              </>
          </Show>

          <Show when={props.testStatus() === 'success'}>
              <div class="text-green-500 flex items-center">
                  <CheckCircle class="mr-2 h-4 w-4" />
                  <span>Success!</span>
                  {/* Conditionally show Play button for TTS */}
                  <Show when={props.functionName === 'TTS' && props.testAudioData && props.testAudioData()}> 
                     <Button 
                       variant="outline"
                       size="sm"
                       class="ml-4"
                       onClick={props.onPlayAudio} 
                     >
                        <SpeakerSimpleHigh class="h-4 w-4 mr-1" /> Play Test Audio
                     </Button>
                  </Show>
              </div>
          </Show>

          {/* Placeholder for idle state if needed, or just leave blank */}
          {/* <Show when={props.testStatus() === 'idle'}>
              <div class="text-muted-foreground text-sm">Ready to test connection.</div>
          </Show> */} 
      </div>
    </div>
  );
};

export default ConnectionTestPanel; 