import type { LLMConfig, ChatMessage, LLMChatResponse, StreamedChatResponsePart } from './types';
import { _ollamaChatStream } from './providers/ollama/chat'; // Import specific stream function
import { _janChatStream } from './providers/jan/chat'; // Import specific stream function
import { ollamaChat } from './providers/ollama/chat';
import { janChat } from './providers/jan/chat';
// Import other provider chat functions as they are created/verified
// import { lmStudioChat } from './providers/lmstudio/chat';

// Import the personality
import personality from './prompts/personality-core.json';
import { getPersonalityContext } from './personalityService';

// --- Import DB functions for context --- 
import { getRecentVisitedPages, getTopVisitedPages } from '../db/visited_pages';
import { getRecentBookmarks } from '../db/bookmarks'; // Assuming BookmarkForContext is exported
import { getRecentlyStudiedFlashcardsForContext } from '../db/learning'; // Import new function and type
import { getTodaysMoodForContext } from '../db/mood'; // Import for mood
import { getDbInstance } from '../db/init'; // Import getDbInstance
import { getTopPlayedSongs, getRecentPlayedSongs } from '../db/music';
import { getOrInitDailyStudyStats } from '../db/study_session';
import { getStudyStreakData } from '../db/streaks';
import { buildRAGContext, formatRAGContextForPrompt, searchUserMemory } from './rag';

import { userConfigurationStorage } from '../storage/storage'; // Import userConfigurationStorage
import { lookup } from '../../shared/languages'; // Use centralized language lookup

const baseSystemPrompt = personality.system;

interface UnifiedChatOptions {
  // basePersonality can be overridden if needed, otherwise defaults to personality.json
  baseSystemOverride?: string; 
  threadSystemPrompt?: string;
  excludeBaseSystem?: boolean; // Added option to exclude base system prompt
  // No need to pass context string via options if fetched internally by prepareLLMMessages
}

