import { getEmbedding } from '../llm/embedding';
import { searchPageSummariesByVector } from '../db/retrieval';
import type { ScenarioOption } from '../../features/roleplay/RoleplaySelectionView';
import type { LLMConfig, ChatMessage } from '../llm/types';
// Placeholder for actual LLM chat function. You'll need to import your specific one (ollamaChat, janChat, etc.)
// or a generic wrapper if you have one.
import { ollamaChat } from '../llm/providers/ollama/chat'; 
import { userConfigurationStorage } from '../storage/storage';
import {
    getTodaysMoodHistory,
    getTodaysVisitedPagesSummary,
    getTodaysSongsSummary,
    getRecentFlashcardActivitySummary
} from '../context/userDataService'; // Import new user data service

console.log('[Roleplay Service] Loaded.');

async function getActiveLLMConfig(): Promise<LLMConfig | null> {
    const userCfg = await userConfigurationStorage.getValue();
    // Use unified llmConfig if present
    if (userCfg.llmConfig) {
        const fc = userCfg.llmConfig;
        if (!fc.providerId || !fc.modelId || !fc.baseUrl) {
            console.error('[Roleplay Service] Incomplete llmConfig in user settings:', fc);
            return null;
        }
        return {
            provider: fc.providerId as LLMConfig['provider'],
            model: fc.modelId,
            baseUrl: fc.baseUrl,
            apiKey: fc.apiKey ?? undefined,
            stream: false,
        };
    }
    console.warn('[Roleplay Service] No unified llmConfig found in settings. Cannot generate scenarios without LLM config.');
    return null;
}

function parseLLMResponseToScenarios(responseText: string): ScenarioOption[] {
    const scenarios: ScenarioOption[] = [];
    try {
        // Remove markdown bolding for keywords before splitting
        const cleanedResponse = responseText.replace(/\*\*(Title|Description):\*\*/g, '$1:');

        // Split by "Title:" marker, ensuring it captures blocks correctly even if Title: is not at the very start of a line after a separator.
        // This regex looks for "Title:" that is either at the start of the string, or follows a newline.
        // It also handles optional separators like --- or === between scenarios.
        const blocks = cleanedResponse.split(/\n(?:---|===)\n(?=Title:)|(?<=\n|^)Title:/).filter(block => block.trim() !== '');
        
        for (let i = 0; i < blocks.length; i++) {
            let currentBlock = blocks[i].trim();
            // The split regex should ensure that each block now effectively starts with the title content (after "Title:")
            // or is the description part.

            // We expect blocks to be like: "[Title Content]\nDescription: [Description Content]"
            // or just "[Title Content]Description: [Description Content]" if newline was consumed by split.
            
            const descriptionMatch = currentBlock.match(/(?:\n|^)Description:\s*([\s\S]+)/i);
            if (descriptionMatch && descriptionMatch[1]) {
                const description = descriptionMatch[1].trim();
                // The title is whatever precedes "Description:"
                const titleCandidate = currentBlock.substring(0, descriptionMatch.index).trim();
                
                if (titleCandidate) {
                    scenarios.push({
                        id: `scenario-${Date.now()}-${scenarios.length}`,
                        title: titleCandidate,
                        description: description,
                    });
                } else {
                    console.warn('[Roleplay Service] Found description but no title in block:', currentBlock);
                }
            } else {
                console.warn('[Roleplay Service] Could not parse block into title/description:', currentBlock);
            }
        }

        if (scenarios.length === 0 && responseText.trim()) {
            console.warn("[Roleplay Service] LLM response parsing yielded no scenarios, but response wasn't empty. Cleaned response for parsing was:", cleanedResponse, "Original Raw:", responseText);
        }
    } catch (error) {
        console.error('[Roleplay Service] Error parsing LLM response to scenarios:', error, "\nRaw response: ", responseText);
    }
    return scenarios;
}


