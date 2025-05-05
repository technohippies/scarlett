// stories/features/redirects/RedirectsPanel.stories.tsx
import { createSignal, createEffect } from 'solid-js';
import { RedirectsPanel } from '../../../src/features/redirects/RedirectsPanel';
import type { RedirectSettings, RedirectServiceSetting } from '../../../src/services/storage/types';

// Mock Data
const mockInitialSettings: RedirectSettings = {
  GitHub: { isEnabled: true, chosenInstance: '' },
  ChatGPT: { isEnabled: false, chosenInstance: '' },
  'X (Twitter)': { isEnabled: true, chosenInstance: '' },
  Reddit: { isEnabled: true, chosenInstance: '' },
  Twitch: { isEnabled: false, chosenInstance: '' },
  YouTube: { isEnabled: true, chosenInstance: '' },
  'YouTube Music': { isEnabled: true, chosenInstance: '' },
  Medium: { isEnabled: true, chosenInstance: '' },
  Bluesky: { isEnabled: false, chosenInstance: '' },
  Pixiv: { isEnabled: true, chosenInstance: '' },
  Soundcloud: { isEnabled: true, chosenInstance: '' },
  Genius: { isEnabled: false, chosenInstance: '' },
};

// Story Definition
export default {
    title: 'Features/Redirects/RedirectsPanel',
    component: RedirectsPanel,
    tags: ['autodocs'],
    argTypes: {
        // Use controls for initial state simulation
        initialSettings: {
            control: 'object',
            description: 'Initial state of redirect settings',
            name: 'Initial Settings'
        },
        isLoading: {
            control: 'boolean',
            description: 'Simulate loading state',
        },
        // Props managed internally or via actions
        allRedirectSettings: { table: { disable: true } },
        onSettingChange: { table: { disable: true } },
    },
    args: { // Default args for controls
        initialSettings: mockInitialSettings,
        isLoading: false,
    },
};

// Base Render Function
const BaseRender = (args: any) => {
    // Internal state management for the story
    const [settings, setSettings] = createSignal<RedirectSettings>(args.initialSettings);
    const [loading, setLoading] = createSignal<boolean>(args.isLoading);

    // Update internal state when args change
    createEffect(() => setLoading(args.isLoading));
    // Use createEffect to reset internal settings if the initialSettings arg changes
    createEffect(() => setSettings(args.initialSettings));

    const handleSettingChange = (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => {
        console.log('[Story] RedirectsPanel setting changed:', service, update);
        setSettings(prev => ({
            ...prev,
            [service]: {
                // Preserve existing chosenInstance if the service exists
                chosenInstance: prev[service]?.chosenInstance || '',
                ...update, // Apply the isEnabled update
            },
        }));
         console.log('[Story] New settings state:', settings());
    };

    return (
        <div class="p-4 bg-background max-w-xl mx-auto">
            <RedirectsPanel
                allRedirectSettings={settings} // Pass the signal accessor
                isLoading={loading}         // Pass the signal accessor
                onSettingChange={handleSettingChange}
            />
             {/* Optional: Display current state for debugging */}
             <details class="mt-4 text-xs text-muted-foreground">
                <summary>Current State</summary>
                <pre>{JSON.stringify(settings(), null, 2)}</pre>
             </details>
        </div>
    );
};

// Stories
export const Default = {
    render: BaseRender,
    args: {
        initialSettings: mockInitialSettings,
        isLoading: false,
    },
};

export const Loading = {
     render: BaseRender,
    args: {
        initialSettings: {}, // Start empty when loading usually
        isLoading: true,
    },
};

export const AllEnabled = {
    render: BaseRender,
    args: {
        // Create settings where all are enabled
        initialSettings: Object.keys(mockInitialSettings).reduce((acc, key) => {
            acc[key] = { isEnabled: true, chosenInstance: '' };
            return acc;
        }, {} as RedirectSettings),
        isLoading: false,
    },
};

export const AllDisabled = {
     render: BaseRender,
    args: {
         initialSettings: Object.keys(mockInitialSettings).reduce((acc, key) => {
            acc[key] = { isEnabled: false, chosenInstance: '' };
            return acc;
        }, {} as RedirectSettings),
        isLoading: false,
    },
}; 