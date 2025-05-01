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

    const models: ModelInfo[] = data.data.map((model: any) => {
      // --- Log the full model object --- 
      console.log('[Jan Provider] Raw model data from API:', JSON.stringify(model, null, 2));
      // --- End Log ---
      return {
        id: model.id, 
        provider: 'jan',
        name: model.id,
        // size: model.size, // Add if available and needed
      };
    });
    
    console.log(`[Jan Provider] Found ${models.length} models:`, models.map(m => m.id));
    return models;

  } catch (error: any) {
    console.error(`[Jan Provider] Error fetching or parsing Jan models from ${url}:`, error);
    // Re-throw for UI layer
    throw error; 
  }
}

// --- Function to Load a Model ---
export async function loadJanModel(
  config: Pick<LLMConfig, 'baseUrl'>,
  modelId: string
): Promise<void> {
  const baseUrl = config.baseUrl || 'http://localhost:1337'; // Default Jan port
  const url = new URL('/v1/models/start', baseUrl).toString();
  const body = { model: modelId };

  console.log(`[Jan Provider] Attempting to load model '${modelId}' via POST to ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorBody = '';
      try { errorBody = await response.text(); } catch { /* Ignore */ }
      console.error(`[Jan Provider] API request to ${url} failed: ${response.status} ${response.statusText}`, errorBody);
      // Try to parse the error body if it's JSON
      try {
        const jsonError = JSON.parse(errorBody);
        if (jsonError.message) {
          throw new Error(`Jan API error loading model: ${jsonError.message}`);
        }
      } catch { /* Ignore JSON parse error */ }
      // Fallback generic error
      throw new Error(`Jan API request failed to load model: ${response.status} ${response.statusText}`);
    }

    // Jan API returns a simple message on success, we don't strictly need to parse it
    // but we can log it.
    const result = await response.json();
    console.log(`[Jan Provider] Successfully requested to load model '${modelId}'. Response:`, result?.message || '(No message)');

  } catch (error: any) {
    console.error(`[Jan Provider] Error loading model '${modelId}' from ${url}:`, error);
    // Re-throw the specific or generic error for UI handling
    throw error;
  }
}
// --- End Load Model Function ---

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