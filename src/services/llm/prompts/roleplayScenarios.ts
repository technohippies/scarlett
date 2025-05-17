console.log('[Prompts RoleplayScenarios] Loaded.');

export interface RoleplayPromptParams {
    targetLanguageName: string;
    topicHint: string;
    contextString: string;
}

export function getRoleplaySystemPrompt(params: Pick<RoleplayPromptParams, 'targetLanguageName' | 'topicHint'>): string {
    return `You are a creative assistant helping a language learner. Your task is to generate 3 distinct roleplay scenarios for a user learning ${params.targetLanguageName}. Each scenario should have a clear title and a short, engaging description (1-3 sentences). Base the scenarios on the provided context if available, or general ${params.topicHint} if not. Focus on practical, conversational situations. RETURN the result as a VALID JSON ARRAY of objects, each with "title" and "description" fields, and no additional text.`;
}

export function getRoleplayUserPrompt(params: RoleplayPromptParams): string {
    return `Please generate 3 roleplay scenarios for ${params.targetLanguageName} practice, and output only a JSON array of objects with keys "title" and "description".

Available Context (use this for inspiration):
${params.contextString}

If the context is not relevant or too limited for varied scenarios, please generate scenarios based on general topics like: ${params.topicHint}.

Format each scenario with a "Title:" and a "Description:". Separate scenarios clearly. For example:
Title: Ordering Coffee
Description: You are at a coffee shop in Paris. Order your favorite coffee and a croissant. Ask if they have Wi-Fi.

Title: Asking for Directions
Description: You are lost and need to find the nearest metro station. Ask a passerby for directions. 

Ensure the descriptions are concise and give the user a clear idea of the situation and their role.`;
}
 