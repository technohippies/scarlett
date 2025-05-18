import { ChatPageView } from '../../../src/features/chat/ChatPageView';
import type { ChatMessage, Thread } from '../../../src/features/chat/types';

// Mock data for Threads
const mockThreads: Thread[] = [
  { 
    id: '1', 
    title: 'Conversation about SolidJS and modern web development frameworks and also many other things that make this title extremely long to test the ellipsis functionality, hopefully this is long enough now to cause an overflow and show the desired truncation effect.', 
    lastActivity: '5m ago',
    systemPrompt: 'You are a helpful assistant discussing SolidJS.',
    messages: [
      { id: 's1-m1', sender: 'ai', text: 'Hello! Let us discuss SolidJS.', timestamp: '10:00 AM' },
      { id: 's1-m2', sender: 'user', text: 'Sure, what makes it fast?', timestamp: '10:01 AM' },
    ]
  },
  { 
    id: '2', 
    title: 'Recipe Ideas for a potluck dinner party next week', 
    lastActivity: '1h ago',
    systemPrompt: 'You are a culinary expert suggesting recipes.',
    messages: [
        { id: 's2-m1', sender: 'ai', text: 'For the potluck, how about a nice pasta salad?', timestamp: '11:00 AM' }
    ]
  },
  { 
    id: '3', 
    title: 'Book Recommendations: Sci-Fi and Fantasy novels from the last decade', 
    lastActivity: 'Yesterday',
    systemPrompt: 'You are a librarian recommending books.',
    messages: [] 
  },
  { 
    id: '4', 
    title: 'Travel Plans for Summer Vacation in Southeast Asia', 
    lastActivity: '2 days ago',
    systemPrompt: 'You are a travel agent planning a trip.',
    messages: []
  },
  { 
    id: '5', 
    title: 'Quick question about project setup', 
    lastActivity: '1 week ago',
    systemPrompt: 'You are a tech support bot.',
    messages: []
  },
];

const mockMessagesShort: ChatMessage[] = [
  { id: 'm1', sender: 'ai', text: 'Hello! How can I help you today?', timestamp: '10:00 AM' },
  { id: 'm2', sender: 'user', text: 'I want to learn about SolidJS.', timestamp: '10:01 AM' },
  { id: 'm3', sender: 'ai', text: 'Great! SolidJS is a declarative JavaScript library for building user interfaces. It\'s known for its fine-grained reactivity and performance.', timestamp: '10:01 AM' },
  { id: 'm4', sender: 'user', text: 'Sounds interesting! How does it compare to React?', timestamp: '10:02 AM' },
];

const generateLongMessagesForStory = (): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < 20; i++) {
    messages.push({
      id: `ai-long-${i}`,
      sender: 'ai',
      text: `This is an AI response, message number ${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. We can make these messages quite long to ensure the scrolling behavior is thoroughly tested. This one will be even longer to take up more vertical space. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`,
      timestamp: `11:${i < 10 ? '0' : ''}${i} AM`
    });
    messages.push({
      id: `user-long-${i}`,
      sender: 'user',
      text: `This is a user reply, message number ${i + 1}. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper. Aenean ultricies mi vitae est. Mauris placerat eleifend leo. This message also needs to be fairly substantial to contribute to the overall height of the content, forcing the container to scroll rather than the entire page. Is the scroll working as expected?`,
      timestamp: `11:${i < 10 ? '0' : ''}${i} AM` 
    });
  }
  return messages;
};

const baseArgs = {
  threads: mockThreads,
  currentChatMessages: mockMessagesShort,
  currentThreadId: '1',
  onNavigateBack: () => console.log('Navigate Back clicked'),
  onSendMessage: (text: string) => console.log('Send Message:', text),
  onSelectThread: (threadId: string) => console.log('Select Thread:', threadId),
};

export default {
  title: 'Features/Chat/ChatPageView',
  component: ChatPageView,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: baseArgs, 
  argTypes: {
    onNavigateBack: { action: 'onNavigateBack' },
    onSendMessage: { action: 'onSendMessage' },
    onSelectThread: { action: 'onSelectThread' },
    threads: { control: 'object' },
    currentChatMessages: { control: 'object' },
    currentThreadId: { control: 'text' },
  }
};

export const Default = {
  render: (args: any) => <ChatPageView {...args} />,
  args: {
    ...baseArgs,
  },
};

export const EmptyChat = {
  render: (args: any) => <ChatPageView {...args} />,
  args: {
    ...baseArgs,
    currentChatMessages: [],
    currentThreadId: '2',
  },
};

export const LongConversation = {
  render: (args: any) => <ChatPageView {...args} />,
  args: {
    ...baseArgs,
    currentChatMessages: generateLongMessagesForStory(),
    currentThreadId: '3',
  },
};

export const NoSessions = {
  render: (args: any) => <ChatPageView {...args} />,
  args: {
    ...baseArgs,
    threads: [],
    currentChatMessages: [],
    currentThreadId: null,
  },
};

export const NoActiveSession = {
  render: (args: any) => <ChatPageView {...args} />,
  args: {
    ...baseArgs,
    currentChatMessages: [],
    currentThreadId: null,
  },
};

export const AiMessageFirst = {
  render: (args: any) => <ChatPageView {...args} />,
  args: {
    ...baseArgs,
    currentChatMessages: [
      { id: 'm1-ai-first', sender: 'ai', text: 'Welcome! How can I assist you?', timestamp: '11:00 AM' },
      ...mockMessagesShort.slice(1).map(m => ({...m, id: `${m.id}-ai-first`})) 
    ],
    currentThreadId: '1',
  },
};

export const UserMessageFirst = {
  render: (args: any) => <ChatPageView {...args} />,
  args: {
    ...baseArgs,
    currentChatMessages: [
        { id: 'm0-user-first', sender: 'user', text: 'Hello?', timestamp: '10:00 AM' },
        ...mockMessagesShort.map(m => ({...m, id: `${m.id}-user-first`})) 
    ],
    currentThreadId: '1',
  },
};
