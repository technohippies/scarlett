import { Component, Accessor } from 'solid-js';
import type { RedirectSettings, RedirectServiceSetting } from '../../services/storage/types';

// --- Import the new panel --- 
import RedirectsPanel from '../redirects/RedirectsPanel';

// --- Updated Props Interface ---
export interface RedirectsProps {
  allRedirectSettings: Accessor<RedirectSettings>;
  isLoading: Accessor<boolean>;
  onSettingChange: (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => void;
  onBack?: () => void;
  title: string;
  description: string;
}

export const Redirects: Component<RedirectsProps> = (props) => {

  return (
    <div class="relative flex flex-col h-full bg-background text-foreground">
      <div class="flex-grow overflow-y-auto flex flex-col items-center">
        <div class="w-full max-w-lg mb-8"> 
           <p class="text-xl md:text-2xl mb-2">{props.title}</p>
           <p class="text-lg text-muted-foreground ">{props.description}</p>
        </div>

        <RedirectsPanel 
            allRedirectSettings={props.allRedirectSettings}
            isLoading={props.isLoading}
            onSettingChange={props.onSettingChange}
        />
      </div>
    </div>
  );
};
