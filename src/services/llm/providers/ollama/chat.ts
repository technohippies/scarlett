import type { LLMConfig, LLMChatResponse, ChatMessage, StreamedChatResponsePart } from '../../types'; // Path relative to chat.ts
import { parseSseChunk } from '../../../../lib/utils'; // Path to utils where parseSseChunk is

// --- Overload Signatures --- 
// Signature for non-streaming (stream: false or undefined)
export function ollamaChat(
  messages: ChatMessage[],
  config: Omit<LLMConfig, 'stream'> | (LLMConfig & { stream?: false })
): Promise<LLMChatResponse>;

// Signature for streaming (stream: true)
export function ollamaChat(
  messages: ChatMessage[],
  config: LLMConfig & { stream: true }
): AsyncGenerator<StreamedChatResponsePart>;

// --- Implementation Signature (uses the union type) --- 
export function ollamaChat(
  messages: ChatMessage[],
  config: LLMConfig // General config for implementation
): Promise<LLMChatResponse> | AsyncGenerator<StreamedChatResponsePart> { 
  if (config.stream === true) {
    return _ollamaChatStream(messages, config);
  } else {
    return _ollamaChatNonStream(messages, config);
  }
}

// Non-streaming implementation for Ollama
async function _ollamaChatNonStream(
  messages: ChatMessage[],
  config: LLMConfig
): Promise<LLMChatResponse> { 
  const body = {
    model: config.model, 
    messages: messages,
    stream: false,
    ...(config.options ? config.options : {}),
  };
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  console.log('[ollamaChat _ollamaChatNonStream] Sending non-streaming request. Body:', JSON.stringify(body, null, 2), 'URL:', `${baseUrl}/v1/chat/completions`);

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, { // Assuming OpenAI compatible endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(`[ollamaChat _ollamaChatNonStream] Received response status: ${response.status}`);

    if (!response.ok) {
      let errorBody = 'Could not retrieve error body.';
      try {
        console.log('[ollamaChat _ollamaChatNonStream] Response not OK. Attempting to read error body as text...');
        errorBody = await response.text();
        console.log('[ollamaChat _ollamaChatNonStream] Error body received:', errorBody);
      } catch (e: any) {
        console.error('[ollamaChat _ollamaChatNonStream] Failed to read error body:', e.message);
      }
      console.error(`[ollamaChat _ollamaChatNonStream] Non-stream error. Status: ${response.status}, Body: ${errorBody}`);
      throw new Error(`Ollama chat non-stream error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
    }

    console.log('[ollamaChat _ollamaChatNonStream] Response OK. Attempting to parse JSON...');
    const jsonResponse = await response.json();
    console.log('[ollamaChat _ollamaChatNonStream] JSON parsed successfully.');
    return jsonResponse;

  } catch (error: any) {
    console.error('[ollamaChat _ollamaChatNonStream] Error during fetch or processing:', error.message, error.stack);
    // Re-throw the original error or a new one wrapping it
    throw new Error(`Error in _ollamaChatNonStream: ${error.message}`);
  }
}

// Streaming implementation for Ollama (adapted from Jan)
export async function* _ollamaChatStream(
  messages: ChatMessage[],
  config: LLMConfig
): AsyncGenerator<StreamedChatResponsePart> {
  const body = {
    model: config.model, 
    messages: messages,
    stream: true,
    ...(config.options ? config.options : {}),
  };
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  console.log('[ollamaChat] Sending streaming request body:', JSON.stringify(body));

  const res = await fetch(`${baseUrl}/v1/chat/completions`, { // Assuming OpenAI compatible endpoint
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('[ollamaChat] Stream error response body:', errorBody);
    throw new Error(`Ollama chat stream error: ${res.status} ${res.statusText}`);
  }

  if (!res.body) {
    throw new Error('Response body is null');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[ollamaChat] Stream finished.');
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // Ollama might use newline delimiters instead of double newlines
      let lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last potentially incomplete line

      for (const line of lines) {
          if (line.trim()) {
              const parsedData = parseSseChunk(line); // Use the utility
              if (parsedData === '[DONE]') {
                  console.log('[ollamaChat] Received [DONE] signal.');
                  return;
              }
              if (parsedData) {
                  // Assuming Ollama chunk structure matches OpenAI delta format
                  const content = parsedData.choices?.[0]?.delta?.content;
                  if (content) {
                      yield { type: 'content', content: content };
                  }
              }
          }
      }
    }
  } catch (error: any) {
      console.error('[ollamaChat] Error reading stream:', error);
      yield { type: 'error', error: error.message || 'Failed to read response stream' };
  } finally {
      reader.releaseLock();
  }
} 