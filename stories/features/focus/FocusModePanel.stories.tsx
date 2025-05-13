import { createSignal } from 'solid-js';
import { 
    FocusModePanel, 
    type FocusModePanelProps
} from '../../../src/features/focus/FocusModePanel';
import type { DomainDetail } from '../../../src/services/storage/types'; // Correct import for DomainDetail

// Initial mock domain data for a single list
const initialMockBlockedDomains: DomainDetail[] = [
  { name: 'facebook.com'}, { name: 'twitter.com'}, { name: 'instagram.com'},
  { name: 'linkedin.com'}, { name: 'reddit.com'}, { name: 'youtube.com'},
  { name: 'tiktok.com'}, { name: 'pinterest.com'}, { name: 'snapchat.com'},
  { name: 'discord.com'}, { name: 'amazon.com'}, { name: 'ebay.com'},
  { name: 'cnn.com'}, { name: 'bbc.com'}, { name: 'pornhub.com'}, { name: 'twitch.tv'}
];

// --- Storybook Metadata ---
export default {
  title: 'Features/Focus/FocusModePanel',
  component: FocusModePanel,
  parameters: {
    // layout: 'centered', // Removed
  },
  tags: ['autodocs'],
  argTypes: {
    isLoading: { control: 'boolean', description: 'Simulate loading state' },
    isFocusModeActive: { table: { disable: true } }, 
    onToggleFocusMode: { table: { disable: true } },
    blockedDomains: { table: { disable: true } },
    onRemoveDomain: { table: { disable: true } },
    onAddDomain: { table: { disable: true } },
  },
};

// --- Story Render Function (Simplified) --- 
const RenderPanelWithState = (storyArgs: { isLoadingInitial?: boolean, isFocusModeActiveInitial?: boolean }) => {
  const [isLoading] = createSignal<boolean>(storyArgs.isLoadingInitial ?? false);
  const [isFocusModeActive, setIsFocusModeActive] = createSignal<boolean>(storyArgs.isFocusModeActiveInitial ?? false);
  const [blockedDomains, setBlockedDomains] = createSignal<DomainDetail[]>([...initialMockBlockedDomains]); // Use spread for a new array copy

  const handleToggleFocusMode = (isEnabled: boolean) => {
    console.log('[Story] Focus Mode Toggled:', isEnabled);
    setIsFocusModeActive(isEnabled);
  };

  const handleRemoveDomain = (domainName: string) => {
    console.log('[Story] Remove Domain:', domainName);
    setBlockedDomains(prev => prev.filter(d => d.name !== domainName));
  };

  const handleAddDomain = (domainName: string) => {
    console.log('[Story] Add Domain:', domainName);
    if (!blockedDomains().some(d => d.name.toLowerCase() === domainName.toLowerCase())) {
      setBlockedDomains(prev => [...prev, { name: domainName }]);
    } else {
      console.log('[Story] Domain already exists:', domainName);
    }
  };

  const componentProps: FocusModePanelProps = {
    isLoading: isLoading,
    isFocusModeActive: isFocusModeActive,
    onToggleFocusMode: handleToggleFocusMode,
    blockedDomains: blockedDomains,
    onRemoveDomain: handleRemoveDomain,
    onAddDomain: handleAddDomain,
  };

  return (
    <div class="p-4 bg-background max-w-xl mx-auto">
      <FocusModePanel {...componentProps} />
    </div>
  );
};

// --- Stories ---
export const Default = {
  render: RenderPanelWithState,
  args: {
    isLoadingInitial: false,
    isFocusModeActiveInitial: false,
  },
};

export const FocusModeActive = {
  render: RenderPanelWithState,
  args: {
    isLoadingInitial: false,
    isFocusModeActiveInitial: true,
  },
};

export const Loading = {
  render: RenderPanelWithState,
  args: {
    isLoadingInitial: true,
    isFocusModeActiveInitial: false,
  },
}; 