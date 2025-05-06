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