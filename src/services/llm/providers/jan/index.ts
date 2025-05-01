import { _janChatNonStream, _janChatStream } from './chat'; // Assumes chat.ts exists
import type { 
  LLMProvider, 
  LLMConfig, 
  ModelInfo, 
  // Import embedding types again
  EmbeddingInput,
  EmbeddingResponse 
} from '../../types'; // Correct relative path to types

// Updated function to fetch available models from Jan
async function listModels(config: Pick<LLMConfig, 'baseUrl'>): Promise<ModelInfo[]> {
  const baseUrl = config.baseUrl || 'http://localhost:1337'; // Default Jan port
  const url = new URL('/v1/models', baseUrl).toString(); 
  console.log(`[Jan Provider] Fetching models from ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      let errorBody = '';
      try { errorBody = await response.text(); } catch { /* Ignore */ }
      console.error(`[Jan Provider] API request to ${url} failed: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Jan API request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    if (data?.object !== 'list' || !Array.isArray(data?.data)) {
       console.error('[Jan Provider] Invalid response structure from /v1/models:', data);
       throw new Error('Invalid response structure from Jan /v1/models');
    }

    const models: ModelInfo[] = data.data.map((model: any) => ({
      id: model.id, 
      provider: 'jan',
      name: model.id,
      // size: model.size, // Add if available and needed
    }));
    
    console.log(`[Jan Provider] Found ${models.length} models:`, models.map(m => m.id));
    return models;

  } catch (error: any) {
    console.error(`[Jan Provider] Error fetching or parsing Jan models from ${url}:`, error);
    // Re-throw for UI layer
    throw error; 
  }
}

// --- Re-added Embedding Function Placeholder ---
async function janEmbed(
  text: EmbeddingInput, 
  config: LLMConfig
): Promise<EmbeddingResponse> {
   console.warn('[Jan Provider embed] Jan does not currently support OpenAI-compatible embeddings API.');
   // Return empty list matching structure to satisfy type:
    return {
        object: 'list',
        data: [],
        model: config.model, 
        usage: { prompt_tokens: 0, total_tokens: 0 } // Dummy usage
    } as EmbeddingResponse;
}
// --- End Embedding Function ---


// Explicitly type the exported provider
export const JanProvider: LLMProvider = {
  // Use the streaming version by default, ensure chat.ts defines it correctly
  chat: _janChatStream, // Assuming _janChatStream matches the required signature
  listModels,
  embed: janEmbed, // Re-added embed property
}; 