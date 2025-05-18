export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp?: string; // Optional timestamp
  // Fields for TTS highlighting (relevant for AI messages in speech mode)
  ttsWordMap?: { text: string; startTime: number; endTime: number; index: number }[];
  alignmentData?: any; // Can be ElevenLabsAlignmentData or similar
  ttsLang?: string; // Language for this specific AI message's TTS
}

export interface Thread {
  id: string;
  title: string;
  systemPrompt: string;
  messages: ChatMessage[];
  lastActivity: string; // ISO string for date
  createdAt?: string; // Added: ISO string for date
  // Optional: For "Just Chat" mode, we might not need a specific scenario description
  // scenarioDescription?: string; 
}

export interface ChatSession {
  id: string;
  title: string; // e.g., "Chat about SolidJS" or a truncated first message
  lastActivity: string; // Timestamp or relative time
} 