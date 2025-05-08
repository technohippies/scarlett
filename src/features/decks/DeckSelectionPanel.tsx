import { Component, For, Accessor, Show } from 'solid-js';
import { Switch, SwitchControl, SwitchThumb } from '../../components/ui/switch';
import { Card, CardTitle, CardDescription } from '../../components/ui/card';

export interface DeckInfo {
  id: string; // The unique deck_identifier from the DB/JSON
  name: string; // User-friendly name, without language codes for this view
  description?: string;
  cardCount: number;
  // Add other relevant fields like source/target lang if needed for display
}

export interface DeckSelectionPanelProps {
  availableDecks: Accessor<DeckInfo[]>;
  onDeckToggle: (deckIdentifier: string, isEnabled: boolean) => void;
  initiallySelectedDeckIds?: Accessor<string[]>; 
  isLoading?: Accessor<boolean>; 
}

export const DeckSelectionPanel: Component<DeckSelectionPanelProps> = (props) => {

  // Helper function to remove trailing language pair like " (Language -> Language)"
  const formatDeckName = (name: string): string => {
    return name.replace(/\s*\([^)]*->[^)]*\)\s*$/, '').trim();
  };

  return (
    <div class="w-full max-w-lg space-y-4">
      <Show when={props.isLoading && props.isLoading()}>
        <div class="flex justify-center items-center p-4">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Show>

      <Show when={!props.isLoading || !props.isLoading()}>
        <For each={props.availableDecks()}>
          {(deck) => (
            <Card class="flex flex-row items-center justify-between p-4 rounded-lg bg-card">
              <div class="flex-grow mr-4">
                <CardTitle class="text-lg font-semibold text-foreground">{formatDeckName(deck.name)}</CardTitle>
                <Show when={deck.description}>
                  <CardDescription class="text-md text-foreground/80 mt-1">
                    {deck.description}
                  </CardDescription>
                </Show>
                <p class="text-md text-foreground/80 mt-1">{deck.cardCount} cards</p>
              </div>
              <Switch
                class="flex items-center"
                checked={props.initiallySelectedDeckIds ? props.initiallySelectedDeckIds().includes(deck.id) : false}
                onChange={(isChecked: boolean) => props.onDeckToggle(deck.id, isChecked)}
                id={`deck-switch-${deck.id}`}
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
              </Switch>
            </Card>
          )}
        </For>
        <Show when={!props.isLoading && props.availableDecks()?.length === 0}>
            <p class="text-muted-foreground text-center py-4">No recommended decks available for this learning goal.</p>
        </Show>
      </Show>
    </div>
  );
};

export default DeckSelectionPanel; 