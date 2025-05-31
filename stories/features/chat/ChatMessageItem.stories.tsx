import { Component, Show, createSignal, For } from 'solid-js';
import type { ChatMessage } from '../../../src/features/chat/types';
import { Button } from '../../../src/components/ui/button';
import { Spinner } from '../../../src/components/ui/spinner';
import { Popover } from '@kobalte/core/popover';
import { Play, Pause, ArrowClockwise } from 'phosphor-solid';
import type { JSX } from 'solid-js';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../../src/components/ui/accordion';

// WordInfo interface
interface WordInfo {
  word: string;
  start: number;
  end: number;
}

export interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface ChatMessageItemProps {
  message: ChatMessage;
  isLastInGroup?: boolean;
  // Props for TTS highlighting
  isCurrentSpokenMessage?: boolean;
  wordMap?: WordInfo[]; 
  currentHighlightIndex?: number | null;
  isStreaming?: boolean;
  isGlobalTTSSpeaking?: boolean;
  onChangeSpeed?: (messageId: string, speed: number) => void;
  // For Storybook alignment testing
  alignment?: AlignmentData;
}

const POPOVER_CONTENT_CLASS = "absolute right-0 bottom-full mb-2 z-10 w-56 rounded-md bg-popover p-1 text-popover-foreground shadow-md outline-none";
const POPOVER_ITEM_CLASS_BASE = "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
const POPOVER_ITEM_CLASS = `${POPOVER_ITEM_CLASS_BASE} justify-start`;

// CSS for word highlighting
const HIGHLIGHT_CSS = `
  .scarlett-unified-word-span {
    display: inline;
    background-color: transparent;
    border-radius: 2px;
    transition: background-color 0.2s ease-out;
    will-change: background-color;
  }
  .scarlett-unified-word-highlight {
    background-color: hsl(240, 5%, 25%);
  }
`;

