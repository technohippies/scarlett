import type { LLMConfig, JanChatResponse } from '../../types'; // Correct path relative to chat.ts
import { parseSseChunk } from '../../utils/sse'; // Correct path to utils where parseSseChunk is

// Combined implementation
export function janChat(
  prompt: string,
  config: LLMConfig
): Promise<JanChatResponse> | AsyncGenerator<string> {
  if (config.stream === true) {
    return _janChatStream(prompt, config);
  } else {
    return _janChatNonStream(prompt, config);
  }
}

// Non-streaming implementation
export async function _janChatNonStream(
  prompt: string,
  config: LLMConfig
): Promise<JanChatResponse> {
  const body = {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    ...(config.extraParams ? config.extraParams : {}),
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
  prompt: string,
  config: LLMConfig
): AsyncGenerator<string> {
  const body = {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
    ...(config.extraParams ? config.extraParams : {}),
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
              yield content;
            }
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    console.error('[janChat] Error reading stream:', error);
    throw new Error('Failed to read response stream');
  } finally {
    reader.releaseLock();
  }
} 