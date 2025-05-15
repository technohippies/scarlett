import type { Accessor } from 'solid-js';

export interface AlignmentData {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
}

export interface ChatMessage {
    id: string; 
    sender: 'user' | 'ai';
    text: string; 
    alignment?: AlignmentData | null; 
    timestamp: Date;
    error?: boolean; 
}

export interface RoleplayConversationViewProps {
    aiWelcomeMessage?: string; 
    onSendMessage: (spokenText: string, chatHistory: ChatMessage[]) => Promise<{ aiResponse: string; alignment?: AlignmentData | null; error?: string } | null>;
    onEndRoleplay: () => void; 
    targetLanguage: string; 
    onStartRecording: () => Promise<boolean>; 
    onStopRecording: () => Promise<string | null>; 
    onPlayTTS: (text: string, lang: string, alignmentData?: AlignmentData | null) => Promise<void>; 
    onStopTTS: () => void;
    isTTSSpeaking?: Accessor<boolean>; 
    currentHighlightIndex?: Accessor<number | null>; 
} 