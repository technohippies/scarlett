import { Component, createSignal, For } from 'solid-js';
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
}

// No longer defining lists here
/*
export const nativeLanguages: LanguageOption[] = [...];
export const allTargetLanguages: LanguageOption[] = [...];
*/

// Define props for the component
interface LanguageProps {
  onComplete: (selectedLangs: { targetValue: string; targetLabel: string }) => void;
  onNativeLangChange: (newLangCode: string) => void;
  iSpeakLabel: string;
  selectLanguagePlaceholder: string;
  wantToLearnLabel: string;
  continueLabel: string;
  initialNativeLangValue: string | undefined;
  availableNativeLanguages: LanguageOptionStub[];
  availableTargetLanguages: LanguageOptionStub[];
  messages: Messages | undefined;
}

// Helper function to get translated name (could be moved)
const getLangName = (value: string | undefined, messages: Messages | undefined): string => {
  if (!value || !messages) return '';
  const key = `langName${value.charAt(0).toUpperCase() + value.slice(1)}`;
  return messages[key]?.message || value; // Fallback to value code
};

export const Language: Component<LanguageProps> = (props) => {

  // Find the initial language stub based on the prop value
  const initialNativeLangStub = props.availableNativeLanguages.find(lang => lang.value === props.initialNativeLangValue);
  
  // State now holds the LanguageOptionStub
  const [selectedNativeLangStub, setSelectedNativeLangStub] = createSignal<LanguageOptionStub | undefined>(
    initialNativeLangStub || props.availableNativeLanguages.find(l => l.value === 'en') // Fallback to English stub
  );
  // State for target language VALUE
  const [selectedTargetLangValue, setSelectedTargetLangValue] = createSignal<string | undefined>();

  // Filter target languages based on selected native language
  const targetLanguages = (): LanguageOptionStub[] => props.availableTargetLanguages.filter(
    lang => lang.value !== selectedNativeLangStub()?.value
  );

  const handleNativeChange = (stub: LanguageOptionStub | null) => {
    const newValue = stub?.value;
    console.log('[Language] handleNativeChange: New value:', newValue);
    setSelectedNativeLangStub(stub ?? undefined);
    // Call the new prop if value is valid
    if (newValue) {
      props.onNativeLangChange(newValue);
    }
  };

  const handleSubmit = () => {
    // Native value is now handled by onChange, just get target
    const nativeLangValue = selectedNativeLangStub()?.value; // Still need for filtering/saving
    const targetLangValue = selectedTargetLangValue();
    if (!nativeLangValue || !targetLangValue) return;

    // Find the full target label (emoji + translated name) for the callback
    const targetStub = props.availableTargetLanguages.find(l => l.value === targetLangValue);
    const targetEmoji = targetStub?.emoji || '';
    const targetTranslatedName = getLangName(targetLangValue, props.messages);
    const fullTargetLabel = `${targetEmoji} ${targetTranslatedName}`.trim();

    const dataToPass = { 
      targetValue: targetLangValue, 
      targetLabel: fullTargetLabel 
    };
    console.log('[Language] handleSubmit: Calling onComplete with:', dataToPass);
    props.onComplete(dataToPass);
  };

  return (
    // Enforce FIXED width: Use w-[48rem]
    <div class="p-4 md:p-8 w-[48rem] mx-auto flex flex-col items-center space-y-6 min-h-screen justify-center bg-background text-foreground">
      {/* Image: Centered by parent's items-center */}
      <img
        src="/images/scarlett-supercoach/scarlett-proud-512x512.png"
        alt="Scarlett Supercoach"
        class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6"
      />

      {/* Sentence Structure: Takes full width */}
      <div class="text-center text-xl md:text-2xl space-y-4 w-full">
        <p class="inline-flex items-center gap-2">
          <span>{props.iSpeakLabel}</span>
          <Select<LanguageOptionStub>
            options={props.availableNativeLanguages}
            value={selectedNativeLangStub()}
            onChange={handleNativeChange}
            optionValue="value"
            optionTextValue={stub => `${stub.emoji} ${getLangName(stub.value, props.messages)}`.trim()}
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
        </p>
        <p>{props.wantToLearnLabel}</p>
      </div>

      {/* Target Language Grid: Takes full width (max-w-md applied internally) */}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-md">
        <For each={targetLanguages()}> 
          {(langStub) => {
            const name = getLangName(langStub.value, props.messages);
            return (
              <Button
                variant="outline"
                onClick={() => setSelectedTargetLangValue(langStub.value)}
                class={cn(
                  'h-auto p-4 flex flex-col items-center justify-center space-y-2 text-base border',
                  'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0',
                  selectedTargetLangValue() === langStub.value
                    ? 'bg-neutral-800 text-foreground border-neutral-700'
                    : 'border-neutral-700'
                )}
              >
                <span class="text-4xl">{langStub.emoji}</span>
                <span>{name}</span> 
              </Button>
            );
          }}
        </For>
      </div>

      {/* Continue Button Area: Takes full width (max-w-xs for button itself) */}
      <div class="pt-6 w-full max-w-xs">
         <Button
           size="lg"
           class="w-full"
           onClick={handleSubmit}
           disabled={!selectedTargetLangValue()}
         >
           {props.continueLabel}
         </Button>
      </div>
    </div>
  );
};
