import { createSignal, Accessor } from 'solid-js';
import DeckSelectionPanel, { type DeckInfo } from '../../../src/features/decks/DeckSelectionPanel';

// Mock Data - Remove language suffixes from names
const mockDecks: DeckInfo[] = [
  { id: 'programming_vi_en', name: 'Programming Terms', description: 'Common terms for programmers.', cardCount: 50 },
  { id: 'travel_es_en', name: 'Travel Phrases', description: 'Essential phrases for your trip to Spain.', cardCount: 120 },
  { id: 'business_zh_en', name: 'Business Chinese', description: 'Formal terms for the workplace.', cardCount: 200 },
  { id: 'hsk_1_zh', name: 'HSK Level 1', description: 'Beginner Chinese vocabulary.', cardCount: 150 },
];

export default {
  title: 'Features/Decks/DeckSelectionPanel',
  component: DeckSelectionPanel,
  tags: ['autodocs'],
  argTypes: {
    availableDecks: { control: 'object' },
    isLoading: { control: 'boolean' },
    initiallySelectedDeckIds: { control: 'object' },
    // onDeckToggle is an action, so hide from controls
    onDeckToggle: { table: { disable: true } },
  },
  args: { // Default args
    availableDecks: mockDecks,
    isLoading: false,
    initiallySelectedDeckIds: [],
  },
};

// Base Render Function
const BaseRender = (args: any) => {
  // Convert raw args to signals for SolidJS reactivity if they aren't already accessors
  const availableDecksAccessor: Accessor<DeckInfo[]> = 
    typeof args.availableDecks === 'function' ? args.availableDecks : createSignal(args.availableDecks)[0];
  const isLoadingAccessor: Accessor<boolean> = 
    typeof args.isLoading === 'function' ? args.isLoading : createSignal(args.isLoading)[0];
  
  // For initiallySelectedDeckIds, we need a signal that can be updated by onDeckToggle
  const [selectedIds, setSelectedIds] = createSignal<string[]>(
    typeof args.initiallySelectedDeckIds === 'function' ? args.initiallySelectedDeckIds() : args.initiallySelectedDeckIds
  );

  const handleToggle = (deckIdentifier: string, isEnabled: boolean) => {
    console.log('[Story] Deck toggled:', deckIdentifier, isEnabled);
    setSelectedIds(prev => {
      const current = [...prev];
      if (isEnabled) {
        if (!current.includes(deckIdentifier)) {
          return [...current, deckIdentifier];
        }
      } else {
        return current.filter(id => id !== deckIdentifier);
      }
      return current; // Return current if no change
    });
  };
  
  return (
    <div class="p-4 bg-background max-w-xl mx-auto">
      <DeckSelectionPanel
        availableDecks={availableDecksAccessor}
        isLoading={isLoadingAccessor}
        onDeckToggle={handleToggle}
        initiallySelectedDeckIds={selectedIds} // Pass the signal itself as an accessor
      />
      <div class="mt-4 p-2 bg-neutral-800 rounded">
        <p class="text-sm font-semibold text-white">Selected Deck Identifiers:</p>
        <pre class="text-xs text-white">{JSON.stringify(selectedIds(), null, 2)}</pre>
      </div>
    </div>
  );
};

export const Default = {
  render: BaseRender,
  args: {
    availableDecks: mockDecks,
    isLoading: false,
    initiallySelectedDeckIds: [],
  }
};

export const Loading = {
  render: BaseRender,
  args: {
    availableDecks: [],
    isLoading: true,
    initiallySelectedDeckIds: [],
  }
};

export const Empty = {
  render: BaseRender,
  args: {
    availableDecks: [],
    isLoading: false,
    initiallySelectedDeckIds: [],
  }
};

export const PreSelected = {
  render: BaseRender,
  args: {
    availableDecks: mockDecks,
    isLoading: false,
    initiallySelectedDeckIds: [mockDecks[0].id, mockDecks[2].id], // Pre-select some decks
  }
}; 