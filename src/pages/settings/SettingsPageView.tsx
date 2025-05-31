import type { Component, Accessor } from "solid-js";
import { For, Show } from "solid-js";
import { Button } from "../../components/ui/button";
import { 
  Brain, SpeakerHigh, Microphone,
  TrendUp, EyeSlash
} from "phosphor-solid";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../../components/ui/sidebar";
import RedirectsPanel from "../../features/redirects/RedirectsPanel";
import FocusModePanel from '../../features/focus/FocusModePanel';
import type { UserConfiguration, RedirectServiceSetting, FunctionConfig, DomainDetail } from "../../services/storage/types";
import type { ProviderOption } from "../../features/models/ProviderSelectionPanel";
import type { ModelOption } from "../../features/models/ModelSelectionPanel";
import type { SettingsLoadStatus, FetchStatus, TestStatus } from "../../context/SettingsContext";
import ProviderSelectionPanel from "../../features/models/ProviderSelectionPanel";
import ModelSelectionPanel from "../../features/models/ModelSelectionPanel";
import ConnectionTestPanel from "../../features/models/ConnectionTestPanel";
import { TtsProviderPanel, type TtsProviderOption } from "../../features/models/TtsProviderPanel";
import { VadPanel, type VadOption } from "../../features/models/VadPanel";
import { Header } from '../../components/layout/Header';

// Menu Items
const settingsMenuItems = [
  { title: "LLM", url: "/settings/models/llm", icon: Brain, sectionKey: 'llm' },
  { title: "TTS", url: "/settings/models/tts", icon: SpeakerHigh, sectionKey: 'tts' },
  { title: "VAD", url: "/settings/models/vad", icon: Microphone, sectionKey: 'vad' },
];

const censorshipMenuItems = [
  { title: "Redirects", url: "/settings/redirects", icon: TrendUp, sectionKey: 'redirects' }
];

const productivityMenuItems = [
  { title: "Focus Mode", url: "/settings/focus", icon: EyeSlash, sectionKey: 'focusmode' }
];

// --- Type Definitions for Transient State (Assuming structure from getTransientState) ---
// Could also be imported from context if exported
interface TransientStateAccessors {
  localModels: Accessor<ModelOption[]>;
  remoteModels: Accessor<ModelOption[]>;
  fetchStatus: Accessor<FetchStatus>;
  fetchError: Accessor<Error | null>;
  testStatus: Accessor<TestStatus>;
  testError: Accessor<Error | null>;
  showSpinner: Accessor<boolean>;
}

// --- Define Props Interface --- 
interface SettingsPageViewProps {
  loadStatus: Accessor<SettingsLoadStatus>;
  config: UserConfiguration; // Direct config object
  activeSection: Accessor<string | null>;
  onSectionChange: (section: string) => void;
  
  // LLM Props (keep)
  llmTransientState: TransientStateAccessors;
  llmProviderOptions: ProviderOption[];
  onLlmSelectProvider: (provider: ProviderOption) => void;
  onLlmSelectModel: (modelId: string | undefined) => void;
  onLlmTestConnection: (config: FunctionConfig) => void;
  


  // --- NEW TTS Props --- 
  availableTtsProviders: TtsProviderOption[];
  selectedTtsProviderId: Accessor<string | undefined>; 
  onSelectTtsProvider: (providerId: string | undefined) => void;

  // ElevenLabs specific props
  elevenLabsApiKey: Accessor<string>;
  onElevenLabsApiKeyChange: (apiKey: string) => void;
  isElevenLabsTesting: Accessor<boolean>;
  onTestElevenLabs: () => void;

  // General TTS Test/Audio
  ttsTestAudioData: Accessor<Blob | null>;
  onTtsPlayAudio: () => void;
  ttsTestError: Accessor<Error | null>;

