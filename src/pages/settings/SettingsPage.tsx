import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import { SettingsProvider, useSettings } from "../../context/SettingsContext"; // Restore useSettings
import SettingsPageView from "./SettingsPageView"; // Uncomment view import
import type { ProviderOption } from "../../features/models/ProviderSelectionPanel";

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
  const embeddingProviderOptions: ProviderOption[] = [...llmProviderOptions]; // Placeholder - Fix Syntax
  const readerProviderOptions: ProviderOption[] = llmProviderOptions.filter(p => p.id === 'ollama'); // Placeholder - Fix Syntax
  const ttsProviderOptions: ProviderOption[] = []; // Placeholder
  console.log('[SettingsPageContent] Log 2: After provider options defined.');

  // 5. Keep Handlers Commented Out
  // const handleLlmSelectProvider = ...
  // ... etc ...

  // --- Debug Logs ---
  console.log('[SettingsPageContent] Log 3: After getTransientState calls.');

  // Render simple div instead of view
  // return <div>Test Render inside SettingsPageContent</div>; // Remove this line

  // Comment out original return /* // Remove this line
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
      onLlmSelectProvider={settingsContext.updateLlmConfig} // Assuming updateLlmConfig handles provider selection logic or similar
      onLlmSelectModel={(model: ModelOption) => { /* TODO */ }} // Placeholder
      onLlmChangeBaseUrl={(url: string) => { /* TODO */ }} // Placeholder
      onLlmTestConnection={(config: FunctionConfig) => settingsContext.testConnection('LLM', config)}
      onEmbeddingSelectProvider={settingsContext.updateEmbeddingConfig} // Assuming analogous context methods
      onEmbeddingSelectModel={(model: ModelOption) => { /* TODO */ }}
      onEmbeddingChangeBaseUrl={(url: string) => { /* TODO */ }}
      onEmbeddingTestConnection={(config: FunctionConfig) => settingsContext.testConnection('Embedding', config)}
      onReaderSelectProvider={settingsContext.updateReaderConfig}
      onReaderSelectModel={(model: ModelOption) => { /* TODO */ }}
      onReaderChangeBaseUrl={(url: string) => { /* TODO */ }}
      onReaderTestConnection={(config: FunctionConfig) => settingsContext.testConnection('Reader', config)}
      // TODO: Add TTS handlers if/when implemented in context
      // onTtsSelectProvider={...} 
      // onTtsSelectModel={...}
      // onTtsChangeBaseUrl={...}
      // onTtsTestConnection={...}
      onRedirectChange={settingsContext.updateRedirectSetting}
      // TODO: Add other handlers (API Key, DB Location, Reset, Import/Export) if needed
      // onApiKeyChange={...}
      // onDbLocationChange={...}
      // onResetSettings={...}
      // onExportSettings={...}
      // onImportSettings={...}
      onSectionChange={(section) => setActiveSection(section)}
    />
  );
  // */ // Remove this line
};

export default SettingsPage;
