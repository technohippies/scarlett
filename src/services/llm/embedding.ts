import type { FunctionConfig } from '../storage/types'; // Import FunctionConfig
import { browser } from 'wxt/browser'; // For runtime.getURL in in-browser embedding
// import type { LLMProviderId } from './types'; // Keep this for casting if needed -- Removed as unused

// REMOVED hardcoded config
// const EMBEDDING_MODEL_CONFIG: Pick<LLMConfig, 'baseUrl' | 'model' | 'provider'> = { ... };

// console.log(`[LLM Embedding Service] Loaded. Using model: ${EMBEDDING_MODEL_CONFIG.model}`);

interface OllamaEmbeddingResponse {
  embedding?: number[];
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

  // Allow in-browser provider (no baseUrl needed) or require baseUrl for others
  if (!providerId || !modelId || (providerId !== 'in-browser' && !baseUrl)) {
    console.error('[getEmbedding] Incomplete embedding configuration provided:', config);
    throw new Error('Incomplete embedding configuration.');
  }

  console.log(`[getEmbedding] Requesting embedding for text (length: ${text.length}) using Provider: ${providerId}, Model: ${modelId}`);

  try {
    switch (providerId) {
      case 'in-browser': {
        console.log(`[getEmbedding] Running in-browser ONNX embedding for model: ${modelId}`);
        const tf = await import('@huggingface/transformers');
        const { pipeline, env } = tf;
        // Configure local model path and disable remote
        const getUrl = (browser.runtime.getURL as any);
        env.localModelPath = getUrl('models/');
        env.allowLocalModels = true;
        env.allowRemoteModels = false;
        const onnxBackend = (env.backends as any).onnx;
        if (onnxBackend?.wasm) {
          onnxBackend.wasm.wasmPaths = getUrl('transformers-wasm/');
        }
        // Initialize feature-extraction pipeline
        const extractor = await pipeline('feature-extraction', modelId);
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        // Extract vector from output
        let vector: number[];
        if (Array.isArray(output) && Array.isArray(output[0])) {
          vector = output[0] as number[];
        } else if ((output as any).data && Array.isArray((output as any).data[0])) {
          vector = (output as any).data[0];
        } else {
          throw new Error('Unexpected extractor output format');
        }
        const dimension = vector.length;
        console.log(`[getEmbedding] In-browser embedding dimension: ${dimension}`);
        return { embedding: vector, modelName: modelId, dimension };
      }
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
          console.log(`[getEmbedding Ollama] Successfully received embedding vector (model: ${modelId}, dimension: ${dimension}).`);
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
      case 'jan':
        // TODO: Implement Jan embedding logic
        console.error(`[getEmbedding] Jan embedding provider not yet implemented.`);
        throw new Error('Jan embedding provider not yet implemented.');
      case 'lmstudio':
        // TODO: Implement LMStudio embedding logic
        console.error(`[getEmbedding] LMStudio embedding provider not yet implemented.`);
        throw new Error('LMStudio embedding provider not yet implemented.');
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