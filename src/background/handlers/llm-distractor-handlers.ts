import type { defineExtensionMessaging } from '@webext-core/messaging';
import type { 
    GenerateLLMDistractorsResponse,
    BackgroundProtocolMap // Import from shared
} from '../../shared/messaging-types';
import { userConfigurationStorage } from '../../services/storage/storage';
import type { FunctionConfig } from '../../services/storage/types';
import { getLLMDistractorsPrompt, validateDistractorLanguage } from '../../services/llm/prompts/exercises';
import { ollamaChat } from '../../services/llm/providers/ollama/chat'; // Assuming dynamicChat might be simplified or replaced
import type { LLMConfig, LLMChatResponse, LLMProviderId, ChatMessage } from '../../services/llm/types';
import { lookup } from '../../shared/languages';

// Moved from message-handlers.ts
function getFullLanguageName(code: string): string {
    return lookup(code).fullName;
}

// Moved and potentially simplified from message-handlers.ts
// This version of dynamicChat is specific to what generateLLMDistractors was using.
// It assumes non-streaming chat.
async function dynamicChatForDistractors(messages: ChatMessage[], config: FunctionConfig): Promise<LLMChatResponse | null> {
    const { providerId, modelId, baseUrl, apiKey } = config;
    if (!providerId || !modelId || !baseUrl) {
        console.error('[dynamicChatForDistractors] Incomplete LLM configuration:', config);
        throw new Error('Incomplete LLM configuration for chat.');
    }

    const chatConfig: LLMConfig = {
        provider: providerId as LLMProviderId,
        model: modelId,
        baseUrl: baseUrl!,
        apiKey: apiKey ?? undefined,
        stream: false, // Explicitly false for this use case
        options: { temperature: 0 } 
    };

    console.log(`[dynamicChatForDistractors] Calling provider: ${providerId}, Model: ${modelId}`);

    switch (providerId) {
        case 'ollama':
            return ollamaChat(messages, chatConfig);
        // Add other cases if generateLLMDistractors directly supported other providers
        // For now, matching the structure it seemed to imply.
        default:
            console.error(`[dynamicChatForDistractors] Unsupported provider for distractors: ${providerId}`);
            throw new Error(`Unsupported provider for distractors: ${providerId}`);
    }
}