export async function generateRoleplayScenarios(
    topicHint: string = 'everyday situations, travel, and hobbies'
): Promise<ScenarioOption[]> {
    const userCfg = await userConfigurationStorage.getValue();
    const rawLang = userCfg.targetLanguage ?? 'French';
    const LANGUAGE_NAME_MAP: Record<string, string> = {
        en: 'English', zh: 'Chinese', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian',
        ar: 'Arabic', ja: 'Japanese', ko: 'Korean', es: 'Spanish', fr: 'French'
    };
    const code = rawLang.toLowerCase();
    const targetLanguageName = LANGUAGE_NAME_MAP[code] ?? rawLang;
    console.log(`[Roleplay Service] Generating 2 scenarios for ${targetLanguageName} based on topic: "${topicHint}" and user context.`);

    const llmConfig = await getActiveLLMConfig();
    if (!llmConfig) {
        console.error('[Roleplay Service] Cannot generate scenarios: Missing LLM configuration.');
        return [];
    }

    // 1. Fetch Rich User Context
    let userContextSummary = "User's recent activity:\n";
    try {
        const moods = await getTodaysMoodHistory();
        if (moods.length > 0) {
            userContextSummary += `- Today's moods: ${moods.map(m => m.mood).join(', ')}\n`;
        }
        const pages = await getTodaysVisitedPagesSummary();
        if (pages.count > 0) {
            userContextSummary += `- Recently visited page topics: ${pages.topicsSummary}\n`;
        }
        const songs = await getTodaysSongsSummary(); // Placeholder, will indicate not available
        if (songs.count > 0) {
             userContextSummary += `- Recently listened songs: ${songs.summary}\n`;
        } else {
            userContextSummary += `- ${songs.summary}\n`; // e.g., "Song listening data for today is not available."
        }
        const flashcards = await getRecentFlashcardActivitySummary(10);
        if (flashcards.count > 0) {
            userContextSummary += `- Recent flashcards: ${flashcards.summary}\n`;
        }
    } catch (contextError) {
        console.error("[Roleplay Service] Error fetching user context:", contextError);
        userContextSummary += "- Could not retrieve all user activity data.\n";
    }

    // RAG context (existing logic, can be combined or prioritized with user context)
    const queryForEmbedding = `Roleplay scenarios for learning ${targetLanguageName} about ${topicHint}`;
    let ragContextString = 'No specific page context available from RAG.';
    const embeddingConfig = userCfg.embeddingConfig;
    if (embeddingConfig) {
        try {
            const queryEmbeddingResult = await getEmbedding(queryForEmbedding, embeddingConfig);
            if (queryEmbeddingResult && queryEmbeddingResult.embedding && queryEmbeddingResult.dimension) {
                const retrievedContexts = await searchPageSummariesByVector(
                    queryEmbeddingResult.embedding,
                    queryEmbeddingResult.dimension as 512 | 768 | 1024,
                    1 // Fetch fewer RAG contexts if user context is rich
                );
                if (retrievedContexts.length > 0) {
                    ragContextString = retrievedContexts
                        .map((ctx, index) => `Supplementary Context Excerpt ${index + 1} (from ${ctx.url}):\n${ctx.summary_content}`)
                        .join('\n\n---\n\n');
                }
            }
        } catch (error) {
            console.error('[Roleplay Service] Error during RAG context retrieval:', error);
        }
    }

    const combinedContext = `${userContextSummary}
Relevant Web Page Context (if any):
${ragContextString}`;

    const systemPrompt = `You are a creative assistant helping a language learner. Your task is to generate **TWO (2)** distinct roleplay scenarios for a user learning ${targetLanguageName}. 
Each scenario should have a clear title **written in ${targetLanguageName}** and a short, engaging description (**a single sentence only**) **written in English**.
Base the scenarios PRIMARILY on the user's recent activity and learning context provided below. Also consider the general topic hint: ${topicHint}. 
Incorporate some of the user's recent flashcard vocabulary (especially ${targetLanguageName} words) naturally into the scenario descriptions (English) if possible, perhaps by mentioning the concept or a translation.
Focus on practical, conversational situations. 
RETURN the result as a VALID JSON ARRAY of objects, each with "id", "title" (in ${targetLanguageName}), and "description" (in English, single sentence) fields. Do not include any additional text, explanations, or markdown. The ID should be a unique string.`;
    
    const userPrompt = `Please generate **TWO (2)** roleplay scenarios for ${targetLanguageName} practice. 
The title for each scenario **must be written in ${targetLanguageName}**. 
The description for each scenario **must be a single sentence in English**.
Output ONLY a VALID JSON array of objects, each with keys "id", "title" (in ${targetLanguageName}), and "description" (in English, single sentence).

User's Recent Activity & Learning Context (Prioritize this for scenario ideas):
${combinedContext}

General Topic Hint (use if context is sparse or for variety): ${topicHint}.

Ensure the English descriptions are concise (a single sentence) and give the user a clear idea of the situation and their role. Make sure the generated IDs are unique strings (e.g., 'scenario-timestamp-index').`;

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];

    try {
        console.log('[Roleplay Service] Sending request to LLM for 2 scenarios...');
        let responseText: string | undefined;
        switch (llmConfig.provider) {
            case 'ollama':
                const ollamaResponse = await ollamaChat(messages, llmConfig);
                responseText = ollamaResponse.choices[0]?.message?.content;
                break;
            default:
                console.error(`[Roleplay Service] Unsupported LLM provider: ${llmConfig.provider}`);
                return [];
        }
        
        if (!responseText) {
            console.error('[Roleplay Service] LLM response was empty or in an unexpected format.');
            return [];
        }
        console.log('[Roleplay Service] Received LLM response for 2 scenarios. Attempting to parse JSON...');
        let scenarios: ScenarioOption[] = [];
        try {
            const cleanedJsonText = responseText.replace(/^```json\n?|\n?```$/g, '').trim();
            const parsedScenarios = JSON.parse(cleanedJsonText);
            // Ensure it's an array and has the expected structure
            if (Array.isArray(parsedScenarios) && parsedScenarios.every(s => s.id && s.title && s.description)) {
                scenarios = parsedScenarios.map(s => ({...s, id: String(s.id) })); // Ensure ID is string
                 // If LLM returns more than 2, slice it.
                if (scenarios.length > 2) {
                    console.warn(`[Roleplay Service] LLM returned ${scenarios.length} scenarios, slicing to 2.`);
                    scenarios = scenarios.slice(0, 2);
                }
            } else {
                throw new Error('Parsed JSON is not an array of valid ScenarioOption objects.');
            }
            console.log(`[Roleplay Service] Parsed ${scenarios.length} scenarios via JSON.`);
        } catch (jsonErr) {
            console.warn('[Roleplay Service] JSON parse failed for 2 scenarios, falling back to markdown parser (if available and still needed).', jsonErr, "Raw response:", responseText);
            // Fallback to old parser if JSON fails, though ideally the LLM follows JSON output for 2 scenarios
            scenarios = parseLLMResponseToScenarios(responseText).slice(0, 2); 
            console.log(`[Roleplay Service] Parsed ${scenarios.length} scenarios via markdown fallback (sliced to 2).`);
        }
        return scenarios;

    } catch (error) {
        console.error('[Roleplay Service] Error generating roleplay scenarios:', error);
        return [];
    }
} 