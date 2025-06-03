import { Component, For, createEffect, createSignal, Show } from 'solid-js';
import { Plus, X } from 'phosphor-solid';
import { Button } from '../../components/ui/button'; // Assuming Button component path
import type { Thread } from './types';
import { Spinner } from '../../components/ui/spinner';
import { parseThinkingContent } from './utils';
import { EmbeddingProcessingPanel } from '../embedding/EmbeddingProcessingPanel';
import type { Messages } from '../../types/i18n';

interface ChatSidebarProps {
  threads: Thread[];
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onGenerateRoleplay: () => void;
  onDeleteThread: (threadId: string) => void;
  isRoleplayLoading: boolean;
  // Embedding props
  pendingEmbeddingCount?: () => number;
  isEmbedding?: () => boolean;
  embedStatusMessage?: () => string | null;
  processedCount?: () => number;
  totalCount?: () => number;
  onEmbedClick?: () => void;
  showEmbeddingPanel?: boolean;
  // Localization
  messages?: Messages;
}

export const ChatSidebar: Component<ChatSidebarProps> = (props) => {
  const [hoveredThreadId, setHoveredThreadId] = createSignal<string | null>(null);

  // Localization helper
  const getLocalizedString = (key: string, fallback: string) => {
    return props.messages?.[key]?.message || fallback;
  };

  createEffect(() => {
    console.log('[ChatSidebar] isRoleplayLoading:', props.isRoleplayLoading);
  });

  const cleanThreadTitle = (title: string | undefined) => {
    if (!title) return '';
    // Remove any thinking tokens that might be in existing thread titles
    const parsed = parseThinkingContent(title);
    return parsed.response_content || title;
  };

  const handleDeleteClick = (e: Event, threadId: string) => {
    e.stopPropagation(); // Prevent thread selection when clicking delete
    const thread = props.threads.find(t => t.id === threadId);
    const threadTitle = cleanThreadTitle(thread?.title) || `Thread ${threadId.substring(0, 8)}`;
    if (confirm(`Are you sure you want to delete "${threadTitle}"?\n\nThis will permanently delete the conversation and cannot be undone.`)) {
      props.onDeleteThread(threadId);
    }
  };

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
            <div 
              class="relative group mb-1"
              onMouseEnter={() => setHoveredThreadId(thread.id)}
              onMouseLeave={() => setHoveredThreadId(null)}
            >
              <Button
                variant={props.currentThreadId === thread.id ? "secondary" : "ghost"}
                class="w-full justify-start text-sm p-2 h-auto text-left pr-10"
                onClick={() => props.onSelectThread(thread.id)}
                title={cleanThreadTitle(thread.title)}
              >
                <span class="block w-full truncate">
                  {cleanThreadTitle(thread.title) || `Thread ${thread.id.substring(0, 8)}`}
                </span>
              </Button>
              {hoveredThreadId() === thread.id && (
                <button
                  class="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 opacity-70 hover:opacity-100"
                  onClick={(e) => handleDeleteClick(e, thread.id)}
                  title="Delete thread"
                >
                  <X class="size-3.5" />
                </button>
              )}
            </div>
          )}
        </For>
      </div>
      <div class="p-2 border-t border-border/40 space-y-2">
        {/* Update Memory Button */}
        <Show when={props.showEmbeddingPanel && props.onEmbedClick && props.pendingEmbeddingCount && props.isEmbedding && props.embedStatusMessage && props.processedCount && props.totalCount}>
          <EmbeddingProcessingPanel
            pendingEmbeddingCount={props.pendingEmbeddingCount!}
            isEmbedding={props.isEmbedding!}
            embedStatusMessage={props.embedStatusMessage!}
            processedCount={props.processedCount!}
            totalCount={props.totalCount!}
            onProcessClick={props.onEmbedClick!}
            class="w-full"
            messages={props.messages}
          />
        </Show>
        
        {/* Generate Roleplay action */}
        <Button
          variant="outline"
          class="w-full flex justify-center"
          onClick={props.onGenerateRoleplay}
          disabled={props.isRoleplayLoading}
        >
          {props.isRoleplayLoading ? <Spinner class="animate-spin size-5" /> : getLocalizedString('chatPageGenerateRoleplay', 'Generate Roleplay')}
        </Button>
      </div>
    </aside>
  );
}; 