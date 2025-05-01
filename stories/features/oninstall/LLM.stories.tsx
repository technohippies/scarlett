import { LLM, LLMProviderOption } from '../../../src/features/oninstall/LLM';
import messagesEn from '../../../public/_locales/en/messages.json';

const mockOllamaProvider: LLMProviderOption[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434',
    logoUrl: '/images/llm-providers/ollama.png'
  }
];

export default {
  title: 'Features/OnInstall/LLM',
  component: LLM,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    onComplete: (provider: LLMProviderOption) => console.log('Story: LLM onComplete triggered with:', provider),
    selectProviderLabel: "Select an LLM Provider",
    continueLabel: messagesEn.onboardingContinue?.message || "Continue",
    availableProviders: mockOllamaProvider,
    messages: messagesEn,
  },
};

// Basic render story (only Default needed now)
export const Default = {};
