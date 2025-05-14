import { Redirects, type RedirectsProps } from '../../../src/features/oninstall/Redirects';
import { createSignal, createEffect } from 'solid-js';
// import { REDIRECT_SERVICES } from '../../../src/shared/constants'; // No longer needed for args
import type { RedirectSettings, RedirectServiceSetting } from '../../../src/services/storage/types';

export default {
  title: 'Features/OnInstall/Redirects',
  component: Redirects,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    // Component state props (managed internally via signals)
    allRedirectSettings: { table: { disable: true } },
    isLoading: { // Keep isLoading control
        control: 'boolean',
        description: 'Simulate loading state',
    },
    
    // Callback props (actions logged in story)
    // onServiceSelect: { table: { disable: true } }, // Removed
    onSettingChange: { table: { disable: true } }, // Keep
    // onComplete: { table: { disable: true } }, // Removed from argTypes
    onBack: { table: { disable: true } },
    
    // Controllable args for the story
    title: {
        control: 'text',
        description: 'Page title',
    },
    description: {
        control: 'text',
        description: 'Page description text',
    },
    // continueLabel: { // Removed from argTypes
    //     control: 'text',
    //     description: 'Label for the main action button',
    // },
    // initialSelectedService: { ... }, // Removed
    showBackButton: { 
        control: 'boolean',
        description: 'Show the back button',
        name: 'Show Back Button'
    }
  },
  // Update default args for the controls
  args: {
    title: 'Bypass Censorship & Paywalls', // Updated title
    description: 'Use privacy-preserving frontends with many mirrors.', // Updated description
    // continueLabel: 'Continue', // Removed from default args
    isLoading: false,
    showBackButton: true,
  },
};

// --- Default Story --- 

export const Default = {
  render: (args: {
     // initialSelectedService: string; // Removed
     isLoading: boolean;
     title: string;
     description: string;
    //  continueLabel: string; // Removed from render args type
     showBackButton: boolean;
    }) => {
    // Internal state management for the story using SolidJS signals
    // const [selectedService, setSelectedService] = createSignal<string>(args.initialSelectedService); // Removed
    const [allSettings, setAllSettings] = createSignal<RedirectSettings>({
      GitHub: { isEnabled: true, chosenInstance: '' },
      ChatGPT: { isEnabled: true, chosenInstance: '' },
      'X (Twitter)': { isEnabled: true, chosenInstance: '' },
      Reddit: { isEnabled: true, chosenInstance: '' }, 
      Twitch: { isEnabled: true, chosenInstance: '' }, 
      YouTube: { isEnabled: true, chosenInstance: '' },
      'YouTube Music': { isEnabled: true, chosenInstance: '' },
      Medium: { isEnabled: true, chosenInstance: '' },
      Bluesky: { isEnabled: true, chosenInstance: '' },
      Pixiv: { isEnabled: true, chosenInstance: '' },
      Soundcloud: { isEnabled: true, chosenInstance: '' },
      Genius: { isEnabled: true, chosenInstance: '' },
    });
    const [isLoading, setIsLoading] = createSignal<boolean>(args.isLoading);

    // Effects to update internal state when args change
    createEffect(() => setIsLoading(args.isLoading));
    // createEffect(() => setSelectedService(args.initialSelectedService)); // Removed

    // Handler functions that log actions
    // const handleServiceSelect = ... // Removed

    // Keep handleSettingChange - it now receives { isEnabled: boolean }
    const handleSettingChange = (service: string, update: Pick<RedirectServiceSetting, 'isEnabled'>) => {
      console.log('[Story] Setting Changed for:', service, 'Update:', update);
      setAllSettings(prev => ({
        ...prev,
        [service]: {
          // Ensure existing chosenInstance (even if empty) is preserved if the service exists
          chosenInstance: prev[service]?.chosenInstance || '', 
          ...update, // Apply the isEnabled update
        },
      }));
    };

    const handleBack = () => {
        console.log('[Story] onBack called.');
        alert('Back button clicked!');
    };

    // Props passed to the actual Redirects component
    const componentProps: RedirectsProps = {
      allRedirectSettings: allSettings,
      // selectedService: selectedService, // Removed
      isLoading: isLoading,
      // onServiceSelect: handleServiceSelect, // Removed
      onSettingChange: handleSettingChange,
      title: args.title,
      description: args.description,
      // continueLabel: args.continueLabel, // Removed from componentProps
      onBack: args.showBackButton ? handleBack : undefined,
    };

    return <Redirects {...componentProps} />;
  },
};
