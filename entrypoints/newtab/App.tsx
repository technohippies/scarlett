import { Component, createSignal, Match, Switch, createResource, createEffect, Show, JSX } from 'solid-js';
import NewTabPage from '../../src/pages/newtab/NewTabPage';
import BookmarksPage from '../../src/pages/bookmarks/BookmarksPage';
import StudyPage from '../../src/pages/study/StudyPage';
import SettingsPage from '../../src/pages/settings/SettingsPage';
import { ChatPageLayout } from '../../src/features/chat/ChatPageLayout';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { ChatMachineProvider } from '../../src/features/chat/ChatMachineContext';
import type { Messages } from '../../src/types/i18n';
import { browser } from 'wxt/browser';
import { userConfigurationStorage } from '../../src/services/storage/storage';
import type { UserConfiguration } from '../../src/services/storage/types';

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

const App: Component = (): JSX.Element => {
  const [activeView, setActiveView] = createSignal<ActiveView>('newtab');
  const [effectiveLangCode] = createSignal<string>(getBestInitialLangCode());
  const [userConfig, setUserConfig] = createSignal<UserConfiguration | null>(null);

  createEffect(() => {
    userConfigurationStorage.getValue()
      .then(config => setUserConfig(config || null))
      .catch(e => console.error('[App.tsx] Failed to load user config:', e));
  });

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
    <SettingsProvider>
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
          <BookmarksPage onNavigateBack={() => navigateTo('newtab')} />
        </Match>
        <Match when={activeView() === 'study'}>
          <StudyPage onNavigateBack={() => navigateTo('newtab')} messages={messagesData()} />
        </Match>
        <Match when={activeView() === 'settings'}>
          <SettingsPage onNavigateBack={() => navigateTo('newtab')} /> 
        </Match>
        <Match when={activeView() === 'unifiedChat'}>
          <Show when={userConfig()} fallback={<div>Loading chats and configuration...</div>}>
            <ChatMachineProvider initialUserConfig={userConfig()!}>
              <ChatPageLayout onNavigateBack={() => navigateTo('newtab')} />
            </ChatMachineProvider>
          </Show>
        </Match>
      </Switch>
    </SettingsProvider>
  );
}; 

export default App;
