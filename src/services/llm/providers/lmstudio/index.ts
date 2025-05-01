import type { 
  LLMProvider, 
  LLMConfig, 
  ModelInfo, 
  ChatMessage,
  StreamedChatResponsePart,
  EmbeddingInput,
  EmbeddingResponse,
} from '../../types'; // Adjusted relative path

// Default LM Studio REST API URL
const DEFAULT_LMSTUDIO_URL = 'http://127.0.0.1:1234';

// List models using the REST API
async function listModels(config: Pick<LLMConfig, 'baseUrl'>): Promise<ModelInfo[]> {
  const baseUrl = config.baseUrl || DEFAULT_LMSTUDIO_URL;
  const validatedBaseUrl = /^https?:\/\//.test(baseUrl) ? baseUrl : DEFAULT_LMSTUDIO_URL;
  if (baseUrl !== validatedBaseUrl) {
    console.warn(`[LMStudio Provider] Invalid baseUrl "${baseUrl}" provided for REST API. Using default: ${DEFAULT_LMSTUDIO_URL}`);
  }
  const url = new URL('/api/v0/models', validatedBaseUrl).toString();
  console.log(`[LMStudio Provider] Fetching models from REST API: ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      let errorBody = '';
      try { errorBody = await response.text(); } catch { /* Ignore */ }
      console.error(`[LMStudio Provider] API request to ${url} failed: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`LM Studio API request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    if (data?.object !== 'list' || !Array.isArray(data?.data)) {
      console.error('[LMStudio Provider] Invalid response structure from /api/v0/models:', data);
      throw new Error('Invalid response structure from LM Studio /api/v0/models');
    }

    const models: ModelInfo[] = data.data.map((model: any) => ({
      id: model.id,
      provider: 'lmstudio',
      name: model.id, 
    }));

    console.log(`[LMStudio Provider] Found ${models.length} models via REST API.`);
    return models;

  } catch (error: any) {
    console.error(`[LMStudio Provider] Error fetching or parsing LM Studio models from ${url}:`, error);
    throw error;
  }
}

// Chat stream using the REST API
async function* lmStudioChatStream(
  messages: ChatMessage[],
  config: LLMConfig
): AsyncGenerator<StreamedChatResponsePart> {
  const baseUrl = config.baseUrl || DEFAULT_LMSTUDIO_URL;
  const validatedBaseUrl = /^https?:\/\//.test(baseUrl) ? baseUrl : DEFAULT_LMSTUDIO_URL;
  const url = new URL('/api/v0/chat/completions', validatedBaseUrl).toString();
  console.log(`[LMStudio Provider] Starting chat stream request to ${url} with model ${config.model}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        stream: true,
        ...(config.extraParams || {}), 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LMStudio Provider] Chat API request failed ${response.status}: ${errorText}`);
      throw new Error(`LM Studio chat request failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[LMStudio Provider] Chat stream finished.');
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const chunk = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 2);

        if (chunk.startsWith('data: ')) {
          const jsonStr = chunk.substring(6);
          if (jsonStr.trim() === '[DONE]') {
            console.log('[LMStudio Provider] Received [DONE] marker.');
            continue; 
          }
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              yield { type: 'content', content: parsed.choices[0].delta.content };
            }
          } catch (e: any) {
            console.error('[LMStudio Provider] Error parsing stream chunk:', e, 'Chunk:', jsonStr);
            yield { type: 'error', error: 'Error parsing stream data' };
          }
        }
        boundary = buffer.indexOf('\n\n');
      } 
    } 

  } catch (error: any) {
    console.error(`[LMStudio Provider] Error during chat stream:`, error);
    yield { type: 'error', error: error.message || 'Unknown error during LM Studio chat stream' };
  }
}

// Embeddings using the REST API
async function lmStudioEmbed(
  text: EmbeddingInput,
  config: LLMConfig
): Promise<EmbeddingResponse> {
  const baseUrl = config.baseUrl || DEFAULT_LMSTUDIO_URL;
  const validatedBaseUrl = /^https?:\/\//.test(baseUrl) ? baseUrl : DEFAULT_LMSTUDIO_URL;
  const url = new URL('/api/v0/embeddings', validatedBaseUrl).toString();
  console.log(`[LMStudio Provider] Requesting embeddings from ${url} for model ${config.model}`);

  const inputText = Array.isArray(text) ? text : [text]; 

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        input: inputText, 
        ...(config.extraParams || {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LMStudio Provider] Embeddings API request failed ${response.status}: ${errorText}`);
      throw new Error(`LM Studio embeddings request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (data?.object !== 'list' || !Array.isArray(data?.data)) {
      console.error('[LMStudio Provider] Invalid response structure from /api/v0/embeddings:', data);
      throw new Error('Invalid response structure from LM Studio /api/v0/embeddings');
    }
    
    return {
      object: 'list',
      data: data.data.map((item: any) => ({
        object: 'embedding',
        embedding: item.embedding,
        index: item.index,
      })),
      model: data.model || config.model, 
      usage: { prompt_tokens: 0, total_tokens: 0 }, // Placeholder usage
    } as EmbeddingResponse;

  } catch (error: any) {
    console.error(`[LMStudio Provider] Error generating embeddings:`, error);
    throw error;
  }
}

// --- Test Connection Function ---
async function testConnection(
  config: LLMConfig,
  functionName: 'LLM' | 'Embedding' | 'Reader'
): Promise<void> {
  const baseUrl = config.baseUrl || DEFAULT_LMSTUDIO_URL;
  const validatedBaseUrl = /^https?:\/\//.test(baseUrl) ? baseUrl : DEFAULT_LMSTUDIO_URL;
  let testApiUrl = '';
  let requestBody: any = {};

  if (functionName === 'Embedding') {
    testApiUrl = new URL('/api/v0/embeddings', validatedBaseUrl).toString();
    requestBody = { model: config.model, input: "test" }; 
  } else { // LLM or Reader - Test with streaming chat
    testApiUrl = new URL('/api/v0/chat/completions', validatedBaseUrl).toString();
    requestBody = {
      model: config.model,
      messages: [{ role: 'user', content: 'hi' }], 
      max_tokens: 1, 
      stream: true
    };
  }

  console.log(`[LMStudio testConnection] Testing ${functionName} at ${testApiUrl}`);

  const response = await fetch(testApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(10000) 
  });

  if (!response.ok) {
    let errorMsg = `HTTP error! status: ${response.status}`;
    try { errorMsg += ` - ${await response.text()}`; } catch { /* Ignore */ }
    const error = new Error(errorMsg);
    (error as any).status = response.status;
    throw error;
  }

  if (functionName === 'Embedding') {
    await response.json(); 
    console.log(`[LMStudio testConnection] Embedding test successful.`);
  } else {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Failed to get stream reader.");
    let firstChunkReceived = false;
    try {
      const { done, value } = await reader.read();
      if (done || !value) throw new Error("Stream ended or first chunk empty.");
      firstChunkReceived = true;
      console.log(`[LMStudio testConnection] Stream test successful (first chunk received).`);
    } finally {
        if (reader) await reader.cancel().catch(e => console.warn("[LMStudio testConnection] Error cancelling stream reader:", e));
    }
    if (!firstChunkReceived) {
        throw new Error("Stream test failed: No chunk received.");
    }
  }
}
// --- End Test Connection ---

export const LMStudioProvider: LLMProvider = {
  chat: lmStudioChatStream,
  listModels,
  embed: lmStudioEmbed,
  testConnection,
}; 