import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { Button } from "../../components/ui/button";
import { 
  // User, Gear, Palette, // Remove unused icons
  Brain, ChartLine, BookOpen, SpeakerHigh, // Model Icons
  TrendUp // Use TrendUp icon
} from "phosphor-solid";

// Import necessary sidebar components
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

// Import the new panel and necessary types
import RedirectsPanel from "../../features/redirects/RedirectsPanel";
import type { RedirectSettings, RedirectServiceSetting } from "../../services/storage/types";

// Import the new model panels
import ProviderSelectionPanel, { type ProviderOption } from "../../features/models/ProviderSelectionPanel";
import ModelSelectionPanel, { type ModelOption } from "../../features/models/ModelSelectionPanel";
import ConnectionTestPanel from "../../features/models/ConnectionTestPanel";

// Import necessary types/functions from SetupFunction or services
import type { LLMConfig } from "../../services/llm/types";
// Import providers individually
import { OllamaProvider } from "../../services/llm/providers/ollama"; 
import { JanProvider } from "../../services/llm/providers/jan"; 
import { LMStudioProvider } from "../../services/llm/providers/lmstudio";

// Import Context
import { SettingsProvider, useSettings } from "../../context/SettingsContext";

// Updated menu items for Models
const settingsMenuItems = [
  {
    title: "LLM",
    url: "/settings/models/llm", // Updated URL
    icon: Brain 
  },
  {
    title: "Embedding",
    url: "/settings/models/embedding", // Updated URL
    icon: ChartLine
  },
  {
    title: "Reader",
    url: "/settings/models/reader", // Updated URL
    icon: BookOpen
  },
  {
    title: "TTS",
    url: "/settings/models/tts", // Updated URL
    icon: SpeakerHigh
  },
  {
    title: "Redirects",
    url: "/settings/redirects",
    icon: TrendUp
  },
];

// Helper Types (Consider moving to shared location)
type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

