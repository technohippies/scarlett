import { Component, createSignal, onMount } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import type { Messages } from '../../types/i18n';
import { ArrowLeft } from 'phosphor-solid';

// Model data (can be moved to a separate file)
export const embeddingModels = [
  { id: 'nomic-embed-text', name: 'nomic-embed-text', description: 'High-performing open embedding model with a large token context window.' },
  { id: 'mxbai-embed-large', name: 'mxbai-embed-large', description: 'State-of-the-art large embedding model from mixedbread.ai.' },
  { id: 'bge-m3', name: 'bge-m3', description: 'BGE-M3: Multi-Functionality, Multi-Linguality, Multi-Granularity.' },
  { id: 'snowflake-arctic-embed', name: 'snowflake-arctic-embed', description: 'Snowflake text embedding models optimized for performance.' },
  { id: 'all-minilm', name: 'all-minilm', description: 'Embedding models trained on very large sentence level datasets.' },
  { id: 'bge-large', name: 'bge-large', description: 'BAAI embedding model mapping texts to vectors.' },
  { id: 'snowflake-arctic-embed2', name: 'snowflake-arctic-embed2', description: 'Snowflake\'s frontier embedding model with multilingual support.' },
  { id: 'paraphrase-multilingual', name: 'paraphrase-multilingual', description: 'Sentence-transformers model for clustering or semantic search.' },
  { id: 'granite-embedding', name: 'granite-embedding', description: 'IBM Granite Embedding models (30M English, 278M multilingual).' },
];

export const readerModels = [
  { id: 'milkey/reader-lm-v2', name: 'milkey/reader-lm-v2', description: '1.5B model converting HTML to markdown/JSON with long context handling.' },
];

export interface ModelOption {
    id: string;
    name: string;
    description: string;
}

// Define props for the component
interface SetupModelsProps {
  onComplete: (models: { embeddingModelId: string; readerModelId: string }) => void;
  onBack: () => void;
  messages?: Messages; // Optional
  // Maybe add embeddingProviderId later if needed for filtering
}

export const SetupModels: Component<SetupModelsProps> = (props) => {
  const [selectedEmbeddingModelId, setSelectedEmbeddingModelId] = createSignal<string | undefined>();
  const [selectedReaderModelId, setSelectedReaderModelId] = createSignal<string | undefined>();

  // Define embedding model priority
  const embeddingPriority = ['bge-m3', 'bge-large', 'nomic-embed-text', 'snowflake-arctic-embed2', 'snowflake-arctic-embed'];

  // Auto-select default models on mount
  onMount(() => {
    // Find first priority embedding model available
    const availableEmbeddingIds = embeddingModels.map(m => m.id);
    const defaultEmbedding = embeddingPriority.find(id => availableEmbeddingIds.includes(id));
    if (defaultEmbedding) {
      setSelectedEmbeddingModelId(defaultEmbedding);
      console.log('[SetupModels] Auto-selected embedding model:', defaultEmbedding);
    }

    // Auto-select reader model (if available - currently only one)
    const defaultReader = readerModels.find(m => m.id === 'milkey/reader-lm-v2');
    if (defaultReader) {
      setSelectedReaderModelId(defaultReader.id);
      console.log('[SetupModels] Auto-selected reader model:', defaultReader.id);
    }
  });

  const i18n = () => {
    const messages = props.messages;
    return {
      get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
    };
  };

  const handleSubmit = () => {
    const embeddingId = selectedEmbeddingModelId();
    const readerId = selectedReaderModelId();
    if (embeddingId && readerId) {
      props.onComplete({ embeddingModelId: embeddingId, readerModelId: readerId });
    }
  };

  const canContinue = () => selectedEmbeddingModelId() && selectedReaderModelId();

  return (
    <div class="relative flex flex-col min-h-screen bg-background text-foreground">
      {/* Back Button */}
      <Button
          variant="ghost"
          size="icon"
          onClick={props.onBack}
          aria-label="Go back"
          class="absolute top-4 left-4 text-muted-foreground hover:text-foreground z-10"
      >
          <ArrowLeft class="h-6 w-6" />
      </Button>

      {/* Content Area */}
      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24">
          <img
            src="/images/scarlett-supercoach/scarlett-on-llama.png" // Reusing image
            alt="Scarlett Supercoach"
            class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6 flex-shrink-0"
          />
          <div class="text-center w-full max-w-lg mb-6">
              <p class="text-xl md:text-2xl mb-4">{i18n().get('onboardingModelSelectTitle', 'Select Models')}</p>
              <p class="text-lg text-muted-foreground">
                {i18n().get('onboardingModelSelectDescription', 'I recommend bge-m3 or bge-large. Use milkey/reader-lm-v2 for HTML-to-Markdown to improve my memory!')}
              </p>
          </div>

          {/* Model Selection Area */}
          <div class="w-full max-w-lg space-y-6 mb-8">
            {/* Embedding Model Select */}
            <div>
              <label for="embedding-select" class="block text-sm font-medium text-muted-foreground mb-1">
                {i18n().get('onboardingEmbeddingLabel', 'Embedding')}
              </label>
              <Select<ModelOption>
                options={embeddingModels}
                optionValue="id"
                optionTextValue="name"
                placeholder={i18n().get('onboardingSelectEmbeddingPlaceholder', 'Select an embedding model...')}
                value={embeddingModels.find(m => m.id === selectedEmbeddingModelId())}
                onChange={(selected) => setSelectedEmbeddingModelId(selected?.id)}
                itemComponent={(props) => (
                  <SelectItem item={props.item} class="cursor-pointer">
                    <div class="flex flex-col">
                      <span class="font-medium">{props.item.rawValue.name}</span>
                      <span class="text-xs text-muted-foreground">{props.item.rawValue.description}</span>
                    </div>
                  </SelectItem>
                )}
              >
                <SelectTrigger id="embedding-model-select" class="w-full">
                  <SelectValue<ModelOption>>{state => state.selectedOption()?.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                </SelectContent>
              </Select>
            </div>

            {/* Reader Model Select */}
            <div>
              <label for="reader-select" class="block text-sm font-medium text-muted-foreground mb-1">
                 {i18n().get('onboardingReaderLabel', 'Reader')}
              </label>
              <Select<ModelOption>
                options={readerModels}
                optionValue="id"
                optionTextValue="name"
                placeholder={i18n().get('onboardingSelectReaderPlaceholder', 'Select a reader model...')}
                value={readerModels.find(m => m.id === selectedReaderModelId())}
                onChange={(selected) => setSelectedReaderModelId(selected?.id)}
                itemComponent={(props) => (
                  <SelectItem item={props.item} class="cursor-pointer">
                    <div class="flex flex-col">
                      <span class="font-medium">{props.item.rawValue.name}</span>
                      <span class="text-xs text-muted-foreground">{props.item.rawValue.description}</span>
                    </div>
                  </SelectItem>
                )}
              >
                <SelectTrigger id="reader-model-select" class="w-full">
                   <SelectValue<ModelOption>>{state => state.selectedOption()?.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                </SelectContent>
              </Select>
            </div>
          </div>
      </div>

      {/* Footer Area */}
      <div class="flex-shrink-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center">
          <div class="w-full max-w-xs">
             <Button
               size="lg"
               class="w-full"
               onClick={handleSubmit}
               disabled={!canContinue()}
             >
               {i18n().get('onboardingFinishSetup', 'Finish Setup')}
             </Button>
          </div>
       </div>
    </div>
  );
}; 