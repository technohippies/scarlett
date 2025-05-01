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

// Define explicit type
interface LanguageOption {
  value: string;
  label: string;
}

// Apply type to arrays - Expanded list for native languages
const nativeLanguages: LanguageOption[] = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'zh', label: '🇨🇳 Chinese' },
  { value: 'th', label: '🇹🇭 Thai' },
  { value: 'id', label: '🇮🇩 Indonesian' }, // Bahasa Indonesia
  { value: 'ar', label: '🇸🇦 Arabic' },
  { value: 'ja', label: '🇯🇵 Japanese' },
  { value: 'ko', label: '🇰🇷 Korean' },
  { value: 'es', label: '🇪🇸 Spanish' },
  // Add more native languages as needed
];

// Target languages offered for learning (initially limited set)
const allTargetLanguages: LanguageOption[] = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'zh', label: '🇨🇳 Mandarin' },
  { value: 'ja', label: '🇯🇵 Japanese' },
  { value: 'ko', label: '🇰🇷 Korean' },
];

// Define props for the component
interface LanguageProps {
  onComplete: () => void; // Function to call when setup is done
}

export const Language: Component<LanguageProps> = (props) => {
  // Store the full object in state
  const [selectedNativeLangObj, setSelectedNativeLangObj] = createSignal<LanguageOption | undefined>(
    nativeLanguages[0] // Default to English object
  );
  const [selectedTargetLang, setSelectedTargetLang] = createSignal<string | undefined>();

  // Filter using the value from the state object
  const targetLanguages = (): LanguageOption[] => allTargetLanguages.filter(
    lang => lang.value !== selectedNativeLangObj()?.value
  );

  const handleSubmit = () => {
    const nativeLang = selectedNativeLangObj()?.value;
    const targetLang = selectedTargetLang();
    if (!nativeLang || !targetLang) return; // Should be disabled, but double-check

    console.log('Saving Native:', nativeLang);
    console.log('Saving Target:', targetLang);
    // TODO: Replace with actual storage service call
    // await settingsService.setNativeLanguage(nativeLang);
    // await settingsService.setTargetLanguage(targetLang);

    // Call the completion callback provided by the parent
    props.onComplete();
  };

  return (
    <div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center space-y-6 min-h-screen justify-center">
      {/* Image at the top */}
      <img
        src="/images/scarlett-supercoach/scarlett-proud-512x512.png"
        alt="Scarlett Supercoach"
        class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6"
      />

      {/* Sentence Structure */}
      <div class="text-center text-xl md:text-2xl space-y-4">
        <p class="inline-flex items-center gap-2">
          <span>I speak</span>
          <Select<LanguageOption>
            options={nativeLanguages}
            // Pass the object to value prop
            value={selectedNativeLangObj()}
            // onChange now receives the full object
            onChange={setSelectedNativeLangObj}
            optionValue="value"
            optionTextValue="label"
            placeholder="Select language"
            itemComponent={(props) => (
              <SelectItem item={props.item}>
                {props.item.rawValue.label}
              </SelectItem>
            )}
            multiple={false}
            id="native-language"
            class="w-auto inline-block align-middle"
          >
            <SelectTrigger class="font-semibold border-b border-border hover:border-primary pl-3 pr-1 py-0 focus:ring-0 min-w-[150px] cursor-pointer">
              <SelectValue<LanguageOption>>
                {(state) => state.selectedOption()?.label || '...'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </p>
        <p>and I want to learn...</p>
      </div>

      {/* Target Language Grid Selector */}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg">
        <For each={targetLanguages()}>
          {(lang) => (
            <Button
              variant="outline"
              onClick={() => setSelectedTargetLang(lang.value)}
              class={cn(
                'h-auto p-4 flex flex-col items-center justify-center space-y-2 text-base border',
                'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0',
                selectedTargetLang() === lang.value
                  ? 'bg-neutral-800 text-foreground border-neutral-700'
                  : 'border-neutral-700'
              )}
            >
              <span class="text-4xl">{lang.label.split(' ')[0]}</span> {/* Emoji */}
              <span>{lang.label.split(' ').slice(1).join(' ')}</span> {/* Name */}
            </Button>
          )}
        </For>
      </div>

      {/* Continue Button */}
      <div class="pt-6 w-full max-w-xs">
         <Button
           size="lg"
           class="w-full"
           onClick={handleSubmit}
           disabled={!selectedTargetLang()} // Disable if no target language selected
         >
           Continue
         </Button>
      </div>
    </div>
  );
};