// --- NEW FUNCTION to fetch and format user context ---
export async function fetchAndFormatUserContext(): Promise<string> {
  console.log('[llmChatService DEBUG] Entered fetchAndFormatUserContext function.'); // VERY FIRST LOG
  let contextParts: string[] = [];
  const db = await getDbInstance(); // Get DB instance

  // --- START: Add Target Language to Context ---
  try {
    const userCfg = await userConfigurationStorage.getValue();
    if (userCfg && userCfg.targetLanguage) {
      const rawLang = userCfg.targetLanguage;
      const targetLanguageName = lookup(rawLang).fullName;
      contextParts.push(`User's Target Learning Language: ${targetLanguageName}`);
      console.log(`[llmChatService DEBUG] Added target language to context: ${targetLanguageName}`);
    } else {
      console.log('[llmChatService DEBUG] Target language not configured or not found.');
    }
  } catch (e) {
    console.warn("[llmChatService] Error fetching target language for context:", e);
  }
  // --- END: Add Target Language to Context ---

  // --- START: Add Learning Motivation to Context ---
  try {
    const userCfg = await userConfigurationStorage.getValue(); // Already fetched, but getValue is cheap
    if (userCfg && userCfg.learningMotivation && userCfg.learningMotivation.trim() !== "") {
      contextParts.push(`User's Learning Motivation: ${userCfg.learningMotivation.trim()}`);
      console.log(`[llmChatService DEBUG] Added learning motivation to context: ${userCfg.learningMotivation.trim()}`);
    } else {
      console.log('[llmChatService DEBUG] Learning motivation not configured or is empty.');
    }
  } catch (e) {
    console.warn("[llmChatService] Error fetching learning motivation for context:", e);
  }
  // --- END: Add Learning Motivation to Context ---

  console.log('[llmChatService DEBUG] Attempting to fetch today\'s mood...'); // ADDED DEBUG LOG
  try {
    const todaysMood = await getTodaysMoodForContext();
    console.log('[llmChatService DEBUG] todaysMood raw value received:', todaysMood); // ADDED DEBUG LOG
    if (todaysMood) {
      console.log('[llmChatService DEBUG] todaysMood is truthy, adding to contextParts.'); // ADDED DEBUG LOG
      contextParts.push(`Today's Mood: ${todaysMood}`);
    } else {
      console.log('[llmChatService DEBUG] todaysMood is falsy, NOT adding to contextParts.'); // ADDED DEBUG LOG
    }
  } catch (e) {
    console.warn("[llmChatService DEBUG] CRITICAL ERROR fetching today\'s mood for context:", e); // Enhanced log
  }

  // --- START: Add RAG User Memory Context ---
  try {
    const userMemory = await searchUserMemory('user preferences name goals');
    if (userMemory.length > 0) {
      const memoryContext = userMemory
        .slice(0, 3) // Limit to top 3 most relevant memories
        .map(result => result.content)
        .join('; ');
      contextParts.push(`User Context: ${memoryContext}`);
      console.log('[llmChatService DEBUG] Added user memory context from RAG.');
    }
  } catch (error) {
    console.warn('[llmChatService DEBUG] Failed to fetch user memory context:', error);
  }
  // --- END: Add RAG User Memory Context ---

  try {
    const recentPagesLimit = 5;
    const topPagesLimit = 8;
    const [recentPages, topPages] = await Promise.all([
      getRecentVisitedPages(recentPagesLimit),
      getTopVisitedPages(topPagesLimit)
    ]);

    const combinedPages: { title: string | null, url: string }[] = [];
    const seenUrls = new Set<string>();

    // Add recent pages first, then top pages, ensuring no duplicates
    recentPages.forEach(page => {
      if (!seenUrls.has(page.url)) {
        combinedPages.push(page);
        seenUrls.add(page.url);
      }
    });

    topPages.forEach(page => {
      if (!seenUrls.has(page.url)) {
        combinedPages.push(page);
        seenUrls.add(page.url);
      }
    });
    
    // Log combined and deduplicated pages
    console.log('[llmChatService DEBUG] Combined and deduplicated visited pages:', JSON.stringify(combinedPages, null, 2));

    if (combinedPages.length > 0) {
      // Only include page titles to save tokens, omit URLs
      const pageLines = combinedPages.map(p => `- Visited: "${p.title || 'Untitled Page'}"`);
      contextParts.push("Visited Pages (Recent & Top):\n" + pageLines.join('\n'));
    }
  } catch (e) {
    console.warn("[llmChatService] Error fetching and processing visited pages for context:", e);
  }

  try {
    const recentBookmarks = await getRecentBookmarks(3);
    console.log('[llmChatService DEBUG] Received recentBookmarks:', JSON.stringify(recentBookmarks, null, 2)); // ADDED LOG
    if (recentBookmarks.length > 0) {
      const bookmarkLines = recentBookmarks.map(b => `- Bookmarked: "${b.title || 'Untitled Bookmark'}"`);
      contextParts.push("Recent Bookmarks:\n" + bookmarkLines.join('\n'));
    }
  } catch (e) {
    console.warn("[llmChatService] Error fetching recent bookmarks for context:", e);
  }

  try {
    const recentFlashcards = await getRecentlyStudiedFlashcardsForContext(db, 3); // Fetch 3 recent flashcards
    console.log('[llmChatService fetchAndFormatUserContext] Received recentFlashcards:', JSON.stringify(recentFlashcards, null, 2)); 
    if (recentFlashcards.length > 0) {
      // Simplified syntax: sourceText (targetText)
      const flashcardLines = recentFlashcards.map(fc => `- ${fc.sourceText} (${fc.targetText})`);
      contextParts.push("Recently Studied Flashcards:\n" + flashcardLines.join('\n'));
    }
  } catch (e) {
    console.warn("[llmChatService] Error fetching recent flashcards for context:", e);
  }

  // --- START: Add Daily Study Stats Context ---
  try {
    const dailyStats = await getOrInitDailyStudyStats();
    contextParts.push(`Daily New Items Studied: ${dailyStats.newItemsStudiedToday}`);
  } catch (e) {
    console.warn("[llmChatService] Error fetching daily study stats for context:", e);
  }
  // --- END: Add Daily Study Stats Context ---

  // --- START: Add Study Streak Context ---
  try {
    const streakData = await getStudyStreakData();
    contextParts.push(`Study Streak: ${streakData.currentStreak} days current, ${streakData.longestStreak} days longest`);
  } catch (e) {
    console.warn("[llmChatService] Error fetching study streak data for context:", e);
  }
  // --- END: Add Study Streak Context ---

  // --- START: Add Songs Listening Context ---
  try {
    const topSongs = await getTopPlayedSongs(3, 1);
    if (topSongs.length > 0) {
      const songLines = topSongs.map(s => `- ${s.track_name} by ${s.artist_name} (${s.play_count} plays today)`);
      contextParts.push("Top Played Songs:\n" + songLines.join('\n'));
    }
    const recentSongs = await getRecentPlayedSongs(3);
    if (recentSongs.length > 0) {
      const songLines = recentSongs.map(s => `- ${s.track_name} by ${s.artist_name}`);
      contextParts.push("Recently Played Songs:\n" + songLines.join('\n'));
    }
  } catch (e) {
    console.warn("[llmChatService] Error fetching songs for context:", e);
  }
  // --- END: Add Songs Listening Context ---

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
  
  let userActivityContext = ""; // Initialize to empty
  if (!options.excludeBaseSystem) {
    // Only fetch context if not excluding base system (and thus its embedded context)
    userActivityContext = await fetchAndFormatUserContext(); 
  }
  
  // Add personality context based on the current user query
  let personalityContext = "";
  try {
    const userConfig = await userConfigurationStorage.getValue();
    const embeddingConfig = userConfig?.embeddingConfig;
    
    if (embeddingConfig) {
      console.log('[llmChatService] Fetching personality context for query:', latestUserMessageContent);
      const personalityChunks = await getPersonalityContext(latestUserMessageContent, embeddingConfig, 2);
      
      if (personalityChunks.length > 0) {
        personalityContext = `[Personality Context]\n${personalityChunks.join('\n\n')}\n[/Personality Context]`;
        console.log(`[llmChatService] Added personality context: ${personalityChunks.length} chunks`);
      }
    } else {
      console.log('[llmChatService] No embedding config available for personality context');
    }
  } catch (error) {
    console.warn('[llmChatService] Failed to fetch personality context:', error);
  }
  
  // Add dynamic RAG context based on the current user query
  let ragContext = "";
  try {
    // Get user's LLM config to determine model for context window management
    const userConfig = await userConfigurationStorage.getValue();
    const modelId = userConfig?.llmConfig?.modelId || 'default';
    
    // Build RAG context for the current query
    const ragResult = await buildRAGContext(latestUserMessageContent, modelId, {
      maxResults: 8,
      minRelevanceScore: 0.3,
      sources: ['chat', 'bookmark', 'page', 'learning']
    });
    
    if (ragResult.results.length > 0) {
      ragContext = formatRAGContextForPrompt(ragResult);
      console.log(`[llmChatService] Added RAG context: ${ragResult.results.length} results, ${ragResult.totalTokensUsed} tokens`);
    }
  } catch (error) {
    console.warn('[llmChatService] Failed to build RAG context:', error);
  }
  
  const systemMessages: ChatMessage[] = [];

  let fullSystemPrompt = "";

  if (options.excludeBaseSystem) {
    if (options.threadSystemPrompt) {
      fullSystemPrompt = options.threadSystemPrompt;
    }
  } else {
    fullSystemPrompt = effectiveBaseSystem;
    if (userActivityContext) {
      fullSystemPrompt += "\n\n" + userActivityContext;
    }
    if (personalityContext) {
      fullSystemPrompt += "\n\n" + personalityContext;
    }
    if (ragContext) {
      fullSystemPrompt += "\n\n" + ragContext;
    }
    if (options.threadSystemPrompt) {
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
  const consolidatedSystemPrompt = `You are a helpful assistant. Your task is to generate 1 distinct roleplay scenario for a user learning ${targetLanguageName}. The scenario must have a 'title' (string), a 'description' (string, 1-3 sentences for scene setting), and an 'ai_opening_line' (string, the first thing the AI character says to the user to start the interaction).

IMPORTANT INSTRUCTIONS:
1.  For the 'title': If you use ${targetLanguageName} text in the title, it MUST NOT include phonetic transcriptions (like Pinyin for Chinese) or parenthetical English translations. For example, a title like "咖啡馆奇遇 - Coffee Shop Adventure" is good; "咖啡馆奇遇 (Kāfēiguǎn Qíyù) - Coffee Shop Adventure" is not.
2.  For the 'ai_opening_line': This line MUST consist ONLY of pure ${targetLanguageName} text. Do NOT include any phonetic transcriptions (like Pinyin for Chinese), translations, or parenthetical explanations.

RETURN the result as a VALID JSON ARRAY containing a single object, like this: [{ "title": "Example Title", "description": "Example scene description.", "ai_opening_line": "Hello! How can I help you today?" }] . Do not include any other text, explanations, or markdown formatting outside the JSON array.

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

// --- NEW FUNCTION FOR THREAD TITLE GENERATION ---
export async function generateThreadTitleLLM(firstUserMessage: string): Promise<string> {
  console.log(`[llmChatService] Generating thread title for first message: "${firstUserMessage.substring(0, 50)}..."`);
  
  const userCfg = await userConfigurationStorage.getValue();
  if (!userCfg || !userCfg.llmConfig || !userCfg.llmConfig.providerId || !userCfg.llmConfig.modelId) {
    console.error('[llmChatService] LLM not configured for title generation.');
    throw new Error('LLM not configured. Please check settings.');
  }

  const llmServiceConfig: LLMConfig = {
    provider: userCfg.llmConfig.providerId as LLMConfig['provider'],
    model: userCfg.llmConfig.modelId,
    baseUrl: userCfg.llmConfig.baseUrl ?? '',
    apiKey: userCfg.llmConfig.apiKey ?? undefined,
    stream: false, // Non-streaming for a short title
  };

  // System prompt instructing the LLM to generate a 3-word title
  // The user message is part of the "user" message to the LLM, not directly in system prompt here.
  const titleGenSystemPrompt = "Based on the user's first message in a new conversation, generate a concise and relevant 3-word title for this conversation. Only return the title itself, with no extra formatting, quotation marks, or introductory phrases. For example, if the user says 'Tell me about the history of Rome', a good title would be 'Roman History Inquiry'.";

  try {
    const title = await getAiChatResponse(
      [], // No prior conversation history for this specific task
      firstUserMessage, // The user's first message is the prompt content
      llmServiceConfig,
      { 
        threadSystemPrompt: titleGenSystemPrompt, 
        excludeBaseSystem: true // Exclude the main personality and its context
      } 
    );

    const trimmedTitle = title.trim();
    // Basic cleanup: remove quotes if LLM accidentally adds them
    const finalTitle = trimmedTitle.replace(/^["'"'']|["'""']$/g, ''); 

    console.log(`[llmChatService] Generated thread title: "${finalTitle}"`);
    return finalTitle;

  } catch (error) {
    console.error('[llmChatService] Error generating thread title via LLM:', error);
    // Fallback or re-throw. For now, let's re-throw so caller can decide.
    throw new Error(`Failed to generate thread title: ${error instanceof Error ? error.message : String(error)}`);
  }
}
// --- END NEW FUNCTION --- 