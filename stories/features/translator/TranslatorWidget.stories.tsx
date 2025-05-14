import { createSignal, createEffect } from 'solid-js';
import { action } from '@storybook/addon-actions';
import TranslatorWidget, { type AlignmentData } from '../../../src/features/translator/TranslatorWidget';

// --- Type Definitions for Story Args --- 
interface PlainDataArgs {
    textToTranslate?: string;
    translatedText?: string;
    isLoading?: boolean;
    sourceLang?: string;
    targetLang?: string;
    pronunciation?: string;
    alignment?: AlignmentData | null;
}

interface ActionArgs {
    onTTSRequest: (text: string, lang: string, speed: number) => Promise<any>; 
    onCloseRequest?: () => void;
}

type FullStoryRenderArgs = PlainDataArgs & ActionArgs;

// --- createAccessors (simplified, may not be used by all stories if testing manually) ---
// This helper is kept for potential reuse but problematic stories will create signals directly.
function createAccessorsAndSetters(staticArgs: PlainDataArgs) {
    const [textToTranslate, setTextToTranslate] = createSignal(staticArgs.textToTranslate || '');
    const [translatedText, setTranslatedText] = createSignal(staticArgs.translatedText || '');
    const [isLoading, setIsLoading] = createSignal(staticArgs.isLoading || false);
    const [sourceLang, setSourceLang] = createSignal(staticArgs.sourceLang || 'en');
    const [targetLang, setTargetLang] = createSignal(staticArgs.targetLang || 'zh-CN');
    const [pronunciation, setPronunciation] = createSignal(staticArgs.pronunciation || undefined);
    const [alignment, setAlignment] = createSignal<AlignmentData | null | undefined>(staticArgs.alignment || null);

    // Effects to update signals if Storybook controls change staticArgs
    createEffect(() => setTextToTranslate(staticArgs.textToTranslate || ''));
    createEffect(() => setTranslatedText(staticArgs.translatedText || ''));
    createEffect(() => setIsLoading(staticArgs.isLoading || false));
    createEffect(() => setSourceLang(staticArgs.sourceLang || 'en'));
    createEffect(() => setTargetLang(staticArgs.targetLang || 'zh-CN'));
    createEffect(() => setPronunciation(staticArgs.pronunciation || undefined));
    createEffect(() => setAlignment(staticArgs.alignment || null));
    
    return {
        textToTranslate, translatedText, isLoading, sourceLang, targetLang, pronunciation, alignment,
        setTextToTranslate, setTranslatedText, setIsLoading, setSourceLang, setTargetLang, setPronunciation, setAlignment
    };
}

// --- Storybook Default Export --- 
export default {
  title: 'Features/TranslatorWidget',
  component: TranslatorWidget,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    textToTranslate: { control: 'text', description: 'The original source word/text' },
    translatedText: { control: 'text', description: 'The translated word/text' },
    isLoading: { control: 'boolean' },
    sourceLang: { control: 'select', options: ['auto', 'en', 'zh-CN', 'es', 'fr', 'de'], description: 'Source language code' },
    targetLang: { control: 'select', options: ['en', 'zh-CN', 'es', 'fr', 'de'], description: 'Target language code' },
    pronunciation: { control: 'text' },
    alignment: { control: 'object' }, 
    onTTSRequest: { action: 'onTTSRequest', description: 'Callback for TTS requests' },
    onCloseRequest: { action: 'onCloseRequest', description: 'Callback for close action' },
  },
  args: { // Default args for ALL stories
    textToTranslate: 'Hello',
    translatedText: '你好',
    sourceLang: 'en',
    targetLang: 'zh-CN',
    pronunciation: 'nǐ hǎo',
    isLoading: false,
    alignment: null,
    onTTSRequest: action('onTTSRequest'),       // Default action mock
    onCloseRequest: action('onCloseRequest'),   // Default action mock
  },
};

// --- Stories --- //

export const Default = {
  render: (args: FullStoryRenderArgs) => {
    // Manually create signals for the core props involved in the error
    const [textToTranslate] = createSignal(args.textToTranslate || '');
    const [translatedText] = createSignal(args.translatedText || '');
    const [isLoading] = createSignal(args.isLoading || false);
    const [sourceLang] = createSignal(args.sourceLang || 'en');
    const [targetLang] = createSignal(args.targetLang || 'zh-CN');
    const [pronunciation] = createSignal(args.pronunciation || undefined);
    const [alignment] = createSignal<AlignmentData | null | undefined>(args.alignment || null);

    return (
      <TranslatorWidget
        textToTranslate={textToTranslate} 
        translatedText={translatedText}    
        isLoading={isLoading}             
        sourceLang={sourceLang}
        targetLang={targetLang}
        pronunciation={pronunciation}
        alignment={alignment}
        onTTSRequest={args.onTTSRequest}  // Pass action directly
        onCloseRequest={args.onCloseRequest} // Pass action directly
      />
    );
  },
  // Args for Default story (will use main args if not overridden here)
  args: {
    // textToTranslate: 'Hello Story Default',
    // translatedText: '你好故事默认',
    // isLoading: false,
  }
};

