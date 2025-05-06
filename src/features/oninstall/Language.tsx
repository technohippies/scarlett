import { Component, createSignal, For, Show } from 'solid-js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import type { Messages } from '../../types/i18n';

// LanguageOption now might only need value and emoji if name comes from messages
export interface LanguageOptionStub {
  value: string;
  emoji: string;
  name?: string;
}

// No longer defining lists here
/*
export const nativeLanguages: LanguageOption[] = [...];
export const allTargetLanguages: LanguageOption[] = [...];
*/

// Define props for the component
interface LanguageProps {
  onTargetLangChange: (value: string, label: string) => void;
  onNativeLangChange: (newLangCode: string) => void;
  iSpeakLabel: string;
  selectLanguagePlaceholder: string;
  wantToLearnLabel: string;
  initialNativeLangValue: string | undefined;
  availableNativeLanguages: LanguageOptionStub[];
  availableTargetLanguages: LanguageOptionStub[];
  messages: Messages | undefined;
  messagesLoading: boolean;
}

// Helper function to get translated name (could be moved)
const getLangName = (value: string | undefined, messages: Messages | undefined): string => {
  if (!value || !messages) return '';
  const key = `langName${value.charAt(0).toUpperCase() + value.slice(1)}`;
  return messages[key]?.message || value; // Fallback to value code
};

export const Language: Component<LanguageProps> = (props) => {

  console.log(`[Language] Render Start. initialNativeLangValue prop: ${props.initialNativeLangValue}`);

  // Removed redundant initial stub finding
  // const initialNativeLangStub = props.availableNativeLanguages.find(lang => lang.value === props.initialNativeLangValue);
  // console.log(`[Language] Initial native lang stub found:`, initialNativeLangStub);
  
  // State now holds the LanguageOptionStub - Initialize directly using prop
  const [selectedNativeLangStub, setSelectedNativeLangStub] = createSignal<LanguageOptionStub | undefined>(
    props.availableNativeLanguages.find(lang => lang.value === props.initialNativeLangValue) || 
    props.availableNativeLanguages.find(l => l.value === 'en') // Fallback to English stub
  );
  console.log(`[Language] Initial selectedNativeLangStub signal set to:`, selectedNativeLangStub());

  // State for target language VALUE
  const [selectedTargetLang, setSelectedTargetLang] = createSignal<LanguageOptionStub | undefined>();

  // Filter target languages based on selected native language
  const targetLanguages = (): LanguageOptionStub[] => {
      const nativeLang = selectedNativeLangStub()?.value;
      if (!nativeLang) {
          // Default: Show all except English if no native selected? Or maybe just English?
          // Let's default to showing only English if native isn't selected yet.
          return props.availableTargetLanguages.filter(lang => lang.value === 'en'); 
      }
      
      if (nativeLang === 'en') {
          // If native is English, show Chinese and Japanese
          return props.availableTargetLanguages.filter(
              lang => lang.value === 'zh' || lang.value === 'ja'
          );
      } else {
          // If native is NOT English, show only English
          return props.availableTargetLanguages.filter(
              lang => lang.value === 'en'
          );
      }
  };

  const handleNativeChange = (stub: LanguageOptionStub | null) => {
    console.log('[Language] handleNativeChange triggered. Received stub:', stub);
    const newValue = stub?.value;
    console.log('[Language] handleNativeChange: Derived newValue:', newValue);
    setSelectedNativeLangStub(stub ?? undefined);
    console.log('[Language] handleNativeChange: Updated selectedNativeLangStub signal to:', selectedNativeLangStub());
    // Call the new prop if value is valid
    if (newValue) {
      console.log(`[Language] handleNativeChange: Calling props.onNativeLangChange with ${newValue}`);
      props.onNativeLangChange(newValue);
    }
  };

  // Handler for target language selection
  const handleTargetLanguageSelect = (option: LanguageOptionStub | null) => {
    if (option) {
      setSelectedTargetLang(option);
      // Call the new prop when a target is selected
      const targetLabel = `${option.emoji} ${getLangName(option.value, props.messages) || option.name || option.value}`;
      props.onTargetLangChange(option.value, targetLabel);
    }
  };

  return (
    // Remove min-h-screen, add h-full
    <div class="relative flex flex-col h-full bg-background text-foreground">
      {/* Content Area: Remove justify-center, standardize top padding */}
      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24">
          {/* Image: Centered by parent's items-center */} 
          <img
            src="/images/scarlett-supercoach/scarlett-proud-512x512.png"
            alt="Scarlett Supercoach"
            // Adjusted mb for spacing within scrollable area
            class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6 flex-shrink-0" 
          />

          {/* Sentence Structure: Limit width, allow space - Remove text-center & space-y-4 */}
          <div class="text-xl md:text-2xl w-full max-w-lg mb-6">
              {/* Combine both sentences into one paragraph */}
              <p class="inline-flex items-center justify-center flex-wrap gap-2"> 
                <span>{props.iSpeakLabel}</span>
                {(() => {
                    // Log value just before Select render
                    console.log('[Language] Rendering Select. Current selectedNativeLangStub():', selectedNativeLangStub());
                    return null; 
                })()}
                <Select<LanguageOptionStub>
                  options={props.availableNativeLanguages}
                  value={selectedNativeLangStub()}
                  onChange={handleNativeChange}
                  optionValue="value"
                  optionTextValue={(option) => `${option.emoji} ${getLangName(option.value, props.messages)}`}
                  placeholder={props.selectLanguagePlaceholder}
                  itemComponent={(itemProps) => {
                    const name = getLangName(itemProps.item.rawValue.value, props.messages);
                    const emoji = itemProps.item.rawValue.emoji;
                    return (
                      <SelectItem item={itemProps.item}>
                        {name} {' '}{emoji} 
                      </SelectItem>
                    );
                  }}
                  multiple={false}
                  id="native-language"
                  class="w-auto inline-block align-middle"
                >
                  <SelectTrigger class="font-semibold border-b border-border hover:border-primary pl-3 pr-1 py-0 focus:ring-0 min-w-[150px] cursor-pointer">
                    <SelectValue<LanguageOptionStub>>
                      {(state) => {
                        const stub = state.selectedOption();
                        if (!stub) return '...';
                        const name = getLangName(stub.value, props.messages);
                        return `${name} ${stub.emoji}`.trim(); 
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
                {/* Add the second part of the sentence here */}
                <span>{' '}{props.wantToLearnLabel}</span> 
              </p>
          </div>

          {/* Target Language Grid: Limit width */}
          {/* Wrap in Show to wait for messages */}
          <Show when={!props.messagesLoading} fallback={<div>Loading languages...</div>}> 
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg mb-6">
                <For each={targetLanguages()}> 
                  {(langStub) => {
                    // Revert to using getLangName for localization
                    const nameToShow = getLangName(langStub.value, props.messages); 
                    return (
                      <Button
                        variant="outline"
                        onClick={() => handleTargetLanguageSelect(langStub)}
                        class={cn(
                          'h-32 aspect-square p-4 flex flex-col items-center justify-center space-y-2 text-base border',
                          'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0',
                          selectedTargetLang() === langStub
                            ? 'bg-neutral-800 text-foreground border-neutral-700'
                            : 'border-neutral-700'
                        )}
                      >
                        <span class="text-4xl">{langStub.emoji}</span>
                        {/* Display the localized nameToShow */}
                        <span class="mt-2 text-center block font-medium">
                          {nameToShow}
                        </span>
                      </Button>
                    );
                  }}
                </For>
            </div>
          </Show>
      </div> 
    </div>
  );
};
