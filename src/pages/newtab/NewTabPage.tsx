import { Component, createResource, createSignal } from 'solid-js';
import { defineExtensionMessaging } from '@webext-core/messaging';
import NewTabPageView from './NewTabPageView';
import type { StudySummary } from '../../services/srs/types';
import type { BackgroundProtocolMap } from '../../background/handlers/message-handlers';
import type { Messages } from '../../types/i18n'; // Import Messages type
import { useSettings } from '../../context/SettingsContext'; // <-- Import useSettings
import { Show, createEffect } from 'solid-js';
import { MoodSelector, type Mood } from '../../features/mood/MoodSelector';
import { addMoodEntry } from '../../services/db/mood';

const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

const getCurrentDateYYYYMMDD = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface NewTabPageProps {
  onNavigateToBookmarks: () => void;
  onNavigateToStudy: () => void;
  onNavigateToSettings: () => void;
  messages: Messages | undefined;
  messagesLoading: boolean;
}

const NewTabPage: Component<NewTabPageProps> = (props) => {
  console.log('[NewTabPage] Component rendering');

  const settings = useSettings();

  const [showMoodSelector, setShowMoodSelector] = createSignal(false);

  createEffect(() => {
    const todayStr = getCurrentDateYYYYMMDD();
    const lastMoodDate = settings.config.lastMoodEntryDate;
    const settingsAreLoaded = !settings.loadStatus().startsWith('pending');
    console.log(`[NewTabPage MoodEffect] Today: ${todayStr}, LastMoodEntry: ${lastMoodDate}, SettingsLoaded: ${settingsAreLoaded}, Onboarding: ${settings.config.onboardingComplete}`);
    if (lastMoodDate !== todayStr && settingsAreLoaded) {
      setShowMoodSelector(true);
      console.log('[NewTabPage MoodEffect] setShowMoodSelector(true)');
    } else {
      setShowMoodSelector(false);
      console.log(`[NewTabPage MoodEffect] setShowMoodSelector(false) - Reason: lastMoodDate matches: ${lastMoodDate === todayStr}, settings not loaded: ${!settingsAreLoaded}`);
    }
  });

  const handleMoodSelect = async (mood: Mood | null) => {
    if (mood) {
      const todayStr = getCurrentDateYYYYMMDD();
      console.log(`[NewTabPage handleMoodSelect] Mood selected: ${mood} for date: ${todayStr}`);
      try {
        await addMoodEntry(mood, todayStr);
        await settings.updateUserConfiguration({ lastMoodEntryDate: todayStr });
        console.log(`[NewTabPage handleMoodSelect] Mood entry for ${todayStr}: ${mood} saved, and lastMoodEntryDate updated.`);
        // setShowMoodSelector(false); // Effect will hide it automatically
      } catch (error) {
        console.error("[NewTabPage handleMoodSelect] Error saving mood entry:", error);
      }
    } else {
      console.log('[NewTabPage handleMoodSelect] Mood selection cancelled (mood is null).');
    }
  };

  const i18n = () => {
    const msgs = props.messages;
    return {
      get: (key: string, fallback: string) => msgs?.[key]?.message || fallback,
    };
  };

  const [summaryData] = createResource<StudySummary | null>(async () => {
    console.log('[NewTabPage] Fetching study summary...');
    try {
      const summary = await messaging.sendMessage('getStudySummary', {});
      console.log('[NewTabPage] Received study summary:', summary);
      return {
          dueCount: Number(summary?.dueCount || 0),
          reviewCount: Number(summary?.reviewCount || 0),
          newCount: Number(summary?.newCount || 0)
      };
    } catch (error) {
      console.error('[NewTabPage] Error fetching study summary:', error);
      return null;
    }
  }, { initialValue: { dueCount: 0, reviewCount: 0, newCount: 0 } });

  const [embeddingCountData, { refetch: refetchEmbeddingCount }] = createResource<{ count: number }>(async () => {
    console.log('[NewTabPage] Fetching pending embedding count...');
    try {
      const result = await messaging.sendMessage('getPendingEmbeddingCount', undefined);
      console.log('[NewTabPage] Received pending count:', result);
      return result || { count: 0 };
    } catch (error) {
      console.error('[NewTabPage] Error fetching pending embedding count:', error);
      return { count: 0 };
    }
  }, { initialValue: { count: 0 } });

  const [isEmbedding, setIsEmbedding] = createSignal(false);
  const [embedStatusMessage, setEmbedStatusMessage] = createSignal<string | null>(null);

  const handleEmbedClick = async () => {
    console.log('[NewTabPage] handleEmbedClick triggered.');
    setIsEmbedding(true);
    setEmbedStatusMessage(i18n().get('newTabPageEmbeddingStarting', 'Starting embedding process...'));
    try {
      const result = await messaging.sendMessage('triggerBatchEmbedding', undefined);
      
      if (result.success) {
        console.log('[NewTabPage] Batch embedding successful:', result);
        let status = i18n().get('newTabPageEmbeddingComplete', 'Embedding complete.');
        const details = [];
        if (result.finalizedCount && result.finalizedCount > 0) {
          details.push(i18n().get('newTabPageEmbeddingFinalized', '{count} new pages embedded').replace('{count}', result.finalizedCount.toString()));
        }
        if (result.duplicateCount && result.duplicateCount > 0) {
          details.push(i18n().get('newTabPageEmbeddingDuplicates', '{count} duplicates skipped').replace('{count}', result.duplicateCount.toString()));
        }
        if (result.errorCount && result.errorCount > 0) {
          details.push(i18n().get('newTabPageEmbeddingErrors', '{count} errors').replace('{count}', result.errorCount.toString()));
        }
        if (details.length > 0) status += ` (${details.join(', ')})`;
        setEmbedStatusMessage(status + '.');
        refetchEmbeddingCount(); 
      } else {
        console.error('[NewTabPage] Batch embedding failed:', result.error);
        const errorMsg = result.error || i18n().get('newTabPageEmbeddingFailedFallback', 'Embedding failed.');
        setEmbedStatusMessage(`${i18n().get('newTabPageEmbeddingErrorPrefix', 'Error:')} ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('[NewTabPage] Error sending triggerBatchEmbedding message:', error);
      const errorMsg = error.message || i18n().get('newTabPageEmbeddingTriggerErrorFallback', 'Could not trigger embedding.');
      setEmbedStatusMessage(`${i18n().get('newTabPageEmbeddingErrorPrefix', 'Error:')} ${errorMsg}`);
    } finally {
      setIsEmbedding(false);
      setTimeout(() => setEmbedStatusMessage(null), 7000);
    }
  };

  // --- Focus Mode --- 
  const isFocusModeActive = () => settings.config.enableFocusMode ?? false;
  const handleToggleFocusMode = () => {
    const currentStatus = isFocusModeActive();
    console.log(`[NewTabPage] Toggling Focus Mode from ${currentStatus} to ${!currentStatus}`);
    settings.updateUserConfiguration({ enableFocusMode: !currentStatus });
  };
  // --- End Focus Mode ---

  return (
    <>
      {/* Mood Selector Section - Using fixed positioning for overlay centering (no extra bg/blur) */}
      <Show when={showMoodSelector()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          {/* Removed bg-black/50 backdrop-blur-sm */}
          <section class="w-full max-w-md p-6 bg-card rounded-xl shadow-lg mx-4">
            <h2 class="text-xl font-semibold text-center text-card-foreground mb-5">
              {i18n().get('newTabPageMoodPrompt', 'How are you feeling today?')}
            </h2>
            <MoodSelector onSelect={handleMoodSelect} class="justify-center" />
          </section>
        </div>
      </Show>

      <NewTabPageView 
        summary={summaryData}
        summaryLoading={() => summaryData.loading || props.messagesLoading} // Combine loading states
        pendingEmbeddingCount={() => embeddingCountData()?.count ?? 0}
        isEmbedding={isEmbedding}
        embedStatusMessage={embedStatusMessage}
        onEmbedClick={handleEmbedClick}
        onNavigateToBookmarks={props.onNavigateToBookmarks}
        onNavigateToStudy={props.onNavigateToStudy}
        onNavigateToSettings={props.onNavigateToSettings}
        messages={props.messages} // Pass messages down to the view
        // No messagesLoading prop for NewTabPageView, it's handled here
        isFocusModeActive={isFocusModeActive} // <-- Pass new prop
        onToggleFocusMode={handleToggleFocusMode} // <-- Pass new prop
      />
    </>
  );
};

export default NewTabPage;