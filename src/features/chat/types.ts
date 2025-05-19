export interface ChatMessage {
  id: string;
  thread_id: string; // Foreign key to ChatSession/Thread
  sender: 'user' | 'ai';
  text_content: string;
  timestamp?: string; // ISO 8601 date string
  // Fields for TTS highlighting (relevant for AI messages in speech mode)
  ttsWordMap?: WordInfo[]; // Corrected type
  alignmentData?: any; // Consider defining a more specific type
  tts_lang?: string; // Language for this specific AI message's TTS
  tts_voice_id?: string;
  isStreaming?: boolean; // Added for UI control during streaming
  // Embedding fields
  embedding_512?: number[] | null;
  embedding_768?: number[] | null;
  embedding_1024?: number[] | null;
  active_embedding_dimension?: 512 | 768 | 1024 | null;
  audio_url?: string;
  playbackRate?: number;
  metadata?: any;
}

export interface Thread {
  id: string;
  title: string;
  systemPrompt?: string;
  messages: ChatMessage[]; // Usually loaded on demand, or just the latest for previews
  createdAt?: string; // ISO 8601 date string
  updatedAt?: string;
  // Embedding fields
  embedding_512?: number[] | null;
  embedding_768?: number[] | null;
  embedding_1024?: number[] | null;
  active_embedding_dimension?: 512 | 768 | 1024 | null;
  // Optional: For "Just Chat" mode, we might not need a specific scenario description
  // scenarioDescription?: string; 
  metadata?: any;
  lastActivity?: string;
}

export interface ChatSession {
  id: string;
  title: string; // e.g., "Chat about SolidJS" or a truncated first message
  lastActivity: string; // Timestamp or relative time
}

export const JUST_CHAT_THREAD_ID = '__just_chat_speech_mode__';

// Add WordInfo here
export interface WordInfo {
  word: string;
  start: number;
  end: number;
  index: number;
} 