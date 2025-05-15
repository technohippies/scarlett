import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Placeholder cn function - you might want to install clsx and tailwind-merge
// or use a simpler implementation if preferred.
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// --- Added SSE Chunk Parser ---
/**
 * Parses a Server-Sent Event chunk.
 * Assumes the chunk is a single line starting with "data: ".
 * @param chunk The raw SSE chunk string.
 * @returns The parsed JSON data, the string "[DONE]", or null if parsing fails or format is wrong.
 */
export function parseSseChunk(chunk: string): any | null {
  if (!chunk.startsWith('data: ')) return null;
  const data = chunk.substring(6).trim();
  if (data === '[DONE]') return '[DONE]';
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('[SSE Util] Failed to parse chunk JSON:', data, e);
    return null;
  }
}
// --- End Added Section ---

// REMOVE WebGPU Check function as it is no longer used 

// --- WAV Audio Conversion --- 

/**
 * Encodes a Float32Array of PCM audio data into a WAV Blob.
 * @param pcmData The Float32Array containing the PCM audio samples.
 * @param sampleRate The sample rate of the audio (e.g., 16000).
 * @returns A Blob representing the WAV audio.
 */
export function pcmToWavBlob(pcmData: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16; // 16-bit WAV
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length * numChannels * (bitsPerSample / 8);
  const fileSize = 36 + dataSize; // 36 bytes for WAV header (RIFF chunk descriptor and fmt sub-chunk)

  const buffer = new ArrayBuffer(fileSize + 8); // +8 for RIFF header itself
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true); // fileSize (little-endian)
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);    // 16 for PCM format (fmt chunk size)
  view.setUint16(20, 1, true);     // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM data (convert Float32 to Int16)
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
} 