// TODO: Define actual provider options (move to constants?)
const llmProviderOptions: ProviderOption[] = [
  { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://127.0.0.1:11434', logoUrl: '/images/llm-providers/ollama.png' },
  { id: 'jan', name: 'Jan', defaultBaseUrl: 'ws://127.0.0.1:1337', logoUrl: '/images/llm-providers/jan.png' },
  { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
];
const embeddingProviderOptions: ProviderOption[] = [/* ... define ... */];
const readerProviderOptions: ProviderOption[] = [/* ... define ... */];
const SettingsPageViewContent: Component = () => {
  // Use the settings context
  const settingsContext = useSettings();

  // Local state for UI interaction (e.g., active section)
  const [activeSection, setActiveSection] = createSignal<string | null>('llm'); 

  // --- Get transient state accessors for the active section (example for LLM) --- 
  // We need a way to get the *correct* transient state based on activeSection
  // For now, let's just get LLM for demonstration
  // TODO: Make this dynamic based on activeSection() for Embedding, Reader, TTS
  const llmTransientState = settingsContext.getTransientState('LLM');
  const embeddingTransientState = settingsContext.getTransientState('Embedding');
  const readerTransientState = settingsContext.getTransientState('Reader');
  const ttsTransientState = settingsContext.getTransientState('TTS'); // Assuming TTS uses similar pattern
  
  // --- Define provider options (These could come from context/config later) ---
  const llmProviderOptions: ProviderOption[] = [
      { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
      { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' },
      { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
  ];
  // TODO: Define options for Embedding, Reader, TTS
  const embeddingProviderOptions: ProviderOption[] = [...llmProviderOptions]; // Placeholder
  const readerProviderOptions: ProviderOption[] = llmProviderOptions.filter(p => p.id === 'ollama'); // Placeholder
  const ttsProviderOptions: ProviderOption[] = []; // Placeholder

  // --- Handlers (now mostly call context actions) --- 
  
  // LLM Handlers
  const handleLlmSelectProvider = (provider: ProviderOption) => {
      // Clear existing model selection in the main store before fetching new ones
      settingsContext.updateLlmConfig({ providerId: provider.id, modelId: '', baseUrl: provider.defaultBaseUrl });
      // Trigger fetch models via context
      settingsContext.fetchModels('LLM', provider);
  };
  const handleLlmSelectModel = (modelId: string | undefined) => {
      // Update only the modelId in the store config
      if (modelId && settingsContext.config.llmConfig) {
           settingsContext.updateLlmConfig({ ...settingsContext.config.llmConfig, modelId: modelId });
      } else if (modelId) { // Handle case where llmConfig might be null initially
           // This case is less likely if handleLlmSelectProvider sets a base config
           console.warn("Attempting to set model ID but LLM config provider part is missing");
      }
      // Note: Saving happens within updateLlmConfig action
  };
  const handleLlmTestConnection = () => {
      // Test connection requires a valid config object from the store
      const currentLlmConfig = settingsContext.config.llmConfig;
      if (currentLlmConfig && currentLlmConfig.providerId && currentLlmConfig.modelId) {
          // Pass the FunctionConfig format to the context action
          settingsContext.testConnection('LLM', currentLlmConfig);
      } else {
          console.warn("Cannot test LLM connection: Provider or Model not selected.");
      }
  };
  // No explicit handleLlmSave needed if updates save automatically

  // TODO: Add handlers for Embedding, Reader, TTS similarly

  return (
    <>
      <SidebarProvider>
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>MODELS</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <For each={settingsMenuItems.filter(item => item.icon !== TrendUp)}>
                    {(item) => (
                      <SidebarMenuItem>
                        <SidebarMenuButton 
                          as="button" 
                          onClick={() => setActiveSection(item.title.toLowerCase())} 
                          tooltip={item.title}
                          class={activeSection() === item.title.toLowerCase() ? 'bg-muted' : ''}
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
            
            {/* New Censorship Group */}
            <SidebarGroup>
              <SidebarGroupLabel>CENSORSHIP</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <For each={settingsMenuItems.filter(item => item.icon === TrendUp)}>
                    {(item) => (
                      <SidebarMenuItem>
                        <SidebarMenuButton 
                          as="button" 
                          onClick={() => setActiveSection(item.title.toLowerCase())} 
                          tooltip={item.title}
                          class={activeSection() === item.title.toLowerCase() ? 'bg-muted' : ''}
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
        <main class="flex-1 p-4">
          {/* --- Conditional Content Area --- */}

          <Show when={activeSection() === 'llm'}>
            <h1 class="text-2xl font-semibold mb-4">LLM Settings</h1>
            <div class="space-y-6">
              <ProviderSelectionPanel
                providerOptions={llmProviderOptions}
                selectedProviderId={() => settingsContext.config.llmConfig?.providerId}
                onSelectProvider={handleLlmSelectProvider}
              />
              {/* --- Block that shows Model/Connection panels --- */}
              <Show when={settingsContext.config.llmConfig?.providerId !== undefined}>
                {/* --- Restore ModelSelectionPanel --- */}
                <ModelSelectionPanel
                  functionName="LLM"
                  // Pass provider object based on stored ID (or make panel accept ID)
                  selectedProvider={() => llmProviderOptions.find(p => p.id === settingsContext.config.llmConfig?.providerId)}
                  fetchStatus={llmTransientState.fetchStatus} // Use scoped transient state
                  showSpinner={llmTransientState.showSpinner}
                  fetchError={llmTransientState.fetchError}
                  fetchedModels={llmTransientState.models}
                  remoteModels={() => []} // Adjust if LLM uses remote models
                  selectedModelId={() => settingsContext.config.llmConfig?.modelId}
                  onSelectModel={handleLlmSelectModel}
                />

                {/* --- Restore ConnectionTestPanel and its wrapping Show + Button --- */}
                <Show when={llmTransientState.fetchStatus() === 'success' && settingsContext.config.llmConfig?.modelId}>
                  <ConnectionTestPanel
                    testStatus={llmTransientState.testStatus}
                    testError={llmTransientState.testError}
                    functionName="LLM"
                     selectedProvider={() => llmProviderOptions.find(p => p.id === settingsContext.config.llmConfig?.providerId)}
                  />
                  <div class="flex space-x-4 mt-4">
                    <Button
                        onClick={handleLlmTestConnection}
                        disabled={llmTransientState.testStatus() === 'testing'}
                    >
                        {llmTransientState.testStatus() === 'testing' ? 'Testing...' : 'Test Connection'}
                    </Button>
                    {/* Save happens automatically on model select now, maybe remove save button */}
                  </div>
                </Show>
              </Show>
            </div>
          </Show>
          
          <Show when={activeSection() === 'embedding'}>
            <h1>Embedding Settings</h1>
            <p>Configure Embedding Model settings here.</p>
          </Show>

          <Show when={activeSection() === 'reader'}>
            <h1>Reader Settings</h1>
            <p>Configure Reader Model settings here.</p>
          </Show>
          
          <Show when={activeSection() === 'tts'}>
            <h1>TTS Settings</h1>
            <p>Configure Text-to-Speech settings here.</p>
          </Show>

          {/* Show RedirectsPanel when active */}
          <Show when={activeSection() === 'redirects'}>
            <h1 class="text-2xl font-semibold mb-4">Redirect Settings</h1>
            <p class="text-muted-foreground mb-6">Enable or disable privacy-preserving frontends for specific services.</p>
            <RedirectsPanel
              allRedirectSettings={() => settingsContext.config.redirectSettings || {}}
              isLoading={() => settingsContext.loadStatus() === 'pending'}
              onSettingChange={settingsContext.updateRedirectSetting}
            />
          </Show>

          <Show when={activeSection() === null}>
             <h1>Settings Content Area</h1>
             <p>Select a category from the sidebar.</p>
          </Show>

          {/* Remove old placeholder */}
          {/* <h1>Settings Content Area</h1> */}
          {/* <p>The selected settings section will be displayed here.</p> */} 
          {/* Content based on the selected route will go here */} 
        </main>
      </SidebarProvider>
    </>
  );
};

// Wrap the content component with the Provider
const SettingsPageView: Component = () => {
  return (
    <SettingsProvider>
      <SettingsPageViewContent />
    </SettingsProvider>
  );
};

export default SettingsPageView;
