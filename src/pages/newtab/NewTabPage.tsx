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
// import { getEmbedding, type EmbeddingResult } from '../../services/llm/embedding';

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

  // const i18n = () => {
  //   const msgs = props.messages;
  //   return {
  //     get: (key: string, fallback: string) => msgs?.[key]?.message || fallback,
  //   };
  // };

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

  // const [embeddingCountData, { refetch: refetchEmbeddingCount }] = createResource<{ count: number }>(async () => {
  //   console.log('[NewTabPage] Fetching pending embedding count...');
  //   try {
  //     const result = await messaging.sendMessage('getPendingEmbeddingCount', undefined);
  //     console.log('[NewTabPage] Received pending count:', result);
  //     return result || { count: 0 };
  //   } catch (error) {
  //     console.error('[NewTabPage] Error fetching pending embedding count:', error);
  //     return { count: 0 };
  //   }
  // }, { initialValue: { count: 0 } });

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

  // const [isEmbedding, setIsEmbedding] = createSignal(false);
  // const [embedStatusMessage, setEmbedStatusMessage] = createSignal<string | null>(null);
  // const [processedCount, setProcessedCount] = createSignal(0);
  // const [totalCount, setTotalCount] = createSignal(0);

  // const handleEmbedClick = async () => {
  //   console.log('[NewTabPage] handleEmbedClick triggered.');
  //   setIsEmbedding(true);
  //   setEmbedStatusMessage(i18n().get('newTabPageEmbeddingStarting', 'Starting embedding process...'));
  //   try {
  //     // Fetch items (pages + bookmarks) needing embedding
  //     const res = await messaging.sendMessage('getItemsNeedingEmbedding', undefined);
  //     const items = res.items ?? [];
  //     const total = items.length;
  //     setTotalCount(total);
  //     setProcessedCount(0);
  //     // Ensure in-browser embedding config is available
  //     const embedCfg = settings.config.embeddingConfig;
  //     if (!embedCfg) {
  //       console.error('[NewTabPage] Embedding configuration is missing.');
  //       setEmbedStatusMessage(i18n().get('newTabPageEmbeddingConfigMissing', 'Embedding not configured.'));
  //       setIsEmbedding(false);
  //       return;
  //     }
  //     for (const [idx, item] of items.entries()) {
  //       const current = idx + 1;
  //       setProcessedCount(current);
  //       const itemType = item.type === 'page' ? 'page' : 'bookmark';
  //       setEmbedStatusMessage(
  //         i18n().get('newTabPageEmbeddingProgress', 'Embedding {current} of {total}...')
  //           .replace('{current}', current.toString())
  //           .replace('{total}', total.toString())
  //       );
  //       try {
  //         const embeddingResult: EmbeddingResult | null = await getEmbedding(
  //           item.content,
  //           embedCfg
  //         );
  //         if (embeddingResult) {
  //           await messaging.sendMessage('finalizeItemEmbedding', {
  //             type: item.type,
  //             id: item.id,
  //             embeddingInfo: embeddingResult
  //           });
  //           console.log(`[NewTabPage] Successfully embedded ${itemType} ${item.id}`);
  //         } else {
  //           console.error(`[NewTabPage] Embedding returned null for ${itemType}:`, item.id);
  //         }
  //       } catch (e) {
  //         console.error(`[NewTabPage] Error during embedding for ${itemType}:`, item.id, e);
  //       }
  //     }
  //     setEmbedStatusMessage(i18n().get('newTabPageEmbeddingComplete', 'Embedding complete.'));
  //     // refetchEmbeddingCount();
  //   } catch (err: any) {
  //     console.error('[NewTabPage] Error in embedding pipeline:', err);
  //     setEmbedStatusMessage(
  //       `${i18n().get('newTabPageEmbeddingErrorPrefix', 'Error:')} ${err.message || err}`
  //     );
  //   } finally {
  //     setIsEmbedding(false);
  //     // Clear status after delay
  //     setTimeout(() => setEmbedStatusMessage(null), 5000);
  //   }
  // };

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
      currentStreak={createMemo(() => streakData()?.currentStreak)}
      streakLoading={createMemo(() => streakData.loading)}
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