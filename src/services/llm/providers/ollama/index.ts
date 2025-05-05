import { ollamaChat } from './chat'; // Assumes chat.ts exists in this directory
import type { 
  LLMProvider, 
  LLMConfig, 
  ModelInfo, 
  EmbeddingInput, 
  EmbeddingResponse 
} from '../../types'; // Correct relative path to types

// Function to fetch available models from Ollama
async function listModels(config: Pick<LLMConfig, 'baseUrl'>): Promise<ModelInfo[]> {
  // Ollama default port is 11434
  const baseUrl = config.baseUrl || 'http://localhost:11434'; 
  const url = new URL('/api/tags', baseUrl).toString();
  console.log(`[Ollama Provider] Fetching models from ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
       let errorBody = '';
       try { errorBody = await response.text(); } catch { /* Ignore */ }
       console.error(`[Ollama Provider] API request to ${url} failed: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    // Assuming the response structure is { models: [{ name: string, modified_at: string, size: number, ... }] }
    if (!data || !Array.isArray(data.models)) {
       console.error('[Ollama Provider] Invalid response structure from /api/tags:', data);
       throw new Error('Invalid response structure from Ollama /api/tags');
    }
    
    const models: ModelInfo[] = data.models.map((model: any) => ({
      id: model.name, // Use 'name' as the unique ID
      provider: 'ollama',
      name: model.name, // Add name field for consistency if needed by UI
      // Add other relevant fields if needed, e.g., size, modified_at
      // size: model.size,
      // modified_at: model.modified_at
    }));
    
    console.log(`[Ollama Provider] Found ${models.length} models:`, models.map(m => m.id));
    return models;
    
  } catch (error: any) {
    console.error(`[Ollama Provider] Error fetching or parsing Ollama models from ${url}:`, error);
    // Re-throw the error so the UI layer can catch it and display appropriate messages
    throw error;
    // return []; // Returning empty might hide connection issues 
  }
}

// --- Embedding Function ---
async function ollamaEmbed(
  text: EmbeddingInput, 
  config: LLMConfig
): Promise<EmbeddingResponse> {
  // Ollama uses a slightly different request structure
  const body = {
    model: config.model, 
    prompt: text, // Uses 'prompt' instead of 'input'
    options: config.extraParams // Pass extraParams as options if needed
  };
  // Ollama default port is 11434
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  console.log('[Ollama Provider embed] Sending embedding request:', JSON.stringify(body));

  const res = await fetch(`${baseUrl}/api/embeddings`, { // Use /api/embeddings
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // No API key typically needed for local Ollama
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('[Ollama Provider embed] Embedding error response body:', errorBody);
    throw new Error(`Ollama embedding error: ${res.status} ${res.statusText}`);
  }
  
  const responseData = await res.json();
  // Ollama's response is simpler, directly contains the embedding array.
  // We need to map it to our standard EmbeddingResponse structure.
  console.log('[Ollama Provider embed] Received embedding response:', responseData);
  if (responseData?.embedding && Array.isArray(responseData.embedding)) {
    return {
        object: 'list', // Fabricate the OpenAI-like structure
        data: [
            { object: 'embedding', embedding: responseData.embedding, index: 0 }
        ],
        model: config.model, // Return the model used
        usage: undefined // Ollama doesn't provide usage stats here
    } as EmbeddingResponse;
  } else {
      console.error('[Ollama Provider embed] Invalid response structure:', responseData);
      throw new Error('Ollama embedding response missing embedding array.');
  }
}
// --- End Embedding Function ---

// --- Test Connection Function --- 
async function testConnection(
  config: LLMConfig,
  functionName: 'LLM' | 'Embedding' | 'Reader'
): Promise<void> {
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  let testApiUrl = '';
  let requestBody: any = {};

  if (functionName === 'Embedding') {
    testApiUrl = `${baseUrl}/api/embeddings`;
    requestBody = { model: config.model, prompt: "test" }; // Ollama uses prompt
  } else { // LLM or Reader - Test with streaming generate
    testApiUrl = `${baseUrl}/api/generate`;
    requestBody = { model: config.model, prompt: 'hi', options: { num_predict: 1 } }; // Default stream=true
  }

  console.log(`[Ollama testConnection] Testing ${functionName} at ${testApiUrl}`);

  const response = await fetch(testApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(10000) // 10s timeout
  });

  if (!response.ok) {
    let errorMsg = `HTTP error! status: ${response.status}`;
    try { errorMsg += ` - ${await response.text()}`; } catch { /* Ignore */ }
    const error = new Error(errorMsg);
    (error as any).status = response.status;
    throw error;
  }

  // Process based on type
  if (functionName === 'Embedding') {
    await response.json(); // Just ensure full response is valid JSON
    console.log(`[Ollama testConnection] Embedding test successful.`);
  } else {
    // Check first stream chunk
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Failed to get stream reader.");
    let firstChunkReceived = false;
    try {
      const { done, value } = await reader.read();
      if (done || !value) throw new Error("Stream ended or first chunk empty.");
      firstChunkReceived = true;
      console.log(`[Ollama testConnection] Stream test successful (first chunk received).`);
    } finally {
       // Always try to cancel, even if read failed after getting the reader
       if (reader) await reader.cancel().catch(e => console.warn("[Ollama testConnection] Error cancelling stream reader:", e));
       // If the read itself failed, the error is already thrown by await reader.read()
    }
    if (!firstChunkReceived) { 
        // This should technically be unreachable if reader exists but read fails
        throw new Error("Stream test failed: No chunk received.");
    } 
  }
  // If we reach here, the test passed
}
// --- End Test Connection --- 

// Explicitly type the exported provider
export const OllamaProvider: LLMProvider = {
  // Cast the combined chat function to the specific type expected by the interface
  // Ensure ollamaChat is correctly typed where it's defined (./chat.ts)
  chat: ollamaChat, // No need to cast if ollamaChat already returns the correct type
  listModels, // Revert to exporting listModels
  embed: ollamaEmbed, // Add the embed function
  testConnection, // Add the test function
}; 