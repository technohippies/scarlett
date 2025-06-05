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
  const url = new URL('/api/v0/models', validatedBaseUrl).toString(); // Use native LM Studio API
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
  const url = new URL('/api/v0/chat/completions', validatedBaseUrl).toString(); // Use native LM Studio API
  
  // More robust message filtering for LM Studio
  const cleanMessages: ChatMessage[] = [];
  let lastRole: string | null = null;
  
  for (const msg of messages) {
    // Always keep system messages
    if (msg.role === 'system') {
      cleanMessages.push(msg);
      continue;
    }
    
    // Skip empty assistant messages completely
    if (msg.role === 'assistant' && (!msg.content || msg.content.trim() === '')) {
      console.log('[LMStudio Provider] Skipping empty assistant message');
      continue;
    }
    
    // Skip consecutive messages from the same role
    if (msg.role === lastRole) {
      console.log(`[LMStudio Provider] Skipping consecutive message from same role: ${msg.role} ${msg.content.substring(0, 20)}...`);
      continue;
    }
    
    cleanMessages.push(msg);
    lastRole = msg.role;
  }
  
  // Ensure conversation starts with user message after system
  // Find the first non-system message
  let firstNonSystemIndex = cleanMessages.findIndex(msg => msg.role !== 'system');
  if (firstNonSystemIndex !== -1 && cleanMessages[firstNonSystemIndex].role === 'assistant') {
    console.log('[LMStudio Provider] Conversation starts with assistant message, removing it to ensure proper alternation');
    cleanMessages.splice(firstNonSystemIndex, 1);
  }
  
  // Revalidate the sequence after removal
  const nonSystemMessages = cleanMessages.filter(msg => msg.role !== 'system');
  if (nonSystemMessages.length > 0 && nonSystemMessages[0].role !== 'user') {
    console.warn('[LMStudio Provider] Warning: Conversation still doesn\'t start with user message after filtering');
  }
  
  console.log(`[LMStudio Provider] Starting chat stream request to ${url} with model ${config.model}`);
  console.log(`[LMStudio Provider] Filtered messages: ${messages.length} -> ${cleanMessages.length}`);
  console.log('[LMStudio Provider] Final message structure:', cleanMessages.map(m => `${m.role}: ${m.content?.substring(0, 30)}...`));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: cleanMessages,
        stream: true,
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
          console.log('[LMStudio Provider] Raw chunk received:', chunk);
          console.log('[LMStudio Provider] JSON string to parse:', jsonStr);
          if (jsonStr.trim() === '[DONE]') {
            console.log('[LMStudio Provider] Received [DONE] marker.');
            continue; 
          }
          try {
            const parsed = JSON.parse(jsonStr);
            console.log('[LMStudio Provider] Parsed chunk:', JSON.stringify(parsed, null, 2));
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              console.log('[LMStudio Provider] Yielding content:', parsed.choices[0].delta.content);
              yield { type: 'content', content: parsed.choices[0].delta.content };
            } else {
              console.log('[LMStudio Provider] No content found in chunk - choices:', parsed.choices?.[0]);
            }
          } catch (e: any) {
            console.error('[LMStudio Provider] Error parsing stream chunk:', e, 'Chunk:', jsonStr);
            yield { type: 'error', error: 'Error parsing stream data' };
          }
        } else {
          console.log('[LMStudio Provider] Non-data chunk received:', chunk);
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
  const url = new URL('/api/v0/embeddings', validatedBaseUrl).toString(); // Use native LM Studio API
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

// Test connection - Use appropriate endpoint for each function type
async function testConnection(
  config: LLMConfig,
  funcType: 'LLM' | 'Embedding' | 'TTS'
): Promise<void> {
  const baseUrl = config.baseUrl || DEFAULT_LMSTUDIO_URL;
  const validatedBaseUrl = /^https?:\/\//.test(baseUrl) ? baseUrl : DEFAULT_LMSTUDIO_URL;
  
  let apiUrl: string;
  if (funcType === 'TTS') {
    apiUrl = `${validatedBaseUrl}/tts`;
  } else if (funcType === 'Embedding') {
    apiUrl = `${validatedBaseUrl}/api/v0/embeddings`;
  } else {
    apiUrl = `${validatedBaseUrl}/api/v0/chat/completions`;
  }

  console.log(`[LMStudio testConnection] Testing ${funcType} at ${apiUrl}...`);

  try {
    const controller = new AbortController();
    const timeoutMs = funcType === 'TTS' ? 60000 : 15000; // 60s for TTS, 15s otherwise
    const timeoutId = setTimeout(() => controller.abort(new Error('TimeoutError: signal timed out')), timeoutMs);
    
    console.log(`[LMStudio testConnection] Endpoint: ${apiUrl}, Timeout: ${timeoutMs}ms`);

    let response;
    if (funcType === 'TTS') {
      // Test TTS by sending sample text
      const testText = "Hello, how are you?";
      console.log(`[LMStudio testConnection] POSTing to TTS endpoint with text: "${testText}"`);
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
        },
        body: JSON.stringify({ text: testText, model: config.model }),
        signal: controller.signal
      });
    } else if (funcType === 'Embedding') {
      // Test Embedding by sending a sample text to embeddings endpoint
      const testText = "Test embedding";
      console.log(`[LMStudio testConnection] POSTing to embeddings endpoint with text: "${testText}"`);
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: config.model,
          input: [testText]
        }),
        signal: controller.signal
      });
    } else {
      // Test LLM by sending a minimal chat request
      console.log("[LMStudio testConnection] POSTing minimal chat request to test LLM");
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: "Test" }],
          max_tokens: 1
        }),
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody = 'Unknown error';
      try {
        errorBody = await response.text();
      } catch { /* ignore */ }
       console.error(`[LMStudio testConnection] Test failed with status ${response.status}:`, errorBody);
      throw new Error(`HTTP error! status: ${response.status} - ${errorBody}`);
    }

    if (funcType === 'TTS') {
      // For TTS, check if we got an audio blob
      const audioBlob = await response.blob();
      if (audioBlob.size > 0 && audioBlob.type.startsWith('audio/')) {
        console.log("[LMStudio testConnection] TTS test successful: Received audio blob.");
        // We don't return the blob here, context handles that
      } else {
        console.error("[LMStudio testConnection] TTS test failed: Received empty or non-audio response.");
        throw new Error('Received empty or non-audio response from TTS endpoint.');
      }
    } else if (funcType === 'Embedding') {
      // For Embedding, validate the response structure
      try {
        const data = await response.json();
        if (data?.object === 'list' && Array.isArray(data?.data) && data.data.length > 0 && data.data[0]?.embedding) {
          console.log(`[LMStudio testConnection] Embedding test successful: Received embedding with ${data.data[0].embedding.length} dimensions.`);
        } else {
          console.error("[LMStudio testConnection] Embedding test failed: Invalid response structure.", data);
          throw new Error('Received invalid embedding response structure.');
        }
      } catch (parseError) {
        console.error("[LMStudio testConnection] Embedding test failed: Could not parse response as JSON.", parseError);
        throw new Error('Could not parse embedding response as JSON.');
      }
    } else {
      // For LLM, just log success
      console.log(`[LMStudio testConnection] ${funcType} test successful.`);
    }

  } catch (error) {
    console.error(`[LMStudio testConnection] Error during ${funcType} test:`, error);
    throw error; // Re-throw the error to be caught by the context
  }
}

export const LMStudioProvider: LLMProvider = {
  chat: lmStudioChatStream,
  listModels,
  embed: lmStudioEmbed,
  testConnection,
}; 