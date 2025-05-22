import { ELEVENLABS_API_BASE_URL } from '../../shared/constants';

export interface ElevenLabsTranscriptionResponse {
  language_code: string;
  language_probability: number;
  text: string;
  words?: Array<{
    text: string;
    type: string;
    logprob: number;
    start: number;
    end: number;
    speaker_id?: string;
    characters?: Array<{
      text: string;
      start: number;
      end: number;
    }>;
  }>;
  // ... other fields from the API if needed
}

/**
 * Transcribes an audio blob using the ElevenLabs Speech-to-Text API.
 *
 * @param apiKey The ElevenLabs API key.
 * @param audioBlob The audio data to transcribe (e.g., a WAV blob from VAD).
 * @param modelId The ID of the transcription model to use (e.g., 'scribe_v1').
 * @param languageCode Optional ISO-639-1 language code (e.g., 'en').
 * @returns A Promise that resolves to the ElevenLabsTranscriptionResponse.
 * @throws An error if the API request fails.
 */
export async function transcribeElevenLabsAudio(
    apiKey: string,
    audioBlob: Blob,
    modelId: string = 'scribe_v1', // Default to scribe_v1 as per docs
    languageCode?: string
): Promise<ElevenLabsTranscriptionResponse> {
    const apiUrl = `${ELEVENLABS_API_BASE_URL}/speech-to-text`;

    // Use xi-api-key header for Speech-to-Text API authentication
    const headers = new Headers({
        'xi-api-key': apiKey,
    });

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav'); // Provide a filename, e.g., audio.wav
    formData.append('model_id', modelId);

    if (languageCode) {
        formData.append('language_code', languageCode);
    }
    // Add other optional parameters from the API docs as needed, e.g.:
    // formData.append('tag_audio_events', 'true');
    // formData.append('diarize', 'true');
    // formData.append('timestamps_granularity', 'word');

    console.log(`[ElevenLabsSttService] Transcribing audio with model: ${modelId}...`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: formData,
        });

        if (!response.ok) {
            let errorBody = '';
            try {
                const errorData = await response.json();
                errorBody = errorData.detail?.message || errorData.detail || JSON.stringify(errorData);
            } catch (e) {
                errorBody = await response.text();
            }
            console.error(`[ElevenLabsSttService] API Error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
            throw new Error(`ElevenLabs STT API Error ${response.status}: ${errorBody}`);
        }

        const transcriptionResult: ElevenLabsTranscriptionResponse = await response.json();
        console.log('[ElevenLabsSttService] Successfully received transcription:', transcriptionResult.text);
        return transcriptionResult;

    } catch (error) {
        console.error('[ElevenLabsSttService] Network or other error during STT:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to transcribe audio with ElevenLabs due to a network or unexpected error.');
    }
} 