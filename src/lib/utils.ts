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

// --- Add WebGPU Check ---
/**
 * Checks if the browser supports the WebGPU API.
 * @returns {boolean} True if WebGPU is supported, false otherwise.
 */
export const checkWebGPUSupport = (): boolean => {
    // Basic check for the presence of the navigator.gpu object
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        console.log("[checkWebGPUSupport] navigator.gpu found.");
        return true;
    } else {
        console.log("[checkWebGPUSupport] navigator.gpu NOT found.");
        return false;
    }
}; 