  // Redirects Props (keep)
  onRedirectSettingChange: (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => Promise<void>;
  onBackClick: () => void;

  // --- NEW Focus Mode Props ---
  isFocusModeActive: Accessor<boolean>;
  isFocusModeLoading: Accessor<boolean>;
  focusModeBlockedDomains: Accessor<DomainDetail[]>;
  onFocusModeToggle: (isEnabled: boolean) => void;
  onFocusModeAddDomain: (domainName: string) => void;
  onFocusModeRemoveDomain: (domainName: string) => void;

  // --- VAD & STT Props ---
  availableVadOptions: VadOption[];
  selectedVadId: Accessor<string | undefined>;
  onSelectVad: (vadId: string | undefined) => void;
  isVadTesting: Accessor<boolean>;
  onTestVad: () => void;
  onStopVadTest?: () => void;
  vadStatusMessage: Accessor<string | null>;
  vadTestError: Accessor<Error | null>;
  isVadLoading: Accessor<boolean>;
  lastRecordedAudioUrl: Accessor<string | null>;
  onPlayLastRecording: () => void;
  // STT specific props
  onTranscribe: () => Promise<void>; // Or appropriate type for the handler
  transcribedText: Accessor<string | null>;
  isTranscribing: Accessor<boolean>;
  sttError: Accessor<Error | null>;
}


// --- SettingsPageView Component (Now Presentational) --- 
const SettingsPageView: Component<SettingsPageViewProps> = (props) => {
  // --- Debug Log --- 
  console.log('[SettingsPageView] Received props.activeSection:', props.activeSection);
  console.log('[SettingsPageView] typeof props.activeSection:', typeof props.activeSection);

  return (
    <div class="flex flex-col h-svh bg-background text-foreground"> {/* Full height container */}

     {/* Use the reusable Header component */}
     <Header 
       onBackClick={props.onBackClick} 
     />

      {/* Main Area (Sidebar + Content) */}
      <div class="flex flex-1 overflow-hidden">
          <SidebarProvider> 
              <Sidebar collapsible="icon" variant="sidebar">
                  <SidebarContent class="pt-24">
                      <SidebarGroup>
                          <SidebarGroupLabel>MODELS</SidebarGroupLabel>
                          <SidebarGroupContent>
                              <SidebarMenu>
                                  <For each={settingsMenuItems}>
                                      {(item) => (
                                          <SidebarMenuItem>
                                              <SidebarMenuButton 
                                                  as="button" 
                                                  onClick={() => props.onSectionChange(item.sectionKey)} 
                                                  tooltip={item.title}
                                                  class={props.activeSection() === item.sectionKey ? 'bg-muted' : ''}
                                              >
                                                  <item.icon />
                                                  <span>{item.title}</span>
                                              </SidebarMenuButton>
                                          </SidebarMenuItem>
                                      )}
                                  </For>
                              </SidebarMenu>
                          </SidebarGroupContent>
                      </SidebarGroup>
                      
                      <SidebarGroup>
                          <SidebarGroupLabel>CENSORSHIP</SidebarGroupLabel>
                          <SidebarGroupContent>
                              <SidebarMenu>
                                  <For each={censorshipMenuItems}>
                                      {(item) => (
                                          <SidebarMenuItem>
                                              <SidebarMenuButton 
                                                  as="button" 
                                                  onClick={() => props.onSectionChange(item.sectionKey)} 
                                                  tooltip={item.title}
                                                  class={props.activeSection() === item.sectionKey ? 'bg-muted' : ''}
                                              >
                                                  <item.icon />
                                                  <span>{item.title}</span>
                                              </SidebarMenuButton>
                                          </SidebarMenuItem>
                                      )}
                                  </For>
                              </SidebarMenu>
                          </SidebarGroupContent>
                      </SidebarGroup>

                      {/* New Productivity Group */}
                      <SidebarGroup>
                          <SidebarGroupLabel>PRODUCTIVITY</SidebarGroupLabel>
                          <SidebarGroupContent>
                              <SidebarMenu>
                                  <For each={productivityMenuItems}>
                                      {(item) => (
                                          <SidebarMenuItem>
                                              <SidebarMenuButton 
                                                  as="button" 
                                                  onClick={() => props.onSectionChange(item.sectionKey)} 
                                                  tooltip={item.title}
                                                  class={props.activeSection() === item.sectionKey ? 'bg-muted' : ''}
                                              >
                                                  <item.icon />
                                                  <span>{item.title}</span>
                                              </SidebarMenuButton>
                                          </SidebarMenuItem>
                                      )}
                                  </For>
                              </SidebarMenu>
                          </SidebarGroupContent>
                      </SidebarGroup>
                  </SidebarContent>
              </Sidebar>

              {/* Main Content Panel */}
              <main class="flex-1 p-6 overflow-y-auto"> {/* Allows main content to scroll */} 
                  <Show when={props.loadStatus() === 'pending'}>
                      <div class="flex items-center justify-center h-full">
                          <p class="text-muted-foreground">Loading settings...</p>
                      </div>
                  </Show>

                  <Show when={props.loadStatus() === 'errored'}>
                      <div class="flex items-center justify-center h-full">
                          <p class="text-destructive">Error loading settings.</p>
                      </div>
                  </Show>

                  <Show when={props.loadStatus() === 'ready'}>
                    {/* --- LLM Section --- */} 
                    <Show when={props.activeSection() === 'llm'}>
                      <div class="space-y-4">
                        <ProviderSelectionPanel
                          providerOptions={props.llmProviderOptions} 
                          selectedProviderId={() => props.config.llmConfig?.providerId}
                          onSelectProvider={props.onLlmSelectProvider}
                        />
                        <Show when={props.config.llmConfig?.providerId !== undefined}>
                          <ModelSelectionPanel
                            functionName="LLM"
                            selectedProvider={() => props.llmProviderOptions.find(p => p.id === props.config.llmConfig?.providerId)}
                            fetchStatus={props.llmTransientState.fetchStatus} 
                            showSpinner={props.llmTransientState.showSpinner}
                            fetchError={props.llmTransientState.fetchError}
                            fetchedModels={props.llmTransientState.localModels}
                            remoteModels={props.llmTransientState.remoteModels}
                            selectedModelId={() => props.config.llmConfig?.modelId}
                            onSelectModel={props.onLlmSelectModel}
                          />
                          <Show when={props.llmTransientState.fetchStatus() === 'success' && props.config.llmConfig?.modelId}>
                            <ConnectionTestPanel
                              testStatus={props.llmTransientState.testStatus}
                              testError={props.llmTransientState.testError}
                              functionName="LLM"
                              selectedProvider={() => props.llmProviderOptions.find(p => p.id === props.config.llmConfig?.providerId)}
                            />
                            <div class="flex space-x-4 mt-6">
                              <Button 
                                  onClick={() => props.onLlmTestConnection(props.config.llmConfig as FunctionConfig)} 
                                  disabled={props.llmTransientState.testStatus() === 'testing'}
                              >
                                  {props.llmTransientState.testStatus() === 'testing' ? 'Testing...' : 'Test Connection'}
                              </Button>
                            </div>
                          </Show>
                        </Show>
                      </div>
                    </Show>


                    
                    {/* --- TTS Section --- */} 
                    <Show when={props.activeSection() === 'tts'}>
                      <TtsProviderPanel
                        availableProviders={props.availableTtsProviders}
                        selectedProviderId={props.selectedTtsProviderId}
                        onSelectProvider={props.onSelectTtsProvider}
                        
                        elevenLabsApiKey={props.elevenLabsApiKey}
                        onElevenLabsApiKeyChange={props.onElevenLabsApiKeyChange}
                        isElevenLabsTesting={props.isElevenLabsTesting}
                        onTestElevenLabs={props.onTestElevenLabs}
                        
                        testAudioData={props.ttsTestAudioData}
                        onPlayTestAudio={props.onTtsPlayAudio}
                        testError={props.ttsTestError}
                      />
                    </Show>

                    {/* --- VAD Section --- */}
                    <Show when={props.activeSection() === 'vad'}>
                      <div class="space-y-4">
                        <h2 class="text-xl font-semibold text-foreground">Speech to Text</h2>
                        <VadPanel
                          availableVadOptions={props.availableVadOptions}
                          selectedVadId={props.selectedVadId}
                          onSelectVad={props.onSelectVad}
                          isVadTesting={props.isVadTesting}
                          onTestVad={props.onTestVad}
                          onStopVadTest={props.onStopVadTest}
                          vadStatusMessage={props.vadStatusMessage}
                          vadTestError={props.vadTestError}
                          isVadLoading={props.isVadLoading}
                          lastRecordedAudioUrl={props.lastRecordedAudioUrl}
                          onPlayLastRecording={props.onPlayLastRecording}
                          // STT Props
                          onTranscribe={props.onTranscribe}
                          transcribedText={props.transcribedText}
                          isTranscribing={props.isTranscribing}
                          sttError={props.sttError}
                        />
                      </div>
                    </Show>

                    {/* --- Redirects Section --- */} 
                    <Show when={props.activeSection() === 'redirects'}>
                      <p class="text-muted-foreground mb-6">Enable or disable privacy-preserving frontends for specific services.</p>
                      <div class="mt-4 ml-4">
                          <RedirectsPanel
                            allRedirectSettings={() => props.config.redirectSettings || {}}
                            isLoading={() => props.loadStatus() === 'pending'}
                            onSettingChange={props.onRedirectSettingChange}
                          />
                      </div>
                    </Show>

                    {/* --- NEW Focus Mode Section --- */}
                    <Show when={props.activeSection() === 'focusmode'}>
                       {/* <p class="text-muted-foreground mb-6">Configure blocked domains and activate Focus Mode to minimize distractions.</p> */}
                       <div class="mt-4 ml-4">
                          <FocusModePanel
                            isLoading={props.isFocusModeLoading}
                            isFocusModeActive={props.isFocusModeActive}
                            blockedDomains={props.focusModeBlockedDomains}
                            onToggleFocusMode={props.onFocusModeToggle}
                            onAddDomain={props.onFocusModeAddDomain}
                            onRemoveDomain={props.onFocusModeRemoveDomain}
                          />
                       </div>
                    </Show>

                    {/* --- Default / No Selection --- */} 
                    <Show when={props.activeSection() === null && props.loadStatus() === 'ready'}>
                       <p class="text-muted-foreground mt-2">Select a category from the sidebar to configure.</p>
                    </Show>
                  </Show> 
              </main>
          </SidebarProvider>
      </div>
    </div>
  );
};

export default SettingsPageView;
