import type { LLMConfig, LLMChatResponse } from '../../types'; // Path relative to chat.ts
import { parseSseChunk } from '../../../../lib/utils'; // Path to utils where parseSseChunk is

// Combined implementation for Ollama
export function ollamaChat(
  prompt: string,
  config: LLMConfig
): Promise<LLMChatResponse> | AsyncGenerator<string> { // Use generic LLMChatResponse type
  if (config.stream === true) {
    return _ollamaChatStream(prompt, config);
  } else {
    return _ollamaChatNonStream(prompt, config);
  }
}

// Non-streaming implementation for Ollama
async function _ollamaChatNonStream(
  prompt: string,
  config: LLMConfig
): Promise<LLMChatResponse> { 
  const body = {
    model: config.model, 
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    ...(config.extraParams ? config.extraParams : {}),
  };
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  console.log('[ollamaChat] Sending non-streaming request body:', JSON.stringify(body));

  const res = await fetch(`${baseUrl}/v1/chat/completions`, { // Assuming OpenAI compatible endpoint
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('[ollamaChat] Non-stream error response body:', errorBody);
    throw new Error(`Ollama chat non-stream error: ${res.status} ${res.statusText}`);
  }
  // Assuming Ollama response structure matches LLMChatResponse
  return res.json();
}

// Streaming implementation for Ollama (adapted from Jan)
export async function* _ollamaChatStream(
  prompt: string,
  config: LLMConfig
): AsyncGenerator<string> {
  const body = {
    model: config.model, 
    messages: [{ role: 'user', content: prompt }],
    stream: true,
    ...(config.extraParams ? config.extraParams : {}),
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
                      yield content;
                  }
              }
          }
      }
    }
  } catch (error) {
      console.error('[ollamaChat] Error reading stream:', error);
      throw new Error('Failed to read response stream');
  } finally {
      reader.releaseLock();
  }
} 