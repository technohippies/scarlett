import { ELEVENLABS_API_BASE_URL, DEFAULT_ELEVENLABS_VOICE_ID } from '../../shared/constants';
import type { AlignmentData } from '../../features/translator/TranslatorWidget'; // Import AlignmentData type

export interface ElevenLabsVoiceSettings {
    stability?: number; // 0-1
    similarity_boost?: number; // 0-1
    style?: number; // 0-1 for eleven_multilingual_v2, 0-0.3 for v1
    use_speaker_boost?: boolean;
    speed?: number;
}

// --- Interface for the new function's response ---
export interface ElevenLabsSpeechWithTimestampsResponse {
    audioBlob: Blob;
    alignmentData: AlignmentData | null;
}

// --- Helper function to convert base64 to Blob ---
function base64ToBlob(base64: string, type: string = 'audio/mpeg'): Blob {
    try {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type });
    } catch (e) {
        console.error("[ElevenLabsService] Error in base64ToBlob:", e);
        throw new Error("Failed to decode base64 audio string.");
    }
}

/**
 * Generates speech from text using the ElevenLabs streaming API and returns it as a Blob.
 *
 * @param apiKey The ElevenLabs API key.
 * @param text The text to synthesize.
 * @param selectedModelId The ID of the model to use (e.g., 'eleven_multilingual_v2').
 * @param voiceId The ID of the voice to use. Defaults to DEFAULT_ELEVENLABS_VOICE_ID.
 * @param voiceSettings Optional voice settings for stability, similarity, etc.
 * @param speed Optional speed parameter
 * @param lang Optional language parameter
 * @returns A Promise that resolves to an audio Blob if successful.
 * @throws An error if the API request fails.
 */
