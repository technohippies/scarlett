import { createMachine, assign, ActorRefFrom, StateFrom } from 'xstate';
import type { ChatMessage, Thread, WordInfo } from './types';
import type { UserConfiguration } from '../../services/storage/types';

// Define services with explicit context and event types
const services = {
  transcribeAudio: async (context: ChatOrchestratorContext, event: Extract<ChatOrchestratorEvent, { type: 'VAD_SPEECH_ENDED' }>) => {
    console.log('Service: transcribeAudio - placeholder, audio data:', event.audioData);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (Math.random() > 0.1) {
      return { transcript: 'Hello, this is a test transcript.' };
    } else {
      throw new Error('Transcription failed');
    }
  },
  invokeLLM: async (context: ChatOrchestratorContext, event: Extract<ChatOrchestratorEvent, { type: 'STT_SUCCESS' } | { type: 'SEND_TEXT_MESSAGE' }>) => {
    console.log('Service: invokeLLM with input:', context.userInput);
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (Math.random() > 0.1) {
      return { aiResponse: "AI response to: " + context.userInput };
    } else {
      throw new Error('LLM failed');
    }
  },
  playTTS: async (context: ChatOrchestratorContext, event: Extract<ChatOrchestratorEvent, { type: 'LLM_SUCCESS' }>) => {
    console.log('Service: playTTS for text:', context.aiResponse);
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (Math.random() > 0.1) {
      return true;
    } else {
      throw new Error('TTS failed');
    }
  },
  initializeVAD: async (context: ChatOrchestratorContext, event: ChatOrchestratorEvent) => {
    console.log('Service: initializeVAD - placeholder');
    await new Promise(resolve => setTimeout(resolve, 500));
    // In a real scenario, this would return a proper VAD instance
    return { vadInstance: { id: 'mockVAD' } }; 
  },
  startVADRecording: async (context: ChatOrchestratorContext, event: ChatOrchestratorEvent) => {
    console.log('Service: startVADRecording - placeholder');
    await new Promise(resolve => setTimeout(resolve, 200));
  },
  stopVADRecording: async (context: ChatOrchestratorContext, event: ChatOrchestratorEvent) => {
    console.log('Service: stopVADRecording - placeholder for context:', context.isVADListening );
    await new Promise(resolve => setTimeout(resolve, 200));
  }
};

// Define actions with explicit context and event types
const actionsDefinition = {
  assignTranscriptToContext: assign<ChatOrchestratorContext, Extract<ChatOrchestratorEvent, { type: 'STT_SUCCESS' }>>({
    userInput: (_, event) => event.data.transcript,
    sttError: null,
  }),
  assignLLMResponseToContext: assign<ChatOrchestratorContext, Extract<ChatOrchestratorEvent, { type: 'LLM_SUCCESS' }>>({
    aiResponse: (_, event) => event.data.aiResponse,
    llmError: null,
  }),
  assignAudioData: assign<ChatOrchestratorContext, Extract<ChatOrchestratorEvent, { type: 'VAD_SPEECH_ENDED' }>>(
    (context, event) => {
      console.log("Assigning audio data (placeholder):", event.audioData);
      return { ...context /*, latestAudioData: event.audioData */ };
    }
  ),
  assignUserInputText: assign<ChatOrchestratorContext, Extract<ChatOrchestratorEvent, { type: 'TEXT_INPUT_CHANGE' }>>({
    userInput: (_, event) => event.text,
  }),
  clearUserInput: assign<ChatOrchestratorContext, ChatOrchestratorEvent>({
    userInput: '',
  }),
  clearAIResponse: assign<ChatOrchestratorContext, ChatOrchestratorEvent>({
    aiResponse: '',
  }),
  assignError: assign<ChatOrchestratorContext, ChatOrchestratorEvent>(
    (context, event: any) => { // Keep `any` for generic error data for now
      return {
        ...context,
        lastError: event.data?.message || event.data?.toString() || 'An unknown error occurred',
      };
    }
  ),
  assignVadInstance: assign<ChatOrchestratorContext, Extract<ChatOrchestratorEvent, { type: 'VAD_INITIALIZED' }>>({
    vadInstance: (_, event) => event.data.vadInstance,
    vadError: null,
  }),
  notifySpeechDetected: (context: ChatOrchestratorContext, event: ChatOrchestratorEvent) => console.log('Action: Speech Detected'),
  notifyVadReady: (context: ChatOrchestratorContext, event: ChatOrchestratorEvent) => console.log('Action: VAD Ready'),
  logEvent: (context: ChatOrchestratorContext, event: ChatOrchestratorEvent) => console.log('[chatOrchestratorMachine]', event.type),
  stopVADRecordingAction: assign<ChatOrchestratorContext, ChatOrchestratorEvent>((context) => {
    console.log('Action: stopVADRecordingAction');
    // This would typically be an invoked service or direct call if synchronous
    // For now, just logging. The actual stop is better as a service.
    return { ...context, isVADListening: false }; // Ensure state reflects VAD is stopped
  })
};

