import type { Accessor } from 'solid-js';
import type { ScenarioOption } from './RoleplaySelectionView';

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
    onPlayTTS: (messageId: string, text: string, lang: string, alignmentData?: AlignmentData | null) => Promise<void>; 
    onStopTTS: () => void;
    isTTSSpeaking?: Accessor<boolean>; 
    currentHighlightIndex?: Accessor<number | null>; 
    ttsWordMap?: { text: string; startTime: number; endTime: number; index: number }[];
    ttsPlaybackError?: Accessor<string | null>;
    activeSpokenMessageId?: Accessor<string | null>;
    scenario: ScenarioOption;
    onNavigateBack: () => void;
} 