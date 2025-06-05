import type { FunctionConfig } from '../storage/types'; // Import FunctionConfig
import { loadJanModel } from './providers/jan'; // Import the Jan model loading function
import { LMStudioProvider } from './providers/lmstudio'; // Import LM Studio provider for embeddings
import type { LLMConfig } from './types'; // Import LLMConfig type for provider calls
// import type { LLMProviderId } from './types'; // Keep this for casting if needed -- Removed as unused

// REMOVED hardcoded config
// const EMBEDDING_MODEL_CONFIG: Pick<LLMConfig, 'baseUrl' | 'model' | 'provider'> = { ... };

// console.log(`[LLM Embedding Service] Loaded. Using model: ${EMBEDDING_MODEL_CONFIG.model}`);

interface OllamaEmbeddingResponse {
  embedding?: number[];
}

// Add interface for Jan/OpenAI-compatible embedding response
interface JanEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Define the return type for the embedding function
export interface EmbeddingResult {
    embedding: number[];
    modelName: string;
    dimension: number;
}

/**
 * Generates text embeddings using the configured provider and model.
 *
 * @param text The text content to embed.
 * @param config The embedding configuration (provider, model, baseUrl, etc.).
 * @returns A Promise resolving to an object containing the embedding vector, model name, and dimension, or null if embedding failed or text is empty.
 * @throws Throws an error if the API call fails or the response is invalid for the specific provider.
 */
export async function getEmbedding(text: string, config: FunctionConfig): Promise<EmbeddingResult | null> {
  if (!text) {
    console.warn('[getEmbedding] Input text is empty.');
    return null;
  }
  
  // Destructure needed info from config
  const { providerId, modelId, baseUrl, /*apiKey*/ } = config; // apiKey removed as it's not used in the current supported providers (Ollama)

  // Require baseUrl for all providers
  if (!providerId || !modelId || !baseUrl) {
    console.error('[getEmbedding] Incomplete embedding configuration provided:', config);
    throw new Error('Incomplete embedding configuration.');
  }

  // Silently generate embedding

  try {
    switch (providerId) {
      case 'ollama': { // Explicitly handle ollama
        const url = `${baseUrl!.replace(/\/$/, '')}/api/embeddings`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add API key header if needed for Ollama in the future
          },
          body: JSON.stringify({
            model: modelId,
            prompt: text,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[getEmbedding Ollama] API request failed with status ${response.status}:`, errorBody);
          throw new Error(`Ollama Embedding API Error (${response.status}): ${errorBody || response.statusText}`);
        }

        const data: OllamaEmbeddingResponse = await response.json();

        if (data.embedding && Array.isArray(data.embedding)) {
          const dimension = data.embedding.length;
          // Embedding successful
          return {
              embedding: data.embedding,
              modelName: modelId,
              dimension: dimension
          };
        } else {
          console.warn('[getEmbedding Ollama] Invalid response format from Ollama embedding API:', data);
          throw new Error('Invalid response format from Ollama embedding API.');
        }
      }
      case 'jan': {
        // First, load the embedding model in Jan
        console.log(`[getEmbedding Jan] Loading embedding model ${modelId}...`);
        try {
          await loadJanModel({ baseUrl }, modelId, 'embedding');
          console.log(`[getEmbedding Jan] Model ${modelId} loaded successfully.`);
        } catch (loadError) {
          console.error(`[getEmbedding Jan] Failed to load model ${modelId}:`, loadError);
          throw new Error(`Failed to load Jan embedding model: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
        }

        // Now make the embedding request
        const url = `${baseUrl!.replace(/\/$/, '')}/v1/embeddings`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add API key header if needed for Jan in the future
          },
          body: JSON.stringify({
            model: modelId,
            input: text,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[getEmbedding Jan] API request failed with status ${response.status}:`, errorBody);
          throw new Error(`Jan Embedding API Error (${response.status}): ${errorBody || response.statusText}`);
        }

        const data: JanEmbeddingResponse = await response.json();

        if (data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].embedding && Array.isArray(data.data[0].embedding)) {
          const embedding = data.data[0].embedding;
          const dimension = embedding.length;
          // Embedding successful
          return {
              embedding: embedding,
              modelName: modelId,
              dimension: dimension
          };
        } else {
          console.warn('[getEmbedding Jan] Invalid response format from Jan embedding API:', data);
          throw new Error('Invalid response format from Jan embedding API.');
        }
      }
      case 'lmstudio': {
        // Use the LM Studio provider implementation
        console.log(`[getEmbedding LMStudio] Generating embedding for model ${modelId}...`);
        
        // Convert FunctionConfig to LLMConfig format expected by provider
        const llmConfig: LLMConfig = {
          provider: 'lmstudio',
          model: modelId,
          baseUrl: baseUrl!,
          apiKey: config.apiKey ?? undefined,
          stream: false,
          options: {}
        };
        
        try {
          const response = await LMStudioProvider.embed!(text, llmConfig);
          
          if (response.data && Array.isArray(response.data) && response.data.length > 0 && response.data[0].embedding && Array.isArray(response.data[0].embedding)) {
            const embedding = response.data[0].embedding;
            const dimension = embedding.length;
            // Embedding successful
            return {
                embedding: embedding,
                modelName: modelId,
                dimension: dimension
            };
          } else {
            console.warn('[getEmbedding LMStudio] Invalid response format from LM Studio embedding API:', response);
            throw new Error('Invalid response format from LM Studio embedding API.');
          }
        } catch (providerError) {
          console.error(`[getEmbedding LMStudio] LM Studio provider error:`, providerError);
          throw new Error(`LM Studio embedding error: ${providerError instanceof Error ? providerError.message : String(providerError)}`);
        }
      }
      default:
        console.error(`[getEmbedding] Unsupported embedding provider: ${providerId}`);
        throw new Error(`Unsupported embedding provider: ${providerId}`);
    }

  } catch (error: any) {
    console.error(`[getEmbedding] Error calling ${providerId} embedding API:`, error);
    
    // Re-throw the error for the caller to handle
    throw error;
  }
} 