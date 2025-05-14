import type { 
    LLMConfig, 
    JanChatResponse, 
    ChatMessage,
    StreamedChatResponsePart
} from '../../types'; // Correct path relative to chat.ts
import { parseSseChunk } from '../../utils/sse'; // Correct path to utils where parseSseChunk is

// Combined implementation
export function janChat(
  messages: ChatMessage[],
  config: LLMConfig
): Promise<JanChatResponse> | AsyncGenerator<StreamedChatResponsePart> {
  if (config.stream === true) {
    return _janChatStream(messages, config);
  } else {
    return _janChatNonStream(messages, config);
  }
}

// Non-streaming implementation
export async function _janChatNonStream(
  messages: ChatMessage[],
  config: LLMConfig
): Promise<JanChatResponse> {
  const body = {
    model: config.model,
    messages: messages,
    stream: false,
    ...(config.options || {}),
  };
  const baseUrl = config.baseUrl || 'http://localhost:1337'; // Default Jan port
  console.log('[janChat] Sending non-streaming request body:', JSON.stringify(body));

  const res = await fetch(`${baseUrl}/v1/chat/completions`,
   {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('[janChat] Non-stream error response body:', errorBody);
    throw new Error(`Jan chat non-stream error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Streaming implementation (extracted to helper)
export async function* _janChatStream(
  messages: ChatMessage[],
  config: LLMConfig
): AsyncGenerator<StreamedChatResponsePart> {
  const body = {
    model: config.model,
    messages: messages,
    stream: true,
    ...(config.options || {}),
  };
  const baseUrl = config.baseUrl || 'http://localhost:1337'; // Default Jan port
  console.log('[janChat] Sending streaming request body:', JSON.stringify(body));

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('[janChat] Stream error response body:', errorBody);
    throw new Error(`Jan chat stream error: ${res.status} ${res.statusText}`);
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
        console.log('[janChat] Stream finished.');
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // Jan likely uses double newlines like OpenAI SSE
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const chunk = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 2);
        if (chunk.trim()) {
          const parsedData = parseSseChunk(chunk); // Use the utility
          if (parsedData === '[DONE]') {
            console.log('[janChat] Received [DONE] signal.');
            return;
          }
          if (parsedData) {
            const content = parsedData.choices?.[0]?.delta?.content;
            if (content) {
              yield { type: 'content', content: content };
            }
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (error: any) {
    console.error('[janChat] Error reading stream:', error);
    yield { type: 'error', error: error.message || 'Failed to read response stream' };
  } finally {
    reader.releaseLock();
  }
} 