// stories/features/models/ProviderSelectionPanel.stories.tsx
// Remove Meta and StoryObj imports
// import type { Meta, StoryObj } from 'storybook-solidjs';
import { createSignal } from 'solid-js';
import { ProviderSelectionPanel, type ProviderOption } from '../../../src/features/models/ProviderSelectionPanel';
// Import action addon if needed for callbacks later
// import { action } from '@storybook/addon-actions';

// Mock Data
const mockProviderOptions: ProviderOption[] = [
  { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
  { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' },
  { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
];

// Define meta information directly in the default export
export default {
  title: 'Features/Models/ProviderSelectionPanel',
  component: ProviderSelectionPanel,
  tags: ['autodocs'],
  argTypes: {
    providerOptions: {
      control: 'object',
      description: 'Array of available provider options',
    },
    // selectedProviderId is managed internally by the story via signal
    selectedProviderId: { table: { disable: true } },
    // onSelectProvider logs the action
    onSelectProvider: { table: { disable: true } },
  },
  args: { // Default args for controls
    providerOptions: mockProviderOptions,
  },
};

// Remove type Story = StoryObj<typeof meta>;

// Define stories directly
export const Default = {
  render: (args: any) => { // Use any for args to match pattern, suppressing implicit any error
    // Internal signal to manage selection state within the story
    const [selectedId, setSelectedId] = createSignal<string | undefined>(undefined);

    const handleSelect = (provider: ProviderOption) => {
      console.log('[Story] Provider selected:', provider);
      setSelectedId(provider.id);
    };

    return (
      <div class="p-4 bg-background max-w-xl mx-auto"> {/* Added padding and centering */}
        <ProviderSelectionPanel
          providerOptions={args.providerOptions}
          selectedProviderId={selectedId} // Pass the signal accessor
          onSelectProvider={handleSelect}
        />
        <div class="mt-4 text-sm text-muted-foreground">Selected Provider ID: {selectedId() || 'None'}</div>
      </div>
    );
  },
};

export const PreSelected = {
    args: {
        providerOptions: mockProviderOptions,
    },
  render: (args: any) => { // Use any for args
    // Initialize with a pre-selected ID
    const [selectedId, setSelectedId] = createSignal<string | undefined>('jan');

    const handleSelect = (provider: ProviderOption) => {
      console.log('[Story] Provider selected:', provider);
      setSelectedId(provider.id);
    };

    return (
      <div class="p-4 bg-background max-w-xl mx-auto">
        <ProviderSelectionPanel
          providerOptions={args.providerOptions}
          selectedProviderId={selectedId}
          onSelectProvider={handleSelect}
        />
        <div class="mt-4 text-sm text-muted-foreground">Selected Provider ID: {selectedId() || 'None'}</div>
      </div>
    );
  },
}; 