// Mock ChatMessageItem for Storybook (no browser extension dependencies)
const MockChatMessageItem: Component<ChatMessageItemProps> = (props) => {
  const { message } = props;
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);
  const [isPlaying, setIsPlaying] = createSignal(false);

  // Mock TTS state based on props
  const isStreaming = () => !!props.isStreaming || !!message.isStreaming;
  const wordMap = () => {
    if (props.wordMap) return props.wordMap;
    if (props.alignment) {
      // Convert alignment data to word map for testing
      return props.alignment.characters.map((char, index) => ({
        word: char,
        start: props.alignment!.character_start_times_seconds[index],
        end: props.alignment!.character_end_times_seconds[index],
      }));
    }
    return null;
  };
  const isGlobalTTS = () => !!props.isGlobalTTSSpeaking || isPlaying();
  const isCurrentSpokenMessage = () => !!props.isCurrentSpokenMessage || isPlaying();
  const currentHighlightIndex = () => props.currentHighlightIndex;
  const canInteractWithTTS = () => !isStreaming() && message.text_content && message.text_content.trim() !== '';
  const isAnotherMessagePlaying = () => isGlobalTTS() && !isCurrentSpokenMessage();
  const isThisMessagePlaying = () => isGlobalTTS() && isCurrentSpokenMessage();

  const handlePlaySpeed = (speed: number) => {
    console.log('[MockChatMessageItem] Play at speed:', speed);
    setIsPopoverOpen(false);
    if (props.onChangeSpeed) {
      props.onChangeSpeed(message.id, speed);
    }
  };

  const handleRegenerate = () => {
    console.log('[MockChatMessageItem] Regenerate audio');
    setIsPopoverOpen(false);
  };

  const handlePlay = () => {
    console.log('[MockChatMessageItem] Play/Pause clicked');
    setIsPlaying(!isPlaying());
  };

  const formatThinkingDuration = () => {
    const duration = message.thinking_duration;
    if (!duration) return '';
    if (duration < 1) return 'Thought briefly';
    if (duration < 60) return `Thought for ${duration.toFixed(1)} seconds`;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `Thought for ${minutes}m ${seconds}s`;
  };

  return (
    <>
      <style>{HIGHLIGHT_CSS}</style>
      <div class={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
        {/* Thinking section for AI messages */}
        <Show when={message.sender === 'ai' && (message.thinking_content || message.is_thinking_complete === false)}>
          <div class="w-full max-w-[75%] md:max-w-[70%] mb-2">
            <Accordion collapsible class="w-full">
              <AccordionItem value="thinking">
                <AccordionTrigger class="text-left text-sm font-normal text-muted-foreground py-2">
                  <Show when={message.is_thinking_complete !== false} fallback="Thinking...">
                    {formatThinkingDuration()}
                  </Show>
                </AccordionTrigger>
                <AccordionContent>
                  <div class="text-sm font-mono bg-muted/30 p-3 rounded border-l-2 border-muted-foreground/20 whitespace-pre-wrap">
                    <Show when={message.thinking_content} fallback={
                      <div class="flex items-center space-x-2">
                        <Spinner class="size-4" />
                        <span class="text-muted-foreground">Thinking in progress...</span>
                      </div>
                    }>
                      {message.thinking_content}
                    </Show>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </Show>
        <div class={`max-w-[75%] md:max-w-[70%] p-2 px-3 rounded-lg break-words no-underline outline-none ${
            message.sender === 'user'
              ? 'bg-neutral-700 text-neutral-50 shadow-sm'
              : 'bg-transparent text-foreground'
          }`}>
          <div class="relative">
            <div class="text-md whitespace-pre-wrap break-words">
              <Show
                when={message.sender === 'ai' && isCurrentSpokenMessage() && wordMap() && wordMap()!.length > 0}
                fallback={
                  <span class="whitespace-pre-wrap break-words">
                    {message.text_content}
                    <Show when={message.sender === 'ai' && isStreaming()}>
                      <Spinner class="ml-2 size-4 text-muted-foreground" />
                    </Show>
                  </span>
                }
              >
                <span class="whitespace-pre-wrap break-words">
                  <For each={wordMap()!}>
                    {(item, index) =>
                      (item.word === ' ' || item.word === '\u00A0')
                        ? item.word
                        : (
                          <span
                            class="scarlett-unified-word-span"
                            classList={{ 'scarlett-unified-word-highlight': currentHighlightIndex() === index() && isCurrentSpokenMessage() }}
                            data-word-index={index()}
                          >
                            {item.word}
                          </span>
                        )
                    }
                  </For>
                  <Show when={message.sender === 'ai' && isStreaming()}>
                    <Spinner class="ml-2 size-4 text-muted-foreground" />
                  </Show>
                </span>
              </Show>
            </div>
          </div>
        </div>

        <Show when={message.sender === 'ai' && canInteractWithTTS()}>
          <div class="mt-1 w-full max-w-[75%] md:max-w-[70%] px-3">
            <div class="flex items-center"> 
              {/* Main play/pause button */}
              <button
                onClick={handlePlay}
                class="inline-flex items-center justify-center rounded-md w-6 h-6 text-muted-foreground hover:text-foreground transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                disabled={isAnotherMessagePlaying()}
                aria-label="Play audio"
              >
                <Show
                  when={isThisMessagePlaying()}
                  fallback={<Play weight="fill" class="size-3.5" />}
                >
                  <Pause weight="fill" class="size-3.5" />
                </Show>
              </button>
              {/* Dropdown for options */}
              <Popover placement="top-start" gutter={4} open={isPopoverOpen()} onOpenChange={(open) => {
                console.log('[MockChatMessageItem] Popover open state changed:', open);
                setIsPopoverOpen(open);
              }}>
                <Popover.Trigger
                  aria-label="More options"
                  disabled={isAnotherMessagePlaying()}
                  class="inline-flex items-center justify-center rounded-md w-4 h-4 ml-1 text-muted-foreground hover:text-foreground transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3"><path d="m6 9 6 6 6-6" /></svg>
                </Popover.Trigger>
                <Show when={isPopoverOpen()}>
                  <Popover.Content class={POPOVER_CONTENT_CLASS} onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div class="flex flex-col">
                      <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.80)} disabled={isAnotherMessagePlaying()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.80x </Button>
                      <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.75)} disabled={isAnotherMessagePlaying()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.75x </Button>
                      <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={handleRegenerate} disabled={isAnotherMessagePlaying()}> <ArrowClockwise weight="regular" class="mr-2 size-4" /> Regenerate </Button>
                    </div>
                  </Popover.Content>
                </Show>
              </Popover>
            </div>
          </div>
        </Show>
      </div>
    </>
  );
};

// Define types for Storybook play function arguments
interface PlayFunctionContext<TArgs = ChatMessageItemProps> {
  canvasElement: HTMLElement;
  args: TArgs;
  updateArgs: (newArgs: Partial<TArgs>) => void;
}

