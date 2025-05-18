export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp?: string; // Optional timestamp
}

export interface ChatSession {
  id: string;
  title: string; // e.g., "Chat about SolidJS" or a truncated first message
  lastActivity: string; // Timestamp or relative time
} 