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
}

const POPOVER_CONTENT_CLASS = "absolute right-0 bottom-full mb-2 z-10 w-56 rounded-md bg-popover p-1 text-popover-foreground shadow-md outline-none";
const POPOVER_ITEM_CLASS_BASE = "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
const POPOVER_ITEM_CLASS = `${POPOVER_ITEM_CLASS_BASE} justify-start`;

export const ChatMessageItem: Component<ChatMessageItemProps> = (props) => {
  const { message } = props;

  // Local state for mock TTS button interactions (Generate Audio, Play, etc.)
  // This part is kept as is for now, as it's separate from the text rendering/highlighting logic.
  const [isGeneratingAudio, setIsGeneratingAudio] = createSignal(false);
  const [isAudioReady, setIsAudioReady] = createSignal(false);
  const [isPlayingAudio, setIsPlayingAudio] = createSignal(false);
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);

  const handleTTSAction = () => {
    if (!isAudioReady()) {
      setIsGeneratingAudio(true);
      setTimeout(() => {
        setIsGeneratingAudio(false);
        setIsAudioReady(true);
      }, 1500);
    } else {
      setIsPlayingAudio(!isPlayingAudio());
    }
  };
  
  const handlePlaySpeed = (speed: number) => {
    console.log('Change speed to:', speed);
    setIsPopoverOpen(false);
    if (isPlayingAudio()) {
        setIsPlayingAudio(false); 
        setIsGeneratingAudio(true);
        setTimeout(() => {
            setIsGeneratingAudio(false);
            setIsAudioReady(true);
        }, 1000);
    } else if (isAudioReady()) {
         setIsGeneratingAudio(true);
        setTimeout(() => {
            setIsGeneratingAudio(false);
            setIsAudioReady(true);
        }, 1000);
    }
  };

  const handleRegenerate = () => {
    console.log('Regenerate audio');
    setIsPopoverOpen(false);
    setIsAudioReady(false);
    setIsPlayingAudio(false);
    setIsGeneratingAudio(true);
    setTimeout(() => {
      setIsGeneratingAudio(false);
      setIsAudioReady(true);
    }, 1500);
  };

  return (
    <div class={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
      <div
        class={`max-w-[75%] md:max-w-[70%] p-2 px-3 rounded-lg shadow-sm break-words no-underline outline-none ${
          message.sender === 'user'
            ? 'bg-neutral-700 text-neutral-50'
            : 'bg-transparent text-foreground' // AI messages have transparent background for highlighting to show through
        }`}
      >
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
      </div>

      {/* TTS Action Buttons - this section's logic remains for local UI interaction for now */}
      <Show when={message.sender === 'ai'}>
        <div class="mt-2 w-full max-w-[75%] md:max-w-[70%]">
          <Show when={isGeneratingAudio()}
            fallback={
              <Show when={isAudioReady()}
                fallback={ 
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={handleTTSAction} 
                    class="" 
                    disabled={isGeneratingAudio()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 mr-2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                    Generate Audio
                  </Button>
                }
              >
                <div class="flex items-center"> 
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={handleTTSAction}
                    class="rounded-r-none"
                    disabled={isGeneratingAudio()}
                  >
                    <Show when={isPlayingAudio()} fallback={
                      <><Play weight="fill" class="size-4 mr-2" /> Play Audio</>
                    }>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 mr-2 animate-pulse"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                       Playing...
                    </Show>
                  </Button>
                  <Popover placement="top-end" gutter={4} open={isPopoverOpen()} onOpenChange={setIsPopoverOpen}>
                    <Popover.Trigger
                      aria-label="More options"
                      disabled={isGeneratingAudio()}
                      class="inline-flex items-center justify-center whitespace-nowrap rounded-l-none rounded-r-md border-l-0 w-11 h-11 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="m6 9 6 6 6-6" /></svg>
                    </Popover.Trigger>
                    <Show when={isPopoverOpen()}>
                      <Popover.Content class={POPOVER_CONTENT_CLASS} onOpenAutoFocus={(e) => e.preventDefault()}>
                        <div class="flex flex-col">
                          <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.85)} disabled={isGeneratingAudio()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.85x </Button>
                          <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.70)} disabled={isGeneratingAudio()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.70x </Button>
                          <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={handleRegenerate} disabled={isGeneratingAudio()}> <ArrowClockwise weight="regular" class="mr-2 size-4" /> Regenerate </Button>
                        </div>
                      </Popover.Content>
                    </Show>
                  </Popover>
                </div>
              </Show>
            }
          >
            <Button variant="outline" size="lg" disabled class="">
              <Spinner class="size-4 mr-2" /> Generating...
            </Button>
          </Show>
        </div>
      </Show>
    </div>
  );
}; 