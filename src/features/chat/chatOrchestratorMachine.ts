import { setup, assign, ActorRefFrom, StateFrom, AnyEventObject, DoneActorEvent, ErrorActorEvent, fromPromise, fromCallback } from 'xstate';
import type { ChatMessage, Thread } from './types';
import type { UserConfiguration } from '../../services/storage/types';
import { getAiChatResponseStream } from '../../services/llm/llmChatService';
import { generateElevenLabsSpeechStream, generateElevenLabsSpeechWithTimestamps } from '../../services/tts/elevenLabsService';
import { transcribeElevenLabsAudio } from '../../services/stt/elevenLabsSttService';
import { ELEVENLABS_API_BASE_URL, DEFAULT_ELEVENLABS_VOICE_ID, DEFAULT_ELEVENLABS_MODEL_ID } from '../../shared/constants';

// External actionsDefinition and services objects are removed as they are now defined within setup.

export interface ChatOrchestratorContext {
  userConfig: UserConfiguration | null;
  currentThreadId: string | null;
  currentChatMessages: ChatMessage[];
  isSpeechModeActive: boolean;
  userInput: string;
  audioBlob?: Blob | null;
  aiResponse: string;
  vadInstance: any | null;
  isVADListening: boolean;
  sttError: string | null;
  llmError: string | null;
  ttsError: string | null;
  vadError: string | null;
  lastError: string | null;
  threads: Thread[];
}

