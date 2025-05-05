import { Component, createSignal} from 'solid-js';
import { SettingsProvider, useSettings } from "../../context/SettingsContext"; // Restore useSettings
import SettingsPageView from "./SettingsPageView"; // Uncomment view import

// Define props for the container page
interface SettingsPageProps {
  onNavigateBack: () => void;
}

const SettingsPage: Component<SettingsPageProps> = (props) => {
  return (
    <SettingsProvider>
      {/* Pass the prop down to the content */}
      <SettingsPageContent onNavigateBack={props.onNavigateBack} /> 
    </SettingsProvider>
  );
};

// Define props for the content component as well
interface SettingsPageContentProps {
  onNavigateBack: () => void;
}

const SettingsPageContent: Component<SettingsPageContentProps> = (props) => {
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
      ttsProviderOptions 
  } = settingsContext;

  console.log('[SettingsPageContent] Log 2: After provider options defined/retrieved.');

  // 5. Keep Handlers Commented Out (Placeholders for some)
  // ...
  console.log('[SettingsPageContent] Log 3: After getTransientState calls.');

  // Define the back button handler
  const handleBackClick = () => {
    console.log('[SettingsPageContent] Back button clicked, navigating back.');
    // setActiveSection(null); // No longer needed - we navigate away
    props.onNavigateBack(); // Call the passed navigation function
  };

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
      onSectionChange={(section) => setActiveSection(section)}
      onBackClick={handleBackClick} // Pass the handler to the view
    />
  );
};

export default SettingsPage;
