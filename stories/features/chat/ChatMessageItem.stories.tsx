import { ChatMessageItem, type ChatMessageItemProps, type AlignmentData } from '../../../src/features/chat/ChatMessageItem';
import type { ChatMessage } from '../../../src/features/chat/types';
import type { JSX } from 'solid-js';
import { createSignal } from 'solid-js'; // Needed for reactive highlighting in story

// Define types for Storybook play function arguments
interface PlayFunctionContext<TArgs = ChatMessageItemProps> {
  canvasElement: HTMLElement;
  args: TArgs;
  updateArgs: (newArgs: Partial<TArgs>) => void;
}

export default {
  title: 'Features/Chat/ChatMessageItem',
  component: ChatMessageItem,
  tags: ['autodocs'],
  argTypes: {
    message: { control: 'object' },
    currentHighlightIndex: { control: 'number' },
  },
  decorators: [
    (StoryComponent: () => JSX.Element) => (
      <div class="max-w-md mx-auto p-4 bg-background">
        <StoryComponent />
      </div>
    ),
  ],
};

const userMessage: ChatMessage = {
  id: 'm-user',
  thread_id: 'thread-storybook',
  sender: 'user',
  text_content: 'Hello, this is a test message from the user.',
  timestamp: '10:00 AM',
};

const aiMessage: ChatMessage = {
  id: 'm-ai',
  thread_id: 'thread-storybook',
  sender: 'ai',
  text_content: 'Hi there! This is AI.',
  timestamp: '10:01 AM',
};

const aiMessageForHighlighting: ChatMessage = {
    id: 'm-ai-highlight',
    thread_id: 'thread-storybook',
    sender: 'ai',
    text_content: 'Hello world, this is a test for highlighting words.',
    timestamp: '10:05 AM',
};

const sampleAlignment: AlignmentData = {
    // Corresponds to "Hello world, this is a test for highlighting words."
    // For simplicity, let's assume characters are words here for the story
    characters: ['Hello', ' ', 'world', ',', ' ', 'this', ' ', 'is', ' ', 'a', ' ', 'test', ' ', 'for', ' ', 'highlighting', ' ', 'words', '.'],
    character_start_times_seconds: [0, 0.5, 0.6, 1.1, 1.2, 1.3, 1.7, 1.8, 2.1, 2.2, 2.4, 2.5, 2.9, 3.0, 3.3, 3.4, 4.4, 4.5, 5.0 ],
    character_end_times_seconds:   [0.5, 0.6, 1.1, 1.2, 1.3, 1.7, 1.8, 2.1, 2.2, 2.4, 2.5, 2.9, 3.0, 3.3, 3.4, 4.4, 4.5, 5.0, 5.1 ],
};

export const UserMessage = {
  args: {
    message: userMessage,
  },
};

export const AiMessageInitial = {
  name: 'AI Message (Initial - Generate Audio)',
  args: {
    message: aiMessage,
  },
};

export const AiMessageGenerating = {
  name: 'AI Message (Simulated Generating State)',
  args: {
    message: aiMessage,
  },
  play: async ({ canvasElement }: PlayFunctionContext<ChatMessageItemProps>) => {
    const generateButton = canvasElement.querySelector('button');
    if (generateButton && generateButton.textContent?.includes('Generate Audio')) {
      generateButton.click();
    }
  },
};

export const AiMessageAudioReady = {
  name: 'AI Message (Simulated Audio Ready State)',
  args: {
    message: aiMessage,
  },
  play: async ({ canvasElement }: PlayFunctionContext<ChatMessageItemProps>) => {
    const generateButton = canvasElement.querySelector('button');
    if (generateButton && generateButton.textContent?.includes('Generate Audio')) {
      generateButton.click();
      await new Promise(resolve => setTimeout(resolve, 1600)); 
    }
  },
};

export const AiMessagePlaying = {
  name: 'AI Message (Simulated Playing State)',
  args: {
    message: aiMessage,
  },
  play: async ({ canvasElement }: PlayFunctionContext<ChatMessageItemProps>) => {
    const generateButton = canvasElement.querySelector('button');
    if (generateButton && generateButton.textContent?.includes('Generate Audio')) {
      generateButton.click();
      await new Promise(resolve => setTimeout(resolve, 1600));
      const playButton = canvasElement.querySelector('button'); 
      if (playButton && playButton.textContent?.includes('Play Audio')) {
        playButton.click();
      }
    }
  },
};

export const AiMessageWithHighlightingStatic = {
  name: 'AI Message (Static Highlight - word 2)',
  args: {
    message: aiMessageForHighlighting,
    alignment: sampleAlignment,
    currentHighlightIndex: 2, // Highlights 'world'
  },
};

// Story to demonstrate highlight animation
export const AiMessageWithSimulatedHighlighting = {
    name: 'AI Message (Animated Highlighting)',
    args: {
        message: aiMessageForHighlighting,
        alignment: sampleAlignment,
        currentHighlightIndex: null, // Start with no highlight
    },
    render: (renderArgs: ChatMessageItemProps) => { // Explicitly type renderArgs
        const [highlightIndex, setHighlightIndex] = createSignal<number | null>(renderArgs.currentHighlightIndex || null);
        
        (window as any).__setHighlightIndex = setHighlightIndex; 

        return <ChatMessageItem {...renderArgs} currentHighlightIndex={highlightIndex()} />;
    },
    play: async ({ updateArgs }: PlayFunctionContext<ChatMessageItemProps>) => { // Removed unused args, explicitly typed PlayFunctionContext
        const numSegments = sampleAlignment.characters.length;
        if (!numSegments) return;

        for (let i = 0; i < numSegments; i++) {
            if ((window as any).__setHighlightIndex) {
                (window as any).__setHighlightIndex(i);
            } else {
                // Fallback or alternative if window hack isn't preferred/working
                // This relies on storybook re-rendering the component when args change
                updateArgs({ currentHighlightIndex: i } as Partial<ChatMessageItemProps>);
            }
            const delay = (sampleAlignment.character_end_times_seconds[i] - sampleAlignment.character_start_times_seconds[i]) * 1000;
            await new Promise(resolve => setTimeout(resolve, Math.max(100, delay) * 0.7));
        }
        if ((window as any).__setHighlightIndex) {
            (window as any).__setHighlightIndex(null);
            delete (window as any).__setHighlightIndex;
        } else {
            updateArgs({ currentHighlightIndex: null } as Partial<ChatMessageItemProps>);
        }
    },
};

export const DefaultUserMessage = {
  args: {
    message: {
      id: '1',
      sender: 'user',
      text_content: 'Hello, this is a test message from the user.',
      timestamp: new Date().toISOString(),
    },
  },
};

export const DefaultAIMessage = {
  args: {
    message: {
      id: '2',
      sender: 'ai',
      text_content: 'Hi there! This is AI.',
      timestamp: new Date().toISOString(),
    },
  },
};

export const AIWithHighlighting = {
  args: {
    message: {
      id: '3',
      sender: 'ai',
      text_content: 'Hello world, this is a test for highlighting words.',
      timestamp: new Date().toISOString(),
      tts_lang: 'en',
    },
  },
}; 