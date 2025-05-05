import type { Component } from "solid-js";
import { For, createSignal, Show } from "solid-js";
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

// Remove Placeholder Icons
// const IconPlaceholder: Component = () => <svg class="size-4" viewBox="0 0 24 24"><path d="M12 2 L2 22 L22 22 Z" /></svg>;
// const IconUser = IconPlaceholder;
// const IconCog = IconPlaceholder;

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
];

const SettingsPageView: Component = () => {
  // --- Temporary State Management for Settings Sections --- 
  // TODO: Replace with actual routing or more robust state management
  const [activeSection, setActiveSection] = createSignal<string | null>('llm'); // Default to LLM section

  // --- Temporary State Management for Redirects --- 
  // TODO: Load initial state from storage and save changes via onSettingChange
  const [redirectSettings, setRedirectSettings] = createSignal<RedirectSettings>({
    GitHub: { isEnabled: true, chosenInstance: '' },
    ChatGPT: { isEnabled: true, chosenInstance: '' },
    'X (Twitter)': { isEnabled: true, chosenInstance: '' },
    Reddit: { isEnabled: true, chosenInstance: '' }, 
    Twitch: { isEnabled: true, chosenInstance: '' }, 
    YouTube: { isEnabled: true, chosenInstance: '' },
    'YouTube Music': { isEnabled: true, chosenInstance: '' },
    Medium: { isEnabled: true, chosenInstance: '' },
    Bluesky: { isEnabled: true, chosenInstance: '' },
    Pixiv: { isEnabled: true, chosenInstance: '' },
    Soundcloud: { isEnabled: true, chosenInstance: '' },
    Genius: { isEnabled: true, chosenInstance: '' },
  });
  const [isRedirectsLoading, setIsRedirectsLoading] = createSignal(false); // TODO: Set true during load

  // Placeholder handler - updates local signal
  // TODO: Implement saving to browser storage
  const handleRedirectSettingChange = (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => {
    console.log('[SettingsPage] Setting Changed for:', service, 'Update:', update); // Keep log for debugging
    setRedirectSettings(prev => ({
      ...prev,
      [service]: {
        chosenInstance: prev[service]?.chosenInstance || '', // Preserve existing instance choice
        ...update,
      },
    }));
    // TODO: Call storage.setRedirectSettings(newSettings) here
  };
  // --- End Temporary State Management --- 

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>MODELS</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <For each={settingsMenuItems}>
                  {(item) => (
                    <SidebarMenuItem>
                      <SidebarMenuButton as="button" onClick={() => setActiveSection(item.title.toLowerCase())} tooltip={item.title}>
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
                <SidebarMenuItem>
                  <SidebarMenuButton as="button" onClick={() => setActiveSection('redirects')} tooltip="Redirects">
                    <TrendUp />
                    <span>Redirects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main class="flex-1 p-4">
        {/* --- Conditional Content Area --- */}

        <Show when={activeSection() === 'llm'}>
          <h1>LLM Settings</h1>
          <p>Configure Large Language Model settings here.</p>
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
            allRedirectSettings={redirectSettings} 
            isLoading={isRedirectsLoading}
            onSettingChange={handleRedirectSettingChange}
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
  );
};

export default SettingsPageView;