// LoadingState story (should still work, keep it as is for baseline)
export const LoadingState = {
  render: (args: FullStoryRenderArgs) => {
    // For LoadingState, we can use the helper if it's confirmed to work, 
    // or stick to manual creation for consistency during debugging.
    // Let's use the helper here as it was working.
    const simplifiedArgsForHelper: PlainDataArgs = {
        textToTranslate: args.textToTranslate,
        translatedText: args.translatedText,
        isLoading: args.isLoading,
        sourceLang: args.sourceLang,
        targetLang: args.targetLang,
        pronunciation: args.pronunciation,
        alignment: args.alignment,
    };
    const { ...accessors } = createAccessorsAndSetters(simplifiedArgsForHelper);
    return <TranslatorWidget {...accessors} onTTSRequest={args.onTTSRequest} onCloseRequest={args.onCloseRequest} />;
  },
  args: {
    textToTranslate: 'Loading example...',
    translatedText: '',
    isLoading: true,
    // Other args will use defaults from the main `args` object
  },
};


export const EnglishToSpanish = {
  render: (args: FullStoryRenderArgs) => {
    const [textToTranslate, setTextToTranslate] = createSignal(args.textToTranslate || '');
    const [translatedText, setTranslatedText] = createSignal(args.translatedText || '');
    const [isLoading, setIsLoading] = createSignal(args.isLoading || false);
    const [sourceLang, setSourceLang] = createSignal(args.sourceLang || 'en');
    const [targetLang, setTargetLang] = createSignal(args.targetLang || 'es');

    createEffect(() => setTextToTranslate(args.textToTranslate || ''));
    createEffect(() => setTranslatedText(args.translatedText || ''));
    createEffect(() => setIsLoading(args.isLoading || false));
    createEffect(() => setSourceLang(args.sourceLang || 'en'));
    createEffect(() => setTargetLang(args.targetLang || 'es'));

    return (
      <TranslatorWidget
        textToTranslate={textToTranslate}
        translatedText={translatedText}
        isLoading={isLoading}
        sourceLang={sourceLang}
        targetLang={targetLang}
        pronunciation={() => args.pronunciation || undefined} // Pass accessor for optional prop
        alignment={() => args.alignment || null}         // Pass accessor for optional prop
        onTTSRequest={args.onTTSRequest}
        onCloseRequest={args.onCloseRequest}
      />
    );
  },
  args: {
    textToTranslate: 'Hello',
    translatedText: 'Hola',
    sourceLang: 'en',
    targetLang: 'es',
    pronunciation: undefined,
    isLoading: false,
  },
};


