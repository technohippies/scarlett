import { Component, Show, createSignal, For } from 'solid-js';
import type { ChatMessage } from './types';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Popover } from '@kobalte/core/popover';
import { Play, ArrowClockwise } from 'phosphor-solid';

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
  onPlayTTS?: (messageId: string, text: string, lang: string, alignmentDataParam?: any) => Promise<void>;
  isStreaming?: boolean; // Controls TTS button visibility
  isGlobalTTSSpeaking?: boolean; // Added to reflect global TTS state
  onChangeSpeed?: (messageId: string, speed: number) => void; // Modified for speed control
}

const POPOVER_CONTENT_CLASS = "absolute right-0 bottom-full mb-2 z-10 w-56 rounded-md bg-popover p-1 text-popover-foreground shadow-md outline-none";
const POPOVER_ITEM_CLASS_BASE = "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
const POPOVER_ITEM_CLASS = `${POPOVER_ITEM_CLASS_BASE} justify-start`;

export const ChatMessageItem: Component<ChatMessageItemProps> = (props) => {
  const { message } = props;
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);

  const canInteractWithTTS = () => !props.isStreaming && message.text_content && message.text_content.trim() !== '';
  const isThisMessagePlaying = () => props.isGlobalTTSSpeaking && props.isCurrentSpokenMessage;
  const isAnotherMessagePlaying = () => props.isGlobalTTSSpeaking && !props.isCurrentSpokenMessage;

  const handlePrimaryTTSAction = () => {
    if (props.onPlayTTS && canInteractWithTTS()) {
      props.onPlayTTS(message.id, message.text_content, message.ttsLang || 'en', message.alignmentData)
        .catch(error => console.error("[ChatMessageItem] Error calling onPlayTTS:", error));
    }
  };
  
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
    if (props.onPlayTTS && canInteractWithTTS()) {
      // Call onPlayTTS, UnifiedConversationView's handlePlayTTS will stop existing and regenerate
      props.onPlayTTS(message.id, message.text_content, message.ttsLang || 'en', undefined) // Pass undefined for alignment to force refetch
        .catch(error => console.error("[ChatMessageItem] Error calling onPlayTTS for regenerate:", error));
    }
  };

  return (
    <div class={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
      <div
        class={`max-w-[75%] md:max-w-[70%] p-2 px-3 rounded-lg shadow-sm break-words no-underline outline-none ${
          message.sender === 'user'
            ? 'bg-neutral-700 text-neutral-50'
            : 'bg-transparent text-foreground'
        }`}
      >
        <Show 
          when={message.sender === 'ai' && props.isStreaming && (!message.text_content || message.text_content.trim() === '')}
          fallback={
            <Show 
              when={message.sender === 'ai' && props.isCurrentSpokenMessage && props.wordMap && props.wordMap.length > 0}
              fallback={<p class="text-md whitespace-pre-wrap">{message.text_content}</p>}
            >
              <p class="text-md whitespace-pre-wrap">
                <For each={props.wordMap || []}>{(item, index) => (
                  <span 
                    class="scarlett-unified-word-span"
                    classList={{ 'scarlett-unified-word-highlight': props.currentHighlightIndex === index() }}
                    data-word-index={index()}
                  >
                    {item.word.replace(/ /g, '\u00A0')} 
                  </span>
                )}</For>
              </p>
            </Show>
          }
        >
          <div class="flex items-center justify-center h-full">
            <Spinner class="size-5 text-muted-foreground" />
          </div>
        </Show>
      </div>

      <Show when={message.sender === 'ai' && canInteractWithTTS()}>
        <div class="mt-2 w-full max-w-[75%] md:max-w-[70%]">
            <div class="flex items-center"> 
              <Button 
                variant="outline" 
                size="lg"
                onClick={handlePrimaryTTSAction}
                class="flex-grow rounded-r-none" // Occupy available space, remove right rounding
                disabled={isAnotherMessagePlaying()}
              >
                <Show 
                  when={isThisMessagePlaying()} 
                  fallback={
                    <><Play weight="fill" class="size-4 mr-2" /> Play Audio</>
                  }
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 mr-2 animate-pulse"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                  Playing...
                </Show>
              </Button>
              <Popover placement="top-end" gutter={4} open={isPopoverOpen()} onOpenChange={setIsPopoverOpen}>
                <Popover.Trigger
                  aria-label="More options"
                  disabled={isAnotherMessagePlaying()}
                  class="inline-flex items-center justify-center whitespace-nowrap rounded-l-none rounded-r-md border-l-0 w-11 h-11 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="m6 9 6 6 6-6" /></svg>
                </Popover.Trigger>
                <Show when={isPopoverOpen()}>
                  <Popover.Content class={POPOVER_CONTENT_CLASS} onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div class="flex flex-col">
                      <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.85)} disabled={isAnotherMessagePlaying()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.85x </Button>
                      <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.70)} disabled={isAnotherMessagePlaying()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.70x </Button>
                      <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={handleRegenerate} disabled={isAnotherMessagePlaying()}> <ArrowClockwise weight="regular" class="mr-2 size-4" /> Regenerate </Button>
                    </div>
                  </Popover.Content>
                </Show>
              </Popover>
            </div>
        </div>
      </Show>
    </div>
  );
}; 