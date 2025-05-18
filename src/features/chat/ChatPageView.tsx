import { Component, For, createSignal, createEffect } from 'solid-js';
import { Button } from '../../components/ui/button';
import { TextField, TextFieldInput } from '../../components/ui/text-field'; 
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../components/ui/sheet';
import type { ChatMessage, ChatSession } from './types';
import { ChatMessageItem } from './ChatMessageItem';

interface ChatPageViewProps {
  chatSessions: ChatSession[];
  currentChatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSelectChatSession: (sessionId: string) => void;
  onNavigateBack: () => void;
  currentSessionId?: string | null;
}

export const ChatPageView: Component<ChatPageViewProps> = (props) => {
  const [inputText, setInputText] = createSignal('');
  let scrollHostRef: HTMLDivElement | undefined;

  const handleSend = () => {
    if (inputText().trim()) {
      props.onSendMessage(inputText().trim());
      setInputText('');
    }
  };

  createEffect(() => {
    props.currentChatMessages;
    if (scrollHostRef) {
      scrollHostRef.scrollTop = scrollHostRef.scrollHeight;
    }
  });

  return (
    <div class="flex flex-col h-screen bg-background text-foreground">
      <header class="flex items-center p-2 md:p-4 border-b border-border/40 sticky top-0 bg-background z-10">
        <Sheet>
          <SheetTrigger as={Button} variant="ghost" class="mr-1 p-2 md:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </SheetTrigger>
          <SheetContent position="left" class="w-full sm:max-w-xs p-0">
            <div class="p-2 pt-4 overflow-y-auto">
              <For each={props.chatSessions}>
                {(session) => (
                  <Button
                    variant={props.currentSessionId === session.id ? "secondary" : "ghost"}
                    class="w-full justify-start mb-1 text-sm p-2 h-auto text-left"
                    onClick={() => props.onSelectChatSession(session.id)}
                    title={session.title}
                  >
                    <span class="block w-full truncate">
                      {session.title}
                    </span>
                  </Button>
                )}
              </For>
            </div>
          </SheetContent>
        </Sheet>
        <Button variant="ghost" onClick={props.onNavigateBack} class="mr-2 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </Button>
        <div class="flex-1"></div>
      </header>

      <div class="flex flex-1 overflow-hidden">
        <aside class="hidden md:flex flex-col w-64 lg:w-72 border-r border-border/40 bg-muted/20">
          <div class="p-2 pt-4 overflow-y-auto flex-grow">
            <For each={props.chatSessions}>
              {(session) => (
                <Button
                  variant={props.currentSessionId === session.id ? "secondary" : "ghost"}
                  class="w-full justify-start mb-1 text-sm p-2 h-auto text-left"
                  onClick={() => props.onSelectChatSession(session.id)}
                  title={session.title}
                >
                  <span class="block w-full truncate">
                    {session.title}
                  </span>
                </Button>
              )}
            </For>
          </div>
        </aside>

        <div ref={scrollHostRef} class="flex-1 flex flex-col overflow-y-auto">
          <main class="w-full max-w-4xl mx-auto flex flex-col flex-grow">
            <div 
              class="flex-grow p-4 space-y-6 bg-background"
              id="message-list-container"
            >
              <For each={props.currentChatMessages}>
                {(message) => (
                  <ChatMessageItem message={message} />
                )}
              </For>
            </div>

            <div class="p-2 md:p-4 border-t border-border/40 bg-background sticky bottom-0">
              <div class="flex items-center space-x-2">
                <TextField class="w-full">
                  <TextFieldInput
                    type="text"
                    placeholder="Type your message..."
                    value={inputText()}
                    onInput={(e) => setInputText(e.currentTarget.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    class="text-md md:text-base h-10"
                  />
                </TextField>
                <Button onClick={handleSend} class="h-10 px-4 w-24">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
