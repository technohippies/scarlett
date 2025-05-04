import type { LLMConfig } from './types';

// Reuse config details for now, could be separate later
// TODO: Retrieve actual config from storage
const EMBEDDING_MODEL_CONFIG: Pick<LLMConfig, 'baseUrl' | 'model' | 'provider'> = {
  provider: 'ollama',
  model: 'nomic-embed-text', // Default embedding model
  baseUrl: 'http://localhost:11434', 
};

console.log(`[LLM Embedding Service] Loaded. Using model: ${EMBEDDING_MODEL_CONFIG.model}`);

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
 * Generates text embeddings using a specified Ollama model.
 *
 * @param text The text content to embed.
 * @returns A Promise resolving to an object containing the embedding vector, model name, and dimension, or null if failed.
 * @throws Throws an error if the API call fails or the response is invalid.
 */
export async function getOllamaEmbedding(text: string): Promise<EmbeddingResult | null> {
  if (!text) {
    console.warn('[getOllamaEmbedding] Input text is empty.');
    return null;
  }

  const { baseUrl, model } = EMBEDDING_MODEL_CONFIG;
  const url = `${baseUrl.replace(/\/$/, '')}/api/embeddings`; // Ensure no trailing slash

  console.log(`[getOllamaEmbedding] Requesting embedding for text (length: ${text.length}) from model: ${model}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: text, // Ollama uses 'prompt' for embeddings input
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[getOllamaEmbedding] Ollama API request failed with status ${response.status}:`, errorBody);
      throw new Error(`Ollama API Error (${response.status}): ${errorBody || response.statusText}`);
    }

    const data: OllamaEmbeddingResponse = await response.json();

    if (data.embedding && Array.isArray(data.embedding)) {
      const dimension = data.embedding.length;
      console.log(`[getOllamaEmbedding] Successfully received embedding vector (model: ${model}, dimension: ${dimension}).`);
      return {
          embedding: data.embedding,
          modelName: model, // Return the model name used
          dimension: dimension // Return the actual dimension
      };
    } else {
      console.warn('[getOllamaEmbedding] Invalid response format from Ollama embedding API:', data);
      throw new Error('Invalid response format from Ollama embedding API.');
    }
  } catch (error: any) {
    console.error('[getOllamaEmbedding] Error calling Ollama embedding API:', error);
    // Re-throw the error for the caller to handle
    throw error;
  }
} 