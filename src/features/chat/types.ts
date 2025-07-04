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
  // Thinking model fields
  thinking_content?: string; // The reasoning/thinking process
  thinking_duration?: number; // Time spent thinking in seconds
  is_thinking_complete?: boolean; // Whether thinking stream is finished
  show_thinking?: boolean; // User preference for this message
  // Embedding fields
  embedding_384?: number[] | null;
  embedding_512?: number[] | null;
  embedding_768?: number[] | null;
  embedding_1024?: number[] | null;
  active_embedding_dimension?: 384 | 512 | 768 | 1024 | null;
  audio_url?: string;
  playbackRate?: number;
  metadata?: any;
  audioObject?: HTMLAudioElement; // Optional, for direct control
}

export interface Thread {
  id: string;
  title: string;
  systemPrompt?: string;
  scenarioDescription?: string;
  messages: ChatMessage[]; // Usually loaded on demand, or just the latest for previews
  createdAt?: string; // ISO 8601 date string
  updatedAt?: string;
  // Embedding fields
  embedding_384?: number[] | null;
  embedding_512?: number[] | null;
  embedding_768?: number[] | null;
  embedding_1024?: number[] | null;
  active_embedding_dimension?: 384 | 512 | 768 | 1024 | null;
  // Optional: For "Just Chat" mode, we might not need a specific scenario description
  metadata?: any;
  lastActivity?: string;
}

export interface ChatSession {
  id: string;
  title: string; // e.g., "Chat about SolidJS" or a truncated first message
  lastActivity: string; // Timestamp or relative time
}

// Add WordInfo here
export interface WordInfo {
  word: string;
  start: number;
  end: number;
  index: number;
}

export interface AlignmentData {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
} 