import { SetupProvider, ProviderOption } from '../../../src/features/oninstall/SetupProvider';
import messagesEn from '../../../public/_locales/en/messages.json';

const allMockProviders: ProviderOption[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434',
    logoUrl: '/images/llm-providers/ollama.png'
  },
  {
    id: 'jan',
    name: 'Jan',
    defaultBaseUrl: 'http://localhost:1337',
    logoUrl: '/images/llm-providers/jan.png'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    defaultBaseUrl: 'ws://127.0.0.1:1234',
    logoUrl: '/images/llm-providers/lmstudio.png'
  }
];

export default {
  title: 'Features/OnInstall/SetupProvider',
  component: SetupProvider,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    onComplete: (provider: ProviderOption) => console.log('Story: SetupProvider onComplete triggered with:', provider),
    onBack: () => console.log('Story: SetupProvider onBack triggered'),
    selectProviderLabel: "Select an LLM Provider",
    description: "If you can't run Qwen3 4B or Gemma3 4B or larger locally, setup Jan with an OpenRouter model, many of which are free.",
    continueLabel: messagesEn.onboardingContinue?.message || "Continue",
    availableProviders: allMockProviders,
    messages: messagesEn,
  },
};

// Basic render story (only Default needed now)
export const Default = {
    render: (args: any) => (
        <div class="h-screen w-full">
            <SetupProvider {...args} />
        </div>
    ),
};

// Embedding Provider Selection story (no Jan, custom description)
export const EmbeddingProvider = {
    render: (args: any) => (
        <div class="h-screen w-full">
            <SetupProvider
                {...args}
                selectProviderLabel="Select Embedding Provider"
                description="Most computers can run an embedding model locally."
                availableProviders={allMockProviders.filter(p => p.id !== 'jan')}
            />
        </div>
    ),
};
