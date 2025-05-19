import { ChatPageLayoutView } from '../../../src/features/chat/ChatPageLayoutView';
import type { ChatPageLayoutViewProps } from '../../../src/features/chat/ChatPageLayoutView';
import type { ChatMessage, Thread } from '../../../src/features/chat/types';

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

const baseArgs: Partial<ChatPageLayoutViewProps> = {
  threads: mockThreads,
  currentThreadId: MOCK_THREAD_ID_1,
  isSpeechModeActive: false,
  onNavigateBack: () => console.log('[Story] Navigate Back'),
  onSelectThread: (id: string) => console.log('[Story] Select Thread', id),
  onToggleMode: () => console.log('[Story] Toggle Mode'),
  messages: mockMessagesShort,
  userInput: '',
  onInputChange: (text: string) => console.log('[Story] Input Change', text),
  onSendText: () => console.log('[Story] Send Text'),
  isIdle: true,
  onStartSpeech: () => console.log('[Story] Start Speech'),
  onCancelSpeech: () => console.log('[Story] Cancel Speech'),
  isRecording: false,
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
    isSpeechModeActive: { control: 'boolean' },
    messages: { control: 'object' },
    userInput: { control: 'text' },
    isIdle: { control: 'boolean' },
    isRecording: { control: 'boolean' },
    onNavigateBack: { action: 'onNavigateBack' },
    onSelectThread: { action: 'onSelectThread' },
    onToggleMode: { action: 'onToggleMode' },
    onInputChange: { action: 'onInputChange' },
    onSendText: { action: 'onSendText' },
    onStartSpeech: { action: 'onStartSpeech' },
    onCancelSpeech: { action: 'onCancelSpeech' },
  },
};

export const TextMode = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,  
  args: { isSpeechModeActive: false },
};

export const SpeechMode = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,  
  args: { isSpeechModeActive: true, messages: [] },
};

export const LongConversation = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,  
  args: { messages: generateLongMessages(MOCK_THREAD_ID_1) },
};

export const NoThreads = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,  
  args: { threads: [], currentThreadId: null, messages: [] },
};

export const NoActiveThread = {
  render: (args: ChatPageLayoutViewProps) => <ChatPageLayoutView {...args} />,  
  args: { currentThreadId: null, messages: [] },
}; 