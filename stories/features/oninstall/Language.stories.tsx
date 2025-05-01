import { Language, LanguageOptionStub } from '../../../src/features/oninstall/Language';
import messagesEn from '../../../public/_locales/en/messages.json';

// Define mock lists for the story (could be imported if shared)
const nativeLanguagesListStub: LanguageOptionStub[] = [
  { value: 'en', emoji: '🇺🇸' }, { value: 'zh', emoji: '🇨🇳' }, 
  { value: 'ja', emoji: '🇯🇵' }, { value: 'ko', emoji: '🇰🇷' },
  { value: 'es', emoji: '🇪🇸' },
];
const allTargetLanguagesListStub: LanguageOptionStub[] = [
  { value: 'en', emoji: '🇺🇸' }, { value: 'zh', emoji: '🇨🇳' }, 
  { value: 'ja', emoji: '🇯🇵' }, { value: 'ko', emoji: '🇰🇷' },
];

export default {
  title: 'Features/OnInstall/Language',
  component: Language,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    // Use actual English messages by importing the JSON
    onComplete: () => console.log('Story: Language onComplete triggered'),
    iSpeakLabel: messagesEn.onboardingISpeak.message,
    selectLanguagePlaceholder: messagesEn.onboardingSelectLanguage.message,
    wantToLearnLabel: messagesEn.onboardingIWantToLearn.message,
    continueLabel: messagesEn.onboardingContinue.message,
    initialNativeLangValue: 'en',
    // Pass the stub lists and messages object
    availableNativeLanguages: nativeLanguagesListStub,
    availableTargetLanguages: allTargetLanguagesListStub,
    onNativeLangChange: (langCode: string) => console.log(`Story: NativeLangChange triggered with: ${langCode}`),
    messages: messagesEn, 
  },
};

// Basic render story, similar structure to Card.stories.tsx
export const Default = {
    // Wrap in a div to provide height context for the story
    render: (args: any) => (
        <div class="h-screen w-full">
            <Language {...args} />
        </div>
    ),
}; 