import { Component, createSignal, Match, Switch, createResource, onCleanup, createEffect } from 'solid-js';
import NewTabPage from '../../src/pages/newtab/NewTabPage';
import BookmarksPage from '../../src/pages/bookmarks/BookmarksPage';
import StudyPage from '../../src/pages/study/StudyPage';
import SettingsPage from '../../src/pages/settings/SettingsPage';
import { UnifiedConversationView } from '../../src/features/chat/UnifiedConversationView';
import type { Thread, ChatMessage } from '../../src/features/chat/types';
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

type ActiveView = 'newtab' | 'bookmarks' | 'study' | 'settings' | 'unifiedChat';

const App: Component = () => {
  const [activeView, setActiveView] = createSignal<ActiveView>('newtab');
  const [effectiveLangCode, setEffectiveLangCode] = createSignal<string>(getBestInitialLangCode());

  const [threads, setThreads] = createSignal<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = createSignal<string | null>(null);

  createEffect(() => {
    const initialThreads: Thread[] = [
      {
        id: 'thread-1',
        title: 'Introductions',
        systemPrompt: 'You are a helpful assistant for general chat. Start by introducing yourself and asking how you can help.',
        messages: [],
        lastActivity: new Date().toISOString(),
      },
      {
        id: 'thread-2',
        title: 'French Tutor Bot',
        systemPrompt: 'You are a friendly French tutor. Start by greeting the user in French and ask what they want to learn.',
        messages: [],
        lastActivity: new Date().toISOString(),
      },
      {
        id: '__just_chat_speech_mode__',
        title: "Just Chat (Speech)",
        systemPrompt: "You are a friendly AI assistant for voice chat. Keep responses concise for speech.",
        messages: [],
        lastActivity: new Date().toISOString(),
      }
    ];
    setThreads(initialThreads);
    if (initialThreads.length > 0 && initialThreads[0].id !== '__just_chat_speech_mode__') {
      setCurrentThreadId(initialThreads[0].id);
    } else if (initialThreads.length > 1) {
      setCurrentThreadId(initialThreads.find(t => t.id !== '__just_chat_speech_mode__')?.id || null);
    }
    
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
    const storageKey = userConfigurationStorage.key;
    if (areaName === 'local' && changes[storageKey]) {
      const newConfig = changes[storageKey].newValue as UserConfiguration | undefined;
      if (newConfig && newConfig.nativeLanguage) {
        if (newConfig.nativeLanguage !== effectiveLangCode()) {
            console.log('[NewTabApp] handleStorageChange: Updating effectiveLangCode to:', newConfig.nativeLanguage);
            setEffectiveLangCode(newConfig.nativeLanguage);
        }
      } else if ((!newConfig || newConfig.nativeLanguage === null) && effectiveLangCode() !== 'en') {
        console.log('[NewTabApp] handleStorageChange: nativeLanguage is null or config removed, defaulting to English.');
        setEffectiveLangCode('en');
      }
    }
  };
  
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChange);
    onCleanup(() => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
        console.log('[NewTabApp] Cleaned up chrome.storage listener.');
    });
  } else if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener(handleStorageChange as any);
    onCleanup(() => {
        browser.storage.onChanged.removeListener(handleStorageChange as any);
        console.log('[NewTabApp] Cleaned up browser.storage listener.');
    });
  }

  const [messagesData] = createResource(effectiveLangCode, fetchMessages);

  const navigateTo = (view: ActiveView) => {
    console.log(`[App.tsx] Navigating to: ${view}`);
    setActiveView(view);
  };

  const handleSendMessageToUnifiedView = async (
    text: string, 
    threadId: string, 
    isUserMessage: boolean, 
    ttsLangForAiResponse?: string
  ) => {
    console.log('[App.tsx] handleSendMessageToUnifiedView:', { text, threadId, isUserMessage, ttsLangForAiResponse });
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      sender: isUserMessage ? 'user' : 'ai',
      timestamp: new Date().toISOString(),
      ttsLang: isUserMessage ? undefined : ttsLangForAiResponse,
    };

    setThreads(prevThreads => 
      prevThreads.map(thread => 
        thread.id === threadId 
          ? { ...thread, messages: [...thread.messages, newMessage], lastActivity: new Date().toISOString() }
          : thread
      )
    );

    if (isUserMessage) {
      setTimeout(() => {
        const currentThreadForResponse = threads().find(t => t.id === threadId);
        let aiResponseText = `Mock AI Response to: "${text}".`;
        if (currentThreadForResponse) {
          aiResponseText += ` My role: "${currentThreadForResponse.systemPrompt.substring(0, 70)}..."`;
        }
        
        const aiMessage: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          text: aiResponseText,
          sender: 'ai',
          timestamp: new Date().toISOString(),
          ttsLang: ttsLangForAiResponse || 'en', 
        };
        setThreads(prevThreads =>
          prevThreads.map(thread =>
            thread.id === threadId
              ? { ...thread, messages: [...thread.messages, aiMessage], lastActivity: new Date().toISOString() }
              : thread
          )
        );
      }, 1000);
    }
  };

  const triggerAiKickoffMessage = (thread: Thread) => {
    if (!thread || thread.messages.length > 0) return; // Only kickoff if thread is empty

    let kickoffText = "Hello! How can I assist you today based on my role?"; // Default kickoff
    let kickoffTtsLang = 'en';

    // Basic logic to customize kickoff based on system prompt
    if (thread.systemPrompt.toLowerCase().includes("french tutor")) {
      kickoffText = "Bonjour! Comment puis-je vous aider avec votre français aujourd'hui?";
      kickoffTtsLang = 'fr';
    } else if (thread.systemPrompt.toLowerCase().includes("general chat")) {
      kickoffText = "Hello! I'm your general assistant. What can I help you with?";
    } else if (thread.title.toLowerCase().includes("introductions")) {
        kickoffText = "Welcome! This is the introductions thread. How can I help you get started?"
    }
    // Add more conditions for other specific system prompts if needed

    console.log(`[App.tsx] Triggering AI kickoff for thread ${thread.id} (${thread.title}) with: "${kickoffText}"`);
    handleSendMessageToUnifiedView(kickoffText, thread.id, false, kickoffTtsLang);
  };

  const handleSelectThread = (threadId: string) => {
    console.log('[App.tsx] handleSelectThread:', threadId);
    setCurrentThreadId(threadId);
    const selectedThread = threads().find(t => t.id === threadId);
    if (selectedThread) {
      triggerAiKickoffMessage(selectedThread);
    }
  };

  const handleCreateNewThread = async (title: string, systemPrompt: string): Promise<string> => {
    console.log('[App.tsx] handleCreateNewThread:', title, systemPrompt);
    const newThread: Thread = {
      id: `thread-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      systemPrompt,
      messages: [], 
      lastActivity: new Date().toISOString(),
    };
    
    setThreads(prev => [...prev, newThread]);
    setCurrentThreadId(newThread.id); // Select the new thread immediately
    triggerAiKickoffMessage(newThread); // Trigger kickoff for the new empty thread
    return newThread.id;
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
          <UnifiedConversationView
            threads={threads()}
            currentSelectedThreadId={currentThreadId()}
            onSelectThread={handleSelectThread}
            onCreateNewThread={handleCreateNewThread}
            onSendMessage={handleSendMessageToUnifiedView}
            onNavigateBack={() => navigateTo('newtab')}
          />
        </Match>
      </Switch>
    </SettingsProvider>
  );
};

export default App;