export interface ChatOrchestratorContext {
  userConfig: UserConfiguration | null;
  currentThreadId: string | null;
  currentChatMessages: ChatMessage[];
  isSpeechModeActive: boolean;
  userInput: string;
  aiResponse: string;
  vadInstance: any | null;
  isVADListening: boolean;
  sttError: string | null;
  llmError: string | null;
  ttsError: string | null;
  vadError: string | null;
  lastError: string | null;
}

export type ChatOrchestratorEvent =
  | { type: 'TOGGLE_INPUT_MODE' }
  | { type: 'TEXT_INPUT_CHANGE'; text: string }
  | { type: 'SEND_TEXT_MESSAGE' }
  | { type: 'ACTIVATE_SPEECH_MODE' }
  | { type: 'VAD_INITIALIZED'; vadInstance: any; data: { vadInstance: any } } // Added data for onDone
  | { type: 'VAD_INIT_ERROR'; error: string ; data: any}
  | { type: 'VAD_SPEECH_DETECTED' }
  | { type: 'VAD_SPEECH_ENDED'; audioData: any }
  | { type: 'VAD_ERROR'; error: string ; data: any}
  | { type: 'CANCEL_SPEECH_INPUT' }
  | { type: 'STT_SUCCESS'; transcript: string; data: { transcript: string } }
  | { type: 'STT_ERROR'; error: string ; data: any}
  | { type: 'LLM_SUCCESS'; aiResponse: string; data: { aiResponse: string } }
  | { type: 'LLM_ERROR'; error: string ; data: any}
  | { type: 'TTS_PLAYBACK_COMPLETE' ; data: any}
  | { type: 'TTS_PLAYBACK_ERROR'; error: string ; data: any}
  | { type: 'RETRY' }
  | { type: 'CLEAR_ERROR' };


