import type { Component } from 'solid-js';
import { For } from 'solid-js';
import { 
  House, 
  EnvelopeSimple, 
  CalendarBlank, 
  MagnifyingGlass, 
  Gear 
} from "phosphor-solid"; // Corrected phosphor icon names

// Import Sidebar components
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '../../../src/components/ui/sidebar'; // Adjusted relative path

// Placeholder Icons (replace with actual icon components if available)
// const IconPlaceholder: Component = () => <svg class="size-4" viewBox="0 0 24 24"><path d="M12 2 L2 22 L22 22 Z" /></svg>;
// const IconHome = IconPlaceholder;
// const IconMail = IconPlaceholder;
// const IconCalendar = IconPlaceholder;
// const IconSearch = IconPlaceholder;
// const IconSettings = IconPlaceholder;

// --- Story Metadata ---
export default {
  title: 'Components/UI/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
  },
  // Decorator to wrap stories in SidebarProvider
  decorators: [(Story: Component) => <SidebarProvider><Story /></SidebarProvider>],
};

// --- Sample Menu Items --- Use Phosphor Icons
const menuItems = [
  {
    title: "Home",
    url: "#",
    icon: House // Use corrected phosphor icon
  },
  {
    title: "Inbox",
    url: "#",
    icon: EnvelopeSimple // Use corrected phosphor icon
  },
  {
    title: "Calendar",
    url: "#",
    icon: CalendarBlank // Use corrected phosphor icon
  },
  {
    title: "Search",
    url: "#",
    icon: MagnifyingGlass // Use corrected phosphor icon
  },
  {
    title: "Settings",
    url: "#",
    icon: Gear // Use corrected phosphor icon
  }
];

// --- Basic Sidebar Story ---
export const Default: { render: Component } = {
  render: () => (
    <div class="flex">
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader>
          {/* Optional Header Content - Removed App Name */}
          {/* <div class="p-2 font-semibold">App Name</div> */}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <For each={menuItems}>
                  {(item) => (
                    <SidebarMenuItem>
                      {/* Using button instead of A due to router issue */}
                      <SidebarMenuButton as="button" onClick={() => alert(`Navigate to ${item.title}`)} tooltip={item.title}>
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
        <SidebarFooter>
          {/* Optional Footer Content */}
          <div class="p-2 text-xs text-muted-foreground">Footer</div>
        </SidebarFooter>
      </Sidebar>
      <main class="flex-1 p-4">
        <h1>Main Content Area</h1>
        <p>This is where the main application content would go.</p>
      </main>
    </div>
  ),
};
