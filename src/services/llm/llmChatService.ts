import type { LLMConfig, ChatMessage, LLMChatResponse, StreamedChatResponsePart } from './types';
import { _ollamaChatStream } from './providers/ollama/chat'; // Import specific stream function
import { _janChatStream } from './providers/jan/chat'; // Import specific stream function
import { ollamaChat } from './providers/ollama/chat';
import { janChat } from './providers/jan/chat';
// Import other provider chat functions as they are created/verified
// import { lmStudioChat } from './providers/lmstudio/chat';

// Import the personality
import personality from './prompts/personality.json';

// --- Import DB functions for context --- 
import { getRecentVisitedPages } from '../db/visited_pages';
import { getRecentBookmarks } from '../db/bookmarks'; // Assuming BookmarkForContext is exported

const baseSystemPrompt = personality.system;

interface UnifiedChatOptions {
  // basePersonality can be overridden if needed, otherwise defaults to personality.json
  baseSystemOverride?: string; 
  threadSystemPrompt?: string;
  // No need to pass context string via options if fetched internally by prepareLLMMessages
}

// --- NEW FUNCTION to fetch and format user context ---
async function fetchAndFormatUserContext(): Promise<string> {
  let contextParts: string[] = [];

  try {
    const recentPages = await getRecentVisitedPages(5);
    if (recentPages.length > 0) {
      const pageLines = recentPages.map(p => `- Visited: "${p.title || 'Untitled Page'}" (${p.url})`);
      contextParts.push("Recently Visited Pages:\n" + pageLines.join('\n'));
    }
  } catch (e) {
    console.warn("[llmChatService] Error fetching recent pages for context:", e);
  }

  try {
    const recentBookmarks = await getRecentBookmarks(3);
    if (recentBookmarks.length > 0) {
      const bookmarkLines = recentBookmarks.map(b => `- Bookmarked: "${b.title || 'Untitled Bookmark'}" (${b.url})`);
      contextParts.push("Recent Bookmarks:\n" + bookmarkLines.join('\n'));
    }
  } catch (e) {
    console.warn("[llmChatService] Error fetching recent bookmarks for context:", e);
  }

  // Future: Add more context sources here (learning activity, etc.)

  if (contextParts.length === 0) {
    return ""; // Return empty string if no context was gathered
  }

  return `[User Activity Context]\n\n${contextParts.join('\n\n')}\n\n[/User Activity Context]`;
}
// --- END NEW FUNCTION ---


/**
 * Combines system prompts and prepares the message list for the LLM.
 */
async function prepareLLMMessages(
  history: ChatMessage[], // Should be Thread.messages, mapped to LLM ChatMessage format
  latestUserMessageContent: string,
  options: UnifiedChatOptions
): Promise<ChatMessage[]> { // MODIFIED: Made async to await context fetching
  const effectiveBaseSystem = options.baseSystemOverride || baseSystemPrompt;
  const userActivityContext = await fetchAndFormatUserContext(); // Fetch context
  
  const systemMessages: ChatMessage[] = [];

  // Construct the full system prompt string
  let fullSystemPrompt = effectiveBaseSystem;
  if (userActivityContext) {
    fullSystemPrompt += `\n\n${userActivityContext}`;
  }
  if (options.threadSystemPrompt) {
    fullSystemPrompt += `\n\n[Current Thread Focus]\n${options.threadSystemPrompt}`;
  }

  if (fullSystemPrompt.trim()) {
      systemMessages.push({ role: 'system', content: fullSystemPrompt.trim() });
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

  // prepareLLMMessages is now async
  const messagesForLLM = await prepareLLMMessages(
    conversationHistorySoFar,
    latestUserMessageContent,
    chatOptions
  );

  // Ensure config for the provider call is set for non-streaming
  const providerConfig: LLMConfig = { ...llmUserConfig, stream: false };

  let response: LLMChatResponse;

  console.log(`[llmChatService] Requesting chat completion from ${providerConfig.provider} with model ${providerConfig.model}.`);
  // For debugging, this line is now uncommented:
  console.log('[llmChatService] Messages for LLM:', JSON.stringify(messagesForLLM, null, 2));

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

export async function* getAiChatResponseStream(
  conversationHistorySoFar: ChatMessage[],
  latestUserMessageContent: string,
  llmUserConfig: LLMConfig,
  chatOptions: UnifiedChatOptions
): AsyncGenerator<StreamedChatResponsePart> {
  if (!llmUserConfig || !llmUserConfig.provider || !llmUserConfig.model) {
    yield { type: 'error', error: 'LLM provider, model, or baseUrl is not configured correctly.' };
    return;
  }

  const messagesForLLM = await prepareLLMMessages(
    conversationHistorySoFar,
    latestUserMessageContent,
    chatOptions
  );

  // Ensure config for the provider call explicitly sets stream: true
  // The specific stream functions expect the general LLMConfig but will use stream:true internally.
  const streamingProviderConfig: LLMConfig = { ...llmUserConfig, stream: true };
  let streamProviderProcessed = false;

  console.log(`[llmChatService] Requesting STREAMING chat completion from ${streamingProviderConfig.provider} with model ${streamingProviderConfig.model}.`);
  console.log('[llmChatService] Messages for LLM (Streaming):', JSON.stringify(messagesForLLM, null, 2));

  try {
    switch (streamingProviderConfig.provider) {
      case 'ollama':
        console.log('[llmChatService Stream] About to iterate Ollama stream...');
        for await (const part of _ollamaChatStream(messagesForLLM, streamingProviderConfig)) {
          console.log('[llmChatService Stream] Ollama part received:', JSON.stringify(part));
          yield part;
          console.log('[llmChatService Stream] Ollama part yielded.');
        }
        streamProviderProcessed = true;
        console.log('[llmChatService Stream] Ollama stream iteration complete.');
        break;
      case 'jan':
        console.log('[llmChatService Stream] About to iterate Jan stream...');
        for await (const part of _janChatStream(messagesForLLM, streamingProviderConfig)) {
          console.log('[llmChatService Stream] Jan part received:', JSON.stringify(part));
          yield part;
          console.log('[llmChatService Stream] Jan part yielded.');
        }
        streamProviderProcessed = true;
        console.log('[llmChatService Stream] Jan stream iteration complete.');
        break;
      // case 'lmstudio':
      //   // When lmStudioChatStream is available and imported:
      //   // for await (const part of lmStudioChatStream(messagesForLLM, streamingProviderConfig)) {
      //   //   yield part;
      //   // }
      //   // streamProviderProcessed = true;
      //   // break;
      //   yield { type: 'error', error: 'LM Studio streaming not yet implemented in llmChatService.' };
      //   return;
      default:
        console.error(`Unsupported LLM provider for streaming: ${streamingProviderConfig.provider}`);
        yield { type: 'error', error: `Unsupported LLM provider for streaming: ${streamingProviderConfig.provider}` };
        return;
    }
    if (!streamProviderProcessed) {
        console.warn("[llmChatService] Stream provider was called but didn't seem to process any parts.");
    }
  } catch (error) {
    console.error('[llmChatService] Error during LLM stream call:', error);
    yield { type: 'error', error: `Failed to get stream from LLM provider ${streamingProviderConfig.provider}: ${error instanceof Error ? error.message : String(error)}` };
  }
} 