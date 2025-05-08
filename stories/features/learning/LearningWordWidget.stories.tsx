import LearningWordWidget from '../../../src/features/learning/LearningWordWidget';

export default {
  title: 'Features/LearningWordWidget', // Categorize under Features
  component: LearningWordWidget,
  parameters: {
    layout: 'centered', // Center the component on the canvas
  },
  tags: ['autodocs'], // Enable automatic documentation generation
  argTypes: {
    originalWord: { control: 'text', description: 'The original source word' },
    translatedWord: { control: 'text', description: 'The translated word (target lang)' },
    sourceLang: { control: 'text', description: 'Source language code (e.g., en)' },
    targetLang: { control: 'select', options: ['en', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ja', 'ko'], description: 'Target language code' },
    onTTSRequest: { action: 'TTS Request', description: 'Callback function for TTS requests' },
    onMouseEnter: { action: 'Mouse Enter Widget', description: 'Mouse entered the widget' },
    onMouseLeave: { action: 'Mouse Leave Widget', description: 'Mouse left the widget' },
  },
  // Default args for stories
  args: {
    originalWord: 'love',
    translatedWord: '爱',
    sourceLang: 'en',
    targetLang: 'zh-CN',
    // Mock the TTS request for Storybook
    onTTSRequest: async (text: string, lang: string) => {
      console.log(`[Storybook TTS Request] Text: ${text}, Lang: ${lang}`);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Simulate success or failure (can make this configurable later)
      const success = Math.random() > 0.2; // 80% chance of success
      if (success) {
        // In a real scenario, you'd fetch a real audio URL or use a placeholder
        console.log('[Storybook TTS Request] Simulating SUCCESS');
        // Placeholder Data URL for a short silent audio clip
        return { audioDataUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA==' };
      } else {
        console.log('[Storybook TTS Request] Simulating FAILURE');
        return { error: 'Simulated TTS generation failed.' };
      }
    },
  },
};

// --- Stories --- //

export const Default = {
  args: {},
};

export const Spanish = {
  args: {
    originalWord: 'hello',
    translatedWord: 'hola',
    sourceLang: 'en',
    targetLang: 'es',
  },
};

export const French = {
  args: {
    originalWord: 'thank you',
    translatedWord: 'merci',
    sourceLang: 'en',
    targetLang: 'fr',
  },
};

export const NoTTSAvailable = {
  args: {
    originalWord: 'house',
    translatedWord: 'дом', // Russian
    sourceLang: 'en',
    targetLang: 'ru', // Assuming 'ru' is not in the supported TTS list
  },
};

export const LongWords = {
  args: {
    originalWord: 'Congratulations',
    translatedWord: 'Herzlichen Glückwunsch',
    sourceLang: 'en',
    targetLang: 'de',
  },
};
