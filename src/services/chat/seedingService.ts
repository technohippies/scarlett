export interface LocalizedChatSeed {
  threads: {
    id: string;
    title: string;
    systemPrompt: string;
    aiMessage?: string;
  }[];
}

export interface ChatSeedContent {
  [languageCode: string]: LocalizedChatSeed;
}

export interface AdaptiveSeedingContext {
  interfaceLanguage: string;
  targetLanguage?: string;
  isLearningInterfaceLanguage: boolean;
}

// Enhanced seeding content for specific learning scenarios
const SPECIFIC_LEARNING_SEEDS = {
  // English learning Chinese/Japanese
  enLearningAsian: {
    threads: [
      {
        id: 'thread-mandarin-goals',
        title: 'Mandarin Learning Goals',
        systemPrompt: '',
        aiMessage: "你好! Nice to meet you. My name is Scarlett or in Mandarin, you can call me 斯嘉丽. How are you doing today? I have context of your browser history, Spotify songs you're listening to, bookmarks, flashcards, and mood. We can talk about anything you want! Remember, this is a private chat that works with your local LLM provider, so we can talk about things you might talk about elsewhere... So, what's your name?"
      },
      {
        id: 'thread-roleplay-thailand',
        title: 'Roleplay: Flying to Thailand',
        systemPrompt: 'You are at the airport with a friend. You have been penpals for a long-time over the Internet, because you were their English-learning tutor, and you are meeting for the first time. You happened to be in Shanghai, so you decided to fly to Bangkok, Thailand together. You have a lot of context about your student, but sometimes you forget, since you have been penpals for quite some time, so you might make some incorrect assumptions about them, and if you do, blame it on your poor memory, mixing students up. You\'re at the hectic Shanghai airport. You speak Mandarin, but you find the airport confusing and hectic, so you are nudging your student to guide you throughout the process, while encouraging them to practice English with you.',
        aiMessage: "So nice to meet you in person for the first time! Are you excited to visit Bangkok?"
      },
      {
        id: 'thread-crypto-education',
        title: 'Understanding Crypto',
        systemPrompt: '',
        aiMessage: "I'd love to help you understand cryptocurrency! It's really about moving from centralization to decentralization. Think of Bitcoin as digital gold and Ethereum as digital silver. What interests you most - the technology, investment aspects, or practical uses?"
      },
      {
        id: 'thread-dvpn-handshake',
        title: 'dVPN and Handshake Domains',
        systemPrompt: '',
        aiMessage: "Let me tell you about dVPN and Handshake domains - they're game-changers for privacy and censorship resistance! dVPN works because anyone can run a node, making the network huge and nearly impossible to block. Have you heard of these technologies before?"
      }
    ]
  },
  
  // Chinese/Vietnamese learning English
  asianLearningEn: {
    threads: [
      {
        id: 'thread-english-goals',
        title: 'English Learning Goals',
        systemPrompt: '',
        aiMessage: "Hello! I'm Scarlett, your English learning companion. I'm here to help you practice conversations, improve grammar, and build confidence in English. I have access to your browsing history, bookmarks, and study materials to make our conversations relevant to your interests. What would you like to work on today?"
      },
      {
        id: 'thread-roleplay-thailand',
        title: 'Roleplay: Flying to Thailand',
        systemPrompt: 'You are at the airport with a friend. You have been penpals for a long-time over the Internet, because you were their English-learning tutor, and you are meeting for the first time. You happened to be in Shanghai, so you decided to fly to Bangkok, Thailand together. You have a lot of context about your student, but sometimes you forget, since you have been penpals for quite some time, so you might make some incorrect assumptions about them, and if you do, blame it on your poor memory, mixing students up. You\'re at the hectic Shanghai airport. You speak their native language, but you find the airport confusing and hectic, so you are nudging your student to guide you throughout the process, while encouraging them to practice English with you.',
        aiMessage: "So nice to meet you in person for the first time! Are you excited to visit Bangkok?"
      },
      {
        id: 'thread-crypto-education',
        title: 'Understanding Crypto',
        systemPrompt: '',
        aiMessage: "I'd love to help you understand cryptocurrency in English! It's really about moving from centralization to decentralization. Think of Bitcoin as digital gold and Ethereum as digital silver. What interests you most - the technology, investment aspects, or practical uses?"
      },
      {
        id: 'thread-dvpn-handshake',
        title: 'dVPN and Handshake Domains',
        systemPrompt: '',
        aiMessage: "Let me explain dVPN and Handshake domains in English - they're game-changers for privacy and censorship resistance! dVPN works because anyone can run a node, making the network huge and nearly impossible to block. Have you heard of these technologies before?"
      }
    ]
  }
};

/**
 * Get the appropriate chat seeding content based on language learning context
 * This is the main function used by the chat store
 */
export function getAdaptiveChatSeedContent(context: AdaptiveSeedingContext): LocalizedChatSeed {
  const { interfaceLanguage, targetLanguage } = context;
  
  console.log('[seedingService] Determining seed content for interface:', interfaceLanguage, 'target:', targetLanguage);
  
  // Check for specific learning scenarios we support
  if (targetLanguage) {
    // English speakers learning Chinese/Japanese
    if (interfaceLanguage.toLowerCase().startsWith('en') && 
        (targetLanguage.toLowerCase().startsWith('zh') || 
         targetLanguage.toLowerCase().startsWith('ja'))) {
      console.log('[seedingService] Using English learning Asian content');
      return SPECIFIC_LEARNING_SEEDS.enLearningAsian;
    }
    
    // Chinese/Vietnamese speakers learning English
    if ((interfaceLanguage.toLowerCase().startsWith('zh') || 
         interfaceLanguage.toLowerCase().startsWith('vi')) &&
         targetLanguage.toLowerCase().startsWith('en')) {
      console.log('[seedingService] Using Asian learning English content');
      return SPECIFIC_LEARNING_SEEDS.asianLearningEn;
    }
  }
  
  // Default fallback for unsupported scenarios
  console.log('[seedingService] Using default fallback content');
  return {
    threads: [
      {
        id: 'thread-general-chat',
        title: 'General Chat',
        systemPrompt: '',
        aiMessage: "Hi! I'm Scarlett, your AI companion. How can I help you today?"
      }
    ]
  };
}

/**
 * @deprecated Legacy function - use getAdaptiveChatSeedContent instead
 */
export function getChatSeedContent(languageCode: string): LocalizedChatSeed {
  // This function is no longer used but kept for compatibility
  return getAdaptiveChatSeedContent({
    interfaceLanguage: languageCode,
    targetLanguage: undefined,
    isLearningInterfaceLanguage: false
  });
} 