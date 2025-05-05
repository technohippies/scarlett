import { Component, createSignal, onMount, Show } from 'solid-js';
import { SettingsProvider, useSettings } from "../../context/SettingsContext"; // Restore useSettings
import SettingsPageView from "./SettingsPageView"; // Uncomment view import
import type { ProviderOption } from "../../features/models/ProviderSelectionPanel";
import { Spinner } from '../../components/ui/spinner';
import type { SettingsLoadStatus, FetchStatus, TestStatus } from '../../context/SettingsContext'; // Import status types

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

  // 4. Get provider options from context
  const { 
      llmProviderOptions, 
      embeddingProviderOptions, 
      readerProviderOptions, 
      ttsProviderOptions, 
      allTags 
  } = settingsContext;

  console.log('[SettingsPageContent] Log 2: After provider options defined/retrieved.');

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
      allTags={allTags}
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
      onSectionChange={(section) => setActiveSection(section)}
    />
  );
};

export default SettingsPage;