export default {
  title: 'Features/Chat/ChatMessageItem',
  component: MockChatMessageItem,
  tags: ['autodocs'],
  argTypes: {
    message: { control: 'object' },
    currentHighlightIndex: { control: 'number' },
    isGlobalTTSSpeaking: { control: 'boolean' },
    isCurrentSpokenMessage: { control: 'boolean' },
    isStreaming: { control: 'boolean' },
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
  text_content: 'Hi there! This is AI response with some text to test the TTS functionality.',
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

export const AiMessagePlaying = {
  name: 'AI Message (Playing State)',
  args: {
    message: aiMessage,
    isGlobalTTSSpeaking: true,
    isCurrentSpokenMessage: true,
  },
};



export const AiMessageWithHighlightingStatic = {
  name: 'AI Message (Static Highlight - word 2)',
  args: {
    message: aiMessageForHighlighting,
    alignment: sampleAlignment,
    currentHighlightIndex: 2, // Highlights 'world'
    isCurrentSpokenMessage: true,
  },
};

// Story to demonstrate highlight animation
export const AiMessageWithSimulatedHighlighting = {
  name: 'AI Message (Animated Highlighting)',
  args: {
    message: aiMessageForHighlighting,
    alignment: sampleAlignment,
    currentHighlightIndex: null,
    isCurrentSpokenMessage: true,
  },
  render: (renderArgs: ChatMessageItemProps) => {
    const [highlightIndex, setHighlightIndex] = createSignal<number | null>(renderArgs.currentHighlightIndex || null);
    
    (window as any).__setHighlightIndex = setHighlightIndex; 

    return <MockChatMessageItem {...renderArgs} currentHighlightIndex={highlightIndex()} />;
  },
  play: async ({ updateArgs }: PlayFunctionContext<ChatMessageItemProps>) => {
    const numSegments = sampleAlignment.characters.length;
    if (!numSegments) return;

    for (let i = 0; i < numSegments; i++) {
      if ((window as any).__setHighlightIndex) {
        (window as any).__setHighlightIndex(i);
      } else {
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
      text_content: 'Hi there! This is AI response that can be played with TTS.',
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
    alignment: sampleAlignment,
    currentHighlightIndex: 5, // Highlight "this"
    isCurrentSpokenMessage: true,
  },
};

// Thinking model examples
export const ThinkingModelComplete = {
  name: 'AI Message (With Thinking - Complete)',
  args: {
    message: {
      id: 'thinking-complete',
      thread_id: 'thread-storybook',
      sender: 'ai',
      text_content: 'The equation x² - 5x + 6 = 0 has two solutions: x = 2 and x = 3.\n\nI solved this by factoring: (x - 2)(x - 3) = 0, which gives us x = 2 or x = 3.',
      timestamp: new Date().toISOString(),
      thinking_content: `I need to solve the quadratic equation x² - 5x + 6 = 0.

Let me try factoring first. I'm looking for two numbers that multiply to 6 and add to -5.

The factors of 6 are:
- 1 and 6 (sum = 7)
- -1 and -6 (sum = -7)
- 2 and 3 (sum = 5)
- -2 and -3 (sum = -5) ✓

So I can factor this as: (x - 2)(x - 3) = 0

This gives me x = 2 or x = 3.

Let me verify:
- For x = 2: 2² - 5(2) + 6 = 4 - 10 + 6 = 0 ✓
- For x = 3: 3² - 5(3) + 6 = 9 - 15 + 6 = 0 ✓

Both solutions check out.`,
      thinking_duration: 3.2,
      is_thinking_complete: true,
    },
  },
};

export const ThinkingModelInProgress = {
  name: 'AI Message (Thinking in Progress)',
  args: {
    message: {
      id: 'thinking-progress',
      thread_id: 'thread-storybook',
      sender: 'ai',
      text_content: '',
      timestamp: new Date().toISOString(),
      thinking_content: `I need to analyze this complex problem step by step.

First, let me understand what we're dealing with:
- This is a mathematical equation
- It appears to be quadratic
- I should try different solution methods

Let me start with factoring...`,
      is_thinking_complete: false,
      isStreaming: true,
    },
  },
};

export const ThinkingModelLongContent = {
  name: 'AI Message (Long Thinking Process)',
  args: {
    message: {
      id: 'thinking-long',
      thread_id: 'thread-storybook',
      sender: 'ai',
      text_content: 'Based on my analysis, I recommend implementing a microservices architecture with the following components...',
      timestamp: new Date().toISOString(),
      thinking_content: `This is a complex software architecture question. Let me think through this systematically.

First, I need to consider the requirements:
1. Scalability - the system needs to handle varying loads
2. Maintainability - the codebase should be easy to update
3. Performance - response times should be optimal
4. Cost - solution should be cost-effective

Now let me evaluate different architectural patterns:

Monolithic Architecture:
- Pros: Simple deployment, easier debugging, no network latency between components
- Cons: Scaling entire app for one component, technology lock-in, large codebase

Microservices Architecture:
- Pros: Independent scaling, technology diversity, team autonomy, fault isolation
- Cons: Distributed system complexity, network latency, data consistency challenges

Service-Oriented Architecture (SOA):
- Pros: Reusability, modularity, platform independence
- Cons: Performance overhead, complexity in service management

Given the requirements, microservices seems like the best fit because:
1. Each service can scale independently based on demand
2. Teams can use different technologies for different services
3. Fault isolation prevents cascade failures
4. Easier to maintain and update individual services

Key components I would recommend:
- API Gateway for routing and authentication
- Service discovery for dynamic service location
- Load balancers for distributing traffic
- Message queues for asynchronous communication
- Centralized logging and monitoring
- Database per service pattern for data isolation`,
      thinking_duration: 127.5,
      is_thinking_complete: true,
    },
  },
}; 