import type { LLMConfig, ChatMessage, LLMChatResponse } from './types';
import { ollamaChat } from './providers/ollama/chat';
import { janChat } from './providers/jan/chat';
// Import other provider chat functions as they are created/verified
// import { lmStudioChat } from './providers/lmstudio/chat';

// Import the personality
import personality from './prompts/personality.json';

const baseSystemPrompt = personality.system;

interface UnifiedChatOptions {
  // basePersonality can be overridden if needed, otherwise defaults to personality.json
  baseSystemOverride?: string; 
  threadSystemPrompt?: string;
}

/**
 * Combines system prompts and prepares the message list for the LLM.
 */
function prepareLLMMessages(
  history: ChatMessage[], // Should be Thread.messages, mapped to LLM ChatMessage format
  latestUserMessageContent: string,
  options: UnifiedChatOptions
): ChatMessage[] {
  const effectiveBaseSystem = options.baseSystemOverride || baseSystemPrompt;
  
  const systemMessages: ChatMessage[] = [];
  if (effectiveBaseSystem) {
    systemMessages.push({ role: 'system', content: effectiveBaseSystem });
  }
  if (options.threadSystemPrompt) {
    // This ensures thread-specific instructions are distinct from the base personality
    systemMessages.push({ role: 'system', content: options.threadSystemPrompt });
  }

  // Ensure history doesn't include system messages if they are being prepended here
  // and map the sender to role.
  const formattedHistory: ChatMessage[] = history
    .filter(msg => msg.role !== 'system') // Filter out any system messages from history itself
    .map(msg => ({
      role: msg.role as 'user' | 'assistant', // Cast sender to role
      content: msg.content
    }));

  return [
    ...systemMessages,
    ...formattedHistory,
    { role: 'user', content: latestUserMessageContent },
  ];
}

/**
 * Gets a chat response from the configured LLM provider.
 * Focuses on non-streaming responses for initial integration.
 *
 * @param conversationHistorySoFar - Messages from the current thread (e.g., Thread.messages).
 *                                   These should be in the { role: 'user' | 'assistant', content: string } format.
 * @param latestUserMessageContent - The most recent message text from the user.
 * @param llmUserConfig - The LLM configuration from user settings.
 * @param chatOptions - Options including thread-specific system prompt and optional base personality override.
 * @returns The AI's response text as a Promise.
 */
export async function getAiChatResponse(
  conversationHistorySoFar: ChatMessage[], 
  latestUserMessageContent: string,
  llmUserConfig: LLMConfig,
  chatOptions: UnifiedChatOptions
): Promise<string> {
  if (!llmUserConfig || !llmUserConfig.provider || !llmUserConfig.model) {
    throw new Error('LLM provider, model, or baseUrl is not configured correctly in user settings.');
  }

  const messagesForLLM = prepareLLMMessages(
    conversationHistorySoFar,
    latestUserMessageContent,
    chatOptions
  );

  // Ensure config for the provider call is set for non-streaming
  const providerConfig: LLMConfig = { ...llmUserConfig, stream: false };

  let response: LLMChatResponse;

  console.log(`[llmChatService] Requesting chat completion from ${providerConfig.provider} with model ${providerConfig.model}.`);
  // For debugging, uncomment the next line:
  // console.log('[llmChatService] Messages for LLM:', JSON.stringify(messagesForLLM, null, 2));

  try {
    switch (providerConfig.provider) {
      case 'ollama':
        response = await ollamaChat(messagesForLLM, providerConfig) as LLMChatResponse;
        break;
      case 'jan':
        response = await janChat(messagesForLLM, providerConfig) as LLMChatResponse;
        break;
      // case 'lmstudio':
      //   // response = await lmStudioChat(messagesForLLM, providerConfig);
      //   throw new Error('LM Studio provider not yet implemented in llmChatService.');
      default:
        console.error(`Unsupported LLM provider: ${providerConfig.provider}`);
        throw new Error(`Unsupported LLM provider: ${providerConfig.provider}`);
    }
  } catch (error) {
    console.error('[llmChatService] Error during LLM call:', error);
    throw new Error(`Failed to get response from LLM provider ${providerConfig.provider}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (response.choices && response.choices.length > 0 && response.choices[0].message && response.choices[0].message.content) {
    return response.choices[0].message.content;
  } else {
    console.error('[llmChatService] No valid response content from LLM. Response:', response);
    throw new Error('LLM response was empty or malformed.');
  }
}

// TODO: Implement streaming support if needed in the future.
// public async getAiChatResponseStreamed(...) 