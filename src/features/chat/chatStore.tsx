import { createStore } from 'solid-js/store';
import { createContext, ParentComponent, useContext, createEffect, onMount } from 'solid-js';
import { getAiChatResponseStream } from '../../services/llm/llmChatService';
import type { LLMConfig, StreamedChatResponsePart } from '../../services/llm/types';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BackgroundProtocolMap, NewChatThreadDataForRpc } from '../../shared/messaging-types';
import type { Thread, ChatMessage } from './types';
import type { UserConfiguration } from '../../services/storage/types';
import type { LLMProviderId } from '../../services/llm/types';
import { generateElevenLabsSpeechWithTimestamps } from '../../services/tts/elevenLabsService';
import type { WordInfo } from './types';
import { DEFAULT_ELEVENLABS_MODEL_ID, DEFAULT_ELEVENLABS_VOICE_ID } from '../../shared/constants';
import { transcribeElevenLabsAudio } from '../../services/stt/elevenLabsSttService';

// RPC client for background storage
const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

// Default threads to seed
const JUST_CHAT_THREAD_ID = '__just_chat_speech_mode__';
const defaultIntroThread: NewChatThreadDataForRpc = {
  id: 'thread-welcome-introductions',
  title: 'Introductions',
  systemPrompt: "I'm Scarlett, your friendly AI language companion. I'd love to get to know you a bit! Tell me about yourself - what are your interests, what languages are you learning, or anything else you'd like to share?"
};
const defaultSharingThread: NewChatThreadDataForRpc = {
  id: 'thread-welcome-sharing',
  title: 'Sharing Thoughts',
  systemPrompt: "It's great to connect on a deeper level. As an AI, I have a unique perspective. I can share some 'AI thoughts' or how I learn if you're curious, and I'm always here to listen to yours. What's on your mind, or what would you like to ask me?"
};
const defaultJustChatThread: NewChatThreadDataForRpc = {
  id: JUST_CHAT_THREAD_ID,
  title: 'Just Chat (Speech)',
  systemPrompt: 'You are a friendly AI assistant for voice chat. Keep responses concise for speech.'
};

export interface ChatState {
  threads: Thread[];
  currentThreadId: string | null;
  messages: ChatMessage[];
  userInput: string;
  isSpeechMode: boolean;
  isLoading: boolean;
  isVADListening: boolean;
  lastError: string | null;
  currentSpokenMessageId: string | null;
  currentHighlightIndex: number | null;
  isGlobalTTSSpeaking: boolean;
  animationFrameId: number | null;
  pendingThreadId: string | null;
}

export interface ChatActions {
  loadThreads: () => Promise<void>;
  selectThread: (id: string) => Promise<void>;
  sendText: () => Promise<void>;
  setInput: (text: string) => void;
  toggleSpeech: () => void;
  startVAD: () => void;
  stopVAD: () => void;
  playTTS: (params: { messageId: string; text: string; lang: string; speed?: number }) => Promise<void>;
  createNewThread: () => Promise<void>;
}

// Props for ChatProvider now include userConfig
export interface ChatProviderProps { initialUserConfig: UserConfiguration; }

// Default empty state and no-op actions for context fallback
const defaultState: ChatState = {
  threads: [],
  currentThreadId: null,
  messages: [],
  userInput: '',
  isSpeechMode: false,
  isLoading: false,
  isVADListening: false,
  lastError: null,
  currentSpokenMessageId: null,
  currentHighlightIndex: null,
  isGlobalTTSSpeaking: false,
  animationFrameId: null,
  pendingThreadId: null,
};
const defaultActions: ChatActions = {
  loadThreads: async () => {},
  selectThread: async () => {},
  sendText: async () => {},
  setInput: () => {},
  toggleSpeech: () => {},
  startVAD: () => {},
  stopVAD: () => {},
  playTTS: async (_params) => {},
  createNewThread: async () => {},
};
// @ts-ignore: suppress createContext overload mismatch
const ChatContext = createContext<[ChatState, ChatActions]>([defaultState, defaultActions]);

