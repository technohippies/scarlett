import { getEmbedding, type EmbeddingResult } from '../llm/embedding';
import { searchPageSummariesByVector, type RetrievedPageContext } from '../db/retrieval';
import type { ScenarioOption } from '../../features/roleplay/RoleplaySelectionView';
import type { LLMConfig, ChatMessage } from '../llm/types';
// Placeholder for actual LLM chat function. You'll need to import your specific one (ollamaChat, janChat, etc.)
// or a generic wrapper if you have one.
import { ollamaChat } from '../llm/providers/ollama/chat'; 
import { userConfigurationStorage } from '../storage/storage';

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
    // Pull learner's target language code from user settings
    const userCfg = await userConfigurationStorage.getValue();
    const rawLang = userCfg.targetLanguage ?? 'French';
    // Map language codes to full language names
    const LANGUAGE_NAME_MAP: Record<string, string> = {
        en: 'English', zh: 'Chinese', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian',
        ar: 'Arabic', ja: 'Japanese', ko: 'Korean', es: 'Spanish', fr: 'French'
    };
    const code = rawLang.toLowerCase();
    const targetLanguageName = LANGUAGE_NAME_MAP[code] ?? rawLang;
    console.log(`[Roleplay Service] Generating scenarios for ${targetLanguageName} based on topic: "${topicHint}"`);

    const llmConfig = await getActiveLLMConfig();
    if (!llmConfig) {
        console.error('[Roleplay Service] Cannot generate scenarios: Missing LLM configuration.');
        return [];
    }
    console.log('[Roleplay Service] Using LLM Config:', llmConfig);

    // 1. Embed the initial query/topic for RAG
    const queryForEmbedding = `Roleplay scenarios for learning ${targetLanguageName} about ${topicHint}`;
    let queryEmbeddingResult: EmbeddingResult | null = null;
    {
        const userCfg = await userConfigurationStorage.getValue();
        if (userCfg.embeddingConfig) {
            try {
                queryEmbeddingResult = await getEmbedding(queryForEmbedding, userCfg.embeddingConfig);
            } catch (error) {
                console.error('[Roleplay Service] Error getting embedding for query:', error);
            }
        } else {
            console.warn('[Roleplay Service] No unified embeddingConfig found in settings; skipping retrieval of contexts.');
        }
    }
    let retrievedContexts: RetrievedPageContext[] = [];
    if (queryEmbeddingResult && queryEmbeddingResult.embedding && queryEmbeddingResult.dimension) {
        console.log(`[Roleplay Service] Query embedded. Dimension: ${queryEmbeddingResult.dimension}. Searching for contexts...`);
        retrievedContexts = await searchPageSummariesByVector(
            queryEmbeddingResult.embedding,
            queryEmbeddingResult.dimension as 512 | 768 | 1024,
            3
        );
        console.log(`[Roleplay Service] Retrieved ${retrievedContexts.length} contexts.`);
    } else {
        console.warn('[Roleplay Service] Could not retrieve contexts via embedding; proceeding with general generation.');
    }

    let contextString = 'No specific page context available.';
    if (retrievedContexts.length > 0) {
        contextString = retrievedContexts
            .map((ctx, index) => `Context Excerpt ${index + 1} (from ${ctx.url}):\n${ctx.summary_content}`)
            .join('\n\n---\n\n');
    }

    const systemPrompt = `You are a creative assistant helping a language learner. Your task is to generate 3 distinct roleplay scenarios for a user learning ${targetLanguageName}. Each scenario should have a clear title and a short, engaging description (1-3 sentences). Base the scenarios on the provided context if available, or general ${topicHint} if not. Focus on practical, conversational situations. RETURN the result as a VALID JSON ARRAY of objects, each with "title" and "description" fields, and no additional text.`;
    
    const userPrompt = `Please generate 3 roleplay scenarios for ${targetLanguageName} practice, and output only a JSON array of objects with keys "title" and "description".

Available Context (use this for inspiration):
${contextString}

If the context is not relevant or too limited for varied scenarios, please generate scenarios based on general topics like: ${topicHint}.

Format each scenario with a "Title:" and a "Description:". Separate scenarios clearly. For example:
Title: Ordering Coffee
Description: You are at a coffee shop in Paris. Order your favorite coffee and a croissant. Ask if they have Wi-Fi.

Title: Asking for Directions
Description: You are lost and need to find the nearest metro station. Ask a passerby for directions. 

Ensure the descriptions are concise and give the user a clear idea of the situation and their role.`;

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];

    try {
        console.log('[Roleplay Service] Sending request to LLM...');
        // This part needs to be dynamic based on llmConfig.provider
        let responseText: string | undefined;

        switch (llmConfig.provider) {
            case 'ollama':
                const ollamaResponse = await ollamaChat(messages, llmConfig);
                responseText = ollamaResponse.choices[0]?.message?.content;
                break;
            // Add cases for 'jan', 'lmstudio' if you have chat functions for them
            // case 'jan':
            //     const janResponse = await janChat(messages, llmConfig);
            //     responseText = janResponse.choices[0]?.message?.content;
            //     break;
            default:
                console.error(`[Roleplay Service] Unsupported LLM provider: ${llmConfig.provider}`);
                return [];
        }
        
        if (!responseText) {
            console.error('[Roleplay Service] LLM response was empty or in an unexpected format.');
            return [];
        }
        console.log('[Roleplay Service] Received LLM response. Attempting to parse JSON scenarios...');
        let scenarios: ScenarioOption[] = [];
        try {
            // Strip markdown code block fences if present
            const cleanedJsonText = responseText.replace(/^```json\n?|\n?```$/g, '');
            scenarios = JSON.parse(cleanedJsonText) as ScenarioOption[];
            console.log(`[Roleplay Service] Parsed ${scenarios.length} scenarios via JSON.`);
        } catch (jsonErr) {
            console.warn('[Roleplay Service] JSON parse failed, falling back to markdown parser.', jsonErr);
            scenarios = parseLLMResponseToScenarios(responseText);
            console.log(`[Roleplay Service] Parsed ${scenarios.length} scenarios via markdown fallback.`);
        }
        return scenarios;

    } catch (error) {
        console.error('[Roleplay Service] Error calling LLM or parsing response:', error);
        return []; 
    }
} 