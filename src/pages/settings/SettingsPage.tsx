import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import { SettingsProvider, useSettings } from "../../context/SettingsContext";
import SettingsPageView from "./SettingsPageView";
import type { ProviderOption } from "../../features/models/ProviderSelectionPanel";

const SettingsPage: Component = () => {
  return (
    <SettingsProvider>
      <SettingsPageContent />
    </SettingsProvider>
  );
};

const SettingsPageContent: Component = () => {
  const settingsContext = useSettings();

  const [activeSection, setActiveSection] = createSignal<string | null>('llm');

  const llmTransientState = settingsContext.getTransientState('LLM');
  const embeddingTransientState = settingsContext.getTransientState('Embedding');
  const readerTransientState = settingsContext.getTransientState('Reader');
  const ttsTransientState = settingsContext.getTransientState('TTS');

  const llmProviderOptions: ProviderOption[] = [
      { id: 'ollama', name: 'Ollama', defaultBaseUrl: 'http://localhost:11434', logoUrl: '/images/llm-providers/ollama.png' },
      { id: 'jan', name: 'Jan', defaultBaseUrl: 'http://localhost:1337', logoUrl: '/images/llm-providers/jan.png' },
      { id: 'lmstudio', name: 'LM Studio', defaultBaseUrl: 'ws://127.0.0.1:1234', logoUrl: '/images/llm-providers/lmstudio.png' },
  ];
  const embeddingProviderOptions: ProviderOption[] = [...llmProviderOptions];
  const readerProviderOptions: ProviderOption[] = llmProviderOptions.filter(p => p.id === 'ollama');
  const ttsProviderOptions: ProviderOption[] = [];

  const handleLlmSelectProvider = (provider: ProviderOption) => {
      settingsContext.updateLlmConfig({ providerId: provider.id, modelId: '', baseUrl: provider.defaultBaseUrl });
      settingsContext.fetchModels('LLM', provider);
  };
  const handleLlmSelectModel = (modelId: string | undefined) => {
      if (modelId && settingsContext.config.llmConfig) {
           settingsContext.updateLlmConfig({ ...settingsContext.config.llmConfig, modelId: modelId });
      } else if (modelId) {
           console.warn("[SettingsPage] Attempting to set LLM model ID but config provider part is missing");
      }
  };
  const handleLlmTestConnection = () => {
      const currentLlmConfig = settingsContext.config.llmConfig;
      if (currentLlmConfig && currentLlmConfig.providerId && currentLlmConfig.modelId) {
          settingsContext.testConnection('LLM', currentLlmConfig);
      } else {
          console.warn("[SettingsPage] Cannot test LLM connection: Provider or Model not selected.");
      }
  };

  const handleEmbeddingSelectProvider = (provider: ProviderOption) => {
    settingsContext.updateEmbeddingConfig({ providerId: provider.id, modelId: '', baseUrl: provider.defaultBaseUrl });
    settingsContext.fetchModels('Embedding', provider);
  };
  const handleEmbeddingSelectModel = (modelId: string | undefined) => {
    if (modelId && settingsContext.config.embeddingConfig) {
        settingsContext.updateEmbeddingConfig({ ...settingsContext.config.embeddingConfig, modelId: modelId });
    } else if (modelId) {
        console.warn("[SettingsPage] Attempting to set Embedding model ID but config provider part is missing");
    }
  };
   const handleEmbeddingTestConnection = () => {
    const currentConfig = settingsContext.config.embeddingConfig;
    if (currentConfig && currentConfig.providerId && currentConfig.modelId) {
        settingsContext.testConnection('Embedding', currentConfig);
    } else {
        console.warn("[SettingsPage] Cannot test Embedding connection: Provider or Model not selected.");
    }
  };

  const handleReaderSelectProvider = (provider: ProviderOption) => {
    settingsContext.updateReaderConfig({ providerId: provider.id, modelId: '', baseUrl: provider.defaultBaseUrl });
    settingsContext.fetchModels('Reader', provider);
  };
  const handleReaderSelectModel = (modelId: string | undefined) => {
    if (modelId && settingsContext.config.readerConfig) {
        settingsContext.updateReaderConfig({ ...settingsContext.config.readerConfig, modelId: modelId });
    } else if (modelId) {
        console.warn("[SettingsPage] Attempting to set Reader model ID but config provider part is missing");
    }
  };
   const handleReaderTestConnection = () => {
    const currentConfig = settingsContext.config.readerConfig;
    if (currentConfig && currentConfig.providerId && currentConfig.modelId) {
        settingsContext.testConnection('Reader', currentConfig);
    } else {
        console.warn("[SettingsPage] Cannot test Reader connection: Provider or Model not selected.");
    }
  };

  return (
    <SettingsPageView
      loadStatus={settingsContext.loadStatus}
      config={settingsContext.config}
      activeSection={activeSection}
      llmTransientState={llmTransientState}
      embeddingTransientState={embeddingTransientState}
      readerTransientState={readerTransientState}
      ttsTransientState={ttsTransientState}
      llmProviderOptions={llmProviderOptions}
      embeddingProviderOptions={embeddingProviderOptions}
      readerProviderOptions={readerProviderOptions}
      ttsProviderOptions={ttsProviderOptions}
      onSectionChange={setActiveSection}
      onLlmSelectProvider={handleLlmSelectProvider}
      onLlmSelectModel={handleLlmSelectModel}
      onLlmTestConnection={handleLlmTestConnection}
      onEmbeddingSelectProvider={handleEmbeddingSelectProvider}
      onEmbeddingSelectModel={handleEmbeddingSelectModel}
      onEmbeddingTestConnection={handleEmbeddingTestConnection}
      onReaderSelectProvider={handleReaderSelectProvider}
      onReaderSelectModel={handleReaderSelectModel}
      onReaderTestConnection={handleReaderTestConnection}
      onRedirectSettingChange={settingsContext.updateRedirectSetting}
    />
  );
};

export default SettingsPage;