export async function generateElevenLabsSpeechStream(
    apiKey: string,
    text: string,
    selectedModelId: string,
    voiceId: string = DEFAULT_ELEVENLABS_VOICE_ID,
    voiceSettings?: ElevenLabsVoiceSettings,
    speed?: number,
    lang?: string
): Promise<Blob> {
    const apiUrl = `${ELEVENLABS_API_BASE_URL}/text-to-speech/${voiceId}/stream`;

    const headers = new Headers({
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
    });

    const body: Record<string, any> = {
        text: text,
        model_id: selectedModelId,
    };

    // Add language_code to body if lang is provided and model is compatible
    if (lang && (selectedModelId === 'eleven_flash_v2.5' || selectedModelId === 'eleven_turbo_v2.5')) {
        body.language_code = lang.toLowerCase().startsWith('zh') ? 'zh' : lang; // Ensure general 'zh' for Chinese variants if applicable
        console.log(`[ElevenLabsService] Enforcing language_code: ${body.language_code} for model ${selectedModelId}`);
    }

    let effectiveVoiceSettings: ElevenLabsVoiceSettings = { ...voiceSettings };

    if (speed !== undefined && speed !== 1.0) {
        if (speed >= 0.7 && speed <= 1.2) {
            effectiveVoiceSettings.speed = speed;
            console.log(`[ElevenLabsService] Applying custom speed: ${speed}`);
        } else {
            console.warn(`[ElevenLabsService] Requested speed ${speed} is outside valid range (0.7-1.2). Using default speed.`);
        }
    }
    
    if (Object.keys(effectiveVoiceSettings).length > 0) {
        body.voice_settings = effectiveVoiceSettings;
    }

    console.log(`[ElevenLabsService] Requesting TTS from: ${apiUrl} with model: ${selectedModelId}, voice: ${voiceId}, settings: ${JSON.stringify(body.voice_settings)}`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            let errorBody = '';
            try {
                // Try to parse error as JSON, which ElevenLabs often returns
                const errorData = await response.json();
                errorBody = errorData.detail?.message || errorData.detail || JSON.stringify(errorData);
            } catch (e) {
                // Fallback to text if not JSON or if JSON parsing fails
                errorBody = await response.text();
            }
            console.error(`[ElevenLabsService] API Error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
            throw new Error(`ElevenLabs API Error ${response.status}: ${errorBody}`);
        }

        // The response body is a stream of audio data.
        // We collect it into a Blob.
        const audioBlob = await response.blob();
        console.log('[ElevenLabsService] Successfully received audio blob.');
        return audioBlob;

    } catch (error) {
        console.error('[ElevenLabsService] Network or other error during TTS generation:', error);
        // Re-throw a generic error or the specific error if it's already an Error instance
        if (error instanceof Error) {
            throw error; 
        }
        throw new Error('Failed to generate speech from ElevenLabs due to a network or unexpected error.');
    }
}

/**
 * Generates speech from text using the ElevenLabs API with timestamps and returns audio and alignment data.
 *
 * @param apiKey The ElevenLabs API key.
 * @param text The text to synthesize.
 * @param selectedModelId The ID of the model to use (e.g., 'eleven_multilingual_v2').
 * @param voiceId The ID of the voice to use. Defaults to DEFAULT_ELEVENLABS_VOICE_ID.
 * @param voiceSettings Optional voice settings for stability, similarity, etc.
 * @param speed Optional speed parameter (applied via voice_settings if model supports it)
 * @param lang Optional language parameter
 * @returns A Promise that resolves to an object with audioBlob and alignmentData.
 * @throws An error if the API request fails.
 */
export async function generateElevenLabsSpeechWithTimestamps(
    apiKey: string,
    text: string,
    selectedModelId: string,
    voiceId: string = DEFAULT_ELEVENLABS_VOICE_ID,
    voiceSettings?: ElevenLabsVoiceSettings,
    speed?: number, // Note: speed for some models is part of voice_settings
    lang?: string
): Promise<ElevenLabsSpeechWithTimestampsResponse> {
    const apiUrl = `${ELEVENLABS_API_BASE_URL}/text-to-speech/${voiceId}/with-timestamps`;

    const headers = new Headers({
        'Accept': 'application/json', // Expect JSON response
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
    });

    const body: Record<string, any> = {
        text: text,
        model_id: selectedModelId,
    };
    
    // Add language_code to body if lang is provided and model is compatible
    // (Turbo v2.5 and Flash v2.5 support language enforcement)
    if (lang && (selectedModelId === 'eleven_flash_v2.5' || selectedModelId === 'eleven_turbo_v2.5')) {
        body.language_code = lang.toLowerCase().startsWith('zh') ? 'zh' : lang; 
        console.log(`[ElevenLabsService] Enforcing language_code: ${body.language_code} for model ${selectedModelId} (with-timestamps)`);
    }

    let effectiveVoiceSettings: ElevenLabsVoiceSettings = { ...voiceSettings };

    // Speed handling for models that support it via voice_settings
    // Note: The /with-timestamps endpoint itself doesn't have a direct `speed` query param like the streaming one might imply.
    // Speed is generally part of voice_settings for newer models.
    if (speed !== undefined && speed !== 1.0) {
        // Assuming models that support timestamps might also support speed in voice_settings
        // This range (0.5-2.0) is more typical for voice_settings.speed
        if (speed >= 0.5 && speed <= 2.0) { 
            effectiveVoiceSettings.speed = speed;
            console.log(`[ElevenLabsService] Applying custom speed via voice_settings: ${speed} (with-timestamps)`);
        } else {
            console.warn(`[ElevenLabsService] Requested speed ${speed} is outside typical voice_settings range (0.5-2.0). (with-timestamps)`);
        }
    }
    
    if (Object.keys(effectiveVoiceSettings).length > 0) {
        body.voice_settings = effectiveVoiceSettings;
    }

    console.log(`[ElevenLabsService] Requesting TTS from: ${apiUrl} with model: ${selectedModelId}, voice: ${voiceId}, body: ${JSON.stringify(body)} (with-timestamps)`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            let errorBody = '';
            try {
                const errorData = await response.json();
                errorBody = errorData.detail?.message || errorData.detail || JSON.stringify(errorData);
            } catch (e) {
                errorBody = await response.text();
            }
            console.error(`[ElevenLabsService] API Error (with-timestamps): ${response.status} ${response.statusText}. Body: ${errorBody}`);
            throw new Error(`ElevenLabs API Error (with-timestamps) ${response.status}: ${errorBody}`);
        }

        const responseData = await response.json();
        
        if (!responseData.audio_base64) {
            console.error("[ElevenLabsService] API Error (with-timestamps): audio_base64 missing from successful response.", responseData);
            throw new Error("ElevenLabs API Error (with-timestamps): audio_base64 missing.");
        }

        const audioBlob = base64ToBlob(responseData.audio_base64);
        // We use `alignment` for original text, not `normalized_alignment`
        const alignmentData = responseData.alignment || null; 

        console.log('[ElevenLabsService] Successfully received audio blob and alignment data. (with-timestamps)');
        return { audioBlob, alignmentData };

    } catch (error) {
        console.error('[ElevenLabsService] Network or other error during TTS generation (with-timestamps):', error);
        if (error instanceof Error) {
            throw error; 
        }
        throw new Error('Failed to generate speech with timestamps from ElevenLabs due to a network or unexpected error.');
    }
} 