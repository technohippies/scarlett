import { createStore } from 'solid-js/store';
import { createContext, ParentComponent, useContext, onMount } from 'solid-js';
import { getAiChatResponseStream } from '../../services/llm/llmChatService';
import type { LLMConfig, StreamedChatResponsePart } from '../../services/llm/types';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BackgroundProtocolMap, NewChatThreadDataForRpc } from '../../shared/messaging-types';
import type { Thread, ChatMessage } from './types';
import type { LLMProviderId } from '../../services/llm/types';
import { generateElevenLabsSpeechWithTimestamps } from '../../services/tts/elevenLabsService';
import type { WordInfo } from './types';
import { DEFAULT_ELEVENLABS_MODEL_ID, DEFAULT_ELEVENLABS_VOICE_ID } from '../../shared/constants';
import { lookup } from '../../shared/languages';
import { transcribeElevenLabsAudio } from '../../services/stt/elevenLabsSttService';
import { generateRoleplayScenariosLLM } from '../../services/llm/llmChatService';
import { getEmbedding, type EmbeddingResult } from '../../services/llm/embedding';
import { trackMilestone } from '../../utils/analytics';
import { isPersonalityEmbedded } from '../../services/llm/personalityService';
import { useSettings } from '../../context/SettingsContext';

// RPC client for background storage
const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

// Default AI seed messages for initial threads (not stored in DB system_prompt)
const defaultIntroPrompt = "I'm Scarlett, your friendly AI language companion. I'd love to get to know you a bit! Tell me about yourself - what are your interests, what languages are you learning, or anything else you'd like to share?";
const defaultSharingPrompt = "It's great to connect on a deeper level. As an AI, I have a unique perspective. I can share some 'AI thoughts' or how I learn if you're curious, and I'm always here to listen to yours. What's on your mind, or what would you like to ask me?";

// Default threads to seed
const defaultIntroThread: NewChatThreadDataForRpc = {
  id: 'thread-welcome-introductions',
  title: 'Introductions',
  systemPrompt: ''
};
const defaultSharingThread: NewChatThreadDataForRpc = {
  id: 'thread-welcome-sharing',
  title: 'Sharing Thoughts',
  systemPrompt: ''
};
const defaultJustChatThread: NewChatThreadDataForRpc = {
  id: 'thread-just-chat',
  title: 'Just Chat',
  systemPrompt: ''
};

