import { Component, Show, createSignal, For } from 'solid-js';
import type { ChatMessage, AlignmentData as ChatAlignmentData } from './types';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Popover } from '@kobalte/core/popover';
import { Play, Pause, ArrowClockwise } from 'phosphor-solid';
import { useChat } from './chatStore';

// WordInfo is expected to be provided by the parent or defined in a shared types file if necessary.
// For now, we assume it matches the structure used by the parent.
interface WordInfo {
    word: string;
    start: number;
    end: number;
}

export interface ChatMessageItemProps {
  message: ChatMessage;
  isLastInGroup?: boolean;
  // Props for TTS highlighting, passed from UnifiedConversationView
  isCurrentSpokenMessage?: boolean;
  wordMap?: WordInfo[]; 
  currentHighlightIndex?: number | null;
  isStreaming?: boolean; // Controls TTS button visibility
  isGlobalTTSSpeaking?: boolean; // Added to reflect global TTS state
  onChangeSpeed?: (messageId: string, speed: number) => void; // Modified for speed control
}

const POPOVER_CONTENT_CLASS = "absolute right-0 bottom-full mb-2 z-10 w-56 rounded-md bg-popover p-1 text-popover-foreground shadow-md outline-none";
const POPOVER_ITEM_CLASS_BASE = "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
const POPOVER_ITEM_CLASS = `${POPOVER_ITEM_CLASS_BASE} justify-start`;

export type { ChatAlignmentData as AlignmentData };

// CSS for word highlighting
const HIGHLIGHT_CSS = `
  .scarlett-unified-word-span {
    /* Default for inline is fine, but explicit for clarity */
    display: inline;
    background-color: transparent; /* Start transparent */
    border-radius: 2px; /* Subtle rounding */
    /* Padding can make inline highlights look a bit blockier, adjust as needed */
    /* padding: 0.05em 0.1em; */ 
    transition: background-color 0.2s ease-out;
    will-change: background-color; /* Hint for optimization */
  }
  .scarlett-unified-word-highlight {
    background-color: hsl(240, 5%, 25%);
  }
`;

export const ChatMessageItem: Component<ChatMessageItemProps> = (props) => {
  const { message } = props;
  const [state, actions] = useChat();
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);

  // Local derived TTS state
  const isStreaming = () => !!message.isStreaming || !!props.isStreaming;
  const wordMap = () => message.ttsWordMap;
  const isGlobalTTS = () => state.isGlobalTTSSpeaking;
  const isCurrentSpokenMessage = () => state.currentSpokenMessageId === message.id;
  const currentHighlightIndex = () => state.currentHighlightIndex;
  const canInteractWithTTS = () => !isStreaming() && message.text_content && message.text_content.trim() !== '';
  const isAnotherMessagePlaying = () => isGlobalTTS() && !isCurrentSpokenMessage();

  const isThisMessagePlaying = () => isGlobalTTS() && isCurrentSpokenMessage();

  const handlePlaySpeed = (speed: number) => {
    setIsPopoverOpen(false);
    if (props.onChangeSpeed) {
      props.onChangeSpeed(props.message.id, speed);
    } else {
      console.warn("[ChatMessageItem] onChangeSpeed prop is not provided.");
    }
  };

  const handleRegenerate = () => {
    console.log('[ChatMessageItem] Regenerate audio');
    setIsPopoverOpen(false);
    if (canInteractWithTTS()) {
      actions.playTTS({
        messageId: message.id,
        text: message.text_content,
        lang: message.tts_lang ?? 'en'
      }).catch(error => console.error('[ChatMessageItem] Error regenerating TTS:', error));
    }
  };

  return (
    <>
      <style>{HIGHLIGHT_CSS}</style>
      <div class={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
        <div class={`max-w-[75%] md:max-w-[70%] p-2 px-3 rounded-lg break-words no-underline outline-none ${
            message.sender === 'user'
              ? 'bg-neutral-700 text-neutral-50 shadow-sm'
              : 'bg-transparent text-foreground'
          }`}>
          <div class="relative">
            {/* Unified character-span container for AI messages */}
            <div class="text-md whitespace-pre-wrap break-words">
              <Show
                when={message.sender === 'ai' && isCurrentSpokenMessage() && wordMap() && wordMap()!.length > 0}
                fallback={
                  <span class="whitespace-pre-wrap break-words">
                    {message.text_content}
                    <Show when={message.sender === 'ai' && isStreaming() && (!message.text_content || message.text_content.trim() === '')}>
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
                  onClick={() => {
                    console.log('[ChatMessageItem] Speak button clicked. Message:', message.text_content, 'Language:', message.tts_lang);
                    actions.playTTS({
                      messageId: message.id,
                      text: message.text_content,
                      lang: message.tts_lang ?? 'en'
                    }).catch(e => console.error('[ChatMessageItem] playTTS error', e));
                  }}
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
                  console.log('[ChatMessageItem] Popover open state changed:', open);
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