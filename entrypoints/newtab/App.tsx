import { Component, createSignal, Match, Switch, createResource, onCleanup, createEffect, Show } from 'solid-js';
import NewTabPage from '../../src/pages/newtab/NewTabPage';
import BookmarksPage from '../../src/pages/bookmarks/BookmarksPage';
import StudyPage from '../../src/pages/study/StudyPage';
import SettingsPage from '../../src/pages/settings/SettingsPage';
import { UnifiedConversationView } from '../../src/features/chat/UnifiedConversationView';
import type { Thread, ChatMessage as UIChatMessage } from '../../src/features/chat/types';
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
import { getAiChatResponseStream } from '../../src/services/llm/llmChatService';
import type { ChatMessage as LLMChatMessage, LLMConfig, LLMProviderId } from '../../src/services/llm/types';

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
  const [userConfig, setUserConfig] = createSignal<UserConfiguration | null>(null);

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
      // Also set the userConfig signal here initially
      if (config) {
        setUserConfig(config);
      } else {
        // Attempt to set a default or minimal config if none exists, 
        // or ensure UnifiedConversationView handles null gracefully.
        // For now, just log and it will be null.
        console.warn('[App.tsx] No user configuration found in storage during initial load.');
        setUserConfig(null); 
      }
    }).catch(e => {
      console.error('[NewTabApp] Error loading initial language or user config from storage during createEffect:', e);
      setUserConfig(null); // Set to null on error too
    });
  });

  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    const storageKey = userConfigurationStorage.key;
    if (areaName === 'local' && changes[storageKey]) {
      const newConfig = changes[storageKey].newValue as UserConfiguration | undefined;
      // Update userConfig signal
      if (newConfig) {
        setUserConfig(newConfig);
        if (newConfig.nativeLanguage) {
          if (newConfig.nativeLanguage !== effectiveLangCode()) {
              console.log('[NewTabApp] handleStorageChange: Updating effectiveLangCode to:', newConfig.nativeLanguage);
              setEffectiveLangCode(newConfig.nativeLanguage);
          }
        }
      } else {
        setUserConfig(null);
        if (effectiveLangCode() !== 'en') {
          console.log('[NewTabApp] handleStorageChange: nativeLanguage is null or config removed, defaulting to English.');
          setEffectiveLangCode('en');
        }
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

  const handleCreateNewThread = async (
    title: string, 
    systemPromptForDB: string,
    initialMessages?: UIChatMessage[],
  ): Promise<string> => {
    const uniqueTitle = title || `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    console.log(`[App.tsx] Creating new thread: "${uniqueTitle}" with system prompt (for DB): "${systemPromptForDB}"`);
    
    const newThreadData: Omit<Thread, 'messages' | 'lastActivity'> = {
      id: `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: uniqueTitle, 
      systemPrompt: systemPromptForDB, 
    };
    try {
      const createdThread = await addChatThread(newThreadData);
      let messagesForNewThread: UIChatMessage[] = [];

      if (initialMessages && initialMessages.length > 0) {
        for (const msg of initialMessages) {
          const messageToSave: UIChatMessage = {
            ...msg,
            thread_id: createdThread.id,
            timestamp: msg.timestamp || new Date().toISOString(),
          };
          await addChatMessage(messageToSave);
          messagesForNewThread.push(messageToSave);
        }
      }
      
      const threadWithMessages = { ...createdThread, messages: messagesForNewThread }; 
      setThreads(prev => [threadWithMessages, ...prev]);
      setCurrentThreadId(createdThread.id);
      
      // Conditionally send "Hello!" only if no initial messages were provided by the caller
      // AND it's a general chat (empty system prompt from UnifiedConversationView implies general from its side)
      if ((!initialMessages || initialMessages.length === 0) && (!systemPromptForDB || systemPromptForDB.trim() === "")) {
        console.log(`[App.tsx] New general thread ${createdThread.id} created without initial messages. Sending 'Hello!' as user.`);
        await handleSendMessageToUnifiedView("Hello!", createdThread.id, true);
      } else if (initialMessages && initialMessages.length > 0) {
        console.log(`[App.tsx] New thread ${createdThread.id} created with ${initialMessages.length} initial message(s). Not sending automatic "Hello!".`);
      }

      return createdThread.id;
    } catch (error) {
      console.error('[App.tsx] Error creating new thread or saving initial messages:', error);
      return '';
    }
  };

  const handleSendMessageToUnifiedView = async (
    text: string,
    threadId: string,
    isUserMessage: boolean,
    ttsLangForAiResponse?: string
  ) => {
    const currentThreadSignalValue = threads().find(t => t.id === threadId);
    if (!currentThreadSignalValue) {
      console.error(`[App.tsx] handleSendMessageToUnifiedView: Thread with id ${threadId} not found.`);
      return;
    }

    const currentIsoTimestamp = new Date().toISOString();
    const userMessage: UIChatMessage = {
      id: `msg-user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      thread_id: threadId,
      timestamp: currentIsoTimestamp,
      sender: 'user',
      text_content: text,
      ttsWordMap: undefined,
      alignmentData: undefined,
      ttsLang: undefined,
    };

    // Add user message to DB and update local state immediately
    if (isUserMessage) {
      try {
        await addChatMessage(userMessage);
        const updatedMessages = [...(currentThreadSignalValue.messages || []), userMessage];
        const updatedThreadAfterUser: Thread = {
          ...currentThreadSignalValue,
          messages: updatedMessages,
          lastActivity: currentIsoTimestamp,
        };
        setThreads(prevThreads =>
          prevThreads.map(t => (t.id === threadId ? updatedThreadAfterUser : t))
        );
      } catch (error) {
        console.error('[App.tsx] Error saving user message or updating UI:', error);
        // Optionally, inform the user that their message couldn't be sent/saved
        return; 
      }
    } else {
      // This branch handles AI-initiated messages (e.g., kickoff)
      // It assumes 'text' is the full message content from the AI already.
      const aiKickoffMessage: UIChatMessage = {
        id: `msg-ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        thread_id: threadId,
        timestamp: currentIsoTimestamp,
        sender: 'ai',
        text_content: text, // Full text for AI kickoff
        ttsWordMap: undefined,
        alignmentData: undefined,
        ttsLang: ttsLangForAiResponse || effectiveLangCode(),
      };
      try {
        await addChatMessage(aiKickoffMessage);
        const updatedMessagesWithKickoff = [...(currentThreadSignalValue.messages || []), aiKickoffMessage];
        const updatedThreadWithKickoff: Thread = {
          ...currentThreadSignalValue,
          messages: updatedMessagesWithKickoff,
          lastActivity: currentIsoTimestamp,
        };
        setThreads(prevThreads =>
          prevThreads.map(t => (t.id === threadId ? updatedThreadWithKickoff : t))
        );
      } catch (error) {
        console.error('[App.tsx] Error saving AI kickoff message or updating UI:', error);
      }
      return; // AI kickoff doesn't need to fetch a response for itself
    }

    // --- Streaming AI Response Logic (only if isUserMessage was true) ---
    const userConfig = await userConfigurationStorage.getValue();
    if (!userConfig || !userConfig.llmConfig || !userConfig.llmConfig.providerId || userConfig.llmConfig.providerId === 'none' || !userConfig.llmConfig.modelId) {
      console.error('[App.tsx] LLM config not properly set for streaming response.', userConfig?.llmConfig);
      const errorText = "AI provider/model not configured. Please check settings.";
      // Add error message to chat
      const errorMsgTimestamp = new Date().toISOString();
      const errorAiMessage: UIChatMessage = {
        id: `msg-error-cfg-stream-${Date.now()}`, thread_id: threadId, timestamp: errorMsgTimestamp,
        sender: 'ai', text_content: errorText, ttsLang: effectiveLangCode(),
      };
      await addChatMessage(errorAiMessage);
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, messages: [...(t.messages || []), errorAiMessage], lastActivity: errorMsgTimestamp } : t));
      return;
    }

    const llmServiceConfig: LLMConfig = {
      provider: userConfig.llmConfig.providerId as LLMProviderId,
      model: userConfig.llmConfig.modelId,
      baseUrl: userConfig.llmConfig.baseUrl ?? '',
      apiKey: userConfig.llmConfig.apiKey ?? undefined,
    };

    if (!llmServiceConfig.model) {
        console.error('[App.tsx] LLM Model ID is empty for streaming.');
        const modelErrorMsg = "LLM model not configured for streaming. Check settings.";
        const modelErrorTimestamp = new Date().toISOString();
        const errorModelMsg: UIChatMessage = {
            id: `msg-error-model-stream-${Date.now()}`, thread_id: threadId, timestamp: modelErrorTimestamp,
            sender: 'ai', text_content: modelErrorMsg, ttsLang: effectiveLangCode(),
        };
        await addChatMessage(errorModelMsg);
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, messages: [...(t.messages || []), errorModelMsg], lastActivity: modelErrorTimestamp } : t));
        return;
    }
    
    // Prepare history for LLM, using messages up to and including the latest user message
    const historyForLLM = threads().find(t => t.id === threadId)?.messages || [];
    const conversationHistoryForLLM: LLMChatMessage[] = historyForLLM
        // Ensure we only map messages that have text_content, and are from user or ai
        .filter(msg => typeof msg.text_content === 'string' && (msg.sender === 'user' || msg.sender === 'ai'))
        .map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant', // Map 'ai' to 'assistant' for LLM
            content: msg.text_content! 
        }));

    // Create an initial placeholder AI message for streaming
    const aiStreamingMessageId = `msg-ai-stream-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const initialAiMessage: UIChatMessage = {
      id: aiStreamingMessageId,
      thread_id: threadId,
      timestamp: new Date().toISOString(), 
      sender: 'ai',
      text_content: '', 
      ttsWordMap: undefined,
      alignmentData: undefined,
      ttsLang: ttsLangForAiResponse || effectiveLangCode(),
      isStreaming: true,
    };

    // Add initial AI message to local state
    setThreads(prevThreads =>
      prevThreads.map(t =>
        t.id === threadId
          ? { ...t, messages: [...(t.messages || []), initialAiMessage] }
          : t
      )
    );
    
    console.log(`[App.tsx] Requesting STREAMING AI response. Provider: ${llmServiceConfig.provider}, Model: ${llmServiceConfig.model}`);
    
    let accumulatedResponse = '';
    let finalTimestamp = initialAiMessage.timestamp;
    let streamErrorOccurred = false;

    try {
      console.log('[App.tsx Stream] Starting to iterate getAiChatResponseStream...');
      for await (const part of getAiChatResponseStream(
        conversationHistoryForLLM, 
        text, 
        llmServiceConfig,
        { threadSystemPrompt: currentThreadSignalValue.systemPrompt }
      )) {
        console.log('[App.tsx Stream] Received part from getAiChatResponseStream:', JSON.stringify(part));
        if (part.type === 'content') {
          accumulatedResponse += part.content;
          finalTimestamp = new Date().toISOString(); 
          console.log(`[App.tsx Stream] Accumulated content: "${accumulatedResponse}"`);
          setThreads(prevThreads =>
            prevThreads.map(t => {
              if (t.id === threadId) {
                const updatedMessages = t.messages.map(m =>
                    m.id === aiStreamingMessageId ? { ...m, text_content: accumulatedResponse, timestamp: finalTimestamp } : m
                  );
                // console.log('[App.tsx Stream] Updating thread messages for id:', threadId, 'New messages:', updatedMessages);
                return {
                  ...t,
                  messages: updatedMessages,
                  lastActivity: finalTimestamp,
                };
              }
              return t;
            })
          );
          console.log('[App.tsx Stream] setThreads called with new content.');
        } else if (part.type === 'error') {
          console.error('[App.tsx Stream] Streaming error part from LLM:', part.error);
          accumulatedResponse += `\n[Stream Error: ${part.error}]`;
          finalTimestamp = new Date().toISOString();
          streamErrorOccurred = true;
          setThreads(prevThreads =>
            prevThreads.map(t => {
              if (t.id === threadId) {
                 const updatedMessages = t.messages.map(m =>
                    m.id === aiStreamingMessageId ? { ...m, text_content: accumulatedResponse, timestamp: finalTimestamp } : m
                  );
                // console.log('[App.tsx Stream] Updating thread messages with error for id:', threadId, 'New messages:', updatedMessages);
                return {
                  ...t,
                  messages: updatedMessages,
                  lastActivity: finalTimestamp,
                };
              }
              return t;
            })
          );
          console.log('[App.tsx Stream] setThreads called with error content.');
          break; 
        }
      }
      console.log('[App.tsx Stream] Finished iterating getAiChatResponseStream. Final accumulated text:', accumulatedResponse);
      
      // After stream finishes (or errors out), update the message with isStreaming: false and save final to DB
      const finalAiMessage: UIChatMessage = {
        ...initialAiMessage, 
        text_content: accumulatedResponse.trim(),
        timestamp: finalTimestamp, 
        isStreaming: false,
      };
      
      // Update the message in DB (or add if it was purely local during streaming)
      // For simplicity, we'll assume addChatMessage can handle an existing ID by updating,
      // or we'd need an updateChatMessage DB function.
      // For now, let's just update the local state which is already done,
      // and then try to add the *final* version. DB might need upsert logic.
      // To avoid duplicates if addChatMessage doesn't upsert, we remove the placeholder before adding final.
      
      // Remove placeholder, then add final. This is a bit inefficient but safer without an upsert.
      setThreads(prevThreads =>
        prevThreads.map(t => {
          if (t.id === threadId) {
            // Filter out the streaming message ID, then add the final one.
            const messagesWithoutStreamingPlaceholder = t.messages.filter(m => m.id !== aiStreamingMessageId);
            return { ...t, messages: [...messagesWithoutStreamingPlaceholder, finalAiMessage], lastActivity: finalTimestamp };
          }
          return t;
        })
      );
      if (finalAiMessage.text_content && streamErrorOccurred) {
         await addChatMessage(finalAiMessage);
      }

    } catch (error) {
      console.error('[App.tsx] Outer error during AI stream processing or DB save:', error);
      const streamErrorText = `Sorry, an error occurred while streaming the response: ${String(error)}.`;
      const finalErrorTimestamp = new Date().toISOString();
      streamErrorOccurred = true;

      // Update the existing streaming message with the error and isStreaming: false
      setThreads(prevThreads =>
        prevThreads.map(t => {
          if (t.id === threadId) {
            const streamingMsgIndex = t.messages.findIndex(m => m.id === aiStreamingMessageId);
            if (streamingMsgIndex !== -1) {
              const updatedMessages = [...t.messages];
              updatedMessages[streamingMsgIndex] = {
                ...updatedMessages[streamingMsgIndex],
                text_content: accumulatedResponse + `\n[Outer Error: ${String(error)}]`, 
                timestamp: finalErrorTimestamp,
                isStreaming: false,
              };
              return { ...t, messages: updatedMessages, lastActivity: finalErrorTimestamp };
            } else {
              const newErrorMsg: UIChatMessage = {
                id: `msg-error-stream-outer-${Date.now()}`,
                thread_id: threadId, timestamp: finalErrorTimestamp,
                sender: 'ai', text_content: streamErrorText, ttsLang: effectiveLangCode(),
                isStreaming: false,
              };
              return { ...t, messages: [...t.messages, newErrorMsg], lastActivity: finalErrorTimestamp };
            }
          }
          return t;
        })
      );
      
      // Attempt to save the error state to the DB if the message exists.
      const finalErrorAiMessage: UIChatMessage = {
        ...initialAiMessage,
        id: aiStreamingMessageId, 
        text_content: accumulatedResponse.trim() + `\n[Outer Error: ${String(error)}]`,
        timestamp: finalErrorTimestamp, 
        isStreaming: false,
      };
      if (finalErrorAiMessage.text_content && streamErrorOccurred) {
          await addChatMessage(finalErrorAiMessage);
      }
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
          <Show when={!isLoadingThreads() && userConfig()} fallback={<div>Loading chats and configuration...</div>}>
            <UnifiedConversationView
              threads={threads()}
              currentSelectedThreadId={currentThreadId()}
              onSelectThread={handleSelectThread}
              onCreateNewThread={handleCreateNewThread}
              onSendMessage={handleSendMessageToUnifiedView}
              onNavigateBack={() => navigateTo('newtab')}
              userConfig={userConfig()!}
            />
          </Show>
        </Match>
      </Switch>
    </SettingsProvider>
  );
};

export default App;