export interface ChatState {
  threads: Thread[];
  currentThreadId: string | null;
  messages: ChatMessage[];
  userInput: string;
  isSpeechMode: boolean;
  isLoading: boolean;
  isRoleplayLoading: boolean;
  isVADListening: boolean;
  lastError: string | null;
  currentSpokenMessageId: string | null;
  currentHighlightIndex: number | null;
  isGlobalTTSSpeaking: boolean;
  animationFrameId: number | null;
  pendingThreadId: string | null;
  audioLevel: number;
  personalityEmbedded: boolean | null; // null = checking, true/false = result
  showPersonalityWarning: boolean;
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
  generateRoleplay: (topicHint?: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  checkPersonalityEmbedding: () => Promise<void>;
  dismissPersonalityWarning: () => void;
}

// Props for ChatProvider - no longer needs initialUserConfig
export interface ChatProviderProps { }

// Default empty state and no-op actions for context fallback
const defaultState: ChatState = {
  threads: [],
  currentThreadId: null,
  messages: [],
  userInput: '',
  isSpeechMode: false,
  isLoading: false,
  isRoleplayLoading: false,
  isVADListening: false,
  lastError: null,
  currentSpokenMessageId: null,
  currentHighlightIndex: null,
  isGlobalTTSSpeaking: false,
  animationFrameId: null,
  pendingThreadId: null,
  audioLevel: 0,
  personalityEmbedded: null,
  showPersonalityWarning: false,
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
  generateRoleplay: async (_topicHint) => {},
  deleteThread: async (_threadId) => {},
  checkPersonalityEmbedding: async () => {},
  dismissPersonalityWarning: () => {},
};
// @ts-ignore: suppress createContext overload mismatch
const ChatContext = createContext<[ChatState, ChatActions]>([defaultState, defaultActions]);

export const ChatProvider: ParentComponent<ChatProviderProps> = (props) => {
  const settings = useSettings(); // Use SettingsContext instead of props
  const [state, setState] = createStore<ChatState>({
    threads: [],
    currentThreadId: null,
    messages: [],
    userInput: '',
    isSpeechMode: false,
    isLoading: false,
    isRoleplayLoading: false,
    isVADListening: false,
    lastError: null,
    currentSpokenMessageId: null,
    currentHighlightIndex: null,
    isGlobalTTSSpeaking: false,
    animationFrameId: null,
    pendingThreadId: null,
    audioLevel: 0,
    personalityEmbedded: null,
    showPersonalityWarning: false,
  });

  // VAD recorder, stream and buffer
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let audioChunks: Blob[] = [];

  const actions: ChatActions = {
    async loadThreads() {
      console.log('[chatStore] loadThreads called');
      try {
        let threads = await messaging.sendMessage('getAllChatThreads', undefined);
        console.log('[chatStore] fetched threads:', threads);
        if (!threads || threads.length === 0) {
          console.log('[chatStore] no threads found, seeding defaults');
          // Create threads with empty systemPrompt, then seed AI messages separately
          const created = await Promise.all([
            defaultIntroThread,
            defaultSharingThread,
            defaultJustChatThread
          ].map(d => messaging.sendMessage('addChatThread', d)));
          console.log('[chatStore] default threads created:', created);
          threads = (created.filter(Boolean) as any);
          // seed AI messages for intro and sharing only
          for (const th of threads) {
            let seedText: string | undefined;
            if (th.id === defaultIntroThread.id) seedText = defaultIntroPrompt;
            else if (th.id === defaultSharingThread.id) seedText = defaultSharingPrompt;
            if (seedText) {
              console.log('[chatStore] seeding AI message for thread', th.id);
              await messaging.sendMessage('addChatMessage', {
                id: `msg-ai-seed-${th.id}-${Date.now()}`,
                thread_id: th.id,
                sender: 'ai',
                text_content: seedText
              });
            }
          }
        }
        console.log('[chatStore] final thread list:', threads);
        setState('threads', threads || []);
        // select first thread as primary
        if (threads && threads.length > 0) {
          console.log('[chatStore] selecting initial thread');
          const primary = threads[0];
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
      if (!state.userInput.trim() || !state.currentThreadId) return;
      setState({ isLoading: true, lastError: null });
      const text = state.userInput.trim();
      
      // Clear the input immediately after capturing the text
      setState('userInput', '');
      
              // Generate embedding for user message if embedding is configured
        let userEmbeddingResult: EmbeddingResult | null = null;
        const embeddingConfig = settings.config.embeddingConfig;
        if (embeddingConfig) {
          try {
            userEmbeddingResult = await getEmbedding(text, embeddingConfig);
          } catch (error) {
            console.error('[chatStore] Failed to generate user message embedding:', error);
            // Continue without embedding - don't block the chat
          }
        }

      const userMsg: ChatMessage = {
        id: `${state.currentThreadId}-user-${Date.now()}`,
        thread_id: state.currentThreadId,
        sender: 'user',
        text_content: text,
        timestamp: new Date().toISOString(),
        // Add embedding data if available
        ...(userEmbeddingResult && {
          [`embedding_${userEmbeddingResult.dimension}`]: userEmbeddingResult.embedding,
          active_embedding_dimension: userEmbeddingResult.dimension as 512 | 768 | 1024
        })
      };
      const aiPlaceholder: ChatMessage = {
        id: `${state.currentThreadId}-ai-${Date.now()}`,
        thread_id: state.currentThreadId,
        sender: 'ai',
        text_content: '',
        timestamp: new Date().toISOString(),
        tts_lang: settings.config.targetLanguage || 'en',
        isStreaming: true
      };
      // Capture placeholder metadata for later persistence
      const placeholderId = aiPlaceholder.id;
      setState('messages', msgs => {
        console.log('[chatStore] appending user and placeholder', userMsg, aiPlaceholder);
        return [...msgs, userMsg, aiPlaceholder];
      });
      // Persist the user's message
      try {
        await messaging.sendMessage('addChatMessage', userMsg);
        
        // Track first chat message milestone (only once)
        const isFirstMessage = state.messages.length === 0; // No previous messages in this thread
        if (isFirstMessage) {
          trackMilestone.firstChatMessage();
        }
      } catch (e: any) {
        console.error('[chatStore] failed to persist user message', e);
      }

      // Buffer for AI response
      let full = '';
      // Determine user's target language code and spacing behavior outside of try/finally
      const targetCode = settings.config.targetLanguage ?? '';
      const collapseLangs = ['zh','ja','ko'];
      try {
        // build LLMConfig from user-provided configuration
        const fc = settings.config.llmConfig;
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
        // Dynamically instruct LLM to omit any romanization or pronunciation guides for the target language
        const langLabel = lookup(targetCode).fullName || targetCode || 'foreign language';
        const noRomanPrompt = `When including ${langLabel} text in your responses, do NOT include any romanization, phonetic transcriptions, or translations.`;
        const stream = getAiChatResponseStream(
          historyForLLM as any,
          text,
          llmConfig,
          { threadSystemPrompt: noRomanPrompt }
        ) as AsyncGenerator<StreamedChatResponsePart>;
        for await (const part of stream) {
          if (part.type === 'content') {
            full += part.content;
          } else if (part.type === 'error') {
            setState('lastError', part.error);
            break;
          }
          // Patch the last AI message text via path-based setter
          const lastIndex = state.messages.length - 1;
          if (lastIndex >= 0) {
            // Remove any parentheses content (e.g., Pinyin)
            let filtered = full.replace(/\s*\([^)]*\)/g, '');
            // If target language uses no inter-word spacing, collapse spaces only between CJK characters
            if (collapseLangs.includes(targetCode)) {
              filtered = filtered.replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])\s+([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])/gu, '$1$2');
            }
            setState('messages', lastIndex, 'text_content', filtered);
          }
        }
      } catch (e: any) {
        setState('lastError', e.message || String(e));
      } finally {
        // Strip parentheses and collapse for certain scripts
        full = full.replace(/\s*\([^)]*\)/g, '').trim();
        if (collapseLangs.includes(targetCode)) {
          full = full.replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])\s+([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])/gu, '$1$2');
        }
        // Update the displayed AI message to the cleaned text
        const cleanIdx = state.messages.findIndex(m => m.id === placeholderId);
        if (cleanIdx >= 0) {
          setState('messages', cleanIdx, 'text_content', full);
        }
        
        // Generate embedding for AI message if embedding is configured
        let aiEmbeddingResult: EmbeddingResult | null = null;
        if (embeddingConfig && full.trim()) {
          try {
            aiEmbeddingResult = await getEmbedding(full, embeddingConfig);
          } catch (error) {
            console.error('[chatStore] Failed to generate AI message embedding:', error);
            // Continue without embedding - don't block the chat
          }
        }
        
        // Persist the AI's completed response (DB will timestamp)
        try {
          const aiMessageToSave: ChatMessage = {
            id: placeholderId,
            thread_id: aiPlaceholder.thread_id,
            sender: aiPlaceholder.sender,
            text_content: full,
            tts_lang: aiPlaceholder.tts_lang,
            // Add embedding data if available
            ...(aiEmbeddingResult && {
              [`embedding_${aiEmbeddingResult.dimension}`]: aiEmbeddingResult.embedding,
              active_embedding_dimension: aiEmbeddingResult.dimension as 512 | 768 | 1024
            })
          };
          await messaging.sendMessage('addChatMessage', aiMessageToSave);
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
        setState({ isLoading: false });
        console.log('[chatStore] sendText complete');
        // If speech mode is active, play TTS for AI response
        if (state.isSpeechMode) {
          console.log('[chatStore] Speech mode active: auto-playing TTS');
          // Use placeholderId and full for playTTS
          actions.playTTS({ messageId: placeholderId, text: full, lang: settings.config.targetLanguage || 'en' });
        }
        // After first message in a new thread, auto-generate a title summary
        if (state.pendingThreadId === state.currentThreadId) {
          try {
            const fc2 = settings.config.llmConfig;
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
      // Toggle speech mode; if turning off, immediately stop VAD
      const newMode = !state.isSpeechMode;
      if (!newMode) {
        console.log('[chatStore] toggleSpeech: speech mode off, stopping VAD');
        actions.stopVAD();
      }
      setState('isSpeechMode', newMode);
    },

    startVAD() {
      console.log('[chatStore] startVAD called');
      setState('isVADListening', true);
      // Begin capturing audio via MediaRecorder
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          // retain stream for later cleanup
          mediaStream = stream;
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];
          mediaRecorder.ondataavailable = e => { audioChunks.push(e.data); };
          mediaRecorder.start();
          // Auto-stop after fixed interval (e.g., 5 seconds)
          setTimeout(() => {
            if (mediaRecorder && state.isVADListening) {
              console.log('[chatStore] Auto-stopping VAD after timeout');
              actions.stopVAD();
            }
          }, 5000);
          
          // Track first VAD usage (fire and forget)
          trackMilestone.firstVADUsage();
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
          // Only process transcription if speech mode is still active
          if (!state.isSpeechMode) {
            console.log('[chatStore] onstop: speech mode off, skipping transcription');
            return;
          }
          const blob = new Blob(audioChunks, { type: audioChunks[0]?.type || 'audio/webm' });
          // Transcribe blob to text
          const apiKey = settings.config.ttsConfig?.apiKey || settings.config.elevenLabsApiKey;
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
        // Fully release microphone stream
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }
        // Clear recorder and buffers
        mediaRecorder = null;
        audioChunks = [];
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
        const apiKey = settings.config.ttsConfig?.apiKey || settings.config.elevenLabsApiKey || '';
        const modelId = settings.config.ttsConfig?.modelId || DEFAULT_ELEVENLABS_MODEL_ID;
        const voiceId = settings.config.elevenLabsVoiceId ?? DEFAULT_ELEVENLABS_VOICE_ID;
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
        // Build character-level WordInfo array over the full text, preserving spaces
        let wordInfos: WordInfo[] = [];
        if (alignmentData && Array.isArray(alignmentData.characters) && alignmentData.characters.length > 0) {
          const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignmentData;
          let alignIdx = 0;
          // Iterate each char in the original text
          for (let i = 0; i < text.length; i++) {
            const char = text.charAt(i);
            if (alignIdx < characters.length && characters[alignIdx] === char) {
              wordInfos.push({ word: char, start: starts[alignIdx] || 0, end: ends[alignIdx] || 0, index: i });
              alignIdx++;
            } else {
              // whitespace or unmatched char: preserve with previous timestamp
              const prevEnd = wordInfos.length > 0 ? wordInfos[wordInfos.length - 1].end : 0;
              wordInfos.push({ word: char, start: prevEnd, end: prevEnd, index: i });
            }
          }
        } else {
          // Fallback: split full text by character (including spaces)
          for (let i = 0; i < text.length; i++) {
            wordInfos.push({ word: text.charAt(i), start: 0, end: 0, index: i });
          }
        }
        setState('messages', idx, 'ttsWordMap', wordInfos);
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);

        // Store audio object on message for potential later control if needed (optional)
        setState('messages', idx, 'audioObject', audio);

        // Setup Web Audio API to analyze TTS output
        const audioCtx = new AudioContext();
        const sourceNode = audioCtx.createMediaElementSource(audio);
        const analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 32;
        sourceNode.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        const updateAudioLevel = () => {
          analyserNode.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const avg = sum / dataArray.length / 255;
          setState('audioLevel', avg);
          if (!audio.paused && !audio.ended) {
            requestAnimationFrame(updateAudioLevel);
          }
        };

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
          audioCtx.resume().then(() => updateAudioLevel());
          
          // Track first TTS usage (fire and forget)
          trackMilestone.firstTTSUsage();
        };

        audio.onpause = () => {
          console.log('[chatStore] Audio onpause');
          if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
          setState({ animationFrameId: null, audioLevel: 0 });
        };

        audio.onended = () => {
          console.log('[chatStore] Audio onended');
          if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
          setState({ isGlobalTTSSpeaking: false, currentSpokenMessageId: null, currentHighlightIndex: null, animationFrameId: null, audioLevel: 0 });
          sourceNode.disconnect(); analyserNode.disconnect(); audioCtx.close();
          // Auto-restart VAD if still in speech mode
          if (state.isSpeechMode) {
            console.log('[chatStore] TTS ended, restarting VAD');
            actions.startVAD();
          }
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
          animationFrameId: null,
          audioLevel: 0
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
      await actions.selectThread(newId);
    },

    async generateRoleplay(topicHint = '') {
      console.log('[chatStore] generateRoleplay called. Setting isRoleplayLoading to true.');
      setState('isRoleplayLoading', true);
      setState('lastError', null);
      try {
        // Determine target language name
        const code = settings.config.targetLanguage || 'en';
        const langName = lookup(code).fullName || code;
        // Generate scenario via LLM service
        const [scenario] = await generateRoleplayScenariosLLM(langName, topicHint);
        // Create new thread with title and description
        const newId = crypto.randomUUID();
        const newThread = await messaging.sendMessage('addChatThread', {
          id: newId,
          title: scenario.title,
          systemPrompt: '',
          scenarioDescription: scenario.description
        });
        // Seed the AI opening line
        await messaging.sendMessage('addChatMessage', {
          id: `${newId}-ai-opening`,
          thread_id: newId,
          sender: 'ai',
          text_content: scenario.ai_opening_line
        });
        // Update local state and switch to new thread
        setState('threads', ts => [newThread, ...ts]);
        await actions.selectThread(newId);
        
        // Track roleplay generation
        trackMilestone.roleplayGenerated();
      } catch (e: any) {
        setState('lastError', e.message || String(e));
      } finally {
        console.log('[chatStore] generateRoleplay finished. Setting isRoleplayLoading to false.');
        setState('isRoleplayLoading', false);
      }
    },

    async deleteThread(threadId) {
      console.log('[chatStore] deleteThread called, id=', threadId);
      setState({ isLoading: true, lastError: null });
      try {
        await messaging.sendMessage('deleteChatThread', { threadId });
        setState('threads', ts => ts.filter(t => t.id !== threadId));
        
        // If the deleted thread was the current one, select another thread or clear selection
        if (state.currentThreadId === threadId) {
          const remainingThreads = state.threads.filter(t => t.id !== threadId);
          if (remainingThreads.length > 0) {
            // Select the first remaining thread
            await actions.selectThread(remainingThreads[0].id);
          } else {
            // No threads left, clear selection and messages
            setState({ currentThreadId: null, messages: [] });
          }
        }
      } catch (e: any) {
        setState('lastError', e.message || String(e));
      } finally {
        setState('isLoading', false);
      }
    },

    async checkPersonalityEmbedding() {
      console.log('[chatStore] Checking personality embedding status...');
      try {
        const isEmbedded = await isPersonalityEmbedded();
        setState('personalityEmbedded', isEmbedded);
        
        // Show warning if personality is not embedded and user has embedding config
        if (!isEmbedded && settings.config.embeddingConfig) {
          setState('showPersonalityWarning', true);
          console.log('[chatStore] Personality not embedded - showing warning');
        } else {
          setState('showPersonalityWarning', false);
        }
      } catch (error) {
        console.error('[chatStore] Failed to check personality embedding:', error);
        setState('personalityEmbedded', false);
        setState('showPersonalityWarning', false);
      }
    },

    dismissPersonalityWarning() {
      setState('showPersonalityWarning', false);
    }
  };

  onMount(() => {
    actions.loadThreads();
    actions.checkPersonalityEmbedding(); // Check personality embedding status on mount
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