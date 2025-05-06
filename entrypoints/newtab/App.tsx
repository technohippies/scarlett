import { Component, createSignal, Match, Switch, createResource, onCleanup, createEffect } from 'solid-js';
import NewTabPage from '../../src/pages/newtab/NewTabPage';
import BookmarksPage from '../../src/pages/bookmarks/BookmarksPage';
import StudyPage from '../../src/pages/study/StudyPage';
import SettingsPage from '../../src/pages/settings/SettingsPage';
import { SettingsProvider } from '../../src/context/SettingsContext';
import type { Messages } from '../../src/types/i18n';
import { userConfigurationStorage } from '../../src/services/storage/storage';
import type { UserConfiguration } from '../../src/services/storage/types';
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
      if (!fallbackResponse.ok) throw new Error(`HTTP error! status: ${fallbackResponse.status} for fallback 'en'`);
      return await fallbackResponse.json();
    } catch (fallbackError) {
      console.error('[NewTabApp] Failed to fetch fallback \'en\' messages.', fallbackError);
      return {}; 
    }
  }
};

type ActiveView = 'newtab' | 'bookmarks' | 'study' | 'settings';

const App: Component = () => {
  const [activeView, setActiveView] = createSignal<ActiveView>('newtab');
  const [effectiveLangCode, setEffectiveLangCode] = createSignal<string>(getBestInitialLangCode());

  createEffect(() => {
    userConfigurationStorage.getValue().then(config => {
      if (config && config.nativeLanguage) {
        if (config.nativeLanguage !== effectiveLangCode()) {
            setEffectiveLangCode(config.nativeLanguage);
        }
      }
    }).catch(e => {
      console.error('[NewTabApp] Error loading initial language from storage during createEffect:', e);
    });
  });

  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    const storageKey = userConfigurationStorage.key; // This is the actual key string e.g., 'userConfiguration'
    if (areaName === 'local' && changes[storageKey]) {
      const newConfig = changes[storageKey].newValue as UserConfiguration | undefined;
      if (newConfig && newConfig.nativeLanguage) {
        if (newConfig.nativeLanguage !== effectiveLangCode()) {
            console.log('[NewTabApp] handleStorageChange: Updating effectiveLangCode to:', newConfig.nativeLanguage);
            setEffectiveLangCode(newConfig.nativeLanguage);
        }
      } else if ((!newConfig || newConfig.nativeLanguage === null) && effectiveLangCode() !== 'en') {
        // If config is removed or nativeLanguage is explicitly null, default to English
        console.log('[NewTabApp] handleStorageChange: nativeLanguage is null or config removed, defaulting to English.');
        setEffectiveLangCode('en');
      }
    }
  };
  
  // Fallback to chrome.storage.onChanged if browser.storage.onChanged is problematic with types
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChange);
    onCleanup(() => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
        console.log('[NewTabApp] Cleaned up chrome.storage listener.');
    });
  } else if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener(handleStorageChange as any); // Use as any if types still conflict
    onCleanup(() => {
        browser.storage.onChanged.removeListener(handleStorageChange as any);
        console.log('[NewTabApp] Cleaned up browser.storage listener.');
    });
  }

  const [messagesData] = createResource(effectiveLangCode, fetchMessages);

  const navigateTo = (view: ActiveView) => {
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
             messages={messagesData()} 
             messagesLoading={messagesData.loading} 
          />
        </Match>
        <Match when={activeView() === 'bookmarks'}>
          <BookmarksPage onNavigateBack={() => navigateTo('newtab')} />
        </Match>
        <Match when={activeView() === 'study'}>
          <StudyPage onNavigateBack={() => navigateTo('newtab')} />
        </Match>
        <Match when={activeView() === 'settings'}>
          <SettingsPage onNavigateBack={() => navigateTo('newtab')} /> 
        </Match>
      </Switch>
    </SettingsProvider>
  );
};

export default App;
