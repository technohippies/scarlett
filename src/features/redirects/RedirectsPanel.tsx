import { Component, Accessor, For } from 'solid-js';
import { Switch, SwitchControl, SwitchThumb } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import type { RedirectSettings, RedirectServiceSetting } from '../../services/storage/types';
import { REDIRECT_SERVICES } from '../../shared/constants';

export interface RedirectsPanelProps {
  allRedirectSettings: Accessor<RedirectSettings>;
  isLoading: Accessor<boolean>;
  onSettingChange: (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => void;
}

const services = REDIRECT_SERVICES as readonly string[];

export const RedirectsPanel: Component<RedirectsPanelProps> = (props) => {
  // Helper to get enabled state for a specific service
  const getIsEnabledForService = (serviceName: string): boolean => {
    const settings = props.allRedirectSettings()?.[serviceName];
    // Default to enabled if not explicitly set
    return settings === undefined ? true : settings.isEnabled;
  };

  const handleEnabledChange = (serviceName: string, checked: boolean) => {
    props.onSettingChange(serviceName, { isEnabled: checked });
  };

  return (
    <div class="w-full max-w-lg space-y-1"> {/* Consistent styling */}
      {props.isLoading() ? (
        <div class="text-md text-muted-foreground text-center p-4">Loading settings...</div>
      ) : (
        <For each={services}>{(serviceName) => (
          <>
            <div class="flex items-center justify-between space-x-4 py-3">
              <Label for={`enable-switch-${serviceName}`} class="text-md font-medium">
                {serviceName}
              </Label>
              <Switch
                checked={getIsEnabledForService(serviceName)}
                onChange={(checked) => handleEnabledChange(serviceName, checked)}
                disabled={props.isLoading()}
                id={`enable-switch-${serviceName}`}
                aria-label={`Enable redirects for ${serviceName}`}
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
              </Switch>
            </div>
            <Separator /> {/* Separator after each service */}
          </>
        )}</For>
      )}
    </div>
  );
};

export default RedirectsPanel; // Add default export if needed elsewhere 