export type ChatOrchestratorEvent =
  | { type: 'TOGGLE_INPUT_MODE' }
  | { type: 'TEXT_INPUT_CHANGE'; text: string }
  | { type: 'SEND_TEXT_MESSAGE'; text: string }
  | { type: 'ACTIVATE_SPEECH_MODE' }
  | DoneActorEvent<{ vadInstance: any }, 'initializeVAD'>
  | ErrorActorEvent<any, 'initializeVAD'>
  | DoneActorEvent<void, 'startVADRecording'>
  | ErrorActorEvent<any, 'startVADRecording'>
  | DoneActorEvent<void, 'stopVADRecording'>
  | ErrorActorEvent<any, 'stopVADRecording'>
  | { type: 'VAD_INITIALIZED'; data: { vadInstance: any } }
  | { type: 'VAD_INIT_ERROR'; data: any }
  | { type: 'VAD_SPEECH_DETECTED' }
  | { type: 'VAD_SPEECH_ENDED'; audioData: any }
  | { type: 'VAD_ERROR'; data: any }
  | { type: 'CANCEL_SPEECH_INPUT' }
  | DoneActorEvent<{ transcript: string }, 'transcribeAudio'>
  | ErrorActorEvent<any, 'transcribeAudio'>
  | DoneActorEvent<{ aiResponse: string }, 'invokeLLM'>
  | ErrorActorEvent<any, 'invokeLLM'>
  | DoneActorEvent<boolean, 'playTTS'>
  | ErrorActorEvent<any, 'playTTS'>
  | { type: 'LLM_TOKEN'; token: string }
  | { type: 'LLM_DONE' }
  | { type: 'TTS_CHUNK'; chunk: Uint8Array }
  | { type: 'TTS_DONE' }
  | { type: 'RETRY' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SYNC_INITIAL_DATA'; threads: Thread[]; currentThreadId: string | null; messages: ChatMessage[]; userConfig: UserConfiguration; }
  | { type: 'SET_THREADS'; threads: Thread[] }
  | { type: 'SET_CURRENT_THREAD_ID'; threadId: string | null }
  | { type: 'SET_MESSAGES'; messages: ChatMessage[] }
  | { type: 'SET_USER_CONFIG'; userConfig: UserConfiguration };

export const chatOrchestratorMachine = setup({
  types: {
    context: {} as ChatOrchestratorContext,
    events: {} as ChatOrchestratorEvent,
  },
  actors: {
    transcribeAudio: fromPromise(async ({ input }: { input: { audioData: Blob; apiKey?: string } }) => {
      const { audioData, apiKey } = input;
      if (!apiKey) {
        console.error('[chatOrchestratorMachine] STT API key missing.');
        throw new Error('STT API key is not configured.');
      }
      // Call real STT service
      const result = await transcribeElevenLabsAudio(apiKey, audioData);
      return { transcript: result.text };
    }),
    invokeLLM: fromPromise(async ({ input }: { input: { userInput: string } }) => {
      console.log('Service: invokeLLM with input:', input.userInput);
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (Math.random() > 0.1) {
        return { aiResponse: "AI response to: " + input.userInput };
      } else {
        throw new Error('LLM failed');
      }
    }),
    playTTS: fromPromise(async ({ input }: { input: { aiResponse: string } }) => {
      console.log('Service: playTTS for text:', input.aiResponse);
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (Math.random() > 0.1) {
        return true; 
      } else {
        throw new Error('TTS failed');
      }
    }),
    initializeVAD: fromPromise(async () => {
      console.log('Service: initializeVAD - placeholder');
      await new Promise(resolve => setTimeout(resolve, 500));
      if (Math.random() > 0.1) {
        return { vadInstance: { id: 'mockVAD' } };
      } else {
        throw new Error('VAD Initialization Failed');
      }
    }),
    startVADRecording: fromPromise(async () => {
      console.log('Service: startVADRecording - placeholder');
      await new Promise(resolve => setTimeout(resolve, 200));
      if (Math.random() < 0.1) throw new Error('Failed to start VAD recording');
    }),
    stopVADRecording: fromPromise(async () => {
      console.log('Service: stopVADRecording - placeholder');
      await new Promise(resolve => setTimeout(resolve, 200));
      if (Math.random() < 0.1) throw new Error('Failed to stop VAD recording');
    }),
    streamLLM: fromCallback((helpers: any) => {
      const { input, emit } = helpers;
      console.log('[chatOrchestratorMachine] streamLLM invoked with input:', input);
      const { history, latestUserInput, llmConfig, chatOptions } = input;
      (async () => {
        for await (const part of getAiChatResponseStream(
          history as any,
          latestUserInput,
          llmConfig,
          chatOptions
        )) {
          if (part.type === 'content') {
            emit({ type: 'LLM_TOKEN', token: part.content });
          }
        }
        emit({ type: 'LLM_DONE' });
      })();
    }),
    streamTTS: fromCallback((helpers: any) => {
      const { input, emit } = helpers;
      const { text, apiKey, voiceId, modelId } = input;
      (async () => {
        if (!apiKey) {
          emit({ type: 'TTS_DONE' });
          return;
        }
        const vid = voiceId || DEFAULT_ELEVENLABS_VOICE_ID;
        const mid = modelId || DEFAULT_ELEVENLABS_MODEL_ID;
        const url = `${ELEVENLABS_API_BASE_URL}/text-to-speech/${vid}/stream`;
        const headers = new Headers({
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        });
        const body = JSON.stringify({ text, model_id: mid });
        try {
          const response = await fetch(url, { method: 'POST', headers, body });
          if (!response.ok || !response.body) throw new Error(`TTS fetch failed: ${response.status}`);
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              emit({ type: 'TTS_CHUNK', chunk: value });
            }
          }
        } catch (e) {
          console.error('[chatOrchestratorMachine] TTS streaming error:', e);
        } finally {
          emit({ type: 'TTS_DONE' });
        }
      })();
    }),
  },
  actions: {
    notifySpeechDetected: () => { console.log('Action: Speech Detected'); },
    notifyVadReady: () => { console.log('Action: VAD Ready'); },
    logEvent: ({ event }: { event: AnyEventObject }) => { console.log('[chatOrchestratorMachine]', event.type, event); },
    
    assignTranscriptToContext: assign(({
      event,
    }: { event: AnyEventObject }) => {
      if (event.type === 'xstate.actor.done.transcribeAudio') {
        const specificEvent = event as DoneActorEvent<{ transcript: string }, 'transcribeAudio'>;
        return {
          userInput: specificEvent.output.transcript,
          sttError: null,
        };
      }
      return {};
    }),

    assignLLMResponseToContext: assign(({
      event,
    }: { event: AnyEventObject }) => {
      if (event.type === 'xstate.actor.done.invokeLLM') {
        const specificEvent = event as DoneActorEvent<{ aiResponse: string }, 'invokeLLM'>;
        return {
          aiResponse: specificEvent.output.aiResponse,
          llmError: null,
        };
      }
      return {};
    }),

    assignAudioData: assign(({ event }: { event: AnyEventObject }) => {
      if (event.type === 'VAD_SPEECH_ENDED') {
        const specificEvent = event as Extract<ChatOrchestratorEvent, { type: 'VAD_SPEECH_ENDED'}>;
        console.log('VAD_SPEECH_ENDED, storing audio data in context.');
        return { audioBlob: specificEvent.audioData };
      }
      return {};
    }),

    assignUserInputText: assign(({
      event
    }: { event: AnyEventObject }) => {
      if (event.type === 'TEXT_INPUT_CHANGE') {
        const specificEvent = event as Extract<ChatOrchestratorEvent, { type: 'TEXT_INPUT_CHANGE'}>;
        return { userInput: specificEvent.text };
      }
      return {};
    }),

    clearUserInput: assign({ userInput: '' }),
    clearAIResponse: assign({ aiResponse: '' }),
    createUserMessage: assign(({ context, event }: { context: ChatOrchestratorContext; event: any }) => {
      const userText = event.type === 'SEND_TEXT_MESSAGE' ? event.text : context.userInput;
      const newMsg: ChatMessage = {
        id: `${context.currentThreadId}-user-${Date.now()}`,
        thread_id: context.currentThreadId!,
        sender: 'user',
        text_content: userText,
        timestamp: new Date().toISOString(),
        isStreaming: false
      };
      return { currentChatMessages: [...context.currentChatMessages, newMsg] };
    }),
    createAIMessagePlaceholder: assign(({ context }: { context: ChatOrchestratorContext }) => {
      const newMsg: ChatMessage = {
        id: `${context.currentThreadId}-ai-${Date.now()}`,
        thread_id: context.currentThreadId!,
        sender: 'ai',
        text_content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true
      };
      return { currentChatMessages: [...context.currentChatMessages, newMsg] };
    }),
    appendTokenToLastAIMessage: assign(({ context, event }: { context: ChatOrchestratorContext; event: any }) => {
      const msgs = [...context.currentChatMessages];
      const last = msgs[msgs.length - 1];
      if (last && last.sender === 'ai') {
        last.text_content += event.token;
      }
      return { currentChatMessages: msgs };
    }),
    finalizeAIMessage: assign(({ context }: { context: ChatOrchestratorContext }) => {
      const msgs = [...context.currentChatMessages];
      const last = msgs[msgs.length - 1];
      if (last && last.sender === 'ai') {
        last.isStreaming = false;
      }
      return { currentChatMessages: msgs };
    }),

    assignError: assign(({ context, event } : { context: ChatOrchestratorContext, event: AnyEventObject }) => {
      let errorMessage = 'An unknown error occurred';
      
      if (event.type.startsWith('xstate.actor.error.')) {
        const actorErrorEvent = event as ErrorActorEvent<any>; 
        if (actorErrorEvent.error) {
            const errorSource = actorErrorEvent.error;
            if (typeof errorSource === 'string') {
                errorMessage = errorSource;
            } else if (errorSource instanceof Error) {
                errorMessage = errorSource.message;
            } else if (typeof errorSource === 'object' && errorSource !== null && 'message' in errorSource && typeof (errorSource as any).message === 'string') {
                errorMessage = (errorSource as any).message;
            } else if (errorSource?.toString) {
                errorMessage = errorSource.toString();
            }
        }
      } else if (event.type === 'VAD_INIT_ERROR') {
        const specificEvent = event as Extract<ChatOrchestratorEvent, { type: 'VAD_INIT_ERROR', data: any }>;
        const errorSource = specificEvent.data;
        if (errorSource) {
            if (typeof errorSource.message === 'string') {
              errorMessage = errorSource.message;
            } else if (typeof errorSource.toString === 'function') {
              errorMessage = errorSource.toString();
            } else if (typeof errorSource === 'string') {
              errorMessage = errorSource;
            }
        }
      } else if (event.type === 'VAD_ERROR') {
        const specificEvent = event as Extract<ChatOrchestratorEvent, { type: 'VAD_ERROR', data: any }>;
        const errorSource = specificEvent.data;
         if (errorSource) {
            if (typeof errorSource.message === 'string') {
              errorMessage = errorSource.message;
            } else if (typeof errorSource.toString === 'function') {
              errorMessage = errorSource.toString();
            } else if (typeof errorSource === 'string') {
              errorMessage = errorSource;
            }
        }
      }
      return { ...context, lastError: errorMessage };
    }),

    assignVadInstance: assign(({
      event,
    }: { event: AnyEventObject }) => {
      if (event.type === 'xstate.actor.done.initializeVAD') {
        const specificEvent = event as DoneActorEvent<{ vadInstance: any }, 'initializeVAD'>;
        return {
          vadInstance: specificEvent.output.vadInstance,
          vadError: null,
        };
      }
      return {};
    }),

    stopVADRecordingAction: assign({ isVADListening: false }),

    assignInitialData: assign(({
      event
    }: { event: AnyEventObject }) => {
      if (event.type === 'SYNC_INITIAL_DATA') {
        const specificEvent = event as Extract<ChatOrchestratorEvent, {type: 'SYNC_INITIAL_DATA'}>;
        return {
          userConfig: specificEvent.userConfig,
          currentChatMessages: specificEvent.messages,
          currentThreadId: specificEvent.currentThreadId,
          threads: specificEvent.threads,
        };
      }
      return {};
    }),

    assignCurrentThreadId: assign(({
      event
    }: { event: AnyEventObject }) => {
      if (event.type === 'SET_CURRENT_THREAD_ID') {
        const specificEvent = event as Extract<ChatOrchestratorEvent, { type: 'SET_CURRENT_THREAD_ID'}>;
        return { currentThreadId: specificEvent.threadId };
      }
      return {};
    }),

    assignMessages: assign(({
      event
    }: { event: AnyEventObject }) => {
      if (event.type === 'SET_MESSAGES') {
        const specificEvent = event as Extract<ChatOrchestratorEvent, { type: 'SET_MESSAGES'}>;
        return { currentChatMessages: specificEvent.messages };
      }
      return {};
    }),

    assignUserConfig: assign(({
      event
    }: { event: AnyEventObject }) => {
      if (event.type === 'SET_USER_CONFIG') {
        const specificEvent = event as Extract<ChatOrchestratorEvent, { type: 'SET_USER_CONFIG'}>;
        return { userConfig: specificEvent.userConfig };
      }
      return {};
    }),

    assignThreads: assign(({
      event
    }: {
      event: AnyEventObject
    }) => {
      if ((event as any).type === 'SET_THREADS') {
        const threadsEvent = event as Extract<ChatOrchestratorEvent, { type: 'SET_THREADS'}>;
        return { threads: threadsEvent.threads };
      }
      return {};
    }),

    assignVadError: assign(( { context, event }: { context: ChatOrchestratorContext, event: AnyEventObject } ) => {
      let errorMessage = 'VAD Operation Failed';
      if (event.type === 'xstate.actor.error.initializeVAD' || event.type === 'xstate.actor.error.startVADRecording' || event.type === 'xstate.actor.error.stopVADRecording') {
        const errorSource = (event as ErrorActorEvent<any>).error;
        if (errorSource) {
            if (typeof errorSource === 'string') errorMessage = errorSource;
            else if (errorSource instanceof Error) errorMessage = errorSource.message;
            else if (typeof errorSource === 'object' && errorSource !== null && 'message' in errorSource && typeof (errorSource as any).message === 'string') errorMessage = (errorSource as any).message;
            else if (errorSource?.toString) errorMessage = errorSource.toString();
        }
      } else if (event.type === 'VAD_INIT_ERROR') {
        const customErrorEvent = event as Extract<ChatOrchestratorEvent, { type: 'VAD_INIT_ERROR', data: any }>;
        const errorSource = customErrorEvent.data;
        if (errorSource) {
            if (typeof errorSource.message === 'string') errorMessage = errorSource.message;
            else if (typeof errorSource.toString === 'function') errorMessage = errorSource.toString();
            else if (typeof errorSource === 'string') errorMessage = errorSource;
        }
      } else if (event.type === 'VAD_ERROR') {
        const customErrorEvent = event as Extract<ChatOrchestratorEvent, { type: 'VAD_ERROR', data: any }>;
        const errorSource = customErrorEvent.data;
        if (errorSource) {
            if (typeof errorSource.message === 'string') errorMessage = errorSource.message;
            else if (typeof errorSource.toString === 'function') errorMessage = errorSource.toString();
            else if (typeof errorSource === 'string') errorMessage = errorSource;
        }
      }
      return { ...context, vadError: errorMessage, lastError: errorMessage };
    }),

    assignSttError: assign(( { context, event }: { context: ChatOrchestratorContext, event: AnyEventObject } ) => {
      let errorMessage = 'STT Operation Failed';
      if (event.type === 'xstate.actor.error.transcribeAudio') {
        const errorSource = (event as ErrorActorEvent<any, 'transcribeAudio'>).error;
        if (errorSource) {
            if (typeof errorSource === 'string') errorMessage = errorSource;
            else if (errorSource instanceof Error) errorMessage = errorSource.message;
            else if (typeof errorSource === 'object' && errorSource !== null && 'message' in errorSource && typeof (errorSource as any).message === 'string') errorMessage = (errorSource as any).message;
            else if (errorSource?.toString) errorMessage = errorSource.toString();
        }
      }
      return { ...context, sttError: errorMessage, lastError: errorMessage };
    }),

    assignLlmError: assign(( { context, event }: { context: ChatOrchestratorContext, event: AnyEventObject }) => {
      let errorMessage = 'LLM Operation Failed';
      if (event.type === 'xstate.actor.error.invokeLLM') {
        const errorSource = (event as ErrorActorEvent<any, 'invokeLLM'>).error;
        if (errorSource) {
            if (typeof errorSource === 'string') errorMessage = errorSource;
            else if (errorSource instanceof Error) errorMessage = errorSource.message;
            else if (typeof errorSource === 'object' && errorSource !== null && 'message' in errorSource && typeof (errorSource as any).message === 'string') errorMessage = (errorSource as any).message;
            else if (errorSource?.toString) errorMessage = errorSource.toString();
        }
      }
      return { ...context, llmError: errorMessage, lastError: errorMessage };
    }),

    assignTtsError: assign(( { context, event }: { context: ChatOrchestratorContext, event: AnyEventObject }) => {
      let errorMessage = 'TTS Operation Failed';
      if (event.type === 'xstate.actor.error.playTTS') {
        const errorSource = (event as ErrorActorEvent<any, 'playTTS'>).error;
        if (errorSource) {
            if (typeof errorSource === 'string') errorMessage = errorSource;
            else if (errorSource instanceof Error) errorMessage = errorSource.message;
            else if (typeof errorSource === 'object' && errorSource !== null && 'message' in errorSource && typeof (errorSource as any).message === 'string') errorMessage = (errorSource as any).message;
            else if (errorSource?.toString) errorMessage = errorSource.toString();
        }
      }
      return { ...context, ttsError: errorMessage, lastError: errorMessage };
    }),
    clearAllErrors: assign({ lastError: null, sttError: null, llmError: null, ttsError: null, vadError: null }),
    appendAIResponse: assign({
      aiResponse: ({ context, event }: { context: ChatOrchestratorContext; event: any }) =>
        context.aiResponse + (event.token ?? '')
    })
  }
}).createMachine({
  id: 'chatOrchestrator',
  context: ({ input }) => ({
    userConfig: (input as any)?.userConfig || null, 
    currentThreadId: (input as any)?.currentThreadId || null,
    currentChatMessages: (input as any)?.messages || [],
    isSpeechModeActive: false,
    userInput: '',
    audioBlob: undefined,
    aiResponse: '',
    vadInstance: null,
    isVADListening: false,
    sttError: null,
    llmError: null,
    ttsError: null,
    vadError: null,
    lastError: null,
    threads: (input as any)?.threads || [],
  }),
  initial: 'initializing',
  on: {
    SYNC_INITIAL_DATA: { actions: 'assignInitialData' },
    SET_CURRENT_THREAD_ID: { actions: 'assignCurrentThreadId' },
    SET_MESSAGES: { actions: 'assignMessages' },
    SET_USER_CONFIG: { actions: 'assignUserConfig' },
    SET_THREADS: { actions: 'assignThreads' },
    CLEAR_ERROR: { actions: assign({ lastError: null }) }, 
    RETRY: [
      { guard: ({ context }: { context: ChatOrchestratorContext }) => context.sttError !== null, target: '#chatOrchestrator.processingSpeech.transcribing' },
      { guard: ({ context }: { context: ChatOrchestratorContext }) => context.llmError !== null, target: '#chatOrchestrator.processingSpeech.streamingResponse' },
      { guard: ({ context }: { context: ChatOrchestratorContext }) => context.ttsError !== null, target: '#chatOrchestrator.processingSpeech.streamingResponse' },
      { guard: ({ context }: { context: ChatOrchestratorContext }) => context.vadError !== null, target: '#chatOrchestrator.speechInput.initializingVAD' }
    ]
  },
  states: {
    initializing: {
      always: [{ target: 'idle', actions: 'logEvent' }], 
    },
    idle: {
      entry: 'clearAllErrors', 
      on: {
        TOGGLE_INPUT_MODE: [
          { guard: ({ context }: { context: ChatOrchestratorContext }) => context.isSpeechModeActive, actions: assign({ isSpeechModeActive: false }) },
          { actions: assign({ isSpeechModeActive: true }), target: 'speechInput' }
        ],
        TEXT_INPUT_CHANGE: { actions: 'assignUserInputText' },
        SEND_TEXT_MESSAGE: {
          guard: (_: any, event: any) => event.type === 'SEND_TEXT_MESSAGE' && event.text.trim().length > 0,
          target: 'processingText',
          actions: ['logEvent', 'createUserMessage', 'createAIMessagePlaceholder', 'clearUserInput']
        },
        ACTIVATE_SPEECH_MODE: { target: 'speechInput', actions: assign({ isSpeechModeActive: true }) }
      }
    },
    speechInput: {
      initial: 'initializingVAD',
      states: {
        initializingVAD: {
          entry: 'logEvent',
          invoke: {
            id: 'initializeVAD',
            src: 'initializeVAD',
            input: {},
            onDone: {
              target: 'readyToListen',
              actions: ['assignVadInstance', 'notifyVadReady', 'logEvent']
            },
            onError: {
              target: 'vadErrorState',
              actions: ['assignVadError', 'logEvent']
            }
          }
        },
        readyToListen: {
          entry: [assign({ isVADListening: true }), 'logEvent'], 
          invoke: {
            id: 'startVADRecording',
            src: 'startVADRecording',
            input: {},
            onDone: {
              actions: 'logEvent' 
            },
            onError: {
              target: 'vadErrorState',
              actions: ['assignVadError', 'logEvent']
            }
          },
          on: {
            VAD_SPEECH_DETECTED: { target: 'listening', actions: ['notifySpeechDetected', 'logEvent'] },
            CANCEL_SPEECH_INPUT: { target: '#chatOrchestrator.idle', actions: ['stopVADRecordingAction', 'logEvent'] },
            VAD_ERROR: { target: 'vadErrorState', actions: 'assignVadError' } 
          },
          exit: ['stopVADRecordingAction'] 
        },
        listening: {
          entry: 'logEvent',
          on: {
            VAD_SPEECH_ENDED: {
              target: '#chatOrchestrator.processingSpeech.transcribing',
              actions: ['assignAudioData', 'stopVADRecordingAction', 'logEvent']
            },
            CANCEL_SPEECH_INPUT: { target: '#chatOrchestrator.idle', actions: ['stopVADRecordingAction', 'logEvent'] },
            VAD_ERROR: { target: 'vadErrorState', actions: 'assignVadError' }
          }
        },
        vadErrorState: {
          entry: 'logEvent',
          on: {
            RETRY: 'initializingVAD', 
            CANCEL_SPEECH_INPUT: { target: '#chatOrchestrator.idle', actions: ['stopVADRecordingAction', 'logEvent'] }
          }
        }
      },
      on: {
        TOGGLE_INPUT_MODE: { target: 'idle', actions: assign({ isSpeechModeActive: false }) } 
      }
    },
    processingText: {
      entry: 'logEvent',
      invoke: {
        id: 'invokeLLMStream',
        src: 'streamLLM',
        input: ({ context, event }: { context: ChatOrchestratorContext; event: any }) => ({
          history: context.currentChatMessages,
          latestUserInput: event.type === 'SEND_TEXT_MESSAGE' ? event.text : '',
          llmConfig: context.userConfig?.llmConfig!,
          chatOptions: {}
        }),
        on: {
          LLM_TOKEN: { actions: ['appendTokenToLastAIMessage'] },
          LLM_DONE:  { target: 'idle', actions: ['finalizeAIMessage', 'logEvent'] }
        },
        onError: {
          target: 'errorState.llmError',
          actions: ['assignLlmError', 'logEvent']
        }
      }
    },
    processingSpeech: {
      initial: 'transcribing',
      states: {
        transcribing: {
          entry: 'logEvent',
          invoke: {
            id: 'transcribeAudio',
            src: 'transcribeAudio',
            input: ({ context }: { context: ChatOrchestratorContext }) => ({
              audioData: context.audioBlob!,
              apiKey: context.userConfig?.elevenLabsApiKey
            }),
            onDone: {
              target: 'streamingResponse',
              actions: ['assignTranscriptToContext', 'logEvent']
            },
            onError: {
              target: '#chatOrchestrator.errorState.sttError',
              actions: ['assignSttError', 'logEvent']
            }
          }
        },
        streamingResponse: {
          type: 'parallel',
          states: {
            llm: {
              initial: 'streaming',
              states: {
                streaming: {
                  invoke: {
                    id: 'invokeLLMStreamSpeech',
                    src: 'streamLLM',
                    input: ({ context }: { context: ChatOrchestratorContext }) => ({ userInput: context.userInput }),
                    on: {
                      LLM_TOKEN: { actions: 'appendAIResponse' },
                      LLM_DONE: { target: 'streaming.done' }
                    },
                    onError: { target: '#chatOrchestrator.errorState.llmError', actions: ['assignLlmError', 'logEvent'] }
                  }
                },
                done: { type: 'final' }
              }
            },
            tts: {
              initial: 'generating',
              states: {
                generating: {
                  invoke: {
                    id: 'invokeTTSStream',
                    src: 'streamTTS',
                    input: ({ context }: { context: ChatOrchestratorContext }) => ({
                      text: context.aiResponse,
                      apiKey: context.userConfig?.elevenLabsApiKey,
                      modelId: context.userConfig?.ttsConfig?.modelId ?? undefined,
                      voiceId: context.userConfig?.elevenLabsVoiceId,
                    }),
                    on: {
                      TTS_DONE: { target: 'done' }
                    },
                    onError: { target: '#chatOrchestrator.errorState.ttsError', actions: ['assignTtsError', 'logEvent'] }
                  }
                },
                done: { type: 'final' }
              }
            }
          },
          onDone: '#chatOrchestrator.idle'
        }
      }
    },
    errorState: {
      entry: 'logEvent',
      initial: 'unknown', 
      states: {
        unknown: {},
        sttError: { entry: 'logEvent' },
        llmError: { entry: 'logEvent' },
        ttsError: { entry: 'logEvent' },
        vadInitError: { entry: 'logEvent' }, 
      },
      on: {
        RETRY: undefined, 
        CLEAR_ERROR: { target: 'idle', actions: 'clearAllErrors' },
      }
    }
  }
});

// Create and start a singleton service outside of React/Component lifecycle
import { createActor } from 'xstate';
export const chatService = createActor(chatOrchestratorMachine).start();

export type ChatOrchestratorActorRef = ActorRefFrom<typeof chatOrchestratorMachine>;
export type ChatOrchestratorState = StateFrom<typeof chatOrchestratorMachine>; 