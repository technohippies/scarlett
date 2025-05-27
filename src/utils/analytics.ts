import { createAnalytics } from '@wxt-dev/analytics';
import { storage } from '@wxt-dev/storage';
import { umami } from '@wxt-dev/analytics/providers/umami';

console.log('[Analytics] Creating manual analytics instance...');

// Create analytics instance manually to avoid config loading issues
export const analytics = createAnalytics({
  debug: true,
  enabled: storage.defineItem('local:analytics-enabled', { fallback: true }),
  providers: [
    umami({
      apiUrl: 'https://cloud.umami.is/api',
      websiteId: '170292c8-4ca4-4a11-8934-d935c81bc6b9',
      domain: 'scarlett-extension.local',
    }),
  ],
});

console.log('[Analytics] Manual analytics instance created:', analytics);

// Helper functions for meaningful milestone tracking
export const trackMilestone = {
  // Chat engagement milestones
  async firstChatMessage() {
    try {
      await analytics.track('milestone-first-chat');
    } catch (error) {
      console.warn('[Analytics] Failed to track first chat milestone:', error);
    }
  },

  async roleplayGenerated() {
    try {
      await analytics.track('feature-roleplay-generated');
    } catch (error) {
      console.warn('[Analytics] Failed to track roleplay generation:', error);
    }
  },

  // Learning milestones
  async studyStreakMilestone(days: number) {
    try {
      await analytics.track('milestone-study-streak', { days: days.toString() });
    } catch (error) {
      console.warn('[Analytics] Failed to track study streak milestone:', error);
    }
  },

  async dailyGoalCompleted() {
    try {
      await analytics.track('milestone-daily-goal-completed');
    } catch (error) {
      console.warn('[Analytics] Failed to track daily goal completion:', error);
    }
  },

  async flashcardsMilestone(count: number) {
    try {
      await analytics.track('milestone-flashcards-studied', { count: count.toString() });
    } catch (error) {
      console.warn('[Analytics] Failed to track flashcards milestone:', error);
    }
  },

  // Feature adoption
  async firstBookmark() {
    try {
      await analytics.track('feature-first-bookmark');
    } catch (error) {
      console.warn('[Analytics] Failed to track first bookmark:', error);
    }
  },

  async firstTTSUsage() {
    try {
      await analytics.track('feature-first-tts');
    } catch (error) {
      console.warn('[Analytics] Failed to track first TTS usage:', error);
    }
  },

  async firstVADUsage() {
    try {
      await analytics.track('feature-first-vad');
    } catch (error) {
      console.warn('[Analytics] Failed to track first VAD usage:', error);
    }
  },

  async focusModeActivated() {
    try {
      await analytics.track('feature-focus-mode-activated');
    } catch (error) {
      console.warn('[Analytics] Failed to track focus mode activation:', error);
    }
  },

  // Weekly engagement
  async weeklyActive() {
    try {
      await analytics.track('engagement-weekly-active');
    } catch (error) {
      console.warn('[Analytics] Failed to track weekly activity:', error);
    }
  }
}; 