export const chatOrchestratorMachine = createMachine<ChatOrchestratorContext, ChatOrchestratorEvent>(
  {
    id: 'chatOrchestrator',
    initial: 'initializing',
    context: {
      userConfig: null,
      currentThreadId: null,
      currentChatMessages: [],
      isSpeechModeActive: true,
      userInput: '',
      aiResponse: '',
      vadInstance: null,
      isVADListening: false,
      sttError: null,
      llmError: null,
      ttsError: null,
      vadError: null,
      lastError: null,
    } as ChatOrchestratorContext,
    states: {
      initializing: {
        invoke: {
          id: 'initVadService',
          src: 'initializeVAD',
          onDone: {
            target: 'idle',
            actions: ['assignVadInstance', 'notifyVadReady'],
          },
          onError: {
            target: 'error',
            actions: assign<ChatOrchestratorContext, any>( // Use any for generic error event data
              { vadError: (_, ev) => ev.data?.message || ev.data?.toString() || 'VAD Init Failed' }
            ),
          }
        }
      },
      idle: {
        entry: ['clearUserInput', 'clearAIResponse', 'logEvent'],
        on: {
          TOGGLE_INPUT_MODE: {
            actions: assign({ isSpeechModeActive: (ctx) => !ctx.isSpeechModeActive }),
            target: 'idle',
            internal: false,
          },
          ACTIVATE_SPEECH_MODE: [
            {
              guard: (ctx) => !!ctx.vadInstance && ctx.isSpeechModeActive,
              target: 'speechInput.listening',
            },
            {
              actions: (ctx) => console.warn('VAD not ready or not in speech mode', ctx.vadInstance, ctx.isSpeechModeActive),
            }
          ],
          TEXT_INPUT_CHANGE: {
            guard: (ctx) => !ctx.isSpeechModeActive,
            actions: 'assignUserInputText',
          },
          SEND_TEXT_MESSAGE: {
            guard: (ctx) => !ctx.isSpeechModeActive && !!ctx.userInput.trim(),
            target: 'processingUserRequest.callingLLM',
          },
        },
      },
      speechInput: {
        initial: 'ready',
        states: {
          ready: {
            on: {
              ACTIVATE_SPEECH_MODE: 'listening',
            },
          },
          listening: {
            entry: [
              assign<ChatOrchestratorContext, ChatOrchestratorEvent>({ isVADListening: true, sttError: null }),
              'logEvent',
            ],
            invoke: {
              id: 'startVadRecordingService',
              src: 'startVADRecording',
              onError: {
                target: '#chatOrchestrator.error',
                actions: assign<ChatOrchestratorContext, any>(
                  { vadError: (_, ev) => ev.data?.message || ev.data?.toString() || 'VAD Start Failed' }
                )
              }
            },
            on: {
              VAD_SPEECH_DETECTED: { actions: ['notifySpeechDetected', 'logEvent'] },
              VAD_SPEECH_ENDED: {
                target: 'transcribing',
                actions: ['assignAudioData', 'logEvent'],
              },
              VAD_ERROR: {
                target: '#chatOrchestrator.error',
                actions: assign<ChatOrchestratorContext, Extract<ChatOrchestratorEvent, { type: 'VAD_ERROR' }>>(
                  { vadError: (_, ev) => ev.error, isVADListening: false }
                ),
              },
              CANCEL_SPEECH_INPUT: {
                target: '#chatOrchestrator.idle',
                actions: [assign<ChatOrchestratorContext, ChatOrchestratorEvent>({ isVADListening: false }), 'logEvent'],
              },
            },
            exit: [
              assign<ChatOrchestratorContext, ChatOrchestratorEvent>({ isVADListening: false }),
              'stopVADRecordingAction' // Action to ensure VAD is stopped, mapped from services.stopVADRecording
            ],
          },
          transcribing: {
            entry: 'logEvent',
            invoke: {
              id: 'sttService',
              src: 'transcribeAudio',
              onDone: {
                target: '#chatOrchestrator.processingUserRequest.callingLLM',
                actions: ['assignTranscriptToContext', 'logEvent'],
              },
              onError: {
                target: '#chatOrchestrator.error',
                actions: assign<ChatOrchestratorContext, any>(
                  { sttError: (_, ev) => ev.data?.message || ev.data?.toString() || 'STT Failed' }
                ),
              },
            },
          },
        },
      },
      processingUserRequest: {
        initial: 'callingLLM',
        states: {
          callingLLM: {
            entry: ['logEvent', assign<ChatOrchestratorContext, ChatOrchestratorEvent>({ llmError: null })],
            invoke: {
              id: 'llmService',
              src: 'invokeLLM',
              onDone: {
                target: '#chatOrchestrator.respondingToUser.playingTTS',
                actions: ['assignLLMResponseToContext', 'logEvent'],
              },
              onError: {
                target: '#chatOrchestrator.error',
                actions: assign<ChatOrchestratorContext, any>(
                  { llmError: (_, ev) => ev.data?.message || ev.data?.toString() || 'LLM Call Failed' }
                ),
              },
            },
          },
        },
      },
      respondingToUser: {
        initial: 'playingTTS',
        states: {
          playingTTS: {
            entry: ['logEvent', assign<ChatOrchestratorContext, ChatOrchestratorEvent>({ ttsError: null })],
            invoke: {
              id: 'ttsService',
              src: 'playTTS',
              onDone: { target: '#chatOrchestrator.idle', actions: 'logEvent' },
              onError: {
                target: '#chatOrchestrator.error',
                actions: assign<ChatOrchestratorContext, any>(
                  { ttsError: (_, ev) => ev.data?.message || ev.data?.toString() || 'TTS Playback Failed' }
                ),
              },
            },
          },
        },
      },
      error: {
        entry: ['assignError', 'logEvent'],
        on: {
          RETRY: 'idle',
          CLEAR_ERROR: { target: 'idle', actions: assign({lastError: null}) },
          TOGGLE_INPUT_MODE: {
            actions: assign({ isSpeechModeActive: (ctx) => !ctx.isSpeechModeActive, lastError: null }),
            target: 'idle',
            internal: false,
          },
        },
      },
    },
  },
  {
    services,
    actions: actionsDefinition,
  }
);

// Types for useActor hook if needed elsewhere
export type ChatOrchestratorActorRef = ActorRefFrom<typeof chatOrchestratorMachine>;
export type ChatOrchestratorState = StateFrom<typeof chatOrchestratorMachine>; 