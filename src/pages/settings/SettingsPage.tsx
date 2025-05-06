import { Component, createSignal, createEffect } from 'solid-js';
import SettingsPageView from './SettingsPageView';
import { useSettings } from '../../context/SettingsContext';
import type { ProviderOption } from '../../features/models/ProviderSelectionPanel';
import type { FunctionConfig } from '../../services/storage/types'; // Import RedirectServiceSetting

// Assume mock provider options are fetched or defined elsewhere if needed for the container
// For now, we rely on the context providing the actual config and the View receiving static options

interface SettingsPageProps {
  onNavigateBack?: () => void;
}

const SettingsPage: Component<SettingsPageProps> = (props) => {
  const settings = useSettings();

  // State for the active section within the page
  const [activeSection, setActiveSection] = createSignal<string | null>('llm');

  // Effect to potentially set initial active section based on config/load status
  createEffect(() => {
    if (settings.loadStatus() === 'ready' && !activeSection()) {
      // Optionally set a default section if none is active after load
      // setActiveSection('llm');
    }
    // Or navigate based on onboarding state if needed
  });

  // --- Get Transient States via Context Function --- 
  const llmTransientState = settings.getTransientState('LLM');
  const embeddingTransientState = settings.getTransientState('Embedding');
  const ttsTransientState = settings.getTransientState('TTS');

  // Mock provider options (can be moved or fetched)
  // These should ideally come from a shared constants or config file
  const mockLlmProviderOptions: ProviderOption[] = [
      { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
      { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' },
      { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
  ];
  const mockEmbeddingProviderOptions: ProviderOption[] = [...mockLlmProviderOptions];
  const mockTtsProviderOptions: ProviderOption[] = [
    { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
  ];

  return (
    <SettingsPageView
      loadStatus={settings.loadStatus} // Pass load status accessor
      config={settings.config} // Pass config signal accessor
      activeSection={activeSection} // Pass active section signal accessor
      // Pass the correctly retrieved transient states
      llmTransientState={llmTransientState}
      embeddingTransientState={embeddingTransientState}
      ttsTransientState={ttsTransientState}
      // Pass provider options (using mocks for now)
      llmProviderOptions={mockLlmProviderOptions}
      embeddingProviderOptions={mockEmbeddingProviderOptions}
      ttsProviderOptions={mockTtsProviderOptions}
      // Pass handlers from context
      onSectionChange={setActiveSection} // Update local active section state
      onLlmSelectProvider={(provider) => { void settings.handleSelectProvider('LLM', provider); }}
      onLlmSelectModel={(modelId) => { void settings.handleSelectModel('LLM', modelId); }}
      onLlmTestConnection={(config: FunctionConfig) => { void settings.testConnection('LLM', config); }}
      onEmbeddingSelectProvider={(provider) => { void settings.handleSelectProvider('Embedding', provider); }}
      onEmbeddingSelectModel={(modelId) => { void settings.handleSelectModel('Embedding', modelId); }}
      onEmbeddingTestConnection={(config: FunctionConfig) => { void settings.testConnection('Embedding', config); }}
      onTtsSelectProvider={(provider) => { void settings.handleSelectProvider('TTS', provider); }}
      onTtsSelectModel={(modelId) => { void settings.handleSelectModel('TTS', modelId); }}
      onTtsTestConnection={(config: FunctionConfig) => { void settings.testConnection('TTS', config); }}
      onRedirectSettingChange={(service, update) => settings.handleRedirectSettingChange(service, update)}
      // Pass navigation handler with fallback
      onBackClick={props.onNavigateBack ?? (() => { console.warn("onBackClick called but no handler provided"); })}
    />
  );
};

export default SettingsPage;
