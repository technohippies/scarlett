import type { Component } from "solid-js";
import { For } from "solid-js";
import { A } from "@solidjs/router";

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

// Placeholder Icons (replace with actual icon components)
const IconPlaceholder: Component = () => <svg class="size-4" viewBox="0 0 24 24"><path d="M12 2 L2 22 L22 22 Z" /></svg>;
const IconUser = IconPlaceholder;
const IconCog = IconPlaceholder;

// Sample menu items for the settings sidebar
const settingsMenuItems = [
  {
    title: "Profile",
    url: "/settings/profile",
    icon: IconUser
  },
  {
    title: "Account",
    url: "/settings/account",
    icon: IconCog
  },
  {
    title: "Appearance",
    url: "/settings/appearance",
    icon: IconPlaceholder // Replace with appropriate icon
  },
  {
    title: "Notifications",
    url: "/settings/notifications",
    icon: IconPlaceholder // Replace with appropriate icon
  },
  {
    title: "Display",
    url: "/settings/display",
    icon: IconPlaceholder // Replace with appropriate icon
  }
];

const SettingsPageView: Component = () => {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <For each={settingsMenuItems}>
                  {(item) => (
                    <SidebarMenuItem>
                      <SidebarMenuButton as={A} href={item.url} tooltip={item.title}>
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
        <h1>Settings Content Area</h1>
        <p>The selected settings section will be displayed here.</p>
        {/* Content based on the selected route will go here */}
      </main>
    </SidebarProvider>
  );
};

export default SettingsPageView;
