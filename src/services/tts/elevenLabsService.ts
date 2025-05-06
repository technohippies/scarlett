import { ELEVENLABS_API_BASE_URL, DEFAULT_ELEVENLABS_VOICE_ID } from '../../shared/constants';

export interface ElevenLabsVoiceSettings {
    stability?: number; // 0-1
    similarity_boost?: number; // 0-1
    style?: number; // 0-1 for eleven_multilingual_v2, 0-0.3 for v1
    use_speaker_boost?: boolean;
}

/**
 * Generates speech from text using the ElevenLabs streaming API and returns it as a Blob.
 *
 * @param apiKey The ElevenLabs API key.
 * @param text The text to synthesize.
 * @param selectedModelId The ID of the model to use (e.g., 'eleven_multilingual_v2').
 * @param voiceId The ID of the voice to use. Defaults to DEFAULT_ELEVENLABS_VOICE_ID.
 * @param voiceSettings Optional voice settings for stability, similarity, etc.
 * @returns A Promise that resolves to an audio Blob if successful.
 * @throws An error if the API request fails.
 */
export async function generateElevenLabsSpeechStream(
    apiKey: string,
    text: string,
    selectedModelId: string,
    voiceId: string = DEFAULT_ELEVENLABS_VOICE_ID,
    voiceSettings?: ElevenLabsVoiceSettings
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

    if (voiceSettings) {
        body.voice_settings = voiceSettings;
    }

    console.log(`[ElevenLabsService] Requesting TTS from: ${apiUrl} with model: ${selectedModelId} and voice: ${voiceId}`);

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