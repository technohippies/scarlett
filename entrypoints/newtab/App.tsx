import { Component, createSignal, Match, Switch, createResource, onCleanup, createEffect, Show, JSX } from 'solid-js';
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
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BackgroundProtocolMap, NewChatThreadDataForRpc, NewChatMessageDataForRpc } from '../../src/shared/messaging-types';
import { getAiChatResponseStream, generateThreadTitleLLM } from '../../src/services/llm/llmChatService';
import type { ChatMessage as LLMChatMessage, LLMConfig, LLMProviderId } from '../../src/services/llm/types';

const JUST_CHAT_THREAD_ID = '__just_chat_speech_mode__';

const messaging = defineExtensionMessaging<BackgroundProtocolMap>();

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

let appScopeHasInitializedDefaultThreads = false;

const App: Component = (): JSX.Element => {
  const [activeView, setActiveView] = createSignal<ActiveView>('newtab');
  const [effectiveLangCode, setEffectiveLangCode] = createSignal<string>(getBestInitialLangCode());
  const [userConfig, setUserConfig] = createSignal<UserConfiguration | null>(null);

  const [threads, setThreads] = createSignal<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = createSignal<string | null>(null);
  const [isLoadingThreads, setIsLoadingThreads] = createSignal(true);

  appScopeHasInitializedDefaultThreads = false;

  const triggerAiKickoffMessage = async (thread: Thread) => {
    if (!thread || thread.messages.length > 0) return;
    let kickoffText: string | null = null;
    let kickoffTtsLang = 'en';
    if (thread.id === 'thread-welcome-introductions') {
      kickoffText = "Welcome! This is the introductions thread. How can I help you get started?";
    } else if (thread.id === 'thread-welcome-sharing') {
      kickoffText = "It's great to connect. I'm here to listen or share some AI thoughts. What's on your mind?";
    } else if (thread.id === JUST_CHAT_THREAD_ID) {
      kickoffText = "Voice chat active! How can I help you concisely?";
    }
    if (kickoffText) {
      console.log(`[App.tsx] Triggering AI kickoff for predefined thread ${thread.id} (${thread.title}) with: "${kickoffText}"`);
      await handleSendMessageToUnifiedView(kickoffText, thread.id, false, kickoffTtsLang);
    } else {
      console.log(`[App.tsx] No specific AI kickoff defined for empty thread ${thread.id} (${thread.title}). It will remain empty.`);
    }
  };

  const loadMessagesForThreadAndKickoff = async (threadId: string) => {
    try {
      const messages = await messaging.sendMessage('getChatMessages', { threadId });
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
        const loadedThreads = await messaging.sendMessage('getAllChatThreads', undefined);
        if (loadedThreads.length === 0) {
          console.log('[App.tsx] No threads in DB. Creating default welcome threads via RPC...');
          const introductionsThreadData: NewChatThreadDataForRpc = {
            id: 'thread-welcome-introductions',
            title: 'Introductions',
            systemPrompt: "I'm Scarlett, your friendly AI language companion. I'd love to get to know you a bit! Tell me about yourself - what are your interests, what languages are you learning, or anything else you'd like to share?"
          };
          const sharingThreadData: NewChatThreadDataForRpc = {
            id: 'thread-welcome-sharing',
            title: 'Sharing Thoughts',
            systemPrompt: "It's great to connect on a deeper level. As an AI, I have a unique perspective. I can share some 'AI thoughts' or how I learn if you're curious, and I'm always here to listen to yours. What's on your mind, or what would you like to ask me?"
          };
          const justChatThreadData: NewChatThreadDataForRpc = {
            id: JUST_CHAT_THREAD_ID,
            title: 'Just Chat (Speech)',
            systemPrompt: 'You are a friendly AI assistant for voice chat. Keep responses concise for speech.'
          };

          const newIntroThread = await messaging.sendMessage('addChatThread', introductionsThreadData);
          const newSharingThread = await messaging.sendMessage('addChatThread', sharingThreadData);
          const newJustChatThread = await messaging.sendMessage('addChatThread', justChatThreadData);

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
          console.log('[App.tsx] Default threads created via RPC and flag set.');
        } else {
          let allThreads = [...loadedThreads];
          if (!allThreads.some(t => t.id === JUST_CHAT_THREAD_ID)) {
            console.log('[App.tsx] JUST_CHAT_THREAD_ID missing. Creating it via RPC.');
            const justChatData: NewChatThreadDataForRpc = {
              id: JUST_CHAT_THREAD_ID,
              title: 'Just Chat (Speech)',
              systemPrompt: 'You are a friendly AI assistant for voice chat. Keep responses concise for speech.'
            };
            try {
              const createdJustChatThread = await messaging.sendMessage('addChatThread', justChatData);
              allThreads.push(createdJustChatThread);
            } catch (dbError) {
              console.error('[App.tsx] Failed to create missing JUST_CHAT_THREAD_ID via RPC:', dbError);
            }
          }
          setThreads(allThreads);
          const firstSelectableThread = allThreads.find(t => t.id !== JUST_CHAT_THREAD_ID);
          if (firstSelectableThread) {
            if (currentThreadId() === null || !allThreads.some(t=> t.id === currentThreadId())) {
               setCurrentThreadId(firstSelectableThread.id);
            }
            await loadMessagesForThreadAndKickoff(currentThreadId() || firstSelectableThread.id);
          } else {
            setCurrentThreadId(null);
          }
          appScopeHasInitializedDefaultThreads = true;
          console.log('[App.tsx] Threads already existed or JUST_CHAT_THREAD_ID handled via RPC, flag set.');
        }
      } catch (error) {
        console.error('[App.tsx] Error during one-time thread initialization via RPC:', error);
        setThreads([]);
        setCurrentThreadId(null);
      } finally {
        setIsLoadingThreads(false);
        console.log('[App.tsx] Finished one-time thread initialization attempt via RPC.');
      }
    } else {
      console.log('[App.tsx] Default threads initialization routine already run, skipping DB seed section.');
      if (threads().length === 0 && appScopeHasInitializedDefaultThreads) {
        console.warn("[App.tsx] Threads array is empty even though init flag is set. Re-fetching via RPC.");
        setIsLoadingThreads(true);
        try {
            const currentDBThreads = await messaging.sendMessage('getAllChatThreads', undefined);
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
            console.error("[App.tsx] Error re-fetching threads via RPC:", e);
        } finally {
            setIsLoadingThreads(false);
        }
      }
    }

    userConfigurationStorage.getValue().then(config => {
      if (config && config.nativeLanguage) {
        if (config.nativeLanguage !== effectiveLangCode()) {
            setEffectiveLangCode(config.nativeLanguage);
        }
      }
      if (config) {
        setUserConfig(config);
      } else {
        console.warn('[App.tsx] No user configuration found in storage during initial load.');
        setUserConfig(null); 
      }
    }).catch(e => {
      console.error('[NewTabApp] Error loading initial language or user config from storage during createEffect:', e);
      setUserConfig(null);
    });
  });

  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    const storageKey = userConfigurationStorage.key;
    if (areaName === 'local' && changes[storageKey]) {
      const newConfig = changes[storageKey].newValue as UserConfiguration | undefined;
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

  const handleSelectThread = async (threadId: string) => {
    console.log('[App.tsx] handleSelectThread:', threadId);
    const selectedThread = threads().find(t => t.id === threadId);
    if (selectedThread) {
      setCurrentThreadId(threadId);
      if (!selectedThread.messages || selectedThread.messages.length === 0) {
        console.log(`[App.tsx] Messages for thread ${threadId} not loaded or empty, fetching via RPC...`);
        await loadMessagesForThreadAndKickoff(threadId);
      }
    } else {
      console.warn(`[App.tsx] Thread with id ${threadId} not found.`);
    }
  };

  const handleCreateNewThread = async (
    title: string, 
    systemPromptForRpc: string,
    initialMessages?: UIChatMessage[],
  ): Promise<string> => {
    const uniqueTitle = title || `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    console.log(`[App.tsx] Creating new thread via RPC: "${uniqueTitle}" with system prompt: "${systemPromptForRpc}"`);
    
    const newThreadRpcData: NewChatThreadDataForRpc = {
      id: `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: uniqueTitle, 
      systemPrompt: systemPromptForRpc, 
    };
    try {
      const createdThread = await messaging.sendMessage('addChatThread', newThreadRpcData);
      let messagesForNewThread: UIChatMessage[] = [];

      if (initialMessages && initialMessages.length > 0) {
        for (const msg of initialMessages) {
          const messageToSaveRpc: NewChatMessageDataForRpc = {
            id: msg.id || `msg-initial-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
            thread_id: createdThread.id,
            sender: msg.sender,
            text_content: msg.text_content,
            tts_lang: msg.ttsLang,
            tts_alignment_data: msg.alignmentData
          };
          const savedMsg = await messaging.sendMessage('addChatMessage', messageToSaveRpc);
          messagesForNewThread.push(savedMsg as UIChatMessage);
        }
      }
      
      const threadWithMessages = { ...createdThread, messages: messagesForNewThread }; 
      setThreads(prev => [threadWithMessages, ...prev]);
      setCurrentThreadId(createdThread.id);
      
      return createdThread.id;
    } catch (error) {
      console.error('[App.tsx] Error creating new thread via RPC or saving initial messages:', error);
      return '';
    }
  };

  const handleSendMessageToUnifiedView = async (
    text: string,
    threadId: string,
    isUserMessage: boolean,
    ttsLangForAiResponse?: string
  ): Promise<void> => {
    const currentThreadSignalValue = threads().find(t => t.id === threadId);
    if (!currentThreadSignalValue) {
      console.error(`[App.tsx] handleSendMessageToUnifiedView: Thread with id ${threadId} not found.`);
      return;
    }

    if (isUserMessage && 
        currentThreadSignalValue.title.startsWith("New Chat") && 
        (currentThreadSignalValue.messages?.length || 0) === 0) {
      console.log(`[App.tsx] First user message. Attempting title gen for thread: ${threadId}`);
      generateThreadTitleLLM(text).then(async (newTitle) => {
        if (newTitle && newTitle.trim() !== '') {
          console.log(`[App.tsx] Generated title "${newTitle}" for thread ${threadId}. Updating via RPC.`);
          try {
            await messaging.sendMessage('updateChatThreadTitle', { threadId, newTitle });
            setThreads(prevThreads =>
              prevThreads.map(t =>
                t.id === threadId ? { ...t, title: newTitle, lastActivity: new Date().toISOString() } : t
              )
            );
          } catch (e) {
            console.error(`[App.tsx] Error updating thread title via RPC for ${threadId}:`, e);
          }
        }
      }).catch(error => {
        console.warn(`[App.tsx] Failed to generate or apply thread title for ${threadId}:`, error);
      });
    }

    const historyForLLMSnapshot = threads().find(t => t.id === threadId)?.messages || [];
    const conversationHistoryForLLM: LLMChatMessage[] = historyForLLMSnapshot
        .filter(msg => typeof msg.text_content === 'string' && (msg.sender === 'user' || msg.sender === 'ai'))
        .map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text_content!
        }));

    const userMessageRpcData: NewChatMessageDataForRpc = {
      id: `msg-user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      thread_id: threadId,
      sender: 'user',
      text_content: text,
    };

    if (isUserMessage) {
      try {
        const savedUserMessage = await messaging.sendMessage('addChatMessage', userMessageRpcData);
        const updatedMessages = [...(currentThreadSignalValue.messages || []), savedUserMessage as UIChatMessage];
        const updatedThreadAfterUser: Thread = {
          ...currentThreadSignalValue,
          messages: updatedMessages,
          lastActivity: savedUserMessage.timestamp,
        };
        setThreads(prevThreads =>
          prevThreads.map(t => (t.id === threadId ? updatedThreadAfterUser : t))
        );
      } catch (error) {
        console.error('[App.tsx] Error saving user message via RPC or updating UI:', error);
        return; 
      }
    } else {
      const aiKickoffMessageRpcData: NewChatMessageDataForRpc = {
        id: `msg-ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        thread_id: threadId,
        sender: 'ai',
        text_content: text,
        tts_lang: ttsLangForAiResponse || effectiveLangCode(),
      };
      try {
        const savedAiKickoffMessage = await messaging.sendMessage('addChatMessage', aiKickoffMessageRpcData);
        const updatedMessagesWithKickoff = [...(currentThreadSignalValue.messages || []), savedAiKickoffMessage as UIChatMessage];
        const updatedThreadWithKickoff: Thread = {
          ...currentThreadSignalValue,
          messages: updatedMessagesWithKickoff,
          lastActivity: savedAiKickoffMessage.timestamp,
        };
        setThreads(prevThreads =>
          prevThreads.map(t => (t.id === threadId ? updatedThreadWithKickoff : t))
        );
      } catch (error) {
        console.error('[App.tsx] Error saving AI kickoff message via RPC or updating UI:', error);
      }
      return;
    }

    const userConfigVal = userConfig();
    if (!userConfigVal || !userConfigVal.llmConfig || !userConfigVal.llmConfig.providerId || userConfigVal.llmConfig.providerId === 'none' || !userConfigVal.llmConfig.modelId) {
      console.error('[App.tsx] LLM config not set for streaming.', userConfigVal?.llmConfig);
      const errorText = "AI provider/model not configured. Please check settings.";
      const errorAiMessageRpc: NewChatMessageDataForRpc = {
        id: `msg-error-cfg-stream-${Date.now()}`, thread_id: threadId, sender: 'ai', 
        text_content: errorText, tts_lang: effectiveLangCode(),
      };
      const savedErrorMsg = await messaging.sendMessage('addChatMessage', errorAiMessageRpc);
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, messages: [...(t.messages || []), savedErrorMsg as UIChatMessage], lastActivity: savedErrorMsg.timestamp } : t));
      return;
    }

    const llmServiceConfig: LLMConfig = {
      provider: userConfigVal.llmConfig.providerId as LLMProviderId,
      model: userConfigVal.llmConfig.modelId,
      baseUrl: userConfigVal.llmConfig.baseUrl ?? '',
      apiKey: userConfigVal.llmConfig.apiKey ?? undefined,
    };

    if (!llmServiceConfig.model) {
        console.error('[App.tsx] LLM Model ID is empty for streaming.');
        const modelErrorMsg = "LLM model not configured. Check settings.";
        const errorModelRpc: NewChatMessageDataForRpc = {
            id: `msg-error-model-stream-${Date.now()}`, thread_id: threadId, 
            sender: 'ai', text_content: modelErrorMsg, tts_lang: effectiveLangCode(),
        };
        const savedModelError = await messaging.sendMessage('addChatMessage', errorModelRpc);
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, messages: [...(t.messages || []), savedModelError as UIChatMessage], lastActivity: savedModelError.timestamp } : t));
        return;
    }
    
    const aiStreamingMessageId = `msg-ai-stream-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const initialAiMessageForUI: UIChatMessage = {
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

    setThreads(prevThreads =>
      prevThreads.map(t =>
        t.id === threadId
          ? { ...t, messages: [...(t.messages || []), initialAiMessageForUI] }
          : t
      )
    );
    
    console.log(`[App.tsx] Requesting STREAMING AI response. Provider: ${llmServiceConfig.provider}, Model: ${llmServiceConfig.model}`);
    
    let accumulatedResponse = '';
    let finalTimestamp = initialAiMessageForUI.timestamp;
    let streamErrorOccurred = false;

    try {
      for await (const part of getAiChatResponseStream(
        conversationHistoryForLLM,
        text, 
        llmServiceConfig,
        { threadSystemPrompt: currentThreadSignalValue.systemPrompt }
      )) {
        if (part.type === 'content') {
          accumulatedResponse += part.content;
          finalTimestamp = new Date().toISOString(); 
          setThreads(prevThreads =>
            prevThreads.map(t => {
              if (t.id === threadId) {
                const updatedMessages = t.messages.map(m =>
                    m.id === aiStreamingMessageId ? { ...m, text_content: accumulatedResponse, timestamp: finalTimestamp } : m
                  );
                return {
                  ...t,
                  messages: updatedMessages,
                  lastActivity: finalTimestamp,
                };
              }
              return t;
            })
          );
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
                return {
                  ...t,
                  messages: updatedMessages,
                  lastActivity: finalTimestamp,
                };
              }
              return t;
            })
          );
          break; 
        }
      }
      
      const finalAiMessageRpcData: NewChatMessageDataForRpc = {
        id: aiStreamingMessageId, 
        thread_id: threadId,
        sender: 'ai',
        text_content: accumulatedResponse.trim(),
        tts_lang: ttsLangForAiResponse || effectiveLangCode(),
      };
      
      const savedFinalAiMessage = await messaging.sendMessage('addChatMessage', finalAiMessageRpcData);
      
      setThreads(prevThreads =>
        prevThreads.map(t => {
          if (t.id === threadId) {
            const messagesWithoutStreamingPlaceholder = t.messages.filter(m => m.id !== aiStreamingMessageId);
            return { ...t, messages: [...messagesWithoutStreamingPlaceholder, savedFinalAiMessage as UIChatMessage], lastActivity: savedFinalAiMessage.timestamp };
          }
          return t;
        })
      );

    } catch (error) {
      console.error('[App.tsx] Outer error during AI stream processing or DB save via RPC:', error);
      const streamErrorText = `Sorry, an error occurred while streaming the response: ${String(error)}.`;
      const finalErrorTimestamp = new Date().toISOString();
      streamErrorOccurred = true;

      const errorForDbRpc: NewChatMessageDataForRpc = {
        id: aiStreamingMessageId, 
        thread_id: threadId,
        sender: 'ai',
        text_content: accumulatedResponse + `\n[Outer Error: ${String(error)}]`,
        tts_lang: ttsLangForAiResponse || effectiveLangCode(),
      };
      try {
        const savedErrorToDb = await messaging.sendMessage('addChatMessage', errorForDbRpc);
        setThreads(prevThreads =>
            prevThreads.map(t => {
              if (t.id === threadId) {
                const streamingMsgIndex = t.messages.findIndex(m => m.id === aiStreamingMessageId);
                if (streamingMsgIndex !== -1) {
                  const updatedMessages = [...t.messages];
                  updatedMessages[streamingMsgIndex] = {
                    ...(savedErrorToDb as UIChatMessage),
                    isStreaming: false, 
                  };
                  return { ...t, messages: updatedMessages, lastActivity: savedErrorToDb.timestamp };
                } else { 
                  return { ...t, messages: [...t.messages, { ...(savedErrorToDb as UIChatMessage), isStreaming: false }], lastActivity: savedErrorToDb.timestamp };
                }
              }
              return t;
            })
          );
      } catch (dbSaveError) {
          console.error('[App.tsx] Failed to save outer stream error to DB via RPC:', dbSaveError);
          setThreads(prevThreads =>
            prevThreads.map(t => {
              if (t.id === threadId) {
                const streamingMsgIndex = t.messages.findIndex(m => m.id === aiStreamingMessageId);
                if (streamingMsgIndex !== -1) {
                  const updatedMessages = [...t.messages];
                  updatedMessages[streamingMsgIndex] = {
                    ...updatedMessages[streamingMsgIndex],
                    text_content: accumulatedResponse + `\n[Outer Error: ${String(error)}] (DB Save Failed)`,
                    timestamp: finalErrorTimestamp,
                    isStreaming: false,
                  };
                  return { ...t, messages: updatedMessages, lastActivity: finalErrorTimestamp };
                }
              }
              return t;
            })
          );
      }
    }
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
