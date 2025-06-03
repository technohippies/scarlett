import { Component, createSignal, Match, Switch, createResource, Show, JSX } from 'solid-js';
import NewTabPage from '../../src/pages/newtab/NewTabPage';
import BookmarksPage from '../../src/pages/bookmarks/BookmarksPage';
import StudyPage from '../../src/pages/study/StudyPage';
import SettingsPage from '../../src/pages/settings/SettingsPage';
import { ChatPageLayout } from '../../src/features/chat/ChatPageLayout';
import { ChatProvider } from '../../src/features/chat/chatStore';
import { SettingsProvider, useSettings } from '../../src/context/SettingsContext';
import type { Messages } from '../../src/types/i18n';
import { browser } from 'wxt/browser';

const minimalNativeLanguagesList = [
  { value: 'en' }, { value: 'zh' }, { value: 'vi' }, { value: 'th' }, { value: 'id' }, 
  { value: 'ar' }, { value: 'ja' }, { value: 'ko' }, { value: 'es' }
];

function getBestInitialLangCode(): string {
  let preferredLang = 'en'; 
  try {
    const navLangs = navigator.languages;
    if (navLangs && navLangs.length > 0) {
      for (const lang of navLangs) {
        const baseLang = lang.split('-')[0];
        if (minimalNativeLanguagesList.some(nl => nl.value === baseLang)) { 
          preferredLang = baseLang;
          break;
        }
      }
    }
    return preferredLang;
  } catch (e) {
    console.error("[NewTabApp] Error getting initial language preference:", e);
    return 'en';
  }
}

const fetchMessages = async (langCode: string): Promise<Messages> => {
  console.log(`[NewTabApp] Fetching messages for langCode: ${langCode}`);
  const messageUrl = browser.runtime.getURL(`/_locales/${langCode}/messages.json` as any);
  try {
    const response = await fetch(messageUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for ${langCode}`);
    return await response.json();
  } catch (error) {
    console.warn(`[NewTabApp] Failed to fetch ${langCode} messages. Falling back to 'en'.`, error);
    const fallbackUrl = browser.runtime.getURL('/_locales/en/messages.json' as any);
    try {
      const fallbackResponse = await fetch(fallbackUrl);
      if (!fallbackResponse.ok) throw new Error(`HTTP error! status: ${fallbackResponse.status} for fallback 'en'.`);
      return await fallbackResponse.json();
    } catch (fallbackError) {
      console.error('[NewTabApp] Failed to fetch fallback \'en\' messages.', fallbackError);
      return {}; 
    }
  }
};

type ActiveView = 'newtab' | 'bookmarks' | 'study' | 'settings' | 'unifiedChat';

const AppContent: Component = (): JSX.Element => {
  const [activeView, setActiveView] = createSignal<ActiveView>('newtab');
  const settings = useSettings();
  
  // Use user's stored native language, fallback to browser detection
  const effectiveLangCode = () => {
    const userLang = settings.config.nativeLanguage;
    const browserLang = getBestInitialLangCode();
    const finalLang = userLang || browserLang;
    console.log(`[NewTabApp] Language selection - User: ${userLang}, Browser: ${browserLang}, Final: ${finalLang}`);
    return finalLang;
  };

  const [messagesData] = createResource(effectiveLangCode, fetchMessages);

  const navigateTo = (view: ActiveView) => {
    console.log(`[App.tsx] Navigating to: ${view}`);
    setActiveView(view);
  };

  const i18n = () => {
    const messages = messagesData();
    return {
      get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
    };
  };

  return (
    <Switch fallback={<div>{i18n().get('newTabPageUnknownView', 'Unknown View')}</div>}>
      <Match when={activeView() === 'newtab'}>
        <NewTabPage 
           onNavigateToBookmarks={() => navigateTo('bookmarks')}
           onNavigateToStudy={() => navigateTo('study')}
           onNavigateToSettings={() => navigateTo('settings')}
           onNavigateToChat={() => navigateTo('unifiedChat')}
           messages={messagesData()} 
           messagesLoading={messagesData.loading} 
        />
      </Match>
      <Match when={activeView() === 'bookmarks'}>
        <BookmarksPage onNavigateBack={() => navigateTo('newtab')} messages={messagesData()} />
      </Match>
      <Match when={activeView() === 'study'}>
        <StudyPage onNavigateBack={() => navigateTo('newtab')} messages={messagesData()} />
      </Match>
      <Match when={activeView() === 'settings'}>
        <SettingsPage onNavigateBack={() => navigateTo('newtab')} messages={messagesData()} /> 
      </Match>
      <Match when={activeView() === 'unifiedChat'}>
        <Show when={settings.loadStatus() === 'ready'} fallback={<div>Loading chats and configuration...</div>}>
          <ChatProvider>
            <ChatPageLayout 
              onNavigateBack={() => navigateTo('newtab')} 
              messages={messagesData() || {}}
            />
          </ChatProvider>
        </Show>
      </Match>
    </Switch>
  );
}; 

const App: Component = (): JSX.Element => {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}; 

export default App;
