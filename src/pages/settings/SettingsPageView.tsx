import type { Component, Accessor } from "solid-js";
import { For, Show } from "solid-js";
import { Button } from "../../components/ui/button";
import { 
  Brain, ChartLine, SpeakerHigh,
  TrendUp
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
import type { UserConfiguration, RedirectServiceSetting, FunctionConfig } from "../../services/storage/types"; 
import type { ProviderOption } from "../../features/models/ProviderSelectionPanel";
import type { ModelOption } from "../../features/models/ModelSelectionPanel";
import type { SettingsLoadStatus, FetchStatus, TestStatus } from "../../context/SettingsContext";
import ProviderSelectionPanel from "../../features/models/ProviderSelectionPanel";
import ModelSelectionPanel from "../../features/models/ModelSelectionPanel";
import ConnectionTestPanel from "../../features/models/ConnectionTestPanel";
import { Header } from '../../components/layout/Header';

// Menu Items (Keep)
const settingsMenuItems = [
  { title: "LLM", url: "/settings/models/llm", icon: Brain },
  { title: "Embedding", url: "/settings/models/embedding", icon: ChartLine },
  { title: "TTS", url: "/settings/models/tts", icon: SpeakerHigh },
  { title: "Redirects", url: "/settings/redirects", icon: TrendUp }
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
  llmTransientState: TransientStateAccessors;
  embeddingTransientState: TransientStateAccessors;
  ttsTransientState: TransientStateAccessors;
  llmProviderOptions: ProviderOption[];
  embeddingProviderOptions: ProviderOption[];
  ttsProviderOptions: ProviderOption[];
  onSectionChange: (section: string | null) => void;
  onLlmSelectProvider: (provider: ProviderOption) => void;
  onLlmSelectModel: (modelId: string | undefined) => void;
  onLlmTestConnection: (config: FunctionConfig) => void;
  onEmbeddingSelectProvider: (provider: ProviderOption) => void;
  onEmbeddingSelectModel: (modelId: string | undefined) => void;
  onEmbeddingTestConnection: (config: FunctionConfig) => void;
  onTtsSelectProvider: (provider: ProviderOption) => void;
  onTtsSelectModel: (modelId: string | undefined) => void;
  onTtsTestConnection: (config: FunctionConfig) => void;
  onRedirectSettingChange: (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => Promise<void>;
  onBackClick: () => void;
  // Add TTS handlers when needed
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
                      {/* Model Group */}
                      <SidebarGroup>
                          <SidebarGroupLabel>MODELS</SidebarGroupLabel>
                          <SidebarGroupContent>
                              <SidebarMenu>
                                  <For each={settingsMenuItems.filter(item => item.icon !== TrendUp)}>
                                      {(item) => (
                                          <SidebarMenuItem>
                                              <SidebarMenuButton 
                                                  as="button" 
                                                  onClick={() => props.onSectionChange(item.title.toLowerCase())} 
                                                  tooltip={item.title}
                                                  class={props.activeSection() === item.title.toLowerCase() ? 'bg-muted' : ''}
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
                      
                      {/* Censorship Group */}
                      <SidebarGroup>
                          <SidebarGroupLabel>CENSORSHIP</SidebarGroupLabel>
                          <SidebarGroupContent>
                              <SidebarMenu>
                                  <For each={settingsMenuItems.filter(item => item.icon === TrendUp)}>
                                      {(item) => (
                                          <SidebarMenuItem>
                                              <SidebarMenuButton 
                                                  as="button" 
                                                  onClick={() => props.onSectionChange(item.title.toLowerCase())} 
                                                  tooltip={item.title}
                                                  class={props.activeSection() === item.title.toLowerCase() ? 'bg-muted' : ''}
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

                    {/* --- Embedding Section --- */} 
                    <Show when={props.activeSection() === 'embedding'}>
                      <div class="space-y-4">
                        <ProviderSelectionPanel
                          providerOptions={props.embeddingProviderOptions} 
                          selectedProviderId={() => props.config.embeddingConfig?.providerId}
                          onSelectProvider={props.onEmbeddingSelectProvider}
                        />
                        <Show when={props.config.embeddingConfig?.providerId !== undefined}>
                          <ModelSelectionPanel
                            functionName="Embedding"
                            selectedProvider={() => props.embeddingProviderOptions.find(p => p.id === props.config.embeddingConfig?.providerId)}
                            fetchStatus={props.embeddingTransientState.fetchStatus} 
                            showSpinner={props.embeddingTransientState.showSpinner}
                            fetchError={props.embeddingTransientState.fetchError}
                            fetchedModels={props.embeddingTransientState.localModels}
                            remoteModels={props.embeddingTransientState.remoteModels}
                            selectedModelId={() => props.config.embeddingConfig?.modelId}
                            onSelectModel={props.onEmbeddingSelectModel}
                          />
                          <Show when={props.embeddingTransientState.fetchStatus() === 'success' && props.config.embeddingConfig?.modelId}>
                            <ConnectionTestPanel
                              testStatus={props.embeddingTransientState.testStatus}
                              testError={props.embeddingTransientState.testError}
                              functionName="Embedding"
                              selectedProvider={() => props.embeddingProviderOptions.find(p => p.id === props.config.embeddingConfig?.providerId)}
                            />
                            <div class="flex space-x-4 mt-6">
                              <Button 
                                  onClick={() => props.onEmbeddingTestConnection(props.config.embeddingConfig as FunctionConfig)} 
                                  disabled={props.embeddingTransientState.testStatus() === 'testing'}
                              >
                                  {props.embeddingTransientState.testStatus() === 'testing' ? 'Testing...' : 'Test Connection'}
                              </Button>
                            </div>
                          </Show>
                        </Show>
                      </div>
                    </Show>
                    
                    {/* --- TTS Section --- */} 
                    <Show when={props.activeSection() === 'tts'}>
                      <div class="space-y-4">
                        <ProviderSelectionPanel
                          providerOptions={props.ttsProviderOptions} 
                          selectedProviderId={() => props.config.ttsConfig?.providerId}
                          onSelectProvider={props.onTtsSelectProvider}
                        />
                        <Show when={props.config.ttsConfig?.providerId === 'lmstudio'}> 
                          <ModelSelectionPanel
                            functionName="TTS"
                            selectedProvider={() => props.ttsProviderOptions.find(p => p.id === props.config.ttsConfig?.providerId)}
                            fetchStatus={props.ttsTransientState.fetchStatus} 
                            showSpinner={props.ttsTransientState.showSpinner}
                            fetchError={props.ttsTransientState.fetchError}
                            fetchedModels={props.ttsTransientState.localModels}
                            remoteModels={props.ttsTransientState.remoteModels}
                            selectedModelId={() => props.config.ttsConfig?.modelId}
                            onSelectModel={props.onTtsSelectModel}
                          />
                          <Show when={props.ttsTransientState.fetchStatus() === 'success' && props.config.ttsConfig?.modelId}>
                            <ConnectionTestPanel
                              testStatus={props.ttsTransientState.testStatus}
                              testError={props.ttsTransientState.testError}
                              functionName="TTS"
                              selectedProvider={() => props.ttsProviderOptions.find(p => p.id === props.config.ttsConfig?.providerId)}
                            />
                            <div class="flex space-x-4 mt-6">
                              <Button 
                                  onClick={() => props.onTtsTestConnection(props.config.ttsConfig as FunctionConfig)} 
                                  disabled={props.ttsTransientState.testStatus() === 'testing'}
                              >
                                  {props.ttsTransientState.testStatus() === 'testing' ? 'Testing...' : 'Test Connection'}
                              </Button>
                            </div>
                          </Show>
                        </Show>
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
