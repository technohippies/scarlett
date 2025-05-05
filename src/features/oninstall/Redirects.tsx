import { Component, Accessor, For } from 'solid-js';
import { Switch, SwitchControl, SwitchThumb } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { ArrowLeft } from 'phosphor-solid';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import type { RedirectSettings, RedirectServiceSetting } from '../../services/storage/types';
import { REDIRECT_SERVICES } from '../../shared/constants';

// --- Import the new panel --- 
import RedirectsPanel from '../redirects/RedirectsPanel';

// --- Updated Props Interface ---
export interface RedirectsProps {
  allRedirectSettings: Accessor<RedirectSettings>;
  isLoading: Accessor<boolean>;
  onSettingChange: (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => void;
  onComplete: () => void;
  onBack?: () => void;
  title: string;
  description: string;
  continueLabel: string;
}

export const Redirects: Component<RedirectsProps> = (props) => {

  return (
    <div class="relative flex flex-col h-full bg-background text-foreground">
      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-16 md:p-8 md:pt-20">
        <div class="w-full max-w-lg mb-8"> 
           <h1 class="text-3xl md:text-4xl font-semibold mb-3">{props.title}</h1>
           <p class="text-md text-muted-foreground">{props.description}</p>
        </div>

        <RedirectsPanel 
            allRedirectSettings={props.allRedirectSettings}
            isLoading={props.isLoading}
            onSettingChange={props.onSettingChange}
        />

        {/* Remove old rendering logic */}
        {/* <div class="w-full max-w-lg space-y-1"> */}
          {/* {props.isLoading() ? ( */}
            {/* <div class="text-md text-muted-foreground text-center p-4">Loading settings...</div> */}
          {/* ) : ( */} 
            {/* // Iterate over services and create a switch for each */} 
            {/* <For each={services}>{(serviceName) => ( */} 
                {/* <> */} 
                  {/* <div class="flex items-center justify-between space-x-4 py-3">  */} 
                      {/* <Label for={`enable-switch-${serviceName}`} class="text-md font-medium"> */} 
                          {/* {serviceName} */} 
                      {/* </Label> */} 
                      {/* <Switch  */} 
                        {/* checked={getIsEnabledForService(serviceName)} */} 
                        {/* onChange={(checked) => handleEnabledChange(serviceName, checked)} */} 
                        {/* disabled={props.isLoading()} */} 
                        {/* id={`enable-switch-${serviceName}`} */} 
                        {/* aria-label={`Enable redirects for ${serviceName}`} */} 
                      {/* > */} 
                        {/* <SwitchControl> */} 
                          {/* <SwitchThumb /> */} 
                        {/* </SwitchControl> */} 
                      {/* </Switch> */} 
                  {/* </div> */} 
                  {/* <Separator /> */}
                {/* </> */} 
            {/* )}</For> */} 
          {/* )} */} 
        {/* </div> */} 
      </div>

      <div class="flex-shrink-0 p-4 md:p-6 border-t border-border bg-background flex justify-center">
          <div class="w-full max-w-xs">
             <Button
               size="lg"
               class="w-full"
               onClick={props.onComplete}
             >
               {props.continueLabel}
             </Button>
          </div>
       </div>
    </div>
  );
};
