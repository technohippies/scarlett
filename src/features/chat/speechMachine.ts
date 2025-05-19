import { createMachine, assign } from 'xstate';

export interface SpeechContext { transcript?: string; }

export type SpeechEvent =
  | { type: 'START' }
  | { type: 'SPEECH_END' }
  | { type: 'CANCEL' }
  | { type: 'TRANSCRIBE_SUCCESS'; transcript: string }
  | { type: 'TRANSCRIBE_ERROR' }
  | { type: 'LLM_DONE' }
  | { type: 'TTS_END' };

export const speechMachine = createMachine(
  {
    id: 'speech',
    initial: 'idle',
    context: { transcript: undefined },
    states: {
      idle: {
        on: { START: 'listening' }
      },
      listening: {
        on: { SPEECH_END: 'recognizing', CANCEL: 'idle' }
      },
      recognizing: {
        on: {
          TRANSCRIBE_SUCCESS: {
            target: 'waitingLLM',
            actions: assign({ transcript: (_ctx, e: any) => e.transcript })
          },
          TRANSCRIBE_ERROR: 'idle'
        }
      },
      waitingLLM: {
        on: { LLM_DONE: 'speaking' }
      },
      speaking: {
        on: { TTS_END: 'idle' }
      }
    }
  }
); 