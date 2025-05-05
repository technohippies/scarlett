import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import { SettingsProvider, useSettings } from "../../context/SettingsContext"; // Restore useSettings
import SettingsPageView from "./SettingsPageView"; // Uncomment view import
import type { ProviderOption } from "../../features/models/ProviderSelectionPanel";
import type { ModelOption } from "../../features/models/ModelSelectionPanel";
import type { FunctionConfig } from "../../services/storage/types";

const SettingsPage: Component = () => {
  return (
    <SettingsProvider>
      <SettingsPageContent />
    </SettingsProvider>
  );
};

const SettingsPageContent: Component = () => {
  // 1. Restore context usage
  const settingsContext = useSettings();

  // 2. Keep signal for testing
  const [activeSection, setActiveSection] = createSignal<string | null>('llm');
  console.log('[SettingsPageContent] Log 1: After createSignal. typeof activeSection:', typeof activeSection);

  // 3. Restore transient state getters
  const llmTransientState = settingsContext.getTransientState('LLM');
  const embeddingTransientState = settingsContext.getTransientState('Embedding');
  const readerTransientState = settingsContext.getTransientState('Reader');
  const ttsTransientState = settingsContext.getTransientState('TTS');

  // 4. Keep provider options
  const llmProviderOptions: ProviderOption[] = [
      { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
      { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' },
      { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
  ];
  const embeddingProviderOptions: ProviderOption[] = [...llmProviderOptions];
  const readerProviderOptions: ProviderOption[] = llmProviderOptions.filter(p => p.id === 'ollama');
  const ttsProviderOptions: ProviderOption[] = []; // Placeholder
  console.log('[SettingsPageContent] Log 2: After provider options defined.');

  // 5. Keep Handlers Commented Out (Placeholders for some)
  // ...
  console.log('[SettingsPageContent] Log 3: After getTransientState calls.');

  // Restore rendering with correct handlers
  return (
    <SettingsPageView
      activeSection={activeSection}
      loadStatus={settingsContext.loadStatus}
      config={settingsContext.config}
      llmProviderOptions={llmProviderOptions}
      embeddingProviderOptions={embeddingProviderOptions}
      readerProviderOptions={readerProviderOptions}
      ttsProviderOptions={ttsProviderOptions}
      llmTransientState={llmTransientState}
      embeddingTransientState={embeddingTransientState}
      readerTransientState={readerTransientState}
      ttsTransientState={ttsTransientState}
      // --- Handlers --- 
      onLlmSelectProvider={(provider) => settingsContext.handleSelectProvider('LLM', provider)} 
      onLlmSelectModel={(modelId) => settingsContext.handleSelectModel('LLM', modelId)}
      onLlmTestConnection={() => settingsContext.config.llmConfig && settingsContext.testConnection('LLM', settingsContext.config.llmConfig)}
      onEmbeddingSelectProvider={(provider) => settingsContext.handleSelectProvider('Embedding', provider)}
      onEmbeddingSelectModel={(modelId) => settingsContext.handleSelectModel('Embedding', modelId)}
      onEmbeddingTestConnection={() => settingsContext.config.embeddingConfig && settingsContext.testConnection('Embedding', settingsContext.config.embeddingConfig)}
      onReaderSelectProvider={(provider) => settingsContext.handleSelectProvider('Reader', provider)}
      onReaderSelectModel={(modelId) => settingsContext.handleSelectModel('Reader', modelId)}
      onReaderTestConnection={() => settingsContext.config.readerConfig && settingsContext.testConnection('Reader', settingsContext.config.readerConfig)}
      // TODO: Add TTS handlers if/when implemented in context
      onRedirectSettingChange={settingsContext.updateRedirectSetting} 
      // TODO: Add other handlers (API Key, DB Location, Reset, Import/Export) if needed
      onSectionChange={(section) => setActiveSection(section)}
    />
  );
};

export default SettingsPage;
