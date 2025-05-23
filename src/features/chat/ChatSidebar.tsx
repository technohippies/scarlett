import { Component, For } from 'solid-js';
import { Plus } from 'phosphor-solid';
import { Button } from '../../components/ui/button'; // Assuming Button component path
import type { Thread } from './types';

interface ChatSidebarProps {
  threads: Thread[];
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onGenerateRoleplay: () => void;
  // Add any other props needed, e.g., for generating roleplays or other actions
}

export const ChatSidebar: Component<ChatSidebarProps> = (props) => {
  return (
    <aside class="hidden md:flex flex-col w-64 lg:w-72 border-r border-border/40 bg-muted/20">
      <div class="p-2 pt-4 overflow-y-auto flex-grow">
        <Button
          variant={props.currentThreadId === null ? 'secondary' : 'ghost'}
          class="w-full justify-center mb-1 text-sm p-2 h-auto"
          onClick={props.onCreateThread}
          title="New Thread"
        >
          <Plus class="size-5" />
        </Button>
        <For each={props.threads}>
          {(thread) => (
            <Button
              variant={props.currentThreadId === thread.id ? "secondary" : "ghost"}
              class="w-full justify-start mb-1 text-sm p-2 h-auto text-left"
              onClick={() => props.onSelectThread(thread.id)}
              title={thread.title}
            >
              <span class="block w-full truncate">
                {thread.title || `Thread ${thread.id.substring(0, 8)}`}
              </span>
            </Button>
          )}
        </For>
      </div>
      <div class="p-2 border-t border-border/40">
        {/* Generate Roleplay action */}
        <Button variant="outline" class="w-full" onClick={props.onGenerateRoleplay}>
          Generate Roleplay
        </Button>
      </div>
    </aside>
  );
}; 