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
  const url = new URL('/v1/models', baseUrl).toString(); // Correctly use the derived baseUrl
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
  _text: EmbeddingInput, // Marked as unused
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

// --- Test Connection Function --- 
async function testConnection(
  config: LLMConfig,
  functionName: 'LLM' | 'Embedding' | 'Reader'
): Promise<void> {
  if (functionName === 'Embedding') {
    // Jan provider doesn't support standard embedding API for testing this way
    console.warn("[Jan testConnection] Skipping test for Embedding function.");
    // Optionally throw an error if embedding is critical and expected to work
    // throw new Error("Jan provider does not support testing the Embedding function via this method.");
    return; // Consider it a pass for now, as we know it's not supported
  }

  // Proceed with testing LLM/Reader via streaming chat completions
  const baseUrl = config.baseUrl || 'http://localhost:1337';
  const testApiUrl = `${baseUrl}/v1/chat/completions`;
  const requestBody = {
    model: config.model,
    messages: [{ role: 'user', content: 'hi' }], // Minimal prompt
    max_tokens: 1, 
    stream: true
  };

  console.log(`[Jan testConnection] Testing ${functionName} at ${testApiUrl}`);

  const response = await fetch(testApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
    },
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

  // Check first stream chunk
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Failed to get stream reader.");
  let firstChunkReceived = false;
  try {
    const { done, value } = await reader.read();
    if (done || !value) throw new Error("Stream ended or first chunk empty.");
    firstChunkReceived = true;
    console.log(`[Jan testConnection] Stream test successful (first chunk received).`);
  } finally {
      if (reader) await reader.cancel().catch(e => console.warn("[Jan testConnection] Error cancelling stream reader:", e));
  }
  if (!firstChunkReceived) {
      throw new Error("Stream test failed: No chunk received.");
  }
  // If we reach here, the test passed
}
// --- End Test Connection --- 

// Explicitly type the exported provider
export const JanProvider: LLMProvider = {
  // Use the streaming version by default, ensure chat.ts defines it correctly
  chat: _janChatStream, // Assuming _janChatStream matches the required signature
  listModels,
  embed: janEmbed, // Re-added embed property
  testConnection, // Add the test function
}; 