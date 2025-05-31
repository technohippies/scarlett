import type { ChatMessage } from './types';

/**
 * Parses thinking content from raw message text containing <think> tags
 */
export function parseThinkingContent(rawText: string): {
  thinking_content?: string;
  response_content: string;
  has_thinking: boolean;
} {
  // Match <think>...</think> tags (case insensitive, allow multiline)
  const thinkingRegex = /<think>([\s\S]*?)<\/think>/i;
  const match = rawText.match(thinkingRegex);
  
  if (match) {
    const thinking_content = match[1].trim();
    // Remove the thinking tags and get the response content
    const response_content = rawText.replace(thinkingRegex, '').trim();
    
    return {
      thinking_content,
      response_content,
      has_thinking: true
    };
  }
  
  return {
    response_content: rawText,
    has_thinking: false
  };
}

/**
 * Enhances a ChatMessage with parsed thinking content
 */
export function enhanceMessageWithThinking(message: Partial<ChatMessage>): Partial<ChatMessage> {
  if (!message.text_content || message.sender !== 'ai') {
    return message;
  }
  
  const parsed = parseThinkingContent(message.text_content);
  
  if (parsed.has_thinking) {
    return {
      ...message,
      text_content: parsed.response_content,
      thinking_content: parsed.thinking_content,
      is_thinking_complete: true,
      // Calculate a rough thinking duration based on content length
      thinking_duration: Math.max(1, Math.min(30, parsed.thinking_content!.length / 100))
    };
  }
  
  return message;
} 