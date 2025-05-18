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

import { userConfigurationStorage } from '../storage/storage'; // Import userConfigurationStorage

const baseSystemPrompt = personality.system;

interface UnifiedChatOptions {
  // basePersonality can be overridden if needed, otherwise defaults to personality.json
  baseSystemOverride?: string; 
  threadSystemPrompt?: string;
  excludeBaseSystem?: boolean; // Added option to exclude base system prompt
  // No need to pass context string via options if fetched internally by prepareLLMMessages
}

// --- NEW FUNCTION to fetch and format user context ---
async function fetchAndFormatUserContext(): Promise<string> {
  let contextParts: string[] = [];

  try {
    const recentPages = await getRecentVisitedPages(5);
    if (recentPages.length > 0) {
      const pageLines = recentPages.map(p => `- Visited: "${p.title || 'Untitled Page'}"`);
      contextParts.push("Recently Visited Pages:\n" + pageLines.join('\n'));
    }
  } catch (e) {
    console.warn("[llmChatService] Error fetching recent pages for context:", e);
  }

  try {
    const recentBookmarks = await getRecentBookmarks(3);
    if (recentBookmarks.length > 0) {
      const bookmarkLines = recentBookmarks.map(b => `- Bookmarked: "${b.title || 'Untitled Bookmark'}"`);
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
  let fullSystemPrompt = "";

  if (options.excludeBaseSystem) {
    // If excluding base, the system prompt is ONLY the threadSystemPrompt.
    // User context is handled by the caller in the user message for this specific task (scenario generation).
    if (options.threadSystemPrompt) {
      fullSystemPrompt = options.threadSystemPrompt;
    }
    // DO NOT append userActivityContext here when excludeBaseSystem is true,
    // as it's expected to be part of the user message for specific tasks like scenario generation.
  } else {
    // Default behavior: start with base system prompt
    fullSystemPrompt = effectiveBaseSystem;
    if (userActivityContext) {
      fullSystemPrompt += "\n\n" + userActivityContext;
    }
    if (options.threadSystemPrompt) {
      // Append as [Current Thread Focus] only if not excluding base system
      fullSystemPrompt += "\n\n[Current Thread Focus]\n" + options.threadSystemPrompt;
    }
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

// --- NEW FUNCTION FOR ROLEPLAY SCENARIO GENERATION ---
export interface RoleplayScenario {
  title: string;
  description: string;
  ai_opening_line: string; // Added for the AI's first interactive line
}

export async function generateRoleplayScenariosLLM(
  targetLanguageName: string,
  topicHint: string // topicHint is now a string, can be empty
): Promise<RoleplayScenario[]> {
  console.log(`[llmChatService] Generating 1 roleplay scenario (with AI opening line) for ${targetLanguageName}, topic: "${topicHint}"`);
  
  const userCfg = await userConfigurationStorage.getValue();
  if (!userCfg || !userCfg.llmConfig || !userCfg.llmConfig.providerId || !userCfg.llmConfig.modelId) {
    console.error('[llmChatService] LLM not configured for roleplay generation.');
    throw new Error('LLM not configured. Please check settings.');
  }

  const llmServiceConfig: LLMConfig = {
    provider: userCfg.llmConfig.providerId as LLMConfig['provider'],
    model: userCfg.llmConfig.modelId,
    baseUrl: userCfg.llmConfig.baseUrl ?? '',
    apiKey: userCfg.llmConfig.apiKey ?? undefined,
    stream: false, // Explicitly non-streaming for this
  };

  let contextString = "";
  try {
    contextString = await fetchAndFormatUserContext();
  } catch (e) {
    console.warn("[llmChatService] Failed to fetch user context for roleplay scenarios, proceeding without it:", e);
  }

  // Consolidated System Prompt for scenario generation
  const consolidatedSystemPrompt = `You are a helpful assistant. Your task is to generate 1 distinct roleplay scenario for a user learning ${targetLanguageName}. The scenario must have a 'title' (string), a 'description' (string, 1-3 sentences for scene setting), and an 'ai_opening_line' (string, the first thing the AI character says to the user to start the interaction). RETURN the result as a VALID JSON ARRAY containing a single object, like this: [{ "title": "Example Title", "description": "Example scene description.", "ai_opening_line": "Hello! How can I help you today?" }] . Do not include any other text, explanations, or markdown formatting outside the JSON array.

${contextString ? `Available Context (use this for inspiration if relevant, otherwise ignore):
${contextString}
` : ''}If the context is not relevant or too limited, please generate a scenario based on a general conversational topic${topicHint ? ` related to: "${topicHint}"` : ''}.`;

  console.log("[llmChatService] Consolidated System Prompt (for scenario generation):", consolidatedSystemPrompt);

  try {
    const scenariosJsonString = await getAiChatResponse(
      [], // No prior conversation history for this specific task
      "", // Empty user message, as all instructions are in the system prompt
      llmServiceConfig,
      { threadSystemPrompt: consolidatedSystemPrompt, excludeBaseSystem: true } 
    );

    console.log("[llmChatService] Raw scenarios JSON string from LLM:", scenariosJsonString);

    if (!scenariosJsonString || scenariosJsonString.trim() === "") {
      console.error('[llmChatService] LLM returned empty string for roleplay scenarios.');
      throw new Error('LLM returned no content for scenarios.');
    }
    
    // Attempt to parse the JSON. LLMs can be finicky with JSON.
    // Basic cleanup: find the first '[' and last ']' to handle potential prefix/suffix garbage.
    const startIndex = scenariosJsonString.indexOf('[');
    const endIndex = scenariosJsonString.lastIndexOf(']');
    
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        console.error('[llmChatService] Could not find valid JSON array structure in LLM response for scenarios.', scenariosJsonString);
        throw new Error('LLM response for scenarios was not a valid JSON array.');
    }

    const cleanedJsonString = scenariosJsonString.substring(startIndex, endIndex + 1);
    
    let parsedScenarios: any;
    try {
      parsedScenarios = JSON.parse(cleanedJsonString);
    } catch (e) {
      console.error('[llmChatService] Failed to parse scenarios JSON from LLM:', e, 'Raw string was:', cleanedJsonString);
      throw new Error('Failed to parse scenarios from LLM. Ensure the model can reliably output JSON arrays.');
    }

    if (!Array.isArray(parsedScenarios)) {
      console.error('[llmChatService] Parsed scenarios is not an array:', parsedScenarios);
      throw new Error('LLM did not return an array of scenarios.');
    }

    // Validate structure of each scenario
    const validScenarios: RoleplayScenario[] = [];
    for (const item of parsedScenarios) {
      if (item && typeof item.title === 'string' && 
          typeof item.description === 'string' && 
          typeof item.ai_opening_line === 'string') { // Validate new field
        validScenarios.push({ 
          title: item.title, 
          description: item.description, 
          ai_opening_line: item.ai_opening_line 
        });
      } else {
        console.warn('[llmChatService] Invalid scenario item from LLM (missing title, description, or ai_opening_line): ', item);
      }
    }

    if (validScenarios.length === 0 && parsedScenarios.length > 0) {
        throw new Error('LLM returned scenario items with incorrect structure (missing title, description, or ai_opening_line).');
    }
    
    console.log(`[llmChatService] Successfully generated ${validScenarios.length} roleplay scenarios.`);
    return validScenarios;

  } catch (error) {
    console.error('[llmChatService] Error generating roleplay scenarios via LLM:', error);
    if (error instanceof Error && error.message.startsWith('LLM returned no content')) {
        throw error; // Re-throw specific informative error
    }
    if (error instanceof Error && error.message.startsWith('Failed to parse scenarios')) {
        throw error; // Re-throw specific informative error
    }
    if (error instanceof Error && error.message.startsWith('LLM response for scenarios was not a valid JSON array')) {
        throw error; // Re-throw specific informative error
    }
    if (error instanceof Error && error.message.startsWith('LLM did not return an array')) {
        throw error; // Re-throw specific informative error
    }
    throw new Error(`Failed to generate roleplay scenarios: ${error instanceof Error ? error.message : String(error)}`);
  }
} 