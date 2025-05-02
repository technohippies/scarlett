import TranslatorWidget from '../../../src/features/translator/TranslatorWidget';

export default {
  title: 'Features/TranslatorWidget', // Categorize under Features
  component: TranslatorWidget,
  parameters: {
    layout: 'centered', // Center the component on the canvas
  },
  tags: ['autodocs'], // Enable automatic documentation generation
  argTypes: {
    hoveredWord: { control: 'text', description: 'The main translated word' },
    originalWord: { control: 'text', description: 'The original source word' },
    pronunciation: { control: 'text', description: 'Optional pronunciation (e.g., Pinyin)' },
    sourceLang: { control: 'text', description: 'Source language code (e.g., en)' },
    targetLang: { control: 'select', options: ['en', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ja', 'ko'], description: 'Target language code' },
    onTTSRequest: { action: 'TTS Request', description: 'Callback function for TTS requests' },
    alignment: { control: 'object' }, // Allow providing alignment via controls if needed
    // Add argType for onClose if you implement it in the component
    // onClose: { action: 'Close Requested', description: 'Callback when close is requested' },
  },
  // Default args for stories
  args: {
    hoveredWord: '你好',
    originalWord: 'Hello',
    sourceLang: 'en',
    targetLang: 'zh-CN',
    pronunciation: 'nǐ hǎo',
    alignment: null,
  },
};

// --- Stories --- //

export const Default = {
  args: {},
};

export const EnglishToSpanish = {
  args: {
    hoveredWord: 'Hola',
    originalWord: 'Hello',
    sourceLang: 'en',
    targetLang: 'es',
    pronunciation: undefined, // No pinyin for Spanish
  },
};

export const WithoutPronunciation = {
  args: {
    hoveredWord: 'Bonjour',
    originalWord: 'Hello',
    sourceLang: 'en',
    targetLang: 'fr',
    pronunciation: undefined, // Explicitly undefined
  },
};

export const LongWord = {
    args: {
        hoveredWord: 'Übersetzungswörterbuch', // A long German word
        originalWord: 'Translation Dictionary',
        sourceLang: 'en',
        targetLang: 'de',
        pronunciation: undefined,
    },
};

export const NoTTS = {
    args: {
        hoveredWord: 'Привет', // Russian
        originalWord: 'Hello',
        sourceLang: 'en',
        targetLang: 'ru', // Assuming 'ru' is not in showTTSButton logic
        pronunciation: 'Privet',
    },
};

// New Story for Multi-line text
export const MultiLineSentence = {
  args: {
    hoveredWord: 'Esta es una frase de ejemplo más larga que debería ajustarse a varias líneas.',
    originalWord: 'This is a longer example sentence that should wrap onto multiple lines.',
    sourceLang: 'en',
    targetLang: 'es',
    pronunciation: undefined,
  },
};

// New Story for Multi-line Pinyin
export const MultiLinePinyin = {
  args: {
    hoveredWord: '你好世界，这是一个多行拼音的例子',
    originalWord: 'Hello world, this is an example of multi-line pinyin.',
    sourceLang: 'en',
    targetLang: 'zh-CN',
    pronunciation: 'nǐ hǎo shì jiè, zhè shì yī gè duō háng pīn yīn de lì zi',
  },
};

// Story demonstrating the loading/highlighting state
// Note: Loading and highlighting are triggered internally by clicking the button
export const GeneratingAudio = {
  args: {
    // Use args that match the internal simulation/highlighting if needed
    // Or just default args, relying on clicking the button
    hoveredWord: '你好 世界', // Example text for potential alignment
    originalWord: 'Hello World',
    sourceLang: 'en',
    targetLang: 'zh-CN',
    pronunciation: 'nǐ hǎo shì jiè',
    alignment: null, 
    // onTTSRequest is handled by default args/argTypes action
  },
}; 