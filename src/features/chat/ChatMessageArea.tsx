import { Component, For, createEffect, Show } from 'solid-js';
import { useChat } from './chatStore';
import type { ChatMessage, WordInfo } from './types';
import { ChatMessageItem } from './ChatMessageItem'; // Assuming this component is reusable

interface ChatMessageAreaProps {
  messages: ChatMessage[];
  description?: string;
  // Props needed for highlighting spoken words, etc.
  activeSpokenMessageId?: string | null;
  ttsWordMap?: WordInfo[];
  currentTTSHighlightIndex?: number | null;
  // Potentially, a ref to the scroll host if managed here
}

export const ChatMessageArea: Component<ChatMessageAreaProps> = (props) => {
  createEffect(() => {
    console.log('[ChatMessageArea] description prop:', props.description);
  });
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
      {props.description && (
        <div class="mb-4 p-2 bg-muted/20 text-muted-foreground italic rounded">
          {props.description}
        </div>
      )}
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