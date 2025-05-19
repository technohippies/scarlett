import { Component, createResource, createSignal, createEffect, createMemo } from 'solid-js';
import { defineExtensionMessaging } from '@webext-core/messaging';
import NewTabPageView from './NewTabPageView';
import type { StudySummary } from '../../services/srs/types';
import type { BackgroundProtocolMap } from '../../shared/messaging-types';
import type { GetStudyStreakDataResponse, GetDailyStudyStatsResponse } from '../../shared/messaging-types';
import type { Messages } from '../../types/i18n'; // Import Messages type
import { useSettings } from '../../context/SettingsContext'; // <-- Import useSettings
import { type Mood } from '../../features/mood/MoodSelector';
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
  onNavigateToChat: () => void;
  messages: Messages | undefined;
  messagesLoading: boolean;
}

const NewTabPage: Component<NewTabPageProps> = (props) => {
  console.log('[NewTabPage] Component rendering');

  const settings = useSettings();

  const [showMoodSelector, setShowMoodSelector] = createSignal(false);

  createEffect(() => {
    const todayStr = getCurrentDateYYYYMMDD();
    const settingsConf = settings.config; // Get a reference to avoid re-accessing multiple times
    const currentLoadStatus = settings.loadStatus(); // Get a reference

    const settingsAreLoaded = !currentLoadStatus.startsWith('pending');
    const lastMoodDate = settingsConf.lastMoodEntryDate;
    const onboardingComplete = settingsConf.onboardingComplete;

    // More detailed logging
    console.log(
      `[NewTabPage MoodEffect Eval] Today: ${todayStr}, LastMoodEntry: "${lastMoodDate}" (type: ${typeof lastMoodDate}), SettingsLoaded: ${settingsAreLoaded}, OnboardingComplete: ${onboardingComplete}, RawLoadStatus: ${currentLoadStatus}`
    );

    if (onboardingComplete && settingsAreLoaded && lastMoodDate !== todayStr) {
      setShowMoodSelector(true);
      console.log('[NewTabPage MoodEffect] Result: SHOW selector');
    } else {
      setShowMoodSelector(false);
      // Log the specific reasons for hiding
      console.log(
        `[NewTabPage MoodEffect] Result: HIDE selector. Reasons Check: Onboarding=${onboardingComplete}, SettingsLoaded=${settingsAreLoaded}, LastMoodDateIsToday=${lastMoodDate === todayStr} (LastMood: "${lastMoodDate}", Today: "${todayStr}")`
      );
    }
  });

  const handleMoodSelect = async (mood: Mood | null) => {
    console.log(`[NewTabPage DEBUG] Entered handleMoodSelect. Mood argument:`, mood); // VERY FIRST LOG
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

  const [streakData] = createResource<GetStudyStreakDataResponse>(async () => {
    console.log('[NewTabPage] Fetching study streak data...');
    try {
      const result = await messaging.sendMessage('getStudyStreakData', {});
      console.log('[NewTabPage] Received study streak data:', result);
      return result; // Assuming result is { currentStreak, longestStreak, success: true } or similar
    } catch (error) {
      console.error('[NewTabPage] Error fetching study streak data:', error);
      return { currentStreak: 0, longestStreak: 0, success: false, error: (error as Error).message };
    }
  }, { initialValue: { currentStreak: 0, longestStreak: 0, success: true } });

  // Resource for daily study statistics
  const [dailyStatsData] = createResource<GetDailyStudyStatsResponse>(async () => {
    console.log('[NewTabPage] Fetching daily study stats...');
    try {
      const result = await messaging.sendMessage('getDailyStudyStats', {});
      console.log('[NewTabPage] Received daily study stats:', result);
      return result;
    } catch (error) {
      console.error('[NewTabPage] Error fetching daily study stats:', error);
      return { newItemsStudiedToday: 0, lastResetDate: '', success: false, error: (error as Error).message };
    }
  }, { initialValue: { newItemsStudiedToday: 0, lastResetDate: '', success: true } });

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

  const dailyGoalCompleted = createMemo(() => {
    const stats = dailyStatsData();
    const configuredLimit = settings.config?.newItemsPerDay ?? 20;
    if (stats && stats.success && typeof stats.newItemsStudiedToday === 'number') {
      return stats.newItemsStudiedToday >= configuredLimit;
    }
    return false; // Default to false if stats are not available, errored, or count is not a number
  });

  const isPageReady = createMemo(() => {
    const summaryActuallyLoaded = !summaryData.loading && summaryData.state === 'ready';
    const messagesActuallyLoaded = !props.messagesLoading;
    const streakActuallyLoaded = !streakData.loading && streakData.state === 'ready';
    const dailyStatsActuallyLoaded = !dailyStatsData.loading && dailyStatsData.state === 'ready';
    // console.log(`[NewTabPage isPageReady] summaryLoaded: ${summaryActuallyLoaded}, messagesLoaded: ${messagesActuallyLoaded}, streakLoaded: ${streakActuallyLoaded}, dailyStatsLoaded: ${dailyStatsActuallyLoaded}`);
    return summaryActuallyLoaded && messagesActuallyLoaded && streakActuallyLoaded && dailyStatsActuallyLoaded;
  });

  return (
    <NewTabPageView
      summary={summaryData}
      summaryLoading={() => summaryData.loading || props.messagesLoading}
      pendingEmbeddingCount={() => embeddingCountData()?.count || 0}
      isEmbedding={isEmbedding}
      embedStatusMessage={embedStatusMessage}
      currentStreak={createMemo(() => streakData()?.currentStreak)}
      streakLoading={createMemo(() => streakData.loading)}
      onEmbedClick={handleEmbedClick}
      onNavigateToBookmarks={props.onNavigateToBookmarks}
      onNavigateToStudy={props.onNavigateToStudy}
      onNavigateToSettings={props.onNavigateToSettings}
      onNavigateToChat={props.onNavigateToChat}
      messages={props.messages}
      isFocusModeActive={isFocusModeActive}
      onToggleFocusMode={handleToggleFocusMode}
      showMoodSelector={showMoodSelector}
      onMoodSelect={handleMoodSelect}
      dailyGoalCompleted={dailyGoalCompleted}
      isPageReady={isPageReady}
    />
  );
};

export default NewTabPage;