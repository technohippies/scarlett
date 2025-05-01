import type { 
  LLMProvider, 
  LLMConfig, 
  ModelInfo, 
  ChatMessage,
  StreamedChatResponsePart,
  EmbeddingInput,
  EmbeddingResponse,
} from '../types'; 

// Default LM Studio REST API URL
const DEFAULT_LMSTUDIO_URL = 'http://127.0.0.1:1234';

// List models using the REST API
async function listModels(config: Pick<LLMConfig, 'baseUrl'>): Promise<ModelInfo[]> {
  const baseUrl = config.baseUrl || DEFAULT_LMSTUDIO_URL;
  // Ensure it starts with http:// or https:// for REST API
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

    // Map the response data to our ModelInfo interface
    const models: ModelInfo[] = data.data.map((model: any) => ({
      id: model.id, // e.g., "qwen2-vl-7b-instruct"
      provider: 'lmstudio',
      name: model.id, // Use id as name for simplicity, could potentially parse further
      // Add other fields if available and needed in ModelInfo
    }));

    console.log(`[LMStudio Provider] Found ${models.length} models via REST API.`);
    return models;

  } catch (error: any) {
    console.error(`[LMStudio Provider] Error fetching or parsing LM Studio models from ${url}:`, error);
    throw error; // Re-throw for UI layer
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
        temperature: 0.7, // Example parameter, make configurable if needed
        max_tokens: -1, // Example parameter
        stream: true, // Ensure streaming is requested
        ...(config.extraParams || {}), // Include extra params if provided
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

    // Process the Server-Sent Events (SSE) stream
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

      // Process buffer line by line for SSE events
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const chunk = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 2);

        if (chunk.startsWith('data: ')) {
          const jsonStr = chunk.substring(6);
          if (jsonStr.trim() === '[DONE]') {
            console.log('[LMStudio Provider] Received [DONE] marker.');
            // Optional: Yield a specific 'done' type if needed by the interface
            // yield { type: 'done' }; 
            continue; // Continue processing buffer in case of multiple events
          }
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              yield { type: 'content', content: parsed.choices[0].delta.content };
            }
          } catch (e) {
            console.error('[LMStudio Provider] Error parsing stream chunk:', e, 'Chunk:', jsonStr);
            yield { type: 'error', error: 'Error parsing stream data' };
          }
        }
        boundary = buffer.indexOf('\n\n');
      } // end while boundary
    } // end while reader

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

  const inputText = Array.isArray(text) ? text : [text]; // API might expect single string or array

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        input: inputText, // Send input as provided (string or string[])
        ...(config.extraParams || {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LMStudio Provider] Embeddings API request failed ${response.status}: ${errorText}`);
      throw new Error(`LM Studio embeddings request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Basic validation of expected structure
    if (data?.object !== 'list' || !Array.isArray(data?.data)) {
      console.error('[LMStudio Provider] Invalid response structure from /api/v0/embeddings:', data);
      throw new Error('Invalid response structure from LM Studio /api/v0/embeddings');
    }
    
    // Map response to our EmbeddingResponse interface
    return {
      object: 'list',
      data: data.data.map((item: any) => ({
        object: 'embedding',
        embedding: item.embedding,
        index: item.index,
      })),
      model: data.model || config.model, // Use model from response if provided
      // LM Studio embed response doesn't seem to include usage stats based on docs
      usage: { prompt_tokens: 0, total_tokens: 0 }, 
    } as EmbeddingResponse;

  } catch (error: any) {
    console.error(`[LMStudio Provider] Error generating embeddings:`, error);
    throw error;
  }
}

export const LMStudioProvider: LLMProvider = {
  chat: lmStudioChatStream,
  listModels,
  embed: lmStudioEmbed,
}; 