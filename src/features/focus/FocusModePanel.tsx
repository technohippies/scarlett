import { Component, Accessor, For, Show, createSignal } from 'solid-js';
import { Switch, SwitchControl, SwitchThumb } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import type { DomainDetail } from '../../services/storage/types';
import { trackMilestone } from '../../utils/analytics';

export interface FocusModePanelProps {
  isFocusModeActive: Accessor<boolean>;
  isLoading: Accessor<boolean>;
  onToggleFocusMode: (isEnabled: boolean) => void;
  blockedDomains: Accessor<DomainDetail[]>;
  onRemoveDomain: (domainName: string) => void;
  onAddDomain: (domainName: string) => void;
}

export const FocusModePanel: Component<FocusModePanelProps> = (props) => {
  const [newDomain, setNewDomain] = createSignal('');

  const handleAddDomainInput = () => {
    const domainToAdd = newDomain().trim();
    if (domainToAdd) {
      if (!props.blockedDomains().some(d => d.name.toLowerCase() === domainToAdd.toLowerCase())) {
        props.onAddDomain(domainToAdd);
      } else {
        console.warn("Domain already exists in prop list:", domainToAdd);
      }
      setNewDomain("");
    }
  };

  return (
    <div class="w-full max-w-lg space-y-4">
      {props.isLoading() ? (
        <div class="text-md text-muted-foreground text-center p-6">Loading settings...</div>
      ) : (
        <>
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold text-foreground">Focus Mode</h3>
            <Switch
              checked={props.isFocusModeActive()}
              onChange={(checked) => {
                props.onToggleFocusMode(checked);
                // Track focus mode activation (only when enabled)
                if (checked) {
                  trackMilestone.focusModeActivated();
                }
              }}
              disabled={props.isLoading()}
              id="focus-mode-toggle"
              aria-label="Enable Focus Mode"
            >
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
            </Switch>
          </div>

          <p class="text-sm text-muted-foreground pt-1 pb-2">
            Configure blocked domains and activate Focus Mode to minimize distractions.
          </p>

          <div class="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Add domain"
              value={newDomain()}
              onInput={(e: Event & { currentTarget: HTMLInputElement; target: Element; }) => setNewDomain(e.currentTarget.value)}
              class="flex-grow text-sm p-2 h-8 border border-input rounded-md bg-transparent focus:ring-ring focus:ring-1 focus:outline-none disabled:opacity-50"
              disabled={props.isLoading()}
              aria-label="Add domain to block list"
            />
            <Button 
              onClick={handleAddDomainInput}
              disabled={props.isLoading() || !newDomain().trim()}
              size="icon"
              class="h-8 w-8 shrink-0 p-0"
              aria-label="Add domain"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </Button>
          </div>
          
          <Show 
            when={props.blockedDomains().length > 0}
            fallback={<p class="text-sm text-muted-foreground italic py-2">No domains in block list.</p>}
          >
            <div class="mt-1">
              <For each={props.blockedDomains()}>{(domain, index) => (
                <>
                  <div class="flex items-center justify-between space-x-4 py-3">
                    <span class="text-sm font-medium text-foreground/90 truncate">{domain.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => props.onRemoveDomain(domain.name)}
                      class="hover:bg-accent/50 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${domain.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </Button>
                  </div>
                  <Show when={index() < props.blockedDomains().length -1}>
                    <Separator />
                  </Show>
                </>
              )}</For>
            </div>
          </Show>
        </>
      )}
    </div>
  );
};

export default FocusModePanel; 