import { Component, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { FlashcardStudyPanel } from '../../features/srs/FlashcardStudyPanel';
import { EmbeddingProcessingPanel } from '../../features/embedding/EmbeddingProcessingPanel';
import { BookmarkSimple, Gear, ArrowClockwise } from 'phosphor-solid';
import type { StudySummary } from '../../services/srs/types';

// Props for the View component
export interface NewTabPageViewProps {
  summary: () => StudySummary | null;
  summaryLoading: () => boolean;
  pendingEmbeddingCount: () => number;
  isEmbedding: () => boolean;
  embedStatusMessage: () => string | null;
  onEmbedClick: () => void;
  onNavigateToBookmarks: () => void;
  onNavigateToStudy: () => void;
  onNavigateToSettings: () => void;
}

// --- Rearranged View Component ---
const NewTabPageView: Component<NewTabPageViewProps> = (props) => {

  return (
    // --- Main container: flex-col, padding, min-height ---
    <div class="newtab-page-container relative p-6 md:p-8 font-sans bg-background min-h-screen flex flex-col">

      {/* --- Top Left: Study Panel --- */}
      <div class="study-panel-area max-w-xs w-full mb-auto"> {/* mb-auto pushes it up */}
          <Show
              when={!props.summaryLoading()}
              fallback={ <div class="bg-card p-4 rounded-lg shadow-md flex justify-center items-center h-24"><Spinner class="h-8 w-8 text-muted-foreground" /></div> }
          >
              <Show
                  when={props.summary()}
                  fallback={ <p class="text-muted-foreground p-4 text-sm bg-card rounded-lg shadow-md">No study data available.</p> }
              >
                  {(data) => (
                      <FlashcardStudyPanel
                          dueCount={data().dueCount}
                          reviewCount={data().reviewCount}
                          newCount={data().newCount}
                          onStudyClick={props.onNavigateToStudy}
                          class="bg-card p-4 rounded-lg shadow-md"
                      />
                  )}
              </Show>
          </Show>
      </div>

      {/* --- Bottom Right Area --- */}
      {/* --- Change gap to gap-2 --- */}
      <div class="mt-auto ml-auto flex flex-col gap-2 items-end"> 
          
          {/* Embedding Panel (now direct child) */} 
          <EmbeddingProcessingPanel 
            pendingEmbeddingCount={props.pendingEmbeddingCount}
            isEmbedding={props.isEmbedding}
            embedStatusMessage={props.embedStatusMessage}
            onProcessClick={props.onEmbedClick}
          />

          {/* --- Remove the quick-actions div --- */}
          {/* Action Buttons (now direct children) */} 
          <Button onClick={props.onNavigateToBookmarks} variant="outline" size="xl" class="flex items-center justify-center gap-2 max-w-xs min-w-[280px]">
              <BookmarkSimple weight="fill" size={18} />
              Bookmarks
          </Button>
          <Button onClick={props.onNavigateToSettings} variant="outline" size="xl" class="flex items-center justify-center gap-2 max-w-xs min-w-[280px]">
              <Gear weight="fill" size={18} />
              Settings
          </Button>
      </div>

    </div>
  );
};

export default NewTabPageView; 