export const ChatProvider: ParentComponent<ChatProviderProps> = (props) => {
  const [state, setState] = createStore<ChatState>({
    threads: [],
    currentThreadId: null,
    messages: [],
    userInput: '',
    isSpeechMode: false,
    isLoading: false,
    isVADListening: false,
    lastError: null,
    currentSpokenMessageId: null,
    currentHighlightIndex: null,
    isGlobalTTSSpeaking: false,
    animationFrameId: null,
    pendingThreadId: null,
  });

  // VAD recorder and buffer
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];

  const actions: ChatActions = {
    async loadThreads() {
      console.log('[chatStore] loadThreads called');
      try {
        let threads = await messaging.sendMessage('getAllChatThreads', undefined);
        console.log('[chatStore] fetched threads:', threads);
        // seed defaults if empty
        if (!threads || threads.length === 0) {
          console.log('[chatStore] no threads found, seeding defaults');
          const created = await Promise.all([
            defaultIntroThread,
            defaultSharingThread,
            defaultJustChatThread
          ].map(d => messaging.sendMessage('addChatThread', d)));
          console.log('[chatStore] default threads created:', created);
          threads = (created.filter(Boolean) as any);
          // seed systemPrompts
          for (const th of threads) {
            console.log('[chatStore] seeding message for thread', th.id);
            if ((th as any).systemPrompt) {
              await messaging.sendMessage('addChatMessage', {
                id: `msg-ai-seed-${th.id}-${Date.now()}`,
                thread_id: th.id,
                sender: 'ai',
                text_content: (th as any).systemPrompt
              });
            }
          }
        }
        console.log('[chatStore] final thread list:', threads);
        setState('threads', threads || []);
        // select first non-just-chat as primary, else first
        if (threads && threads.length > 0) {
          console.log('[chatStore] selecting initial thread');
          const primary = threads.find((t: any) => t.id !== JUST_CHAT_THREAD_ID) || threads[0];
          await actions.selectThread(primary.id);
        }
      } catch (e: any) {
        setState('lastError', e.message || String(e));
      }
    },

    async selectThread(id) {
      console.log('[chatStore] selectThread called, id=', id);
      setState({ currentThreadId: id, isLoading: true, lastError: null });
      try {
        const msgs: ChatMessage[] = await messaging.sendMessage('getChatMessages', { threadId: id });
        console.log('[chatStore] fetched messages for', id, msgs);
        setState({ messages: msgs || [] });
      } catch (e: any) {
        setState('lastError', e.message || String(e));
      } finally {
        setState('isLoading', false);
      }
    },

    async sendText() {
      console.log('[chatStore] sendText called, userInput=', state.userInput);
      const text = state.userInput.trim();
      if (!text || !state.currentThreadId) return;
      setState('isLoading', true);
      setState('lastError', null);

      const userMsg: ChatMessage = {
        id: `${state.currentThreadId}-user-${Date.now()}`,
        thread_id: state.currentThreadId,
        sender: 'user',
        text_content: text,
        timestamp: new Date().toISOString(),
      };
      const aiPlaceholder: ChatMessage = {
        id: `${state.currentThreadId}-ai-${Date.now()}`,
        thread_id: state.currentThreadId,
        sender: 'ai',
        text_content: '',
        timestamp: new Date().toISOString(),
        tts_lang: props.initialUserConfig.targetLanguage || 'en',
        isStreaming: true
      };
      // Capture placeholder metadata for later persistence
      const placeholderId = aiPlaceholder.id;
      const placeholderTs = aiPlaceholder.timestamp;
      setState('messages', msgs => {
        console.log('[chatStore] appending user and placeholder', userMsg, aiPlaceholder);
        return [...msgs, userMsg, aiPlaceholder];
      });
      // Persist the user's message
      try {
        await messaging.sendMessage('addChatMessage', userMsg);
      } catch (e: any) {
        console.error('[chatStore] failed to persist user message', e);
      }

      // Buffer for AI response
      let full = '';
      try {
        // build LLMConfig from user-provided configuration
        const fc = props.initialUserConfig.llmConfig;
        if (!fc) {
          setState('lastError', 'LLM not configured in settings');
          return;
        }
        const llmConfig: LLMConfig = {
          provider: fc.providerId as LLMProviderId,
          model: fc.modelId,
          baseUrl: fc.baseUrl || '',
          apiKey: fc.apiKey || undefined,
          stream: true
        };
        // Map our ChatMessage type to LLM ChatMessage format
        const historyForLLM = state.messages.map(m => ({
          role: m.sender === 'ai' ? 'assistant' : 'user',
          content: m.text_content
        }));
        console.log('[chatStore] historyForLLM:', historyForLLM);
        const stream = getAiChatResponseStream(
          historyForLLM as any,
          text,
          llmConfig,
          {}
        ) as AsyncGenerator<StreamedChatResponsePart>;
        for await (const part of stream) {
          console.log('[chatStore] received stream part', part);
          if (part.type === 'content') {
            // Clear streaming flag on first content part
            const idx = state.messages.findIndex(m => m.id === placeholderId);
            if (idx >= 0) {
              setState('messages', idx, 'isStreaming', false);
            }
            full += part.content;
          } else if (part.type === 'error') {
            setState('lastError', part.error);
            break;
          }
          // Patch the last AI message text via path-based setter
          const lastIndex = state.messages.length - 1;
          if (lastIndex >= 0) {
            setState('messages', lastIndex, 'text_content', full);
          }
          console.log('[chatStore] updated AI message to', full);
        }
      } catch (e: any) {
        setState('lastError', e.message || String(e));
      } finally {
        // Persist the AI's completed response (DB will timestamp)
        try {
          await messaging.sendMessage('addChatMessage', {
            id: placeholderId,
            thread_id: aiPlaceholder.thread_id,
            sender: aiPlaceholder.sender,
            text_content: full,
            tts_lang: aiPlaceholder.tts_lang
          });
        } catch (e: any) {
          console.error('[chatStore] failed to persist AI message', e);
        }
        // Ensure streaming flag is cleared after streaming completes
        {
          const idx = state.messages.findIndex(m => m.id === placeholderId);
          if (idx >= 0) {
            setState('messages', idx, 'isStreaming', false);
          }
        }
        setState({ isLoading: false, userInput: '' });
        console.log('[chatStore] sendText complete');
        // After first message in a new thread, auto-generate a title summary
        if (state.pendingThreadId === state.currentThreadId) {
          try {
            const fc2 = props.initialUserConfig.llmConfig;
            if (fc2) {
              const llmConfig2: LLMConfig = {
                provider: fc2.providerId as LLMProviderId,
                model: fc2.modelId,
                baseUrl: fc2.baseUrl || '',
                apiKey: fc2.apiKey || undefined,
                stream: true
              };
              const summaryPrompt = 'Summarize this conversation in 3–4 words.';
              const historyForLLM2 = state.messages.map(m => ({
                role: m.sender === 'ai' ? 'assistant' : 'user',
                content: m.text_content
              }));
              const summaryStream = getAiChatResponseStream(historyForLLM2 as any, summaryPrompt, llmConfig2, {}) as AsyncGenerator<StreamedChatResponsePart>;
              let summary = '';
              for await (const part2 of summaryStream) {
                if (part2.type === 'content') summary += part2.content;
              }
              const trimmed = summary.trim();
              await messaging.sendMessage('updateChatThreadTitle', { threadId: state.pendingThreadId, newTitle: trimmed });
              setState('threads', ts => ts.map(t => t.id === state.pendingThreadId ? { ...t, title: trimmed } : t));
            }
          } catch (e) {
            console.error('[chatStore] thread summarization failed', e);
          } finally {
            setState('pendingThreadId', null);
          }
        }
      }
    },

    setInput(text) {
      setState('userInput', text);
    },

    toggleSpeech() {
      setState('isSpeechMode', mode => !mode);
    },

    startVAD() {
      console.log('[chatStore] startVAD called');
      setState('isVADListening', true);
      // Begin capturing audio via MediaRecorder
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];
          mediaRecorder.ondataavailable = e => { audioChunks.push(e.data); };
          mediaRecorder.start();
          // Auto-stop after fixed interval (e.g., 5 seconds) if user doesn't click stop
          setTimeout(() => {
            if (mediaRecorder && state.isVADListening) {
              console.log('[chatStore] Auto-stopping VAD after timeout');
              actions.stopVAD();
            }
          }, 5000);
        })
        .catch(e => {
          console.error('[chatStore] Unable to start audio capture', e);
          setState('lastError', 'Microphone access denied.');
          setState('isVADListening', false);
        });
    },

    async stopVAD() {
      console.log('[chatStore] stopVAD called');
      setState('isVADListening', false);
      if (mediaRecorder) {
        mediaRecorder.onstop = async () => {
          const blob = new Blob(audioChunks, { type: audioChunks[0]?.type || 'audio/webm' });
          // Transcribe blob to text
          const apiKey = props.initialUserConfig.ttsConfig?.apiKey || props.initialUserConfig.elevenLabsApiKey;
          if (!apiKey) {
            console.warn('[chatStore] STT API key not configured');
            setState('lastError', 'Speech-to-text API key is missing. Please configure it in Settings.');
            return;
          }
          try {
            const result = await transcribeElevenLabsAudio(apiKey, blob);
            // Populate input and send as text
            setState('userInput', result.text);
            await actions.sendText();
          } catch (e: any) {
            console.error('[chatStore] STT error', e);
            setState('lastError', e.message || String(e));
          }
        };
        mediaRecorder.stop();
      } else {
        console.warn('[chatStore] stopVAD called but recorder not initialized');
      }
    },

    async playTTS({ messageId, text, lang, speed }) {
      console.log('[chatStore] playTTS called for', messageId, 'speed:', speed);
      const idx = state.messages.findIndex(m => m.id === messageId);
      if (idx < 0) return;

      // Stop any existing playback and clear its animation frame
      const existingAudio = state.messages.find(m => m.audioObject)?.audioObject;
      if (existingAudio) {
        existingAudio.pause();
      }
      if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
        setState('animationFrameId', null);
      }

      try {
        setState({ currentSpokenMessageId: messageId, isGlobalTTSSpeaking: true, currentHighlightIndex: null });
        // Generate full audio blob with timestamps for highlighting
        const apiKey = props.initialUserConfig.ttsConfig?.apiKey || props.initialUserConfig.elevenLabsApiKey || '';
        const modelId = props.initialUserConfig.ttsConfig?.modelId || DEFAULT_ELEVENLABS_MODEL_ID;
        const voiceId = props.initialUserConfig.elevenLabsVoiceId ?? DEFAULT_ELEVENLABS_VOICE_ID;
        const resp = await generateElevenLabsSpeechWithTimestamps(
          apiKey,
          text,
          modelId,
          voiceId,
          undefined,
          speed,
          lang
        );
        const { audioBlob, alignmentData } = resp;
        const wordInfos: WordInfo[] = alignmentData
          ? alignmentData.characters.map((char, i) => ({ word: char, start: alignmentData.character_start_times_seconds[i] || 0, end: alignmentData.character_end_times_seconds[i] || 0, index: i }))
          : [];
        setState('messages', idx, 'ttsWordMap', wordInfos);
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);

        // Store audio object on message for potential later control if needed (optional)
        setState('messages', idx, 'audioObject', audio);

        const updateHighlightLoop = () => {
          if (!audio || audio.paused || audio.ended) {
            if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
            setState('animationFrameId', null);
            return;
          }

          const currentTime = audio.currentTime;
          let highlightIdx: number | null = null;
          for (const charInfo of wordInfos) {
            if (currentTime >= charInfo.start && currentTime < charInfo.end) {
              highlightIdx = charInfo.index;
              break;
            }
          }
          if (state.currentHighlightIndex !== highlightIdx) {
            setState('currentHighlightIndex', highlightIdx);
          }
          setState('animationFrameId', requestAnimationFrame(updateHighlightLoop));
        };

        audio.onplay = () => {
          console.log('[chatStore] Audio onplay');
          if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
          setState('animationFrameId', requestAnimationFrame(updateHighlightLoop));
        };

        audio.onpause = () => {
          console.log('[chatStore] Audio onpause');
          if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
          setState('animationFrameId', null);
        };

        audio.onended = () => {
          console.log('[chatStore] Audio onended');
          if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
          setState({ isGlobalTTSSpeaking: false, currentSpokenMessageId: null, currentHighlightIndex: null, animationFrameId: null });
        };

        audio.play().catch(e => {
          console.error('[chatStore] Audio play error', e);
          setState('lastError', 'Failed to play TTS audio.');
        });

      } catch (e: any) {
        console.error('[chatStore] TTS error', e);
        setState('lastError', e.message || String(e));
        // Ensure cleanup if there was an error during TTS setup
        if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
        setState({
          isGlobalTTSSpeaking: false, 
          currentSpokenMessageId: null, 
          currentHighlightIndex: null,
          animationFrameId: null
        });
      }
    },

    async createNewThread() {
      // 1) Create empty thread and mark as pending
      const newId = crypto.randomUUID();
      const placeholderTitle = 'New Thread';
      const newThread = await messaging.sendMessage('addChatThread', { id: newId, title: placeholderTitle });
      setState('threads', ts => [newThread, ...ts]);
      setState('pendingThreadId', newId);
      // 2) Switch into the new thread
      await this.selectThread(newId);
    }
  };

  onMount(() => {
    actions.loadThreads();
  });

  return (
    <ChatContext.Provider value={[state, actions]}>
      {props.children}
    </ChatContext.Provider>
  );
};

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
} 