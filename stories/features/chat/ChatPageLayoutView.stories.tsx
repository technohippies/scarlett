import { ChatPageLayoutView } from '../../../src/features/chat/ChatPageLayoutView';
import type { ChatPageLayoutViewProps } from '../../../src/features/chat/ChatPageLayoutView';
import type { ChatMessage, Thread } from '../../../src/features/chat/types';
import type { ChatOrchestratorContext, ChatOrchestratorEvent, ChatOrchestratorState } from '../../../src/features/chat/chatOrchestratorMachine';

const MOCK_THREAD_ID_1 = 'view-1';
const MOCK_THREAD_ID_2 = 'view-2';

const mockThreads: Thread[] = [
  { id: MOCK_THREAD_ID_1, title: 'View: SolidJS Discussion - A very long title to test truncation', lastActivity: '10m ago', messages: [] },
  { id: MOCK_THREAD_ID_2, title: 'View: Recipe Ideas', lastActivity: '2h ago', messages: [] },
];

const mockMessagesShort: ChatMessage[] = [
  { id: 'view-m1', thread_id: MOCK_THREAD_ID_1, sender: 'ai', text_content: 'Welcome to the new chat view! How can I assist?', timestamp: new Date().toISOString(), isStreaming: false },
  { id: 'view-m2', thread_id: MOCK_THREAD_ID_1, sender: 'user', text_content: 'Tell me more about SolidJS!', timestamp: new Date().toISOString(), isStreaming: false },
];

const generateLongMessages = (threadId: string): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < 15; i++) {
    messages.push({ id: `view-ai-${i}`, thread_id: threadId, sender: 'ai', text_content: `AI message ${i + 1} in a longer conversation (view)`, timestamp: new Date(Date.now() - (20 - i) * 60000).toISOString(), isStreaming: false });
    messages.push({ id: `view-user-${i}`, thread_id: threadId, sender: 'user', text_content: `User reply ${i + 1} in a longer conversation (view)`, timestamp: new Date(Date.now() - (19 - i) * 60000).toISOString(), isStreaming: false });
  }
  return messages;
};

// Mock machine context, state, and send function for stories
const mockMachineContextBase: ChatOrchestratorContext = {
  threads: mockThreads,
  currentThreadId: MOCK_THREAD_ID_1,
  currentChatMessages: mockMessagesShort,
  userInput: '',
  isSpeechModeActive: false,
  userConfig: null,
  aiResponse: '',
  vadInstance: null,
  isVADListening: false,
  sttError: null,
  llmError: null,
  ttsError: null,
  vadError: null,
  lastError: null,
  error: undefined,
  currentTTSAudio: undefined,
  sttInterimTranscript: '',
  sttFinalTranscript: '',
  isTTSEnabled: true,
  activeSystemPersonaId: 'default',
  activeUserPersonaId: 'default',
  apiState: 'idle',
  availableModels: [],
  chatMode: 'text',
  currentAssistantMessageId: null,
  currentSystemMessage: '',
  currentUtterance: '',
  isCurrentUserSpeaking: false,
  lastSpokenAudioUrl: null,
  modelProvider: 'ollama',
  selectedModelId: 'default',
  userPreferences: { autoPlayTTS: 'narrator', preferredLanguage: 'en', preferredModel: 'default', preferredVoice: 'default' },
  vadStatus: 'inactive',
  actors: {},
  services: {},
  vadSilero: null,
  isWakeWordDetectionEnabled: false,
  wakeWordDetector: null,
  isWakeWordListening: false,
  wakeWordError: null,
  wakeWordRecentlyDetected: false,
  isAutoSendEnabled: false,
  autoSendTimer: 0,
  isThinkingIndicatorEnabled: false,
};

const mockMachineStateValue: ChatOrchestratorState['value'] = 'idle';
const mockSendToMachine = (event: ChatOrchestratorEvent) => console.log('[Story] Send to Machine', event);


const baseArgs: Omit<ChatPageLayoutViewProps, 'onStartSpeech' | 'onCancelSpeech' | 'isRecording'> & { machineContext: ChatOrchestratorContext, machineStateValue: ChatOrchestratorState['value'], sendToMachine: (event: ChatOrchestratorEvent) => void } = {
  threads: mockThreads,
  currentThreadId: MOCK_THREAD_ID_1,
  isSpeechModeActive: false, // Direct prop for the switch
  onNavigateBack: () => console.log('[Story] Navigate Back'),
  onSelectThread: (id: string) => console.log('[Story] Select Thread', id),
  onToggleMode: () => console.log('[Story] Toggle Mode'),
  messages: mockMessagesShort,
  userInput: '',
  onInputChange: (text: string) => console.log('[Story] Input Change', text),
  onSendText: () => console.log('[Story] Send Text'),
  isIdle: true,
  // Add machine-related props
  machineStateValue: mockMachineStateValue,
  machineContext: mockMachineContextBase,
  sendToMachine: mockSendToMachine,
};

export default {
  title: 'Features/Chat/ChatPageLayoutView',
  component: ChatPageLayoutView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: baseArgs,
  argTypes: {
    threads: { control: 'object' },
    currentThreadId: { control: 'text' },
    isSpeechModeActive: { control: 'boolean' }, // Direct prop
    messages: { control: 'object' },
    userInput: { control: 'text' },
    isIdle: { control: 'boolean' },
    onNavigateBack: { action: 'onNavigateBack' },
    onSelectThread: { action: 'onSelectThread' },
    onToggleMode: { action: 'onToggleMode' },
    onInputChange: { action: 'onInputChange' },
    onSendText: { action: 'onSendText' },
    machineStateValue: { control: 'text' }, // Can be configured if needed
    machineContext: { control: 'object' },   // Can be configured if needed
    // sendToMachine: { action: 'sendToMachine' } // Action for sendToMachine
  },
};

export const TextMode = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,
  args: {
    ...baseArgs, // Ensure all base args are spread
    isSpeechModeActive: false,
    machineContext: {
      ...mockMachineContextBase,
      isSpeechModeActive: false,
    },
  },
};

export const SpeechMode = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,
  args: {
    ...baseArgs, // Ensure all base args are spread
    isSpeechModeActive: true, // Direct prop for the switch
    messages: [], // Override messages for this story if needed
    machineContext: {
      ...mockMachineContextBase,
      isSpeechModeActive: true, // Context for speech controls
      isRecording: false, // Example: show not recording state
    },
  },
};

export const SpeechModeRecording = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,
  args: {
    ...baseArgs,
    isSpeechModeActive: true,
    messages: [],
    machineContext: {
      ...mockMachineContextBase,
      isSpeechModeActive: true,
      isVADListening: true,
    },
    machineStateValue: 'speechInput.active.listeningToSpeech',
  },
};

export const LongConversation = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,
  args: {
    ...baseArgs,
    messages: generateLongMessages(MOCK_THREAD_ID_1),
    machineContext: { // Ensure context also has correct messages if SpeechInputControls uses them
      ...mockMachineContextBase,
      currentChatMessages: generateLongMessages(MOCK_THREAD_ID_1),
    }
  },
};

export const NoThreads = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,
  args: {
    ...baseArgs,
    threads: [],
    currentThreadId: null,
    messages: [],
    machineContext: {
      ...mockMachineContextBase,
      threads: [],
      currentThreadId: null,
      currentChatMessages: [],
    }
  },
};

export const NoActiveThread = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,
  args: {
    ...baseArgs,
    currentThreadId: null,
    messages: [], // Typically no messages if no active thread
     machineContext: {
      ...mockMachineContextBase,
      currentThreadId: null,
      currentChatMessages: [],
    }
  },
}; 