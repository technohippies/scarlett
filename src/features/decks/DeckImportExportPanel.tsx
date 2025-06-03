import { Component, createSignal, For, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Card, CardTitle, CardDescription, CardContent, CardHeader } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import type { Messages } from '../../types/i18n';

export interface ImportedDeck {
  name: string;
  description?: string;
  sourceLanguage: string;
  targetLanguage: string;
  cardCount: number;
  format: 'csv' | 'anki-txt' | 'json';
  data: any; // The parsed deck data
}

export interface DeckImportExportPanelProps {
  onImport: (deck: ImportedDeck) => void;
  onExport: (format: 'csv' | 'anki-txt' | 'json') => void;
  isProcessing?: boolean;
  messages?: Messages;
}

// Helper function to get translated string or fallback
const getLocalizedString = (messages: Messages | undefined, key: string, fallback: string): string => {
  return messages?.[key]?.message || fallback;
};

export const DeckImportExportPanel: Component<DeckImportExportPanelProps> = (props) => {
  const [dragActive, setDragActive] = createSignal(false);
  const [processingFile, setProcessingFile] = createSignal<string | null>(null);
  
  let fileInputRef: HTMLInputElement | undefined;

  const handleFileSelect = () => {
    fileInputRef?.click();
  };

  const handleFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setProcessingFile(file.name);
    
    try {
      const text = await file.text();
      let importedDeck: ImportedDeck;
      
      // Determine file format and parse accordingly
      if (file.name.endsWith('.csv')) {
        importedDeck = await parseCSV(text, file.name);
      } else if (file.name.endsWith('.txt')) {
        importedDeck = await parseAnkiText(text, file.name);
      } else if (file.name.endsWith('.json')) {
        importedDeck = await parseJSON(text, file.name);
      } else {
        throw new Error('Unsupported file format. Please use CSV, TXT (Anki text export), or JSON files.');
      }
      
      props.onImport(importedDeck);
    } catch (error) {
      console.error('Error processing file:', error);
      // You might want to show a toast notification here
    } finally {
      setProcessingFile(null);
    }
  };

  const parseCSV = async (content: string, filename: string): Promise<ImportedDeck> => {
    const lines = content.trim().split('\n');
    
    // Basic CSV parsing - you'll want to make this more robust
    const cards = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      return {
        source: values[0] || '',
        target: values[1] || '',
        definition: values[2] || ''
      };
    }).filter(card => card.source && card.target);

    return {
      name: filename.replace('.csv', ''),
      description: `Imported from ${filename}`,
      sourceLanguage: 'unknown', // You might want to detect this
      targetLanguage: 'unknown',
      cardCount: cards.length,
      format: 'csv',
      data: cards
    };
  };

  const parseAnkiText = async (content: string, filename: string): Promise<ImportedDeck> => {
    // Parse Anki text format (tab-separated values from Anki's text export)
    const lines = content.trim().split('\n');
    const cards = lines.map(line => {
      const parts = line.split('\t');
      return {
        source: parts[0] || '',
        target: parts[1] || '',
        definition: parts[2] || ''
      };
    }).filter(card => card.source && card.target);

    return {
      name: filename.replace(/\.txt$/, ''),
      description: `Imported from Anki text export: ${filename}`,
      sourceLanguage: 'unknown',
      targetLanguage: 'unknown',
      cardCount: cards.length,
      format: 'anki-txt',
      data: cards
    };
  };

  const parseJSON = async (content: string, filename: string): Promise<ImportedDeck> => {
    const data = JSON.parse(content);
    
    // Assume JSON format matches your deck structure
    return {
      name: data.name || filename.replace('.json', ''),
      description: data.description || `Imported from ${filename}`,
      sourceLanguage: data.sourceLanguage || 'unknown',
      targetLanguage: data.targetLanguage || 'unknown',
      cardCount: data.cards?.length || 0,
      format: 'json',
      data: data.cards || []
    };
  };

  const exportFormats = [
    {
      format: 'csv' as const,
      title: 'CSV Export',
      description: 'Export as comma-separated values for spreadsheet apps',
      icon: '📊'
    },
    {
      format: 'anki-txt' as const,
      title: 'Anki Text Export', 
      description: 'Export as Anki-compatible tab-separated text format',
      icon: '🎴'
    },
    {
      format: 'json' as const,
      title: 'JSON Export',
      description: 'Export as JSON for developers and advanced users',
      icon: '📄'
    }
  ];

  return (
    <div class="w-full max-w-2xl space-y-6">
      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle class="text-xl font-bold">
            {getLocalizedString(props.messages, 'importDeckTitle', 'Import Deck')}
          </CardTitle>
          <CardDescription>
            {getLocalizedString(props.messages, 'importDeckDescription', 'Import flashcards from CSV, Anki exports, or JSON files')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            class={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive() 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Show when={processingFile()}>
              <div class="space-y-2">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p class="text-sm text-muted-foreground">
                  Processing {processingFile()}...
                </p>
              </div>
            </Show>
            
            <Show when={!processingFile()}>
              <div class="space-y-4">
                <div class="text-4xl">📁</div>
                <div class="space-y-2">
                  <p class="text-lg font-medium">
                    {getLocalizedString(props.messages, 'dropFilesHere', 'Drop files here')}
                  </p>
                  <p class="text-sm text-muted-foreground">
                    {getLocalizedString(props.messages, 'supportedFormats', 'Supports CSV, Anki text exports (.txt), and JSON files')}
                  </p>
                </div>
                <Button onClick={handleFileSelect} variant="outline">
                  {getLocalizedString(props.messages, 'selectFiles', 'Select Files')}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.json"
                  multiple={false}
                  class="hidden"
                  onInput={handleFileChange}
                />
              </div>
            </Show>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle class="text-xl font-bold">
            {getLocalizedString(props.messages, 'exportDeckTitle', 'Export Deck')}
          </CardTitle>
          <CardDescription>
            {getLocalizedString(props.messages, 'exportDeckDescription', 'Export your current deck in various formats')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid gap-3">
            <For each={exportFormats}>
              {(format) => (
                <div class="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div class="flex items-center space-x-3">
                    <span class="text-2xl">{format.icon}</span>
                    <div>
                      <p class="font-medium">{format.title}</p>
                      <p class="text-sm text-muted-foreground">{format.description}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => props.onExport(format.format)}
                    disabled={props.isProcessing}
                  >
                    {getLocalizedString(props.messages, 'export', 'Export')}
                  </Button>
                </div>
              )}
            </For>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeckImportExportPanel; 