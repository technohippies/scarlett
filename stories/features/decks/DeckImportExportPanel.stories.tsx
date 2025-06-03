import { createSignal } from 'solid-js';
import DeckImportExportPanel, { type ImportedDeck } from '../../../src/features/decks/DeckImportExportPanel';

export default {
  title: 'Features/Decks/DeckImportExportPanel',
  component: DeckImportExportPanel,
  tags: ['autodocs'],
  argTypes: {
    isProcessing: { control: 'boolean' },
    onImport: { table: { disable: true } },
    onExport: { table: { disable: true } },
  },
  args: {
    isProcessing: false,
  },
};

// Base Render Function
const BaseRender = (args: any) => {
  const [lastAction, setLastAction] = createSignal<{ type: 'import' | 'export'; data: any } | null>(null);
  
  const handleImport = (deck: ImportedDeck) => {
    console.log('[Story] Deck imported:', deck);
    setLastAction({ type: 'import', data: deck });
  };

  const handleExport = (format: 'csv' | 'anki-txt' | 'json') => {
    console.log('[Story] Export requested:', format);
    setLastAction({ type: 'export', data: { format } });
    
    // Simulate export processing
    setTimeout(() => {
      console.log('[Story] Export completed for format:', format);
    }, 1000);
  };

  return (
    <div class="p-6 bg-background max-w-4xl mx-auto space-y-6">
      <div class="space-y-2">
        <h1 class="text-2xl font-bold">Deck Import/Export Panel</h1>
        <p class="text-muted-foreground">
          This panel allows users to import decks from various formats and export their existing decks.
        </p>
      </div>
      
      <DeckImportExportPanel
        onImport={handleImport}
        onExport={handleExport}
        isProcessing={args.isProcessing}
        messages={args.messages}
      />
      
      {/* Debug Output */}
      <div class="mt-6 p-4 bg-neutral-800 rounded-lg">
        <p class="text-sm font-semibold text-white mb-2">Last Action:</p>
        <pre class="text-xs text-white overflow-auto">
          {lastAction() ? JSON.stringify(lastAction(), null, 2) : 'No actions yet'}
        </pre>
      </div>
    </div>
  );
};

export const Default = {
  render: BaseRender,
  args: {
    isProcessing: false,
  }
};

export const Processing = {
  render: BaseRender,
  args: {
    isProcessing: true,
  }
};

// Example of a custom deck import simulation
export const WithMockImport = {
  render: () => {
    const [lastAction, setLastAction] = createSignal<{ type: 'import' | 'export'; data: any } | null>(null);
    
    const handleImport = (deck: ImportedDeck) => {
      console.log('[Story] Deck imported:', deck);
      setLastAction({ type: 'import', data: deck });
    };

    const handleExport = (format: 'csv' | 'anki-txt' | 'json') => {
      console.log('[Story] Export requested:', format);
      setLastAction({ type: 'export', data: { format } });
    };

    // Simulate importing a deck after 2 seconds
    setTimeout(() => {
      const mockDeck: ImportedDeck = {
        name: 'Programming Terms',
        description: 'Common programming vocabulary for developers',
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        cardCount: 42,
        format: 'csv',
        data: [
          { source: 'function', target: 'hàm', definition: 'A reusable block of code' },
          { source: 'variable', target: 'biến', definition: 'A storage location with a name' },
          { source: 'loop', target: 'vòng lặp', definition: 'A sequence of instructions that repeats' },
        ]
      };
      handleImport(mockDeck);
    }, 2000);

    return (
      <div class="p-6 bg-background max-w-4xl mx-auto space-y-6">
        <div class="space-y-2">
          <h1 class="text-2xl font-bold">Mock Import Demo</h1>
          <p class="text-muted-foreground">
            A deck will be automatically imported after 2 seconds to demonstrate the import functionality.
          </p>
        </div>
        
        <DeckImportExportPanel
          onImport={handleImport}
          onExport={handleExport}
          isProcessing={false}
        />
        
        <div class="mt-6 p-4 bg-neutral-800 rounded-lg">
          <p class="text-sm font-semibold text-white mb-2">Import Results:</p>
          <pre class="text-xs text-white overflow-auto">
            {lastAction() && lastAction()?.type === 'import' 
              ? JSON.stringify(lastAction()?.data, null, 2) 
              : 'Waiting for import...'}
          </pre>
        </div>
      </div>
    );
  }
};

// Story showing different file format examples
export const FileFormatExamples = {
  render: BaseRender,
  args: {
    isProcessing: false,
  },
  parameters: {
    docs: {
      description: {
        story: `
This panel supports multiple file formats:

**CSV Format:**
\`\`\`csv
source,target,definition
hello,xin chào,A greeting
goodbye,tạm biệt,A farewell
\`\`\`

**Anki Text Format:**
\`\`\`txt
hello	xin chào	A greeting
goodbye	tạm biệt	A farewell
\`\`\`

**JSON Format:**
\`\`\`json
{
  "name": "Basic Greetings",
  "description": "Common greeting phrases",
  "sourceLanguage": "en",
  "targetLanguage": "vi",
  "cards": [
    {
      "source": "hello",
      "target": "xin chào",
      "definition": "A greeting"
    }
  ]
}
\`\`\`
        `
      }
    }
  }
}; 