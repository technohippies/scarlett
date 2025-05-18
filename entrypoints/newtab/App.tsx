import { Component, createSignal, Match, Switch, createResource, onCleanup, createEffect, Show } from 'solid-js';
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
import {
  getAllChatThreads,
  getChatMessagesByThreadId,
  addChatThread,
  addChatMessage
} from '../../src/services/db/chat';
import { getAiChatResponse } from '../../src/services/llm/llmChatService';
import type { ChatMessage as LLMChatMessage, LLMConfig } from '../../src/services/llm/types';

const JUST_CHAT_THREAD_ID = '__just_chat_speech_mode__';

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

let appScopeHasInitializedDefaultThreads = false;

const App: Component = () => {
  const [activeView, setActiveView] = createSignal<ActiveView>('newtab');
  const [effectiveLangCode, setEffectiveLangCode] = createSignal<string>(getBestInitialLangCode());

  const [threads, setThreads] = createSignal<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = createSignal<string | null>(null);
  const [isLoadingThreads, setIsLoadingThreads] = createSignal(true);

  // Reset the flag if the App component itself is somehow re-mounted, for safety in some HMR scenarios.
  appScopeHasInitializedDefaultThreads = false;

  const triggerAiKickoffMessage = async (thread: Thread) => { // Made async for safety if DB calls were added here
    if (!thread || thread.messages.length > 0 || thread.id === JUST_CHAT_THREAD_ID) return;

    let kickoffText = "Hello! How can I assist you today based on my role?";
    let kickoffTtsLang = 'en';

    if (thread.systemPrompt.toLowerCase().includes("french tutor")) {
      kickoffText = "Bonjour! Comment puis-je vous aider avec votre français aujourd'hui?";
      kickoffTtsLang = 'fr';
    } else if (thread.systemPrompt.toLowerCase().includes("introductions")) {
      kickoffText = "Welcome! This is the introductions thread. How can I help you get started?";
    } else if (thread.systemPrompt.toLowerCase().includes("general chat")) {
      kickoffText = "Hello! I'm your general assistant. What can I help you with?";
    } // More conditions can be added here

    console.log(`[App.tsx] Triggering AI kickoff for thread ${thread.id} (${thread.title}) with: "${kickoffText}"`);
    // This will be updated to use addChatMessage later
    await handleSendMessageToUnifiedView(kickoffText, thread.id, false, kickoffTtsLang);
  };

  const loadMessagesForThreadAndKickoff = async (threadId: string) => {
    try {
      const messages = await getChatMessagesByThreadId(threadId);
      setThreads(prevThreads => 
        prevThreads.map(t => t.id === threadId ? { ...t, messages: messages } : t)
      );
      const updatedThread = threads().find(t => t.id === threadId);
      if (updatedThread && messages.length === 0) {
        await triggerAiKickoffMessage(updatedThread);
      }
    } catch (error) {
      console.error(`[App.tsx] Error loading messages or kicking off for thread ${threadId}:`, error);
    }
  };

  createEffect(async () => {
    if (!appScopeHasInitializedDefaultThreads) {
      console.log('[App.tsx] Attempting to initialize default threads (run once check)...');
      setIsLoadingThreads(true);
      try {
        const loadedThreads = await getAllChatThreads();
        if (loadedThreads.length === 0) {
          console.log('[App.tsx] No threads in DB. Creating default welcome threads...');
          const introductionsThreadData: Omit<Thread, 'messages' | 'lastActivity'> = {
            id: 'thread-welcome-introductions',
            title: 'Introductions',
            systemPrompt: "I'm Scarlett, your friendly AI language companion. I'd love to get to know you a bit! Tell me about yourself - what are your interests, what languages are you learning, or anything else you'd like to share?"
          };
          const sharingThreadData: Omit<Thread, 'messages' | 'lastActivity'> = {
            id: 'thread-welcome-sharing',
            title: 'Sharing Thoughts',
            systemPrompt: "It's great to connect on a deeper level. As an AI, I have a unique perspective. I can share some 'AI thoughts' or how I learn if you're curious, and I'm always here to listen to yours. What's on your mind, or what would you like to ask me?"
          };
          const justChatThreadData: Omit<Thread, 'messages' | 'lastActivity'> = {
            id: JUST_CHAT_THREAD_ID,
            title: 'Just Chat (Speech)',
            systemPrompt: 'You are a friendly AI assistant for voice chat. Keep responses concise for speech.'
          };

          const newIntroThread = await addChatThread(introductionsThreadData);
          const newSharingThread = await addChatThread(sharingThreadData);
          const newJustChatThread = await addChatThread(justChatThreadData);

          const initialSetupThreads = [newIntroThread, newSharingThread, newJustChatThread].filter(Boolean) as Thread[];
          setThreads(initialSetupThreads);
          
          const firstSelectableThread = initialSetupThreads.find(t => t.id !== JUST_CHAT_THREAD_ID);
          if (firstSelectableThread) {
            setCurrentThreadId(firstSelectableThread.id);
            await loadMessagesForThreadAndKickoff(firstSelectableThread.id); 
          } else {
            setCurrentThreadId(null);
          }
          appScopeHasInitializedDefaultThreads = true;
          console.log('[App.tsx] Default threads created and flag set.');
        } else {
          let allThreads = [...loadedThreads];
          if (!allThreads.some(t => t.id === JUST_CHAT_THREAD_ID)) {
            console.log('[App.tsx] JUST_CHAT_THREAD_ID missing from loaded threads. Creating it.');
            const justChatData: Omit<Thread, 'messages' | 'lastActivity'> = {
              id: JUST_CHAT_THREAD_ID,
              title: 'Just Chat (Speech)',
              systemPrompt: 'You are a friendly AI assistant for voice chat. Keep responses concise for speech.'
            };
            try {
              const createdJustChatThread = await addChatThread(justChatData);
              allThreads.push(createdJustChatThread);
            } catch (dbError) {
              console.error('[App.tsx] Failed to create missing JUST_CHAT_THREAD_ID:', dbError);
            }
          }
          setThreads(allThreads);
          const firstSelectableThread = allThreads.find(t => t.id !== JUST_CHAT_THREAD_ID);
          if (firstSelectableThread) {
            // Only set currentThreadId if it's not already valid or set
            if (currentThreadId() === null || !allThreads.some(t=> t.id === currentThreadId())) {
               setCurrentThreadId(firstSelectableThread.id);
            }
            await loadMessagesForThreadAndKickoff(currentThreadId() || firstSelectableThread.id);
          } else {
            setCurrentThreadId(null);
          }
          appScopeHasInitializedDefaultThreads = true;
          console.log('[App.tsx] Threads already existed or JUST_CHAT_THREAD_ID handled, flag set.');
        }
      } catch (error) {
        console.error('[App.tsx] Error during one-time thread initialization:', error);
        setThreads([]);
        setCurrentThreadId(null);
        // Do not set flag to true on error, to allow potential re-try if appropriate
      } finally {
        setIsLoadingThreads(false);
        console.log('[App.tsx] Finished one-time thread initialization attempt.');
      }
    } else {
      console.log('[App.tsx] Default threads initialization routine already run, skipping DB seed section.');
      // This section handles subsequent runs of the createEffect if it's triggered by other dependencies
      // after the initial thread setup. For example, if effectiveLangCode changes.
      // We might need to ensure threads are still loaded if not already.
      if (threads().length === 0 && appScopeHasInitializedDefaultThreads) {
        console.warn("[App.tsx] Threads array is empty even though initialization flag is set. Re-fetching threads.");
        setIsLoadingThreads(true);
        try {
            const currentDBThreads = await getAllChatThreads();
            setThreads(currentDBThreads);
            if (currentDBThreads.length > 0) {
                const firstSelectable = currentDBThreads.find(t => t.id !== JUST_CHAT_THREAD_ID);
                if (firstSelectable && (currentThreadId() === null || !currentDBThreads.some(t => t.id === currentThreadId()))) {
                    setCurrentThreadId(firstSelectable.id);
                }
                if(currentThreadId()){
                    await loadMessagesForThreadAndKickoff(currentThreadId()!);
                }
            }
        } catch (e) {
            console.error("[App.tsx] Error re-fetching threads:", e);
        } finally {
            setIsLoadingThreads(false);
        }
      }
    }

    // Language loading logic (runs independently of the thread seeding guard)
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

  const i18n = () => {
    const messages = messagesData();
    return {
      get: (key: string, fallback: string) => messages?.[key]?.message || fallback,
    };
  };
  // --- Handler modifications for DB interaction --- 

  const handleSelectThread = async (threadId: string) => {
    console.log('[App.tsx] handleSelectThread:', threadId);
    const selectedThread = threads().find(t => t.id === threadId);
    if (selectedThread) {
      setCurrentThreadId(threadId);
      if (!selectedThread.messages || selectedThread.messages.length === 0) {
        console.log(`[App.tsx] Messages for thread ${threadId} not loaded or empty, fetching...`);
        await loadMessagesForThreadAndKickoff(threadId);
      }
    } else {
      console.warn(`[App.tsx] Thread with id ${threadId} not found.`);
    }
  };

  const handleCreateNewThread = async (baseTitle: string, systemPromptForDB: string): Promise<string> => {
    const uniqueTitle = `${baseTitle} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    console.log(`[App.tsx] Creating new thread: "${uniqueTitle}" with system prompt (for DB): "${systemPromptForDB}"`);
    
    const newThreadData: Omit<Thread, 'messages' | 'lastActivity'> = {
      id: `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: uniqueTitle, // Use the generated unique title
      systemPrompt: systemPromptForDB, // This will be empty for general chats from the UI
    };
    try {
      const createdThread = await addChatThread(newThreadData);
      // Ensure messages array is initialized for the new thread in the local state
      const threadWithEmptyMessages = { ...createdThread, messages: [] }; 
      setThreads(prev => [threadWithEmptyMessages, ...prev]);
      setCurrentThreadId(createdThread.id);
      // No automatic AI kickoff for these general new chats, user initiates.
      // await loadMessagesForThreadAndKickoff(createdThread.id); // Not needed if no kickoff and messages are empty
      return createdThread.id;
    } catch (error) {
      console.error('[App.tsx] Error creating new thread:', error);
      return '';
    }
  };

  const handleSendMessageToUnifiedView = async (
    text: string,
    threadId: string,
    isUserMessage: boolean,
    ttsLangForAiResponse?: string
  ) => {
    console.log(`[App.tsx] handleSendMessageToUnifiedView. Thread: ${threadId}, User: ${isUserMessage}, Text: \"${text}\"`);
    const currentThreadSignalValue = threads().find(t => t.id === threadId);
    if (!currentThreadSignalValue) {
      console.error(`[App.tsx] Thread with id ${threadId} not found. Cannot send message.`);
      return;
    }

    const currentIsoTimestamp = new Date().toISOString();

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      thread_id: threadId, 
      timestamp: currentIsoTimestamp,
      sender: isUserMessage ? 'user' : 'ai',
      text_content: text,
      ttsWordMap: undefined,
      alignmentData: undefined,
      ttsLang: isUserMessage ? undefined : ttsLangForAiResponse || effectiveLangCode(),
    };

    try {
      await addChatMessage(newMessage);

      const newMessagesAfterUser = [...(currentThreadSignalValue.messages || []), newMessage];
      const updatedThreadAfterUserMessage: Thread = {
        ...currentThreadSignalValue,
        messages: newMessagesAfterUser,
        lastActivity: currentIsoTimestamp,
      };
      setThreads(prevThreads =>
        prevThreads.map(t => (t.id === threadId ? updatedThreadAfterUserMessage : t))
      );

      if (isUserMessage) {
        const userConfig = await userConfigurationStorage.getValue();

        if (!userConfig
            || !userConfig.selectedLlmProvider
            || userConfig.selectedLlmProvider === 'none'
            || !userConfig.llmConfig
            || !userConfig.llmConfig.modelId
            || !userConfig.llmConfig.baseUrl
        ) {
          console.error('[App.tsx] LLM provider, config, or modelId not properly set. Cannot get AI response.');
          const errorText = !userConfig || !userConfig.llmConfig
            ? "AI provider is not set."
            : !userConfig.llmConfig.modelId
              ? "LLM model is not configured."
              : "LLM baseUrl is not configured.";
          const errorTimestamp = new Date().toISOString();
          const errorAiMessage: ChatMessage = {
            id: `msg-error-cfg-${Date.now()}`,
            thread_id: threadId, 
            timestamp: errorTimestamp,
            sender: 'ai',
            text_content: errorText + " Please check settings.",
            ttsWordMap: undefined, alignmentData: undefined, ttsLang: effectiveLangCode(),
          };
          await addChatMessage(errorAiMessage);

          const newMessagesAfterError = [...newMessagesAfterUser, errorAiMessage];
          const updatedThreadAfterError: Thread = {
            ...updatedThreadAfterUserMessage,
            messages: newMessagesAfterError,
            lastActivity: errorTimestamp,
          };
          setThreads(prevThreads =>
            prevThreads.map(t => (t.id === threadId ? updatedThreadAfterError : t))
          );
          return;
        }

        const modelIdSafe: string = userConfig.llmConfig.modelId;
        const baseUrlSafe: string = userConfig.llmConfig.baseUrl; // guaranteed non-null by guard

        const llmSpecificConfig: LLMConfig = {
          provider: userConfig.selectedLlmProvider,
          model: modelIdSafe,
          baseUrl: baseUrlSafe,
          apiKey: userConfig.llmConfig.apiKey ?? '',
          stream: false,
        };
        
        // Additional check for empty model string if the LLM provider cannot handle it.
        if (llmSpecificConfig.model === "") {
            console.error('[App.tsx] LLM model ID is an empty string after safety check. Cannot get AI response.');
            const errorModelEmptyTimestamp = new Date().toISOString();
            const errorModelEmptyMessage: ChatMessage = {
                id: `msg-error-model-empty-${Date.now()}`,
                thread_id: threadId,
                timestamp: errorModelEmptyTimestamp,
                sender: 'ai',
                text_content: "LLM model is not configured (empty). Please check settings.",
                ttsWordMap: undefined, alignmentData: undefined, ttsLang: effectiveLangCode(),
            };
            await addChatMessage(errorModelEmptyMessage);
            const newMessagesAfterModelError = [...newMessagesAfterUser, errorModelEmptyMessage];
            const updatedThreadAfterModelError: Thread = {
                ...updatedThreadAfterUserMessage,
                messages: newMessagesAfterModelError,
                lastActivity: errorModelEmptyTimestamp,
            };
            setThreads(prevThreads =>
                prevThreads.map(t => (t.id === threadId ? updatedThreadAfterModelError : t))
            );
            return;
        }

        const historyForLLM = currentThreadSignalValue.messages || [];
        const conversationHistoryForLLM: LLMChatMessage[] = historyForLLM.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text_content
        }));

        console.log(`[App.tsx] Requesting AI response. Provider: ${llmSpecificConfig.provider}, Model: ${llmSpecificConfig.model}`);

        try {
          const aiResponseText = await getAiChatResponse(
            conversationHistoryForLLM,
            text,
            llmSpecificConfig,
            { threadSystemPrompt: currentThreadSignalValue.systemPrompt }
          );

          if (aiResponseText && typeof aiResponseText === 'string' && aiResponseText.trim() !== '') {
            const aiMessageTimestamp = new Date().toISOString();
            const aiMessage: ChatMessage = {
              id: `msg-ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              thread_id: threadId, 
              timestamp: aiMessageTimestamp,
              sender: 'ai',
              text_content: aiResponseText,
              ttsWordMap: undefined, alignmentData: undefined, 
              ttsLang: ttsLangForAiResponse || effectiveLangCode(),
            };
            await addChatMessage(aiMessage);

            const newMessagesAfterAI = [...newMessagesAfterUser, aiMessage];
            const updatedThreadAfterAI: Thread = {
              ...updatedThreadAfterUserMessage,
              messages: newMessagesAfterAI,
              lastActivity: aiMessageTimestamp,
            };
            setThreads(prevThreads =>
              prevThreads.map(t => (t.id === threadId ? updatedThreadAfterAI : t))
            );
          } else {
            console.error('[App.tsx] AI response text was empty or not a string:', aiResponseText);
            const emptyErrorTimestamp = new Date().toISOString();
            const errorResponseMessage: ChatMessage = {
              id: `msg-error-empty-${Date.now()}`,
              thread_id: threadId, 
              timestamp: emptyErrorTimestamp,
              sender: 'ai',
              text_content: "Sorry, I received an empty or invalid response from the AI.",
              ttsWordMap: undefined, alignmentData: undefined, ttsLang: effectiveLangCode(),
            };
            await addChatMessage(errorResponseMessage);

            const newMessagesAfterEmptyError = [...newMessagesAfterUser, errorResponseMessage];
            const updatedThreadAfterEmptyError: Thread = {
              ...updatedThreadAfterUserMessage,
              messages: newMessagesAfterEmptyError,
              lastActivity: emptyErrorTimestamp,
            };
            setThreads(prevThreads =>
              prevThreads.map(t => (t.id === threadId ? updatedThreadAfterEmptyError : t))
            );
          }
        } catch (llmError) {
          console.error('[App.tsx] Error getting AI response from LLM service:', llmError);
          const llmErrorTimestamp = new Date().toISOString();
          const errorLlmMessage: ChatMessage = {
            id: `msg-error-llm-${Date.now()}`,
            thread_id: threadId, 
            timestamp: llmErrorTimestamp,
            sender: 'ai',
            text_content: `Sorry, I encountered an error trying to respond: ${String(llmError)}.`,
            ttsWordMap: undefined, alignmentData: undefined, ttsLang: effectiveLangCode(),
          };
          await addChatMessage(errorLlmMessage);

          const newMessagesAfterLlmError = [...newMessagesAfterUser, errorLlmMessage];
          const updatedThreadAfterLlmError: Thread = {
            ...updatedThreadAfterUserMessage,
            messages: newMessagesAfterLlmError,
            lastActivity: llmErrorTimestamp,
          };
          setThreads(prevThreads =>
            prevThreads.map(t => (t.id === threadId ? updatedThreadAfterLlmError : t))
          );
        }
      }
    } catch (error) {
      console.error('[App.tsx] Error sending message or updating UI:', error);
    }
  };

  // --- JSX --- 
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
          <Show when={!isLoadingThreads()} fallback={<div>Loading chats...</div>}>
            <UnifiedConversationView
              threads={threads()}
              currentSelectedThreadId={currentThreadId()}
              onSelectThread={handleSelectThread}
              onCreateNewThread={handleCreateNewThread}
              onSendMessage={handleSendMessageToUnifiedView}
              onNavigateBack={() => navigateTo('newtab')}
            />
          </Show>
        </Match>
      </Switch>
    </SettingsProvider>
  );
};

export default App;
