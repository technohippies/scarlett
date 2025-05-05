import type { Component, Accessor } from "solid-js";
import { For, Show } from "solid-js";
import { Button } from "../../components/ui/button";
import { 
  Brain, ChartLine, BookOpen, SpeakerHigh,
  TrendUp, Tag
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
import type { UserConfiguration, RedirectSettings, RedirectServiceSetting } from "../../services/storage/types"; 
import type { ProviderOption } from "../../features/models/ProviderSelectionPanel";
import type { ModelOption } from "../../features/models/ModelSelectionPanel";
import type { SettingsLoadStatus, FetchStatus, TestStatus } from "../../context/SettingsContext";
import ProviderSelectionPanel from "../../features/models/ProviderSelectionPanel";
import ModelSelectionPanel from "../../features/models/ModelSelectionPanel";
import ConnectionTestPanel from "../../features/models/ConnectionTestPanel";
import TagsPanel from "../../features/tags/TagsPanel";
import type { Tag as DbTag } from "../../services/db/types";

// Menu Items (Keep)
const settingsMenuItems = [
  { title: "LLM", url: "/settings/models/llm", icon: Brain },
  { title: "Embedding", url: "/settings/models/embedding", icon: ChartLine },
  { title: "Reader", url: "/settings/models/reader", icon: BookOpen },
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
  readerTransientState: TransientStateAccessors;
  ttsTransientState: TransientStateAccessors;
  llmProviderOptions: ProviderOption[];
  embeddingProviderOptions: ProviderOption[];
  readerProviderOptions: ProviderOption[];
  ttsProviderOptions: ProviderOption[];
  allTags: Accessor<DbTag[]>;
  onSectionChange: (section: string | null) => void;
  onLlmSelectProvider: (provider: ProviderOption) => void;
  onLlmSelectModel: (modelId: string | undefined) => void;
  onLlmTestConnection: () => void;
  onEmbeddingSelectProvider: (provider: ProviderOption) => void;
  onEmbeddingSelectModel: (modelId: string | undefined) => void;
  onEmbeddingTestConnection: () => void;
  onReaderSelectProvider: (provider: ProviderOption) => void;
  onReaderSelectModel: (modelId: string | undefined) => void;
  onReaderTestConnection: () => void;
  onRedirectSettingChange: (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => Promise<void>;
  // Add TTS handlers when needed
}


// --- SettingsPageView Component (Now Presentational) --- 
const SettingsPageView: Component<SettingsPageViewProps> = (props) => {
  // --- Debug Log --- 
  console.log('[SettingsPageView] Received props.activeSection:', props.activeSection);
  console.log('[SettingsPageView] typeof props.activeSection:', typeof props.activeSection);

  return (
    <>
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarContent>
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
          
            {/* Data Management Group */}
          <SidebarGroup>
             <SidebarGroupLabel>DATA</SidebarGroupLabel>
             <SidebarGroupContent>
               <SidebarMenu>
                 {/* Tags Item */}
                 <SidebarMenuItem>
                   <SidebarMenuButton 
                     as="button" 
                     onClick={() => props.onSectionChange('tags')} 
                     tooltip="Tags"
                     class={props.activeSection() === 'tags' ? 'bg-muted' : ''}
                   >
                     <Tag /> 
                     <span>Tags</span>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
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

        {/* Main Content Area uses Props */}
        <main class="flex-1 p-6 overflow-y-auto bg-background text-foreground">
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
              <h1 class="text-2xl font-semibold mb-4">LLM Settings</h1>
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
                          onClick={props.onLlmTestConnection} 
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
              <h1 class="text-2xl font-semibold mb-4">Embedding Settings</h1>
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
                          onClick={props.onEmbeddingTestConnection} 
                          disabled={props.embeddingTransientState.testStatus() === 'testing'}
                      >
                          {props.embeddingTransientState.testStatus() === 'testing' ? 'Testing...' : 'Test Connection'}
                      </Button>
                    </div>
                  </Show>
                </Show>
              </div>
            </Show>

            {/* --- Reader Section --- */} 
            <Show when={props.activeSection() === 'reader'}>
              <h1 class="text-2xl font-semibold mb-4">Reader Settings</h1>
              <div class="space-y-4">
                <ProviderSelectionPanel
                  providerOptions={props.readerProviderOptions} 
                  selectedProviderId={() => props.config.readerConfig?.providerId}
                  onSelectProvider={props.onReaderSelectProvider}
                />
                <Show when={props.config.readerConfig?.providerId !== undefined}>
                  <ModelSelectionPanel
                    functionName="Reader"
                    selectedProvider={() => props.readerProviderOptions.find(p => p.id === props.config.readerConfig?.providerId)}
                    fetchStatus={props.readerTransientState.fetchStatus} 
                    showSpinner={props.readerTransientState.showSpinner}
                    fetchError={props.readerTransientState.fetchError}
                    fetchedModels={props.readerTransientState.localModels}
                    remoteModels={props.readerTransientState.remoteModels}
                    selectedModelId={() => props.config.readerConfig?.modelId}
                    onSelectModel={props.onReaderSelectModel}
                  />
                  <Show when={props.readerTransientState.fetchStatus() === 'success' && props.config.readerConfig?.modelId}>
                    <ConnectionTestPanel
                      testStatus={props.readerTransientState.testStatus}
                      testError={props.readerTransientState.testError}
                      functionName="Reader"
                      selectedProvider={() => props.readerProviderOptions.find(p => p.id === props.config.readerConfig?.providerId)}
                    />
                    <div class="flex space-x-4 mt-6">
                      <Button 
                          onClick={props.onReaderTestConnection} 
                          disabled={props.readerTransientState.testStatus() === 'testing'}
                      >
                          {props.readerTransientState.testStatus() === 'testing' ? 'Testing...' : 'Test Connection'}
                      </Button>
                    </div>
                  </Show>
                </Show>
              </div>
            </Show>
            
            {/* --- TTS Section --- */} 
            <Show when={props.activeSection() === 'tts'}>
              <h1 class="text-2xl font-semibold mb-4">TTS Settings</h1>
              <p class="text-muted-foreground">TODO: Implement TTS settings using panels/context. Configuration might differ from other models.</p>
            </Show>

            {/* --- Tags Section --- */}
            <Show when={props.activeSection() === 'tags'}>
              <h1 class="text-2xl font-semibold mb-4">Tags</h1>
               <div class="mt-4 ml-4">
                  <TagsPanel 
                    tags={props.allTags} 
                    // Add loading/error states if needed later from context
                  />
              </div>
            </Show>

            {/* --- Redirects Section --- */} 
            <Show when={props.activeSection() === 'redirects'}>
              <h1 class="text-2xl font-semibold mb-4">Redirect Settings</h1>
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
               <h1 class="text-xl font-semibold">Settings</h1>
               <p class="text-muted-foreground mt-2">Select a category from the sidebar to configure.</p>
            </Show>
          </Show> 
      </main>
    </SidebarProvider>
    </>
  );
};

export default SettingsPageView;
