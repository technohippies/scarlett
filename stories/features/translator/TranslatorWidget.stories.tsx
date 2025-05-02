import TranslatorWidget from '../../../src/features/translator/TranslatorWidget';
import { action } from '@storybook/addon-actions'; // Use addon-actions for callbacks

// Mock TTS function for Storybook
const mockTTS = (text: string, lang: string) => {
  action('TTS Request')({ text, lang }); // Log action to Storybook UI
  console.log(`[Storybook TTS] Request: "${text}" (${lang})`);
};

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
    onTTSRequest: mockTTS, // Use the mock function
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
    hoveredWord: 'Esta es una frase de ejemplo más larga que debería ajustarse a varias líneas.', // Spanish example sentence
    originalWord: 'This is a longer example sentence that should wrap onto multiple lines.',
    sourceLang: 'en',
    targetLang: 'es',
    pronunciation: undefined,
    onTTSRequest: mockTTS,
  },
};

// New Story for Multi-line Pinyin
export const MultiLinePinyin = {
  args: {
    hoveredWord: '你好世界，这是一个多行拼音的例子', // Example Chinese sentence
    originalWord: 'Hello world, this is an example of multi-line pinyin.',
    sourceLang: 'en',
    targetLang: 'zh-CN',
    // Longer pinyin string that might wrap
    pronunciation: 'nǐ hǎo shì jiè, zhè shì yī gè duō háng pīn yīn de lì zi',
    onTTSRequest: mockTTS,
  },
};

// New Story demonstrating the loading state
// Note: Loading is triggered by clicking the button due to internal simulation
export const GeneratingAudio = {
  args: {
    // Use default props, or customize as needed
    hoveredWord: '你好',
    originalWord: 'Hello',
    sourceLang: 'en',
    targetLang: 'zh-CN',
    pronunciation: 'nǐ hǎo',
    onTTSRequest: mockTTS,
  },
}; 