export const WithAlignmentData = {
  render: (args: FullStoryRenderArgs) => {
    const { 
        textToTranslate: initialText,
        translatedText: initialTranslated,
        isLoading: initialIsLoading,
        sourceLang: initialSourceLang,
        targetLang: initialTargetLang,
        pronunciation: initialPronunciation,
        alignment: initialAlignment,
        onCloseRequest: onCloseRequestArg // onTTSRequest is handled by custom mock
    } = args;

    const [textToTranslate, setTextToTranslate] = createSignal(initialText || '');
    const [translatedText, setTranslatedText] = createSignal(initialTranslated || '');
    const [isLoading, setIsLoading] = createSignal(initialIsLoading || false);
    const [sourceLang, setSourceLang] = createSignal(initialSourceLang || 'en');
    const [targetLang, setTargetLang] = createSignal(initialTargetLang || 'zh-CN');
    const [pronunciationSignal, setPronunciationSignal] = createSignal(initialPronunciation || undefined);
    const [alignmentSignal, setAlignmentSignal] = createSignal<AlignmentData | null | undefined>(initialAlignment || null);

    createEffect(() => setTextToTranslate(args.textToTranslate || ''));
    createEffect(() => setTranslatedText(args.translatedText || ''));
    createEffect(() => setIsLoading(args.isLoading || false));
    createEffect(() => setSourceLang(args.sourceLang || 'en'));
    createEffect(() => setTargetLang(args.targetLang || 'zh-CN'));
    createEffect(() => setPronunciationSignal(args.pronunciation || undefined));
    createEffect(() => setAlignmentSignal(args.alignment || null));

    const mockOnTTSRequest = async (text: string, lang: string, speed: number) => {
        action('onTTSRequest-WithAlignmentData')(text, lang, speed); // Story-specific action log
        setIsLoading(true); // Use the local signal's setter
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
        
        let simulatedAlignment: AlignmentData | null = null;
        // Ensure this logic matches the translatedText of the story for meaningful highlighting
        if (text === '你好 世界') { 
            // More detailed alignment for "你好 世界"
            simulatedAlignment = {
                characters: ['你', '好', ' ', '世', '界'],
                character_start_times_seconds: [0.1, 0.5, 0.9, 1.0, 1.5], 
                character_end_times_seconds:   [0.5, 0.9, 1.0, 1.5, 2.0]
            };
        } else if (text && text.includes('你好')) { // Fallback for simpler "你好"
            simulatedAlignment = { characters: ['你', '好'], character_start_times_seconds: [0.1, 0.5], character_end_times_seconds: [0.5, 1.0] };
        } else if (text) { // Generic fallback
            const chars = text.split('');
            simulatedAlignment = { characters: chars, character_start_times_seconds: chars.map((_,i) => i * 0.3), character_end_times_seconds: chars.map((_,i) => (i * 0.3) + 0.25) };
        }
        
        setAlignmentSignal(simulatedAlignment); 
        setIsLoading(false); // Use the local signal's setter
        // MODIFICATION: Use the user's provided audio file
        return { audioDataUrl: '/audio/test-voice.mp3', alignment: simulatedAlignment };
    };

    return (
      <TranslatorWidget
        textToTranslate={textToTranslate}
        translatedText={translatedText}
        isLoading={isLoading}
        sourceLang={sourceLang}
        targetLang={targetLang}
        pronunciation={pronunciationSignal} // Use signal accessor
        alignment={alignmentSignal}         // Use signal accessor
        onTTSRequest={mockOnTTSRequest} 
        onCloseRequest={onCloseRequestArg}
      />
    );
  },
  args: {
    textToTranslate: 'Hello World',
    translatedText: '你好 世界',
    sourceLang: 'en',
    targetLang: 'zh-CN',
    pronunciation: 'nǐ hǎo shì jiè',
    isLoading: false,
    alignment: null, 
    // onTTSRequest is defined by the custom mock in render
    // onCloseRequest uses the default action from main args
  },
};

export const BrowserTTSSimulation = {
  render: (args: FullStoryRenderArgs) => {
    const { 
        textToTranslate: initialText, translatedText: initialTranslated, isLoading: initialIsLoading,
        sourceLang: initialSourceLang, targetLang: initialTargetLang, onCloseRequest: onCloseRequestArg
    } = args;

    const [textToTranslate, setTextToTranslate] = createSignal(initialText || '');
    const [translatedText, setTranslatedText] = createSignal(initialTranslated || '');
    const [isLoading, setIsLoading] = createSignal(initialIsLoading || false);
    const [sourceLang, setSourceLang] = createSignal(initialSourceLang || 'en');
    const [targetLang, setTargetLang] = createSignal(initialTargetLang || 'en');
    
    createEffect(() => setTextToTranslate(args.textToTranslate || ''));
    createEffect(() => setTranslatedText(args.translatedText || ''));
    createEffect(() => setIsLoading(args.isLoading || false));
    createEffect(() => setSourceLang(args.sourceLang || 'en'));
    createEffect(() => setTargetLang(args.targetLang || 'en'));

    const mockOnTTSRequest = async (text: string, lang: string, speed: number) => {
        action('onTTSRequest-BrowserSim')(text, lang, speed);
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsLoading(false);
        return { browserTtsInitiated: true, alignment: null };
    };

    return (
      <TranslatorWidget
        textToTranslate={textToTranslate}
        translatedText={translatedText}
        isLoading={isLoading}
        sourceLang={sourceLang}
        targetLang={targetLang}
        pronunciation={() => args.pronunciation || undefined} // Use direct accessor for optional prop based on args
        alignment={() => args.alignment || null}            // Use direct accessor for optional prop based on args
        onTTSRequest={mockOnTTSRequest}
        onCloseRequest={onCloseRequestArg}
      />
    );
  },
  args: {
    textToTranslate: '你好',
    translatedText: 'Hello',
    sourceLang: 'zh-CN',
    targetLang: 'en',
    isLoading: false,
    // onTTSRequest is defined by the custom mock in render
    // onCloseRequest uses the default action from main args
  },
}; 