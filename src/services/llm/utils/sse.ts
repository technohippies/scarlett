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