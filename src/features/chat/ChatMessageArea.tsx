import { Component, For, createEffect, Show } from 'solid-js';
import { useChat } from './chatStore';
import type { ChatMessage, WordInfo } from './types';
import { ChatMessageItem } from './ChatMessageItem'; // Assuming this component is reusable

interface ChatMessageAreaProps {
  messages: ChatMessage[];
  // Props needed for highlighting spoken words, etc.
  activeSpokenMessageId?: string | null;
  ttsWordMap?: WordInfo[];
  currentTTSHighlightIndex?: number | null;
  // Potentially, a ref to the scroll host if managed here
}

export const ChatMessageArea: Component<ChatMessageAreaProps> = (props) => {
  let scrollHostRef: HTMLDivElement | undefined;
  const [state, actions] = useChat();

  createEffect(() => {
    // Keep messages scrolled to the bottom
    if (scrollHostRef) {
      scrollHostRef.scrollTop = scrollHostRef.scrollHeight;
    }
  });

  return (
    <div ref={scrollHostRef} class="flex-grow p-4 space-y-6 bg-background overflow-y-auto" id="message-list-container">
      <Show when={props.messages.length > 0} fallback={<div class="text-center text-muted-foreground p-8">No messages yet.</div>}>
        <For each={props.messages}>
          {(message) => (
            <ChatMessageItem
              message={message}
              isStreaming={message.isStreaming}
              // TTS speed controls
              onChangeSpeed={(msgId, speed) => actions.playTTS({ messageId: msgId, text: message.text_content, lang: message.tts_lang || 'en', speed })}
            />
          )}
        </For>
      </Show>
    </div>
  );
}; 