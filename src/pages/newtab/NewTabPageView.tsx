import { Component, Show, Accessor } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { FlashcardStudyPanel } from '../../features/srs/FlashcardStudyPanel';
import { EmbeddingProcessingPanel } from '../../features/embedding/EmbeddingProcessingPanel';
import { BookmarkSimple, Gear, Shield, Chat } from 'phosphor-solid';
import type { StudySummary } from '../../services/srs/types';
import type { Messages } from '../../types/i18n';
import { MoodSelector, type Mood } from '../../features/mood/MoodSelector';
import { Motion } from 'solid-motionone';
import { StudyStreakPanel } from '../../features/srs/StudyStreakPanel';

// Props for the View component
export interface NewTabPageViewProps {
  summary: () => StudySummary | null;
  summaryLoading: () => boolean;
  pendingEmbeddingCount: () => number;
  isEmbedding: () => boolean;
  embedStatusMessage: () => string | null;
  currentStreak: Accessor<number | undefined>;
  streakLoading: Accessor<boolean>;
  onEmbedClick: () => void;
  onNavigateToBookmarks: () => void;
  onNavigateToStudy: () => void;
  onNavigateToSettings: () => void;
  onNavigateToChat: () => void;
  messages: Messages | undefined;
  isFocusModeActive: Accessor<boolean>;
  onToggleFocusMode: () => void;
  showMoodSelector: Accessor<boolean>;
  onMoodSelect: (mood: Mood | null) => Promise<void>;
  isPageReady: Accessor<boolean>;
  dailyGoalCompleted: Accessor<boolean>;
}

const transitionSettings = { duration: 0.4, easing: "ease-in-out" } as const;

// --- Rearranged View Component ---
const NewTabPageView: Component<NewTabPageViewProps> = (props) => {

  const i18n = () => {
    const msgs = props.messages;
    return {
      get: (key: string, fallback: string) => msgs?.[key]?.message || fallback,
    };
  };

  return (
    // --- Main container: flex-col, padding, min-height ---
    <Motion
      initial={{ opacity: 0 }}
      animate={{ opacity: props.isPageReady() ? 1 : 0 }}
      transition={transitionSettings}
      class="newtab-page-container relative p-6 md:p-8 font-sans bg-background min-h-screen flex flex-col"
    >
      {/* --- Top Left Area: Streak and Study Panels --- */}
      <div class="top-left-area flex flex-col gap-4 mb-4 md:max-w-xs w-full">
        {/* Streak Display Area */}
        <div class="streak-display-area w-full">
          <StudyStreakPanel
            currentStreak={props.currentStreak}
            isLoading={props.streakLoading}
            messages={props.messages}
            class="w-full" 
          />
        </div>

        {/* Study Panel Area (Conditionally Rendered) */}
        <Show when={!props.dailyGoalCompleted()}>
          <div class="study-panel-area w-full">
            <Show
              when={!props.summaryLoading()}
              fallback={<div class="bg-card p-4 rounded-lg shadow-md flex justify-center items-center h-24"><Spinner class="h-8 w-8 text-muted-foreground" /></div>}
            >
              <Show
                when={props.summary()}
                fallback={<p class="text-muted-foreground p-4 text-sm bg-card rounded-lg shadow-md">{i18n().get('newTabPageNoStudyData', 'No study data available.')}</p>}
              >
                {(data) => (
                  <FlashcardStudyPanel
                    dueCount={data().dueCount}
                    reviewCount={data().reviewCount}
                    newCount={data().newCount}
                    onStudyClick={props.onNavigateToStudy}
                    class="bg-card p-4 rounded-lg shadow-md w-full"
                    messages={props.messages}
                  />
                )}
              </Show>
            </Show>
          </div>
        </Show>
      </div>

      {/* --- Mood Selector Section (Conditionally Rendered, Centered in available space) --- */}
      <Show when={props.showMoodSelector()}>
        <div class="flex-grow flex items-center justify-center py-4">
          <section class="w-full max-w-md p-6 bg-card rounded-xl shadow-lg">
            <h2 class="text-xl font-semibold text-center text-card-foreground mb-5">
              {i18n().get('newTabPageMoodPrompt', 'How are you feeling today?')}
            </h2>
            <MoodSelector onSelect={props.onMoodSelect} class="justify-center" />
          </section>
        </div>
      </Show>

      <Show when={!props.showMoodSelector()}>
        <div class="flex-grow"></div>
      </Show>

      <div class="mt-auto ml-auto flex flex-col gap-2 items-end">
        {/* Chat / Roleplay button */}
        <Button onClick={props.onNavigateToChat} variant="outline" size="xl" class="flex items-center justify-center gap-2 max-w-xs min-w-[280px]">
          <Chat weight="fill" size={18} />
          Chat
        </Button>
          {/* Focus Button first in this stack */}
          <Button onClick={props.onToggleFocusMode} variant="outline" size="xl" class="flex items-center justify-center gap-2 max-w-xs min-w-[280px]">
            <Shield weight="fill" size={18} />
            {props.isFocusModeActive()
              ? i18n().get('newTabPageButtonStopFocus', 'Stop Focus')
              : i18n().get('newTabPageButtonStartFocus', 'Start Focus')}
          </Button>

          <EmbeddingProcessingPanel
            pendingEmbeddingCount={props.pendingEmbeddingCount}
            isEmbedding={props.isEmbedding}
            embedStatusMessage={props.embedStatusMessage}
            onProcessClick={props.onEmbedClick}
            messages={props.messages}
          />
          
          <Button onClick={props.onNavigateToBookmarks} variant="outline" size="xl" class="flex items-center justify-center gap-2 max-w-xs min-w-[280px]">
              <BookmarkSimple weight="fill" size={18} />
              {i18n().get('newTabPageButtonBookmarks', 'Bookmarks')}
          </Button>
          <Button onClick={props.onNavigateToSettings} variant="outline" size="xl" class="flex items-center justify-center gap-2 max-w-xs min-w-[280px]">
              <Gear weight="fill" size={18} />
              {i18n().get('newTabPageButtonSettings', 'Settings')}
          </Button>
      </div>

    </Motion>
  );
};

export default NewTabPageView; 