export function registerLlmDistractorHandlers(messaging: ReturnType<typeof defineExtensionMessaging<BackgroundProtocolMap>>) {
    messaging.onMessage('generateLLMDistractors', async (message): Promise<GenerateLLMDistractorsResponse> => {
        console.log('[LlmDistractorHandlers] Received generateLLMDistractors request:', message.data);
        const { sourceText, targetText, count = 3, direction, correctAnswerForFiltering } = message.data;
        
        const safeDirection: string = direction || 'EN_TO_NATIVE';

        let llmFunctionConfig: FunctionConfig | null = null;
        try {
            const settings = await userConfigurationStorage.getValue();
            if (!settings) {
                console.error('[LlmDistractorHandlers] User settings not found.');
                return { distractors: [], error: 'User settings not found.' };
            }

            // Logic for determining llmFunctionConfig (copied from message-handlers.ts)
            if (settings.llmConfig && settings.llmConfig.providerId && settings.llmConfig.providerId !== 'none') {
                const providerId = settings.llmConfig.providerId;
                llmFunctionConfig = {
                    providerId: providerId,
                    modelId: settings.llmConfig.modelId || '', 
                    baseUrl: settings.llmConfig.baseUrl || '', 
                    apiKey: settings.llmConfig.apiKey || undefined,
                };
                // Provider specific validation (simplified from original for brevity, can be expanded)
                if (!llmFunctionConfig.modelId || !llmFunctionConfig.baseUrl) {
                    console.error(`[LlmDistractorHandlers] Configuration for ${providerId} in llmConfig incomplete.`);
                    llmFunctionConfig = null;
                }
            } else if (settings.selectedLlmProvider && settings.selectedLlmProvider !== 'none') {
                console.warn('[LlmDistractorHandlers] Using fallback to selectedLlmProvider and flat properties.');
                llmFunctionConfig = {
                    providerId: settings.selectedLlmProvider,
                    modelId: '', 
                    baseUrl: '', 
                    apiKey: undefined, 
                };
                switch (settings.selectedLlmProvider) {
                    case 'ollama':
                        llmFunctionConfig.modelId = settings.ollamaModel || '';
                        llmFunctionConfig.baseUrl = settings.ollamaBaseUrl || '';
                        break;
                    case 'lmstudio':
                        llmFunctionConfig.modelId = settings.lmStudioModel || '';
                        llmFunctionConfig.baseUrl = settings.lmStudioBaseUrl || '';
                        break;
                    case 'jan':
                        llmFunctionConfig.modelId = settings.janModel || '';
                        llmFunctionConfig.baseUrl = settings.janBaseUrl || '';
                        break;
                    default:
                        console.error(`[LlmDistractorHandlers] (Fallback) Unsupported LLM provider: ${settings.selectedLlmProvider}`);
                        llmFunctionConfig = null;
                }
                if (llmFunctionConfig && (!llmFunctionConfig.modelId || !llmFunctionConfig.baseUrl)) {
                     console.error(`[LlmDistractorHandlers] (Fallback) Configuration for ${settings.selectedLlmProvider} incomplete.`);
                     llmFunctionConfig = null;
                }
            }

            if (!llmFunctionConfig) {
                const errorMsg = 'LLM configuration is missing, incomplete, or unsupported.';
                console.error(`[LlmDistractorHandlers] ${errorMsg}`);
                return { distractors: [], error: errorMsg };
            }

            const userNativeLang = settings.nativeLanguage || 'vi';
            const userTargetLang = settings.targetLanguage || 'en'; 

            // CORRECT LOGIC: Distractors should always be in the same language as the correct answer
            // The correct answer is always correctAnswerForFiltering, so distractors should match its language
            
            let wordToTranslate: string;
            let originalWordLanguageName: string;
            let distractorsLanguageName: string;
            
            if (safeDirection === 'EN_TO_NATIVE') {
                // Question: English word, User selects correct Native word
                // correctAnswerForFiltering is the native word (targetText), distractors should be native words too
                wordToTranslate = sourceText; // The English word being translated
                originalWordLanguageName = getFullLanguageName('en');
                distractorsLanguageName = getFullLanguageName(userTargetLang); // Target language for distractors
            } else { // NATIVE_TO_EN
                // Question: Native word, User selects correct English word
                // correctAnswerForFiltering is the English word (targetText), distractors should be English words too
                wordToTranslate = sourceText; // The native word being translated
                originalWordLanguageName = getFullLanguageName(userNativeLang);
                distractorsLanguageName = getFullLanguageName('en'); // English for distractors
            }
            
            console.log(`[LlmDistractorHandlers DEBUG] Direction: ${safeDirection}`);
            console.log(`[LlmDistractorHandlers DEBUG] sourceText: "${sourceText}"`);
            console.log(`[LlmDistractorHandlers DEBUG] targetText: "${targetText}"`);
            console.log(`[LlmDistractorHandlers DEBUG] correctAnswerForFiltering: "${correctAnswerForFiltering}"`);
            console.log(`[LlmDistractorHandlers DEBUG] userNativeLang: ${userNativeLang}`);
            console.log(`[LlmDistractorHandlers DEBUG] userTargetLang: ${userTargetLang}`);
            console.log(`[LlmDistractorHandlers Prep] Word: "${wordToTranslate}" (${originalWordLanguageName}). Distractors in: ${distractorsLanguageName}. Correct answer (filter): "${correctAnswerForFiltering}"`);
            
            const prompt = getLLMDistractorsPrompt(wordToTranslate, originalWordLanguageName, distractorsLanguageName, count);
            // Using the specific dynamicChatForDistractors
            const response = await dynamicChatForDistractors([{ role: 'user', content: prompt }], llmFunctionConfig);

            if (response && response.choices && response.choices.length > 0 && response.choices[0].message?.content) {
                let rawContent = response.choices[0].message.content;
                console.log("[LlmDistractorHandlers] Raw LLM content for distractors:", rawContent);

                rawContent = rawContent.replace(/^```json\s*|```$/g, '').trim();
                try {
                    const parsedJson = JSON.parse(rawContent);
                    if (Array.isArray(parsedJson) && parsedJson.every(item => typeof item === 'string')) {
                        console.log("[LlmDistractorHandlers] Extracted distractors:", parsedJson);
                        
                        // Validate language consistency
                        const validation = validateDistractorLanguage(parsedJson, distractorsLanguageName);
                        if (validation.warnings.length > 0) {
                            console.warn("[LlmDistractorHandlers] Distractor validation warnings:", validation.warnings);
                        }
                        if (validation.invalid.length > 0) {
                            console.warn("[LlmDistractorHandlers] Invalid distractors filtered out:", validation.invalid);
                        }
                        
                        // Use only valid distractors and filter out correct answer
                        const finalDistractors = validation.valid.filter(d => d.toLowerCase() !== correctAnswerForFiltering.toLowerCase());
                        
                        if (finalDistractors.length < count && validation.invalid.length > 0) {
                            console.warn(`[LlmDistractorHandlers] Only ${finalDistractors.length}/${count} valid distractors after language validation. Some were filtered due to script/language issues.`);
                        }
                        
                        return { distractors: finalDistractors.slice(0, count) };
                    } else {
                        throw new Error("LLM response is not a JSON array of strings.");
                    }
                } catch (parseError) {
                    console.error("[LlmDistractorHandlers] Error parsing LLM response:", parseError, "Raw content:", rawContent);
                    return { distractors: [], error: `Failed to parse LLM response: ${(parseError as Error).message}` };
                }
            } else {
                console.error("[LlmDistractorHandlers] No content in LLM response or invalid response structure.");
                return { distractors: [], error: "No content in LLM response or invalid response structure." };
            }
        } catch (error: any) {
            console.error('[LlmDistractorHandlers] Error handling generateLLMDistractors:', error);
            if (llmFunctionConfig) {
                console.error(`[LlmDistractorHandlers] Failed using config: Provider=${llmFunctionConfig.providerId}, Model=${llmFunctionConfig.modelId}, BaseUrl=${llmFunctionConfig.baseUrl}`);
            }
            return { distractors: [], error: error.message || 'Failed to generate distractors.' };
        }
    });
} 