# Chat Seeding Service

The chat seeding service provides language-aware onboarding content for specific language learning scenarios.

## Supported Learning Scenarios

We focus on 4 specific learning directions:

### 1. **English → Chinese/Japanese Learning**
- Interface Language: English
- Target Language: Chinese (`zh`) or Japanese (`ja`)
- **Threads Created:**
  - **Mandarin Learning Goals**: Personal introduction with mixed English/Chinese
  - **Roleplay: Flying to Thailand**: Airport roleplay scenario (includes `systemPrompt` for LLM behavior)
  - **Understanding Crypto**: Educational conversation about cryptocurrency
  - **dVPN and Handshake Domains**: Tech education about privacy tools

### 2. **Chinese/Vietnamese → English Learning**
- Interface Language: Chinese (`zh`) or Vietnamese (`vi`)
- Target Language: English (`en`)
- **Threads Created:**
  - **English Learning Goals**: Focused on English practice and improvement
  - **Roleplay: Flying to Thailand**: Same airport scenario, adapted for English learners
  - **Understanding Crypto**: Crypto education delivered in English for practice
  - **dVPN and Handshake Domains**: Privacy tech explanation for English practice

## System Prompt Architecture

- **Educational threads**: Use base personality (`systemPrompt: ''`) + contextual first messages
- **Roleplay threads**: Include roleplay instructions in `systemPrompt` field to modify AI behavior
- **Roleplay display**: For roleplay threads, `systemPrompt` content also becomes `scenarioDescription` for UI display

## How It Works

1. **Chat store** calls `getAdaptiveChatSeedContent()` with user's interface and target languages
2. **Service determines** which of the 4 supported scenarios applies
3. **Returns appropriate** thread structure with titles, system prompts, and initial AI messages
4. **Unsupported scenarios** get a simple fallback chat thread

## Usage

```typescript
import { getAdaptiveChatSeedContent } from './seedingService';

const context = {
  interfaceLanguage: 'en',
  targetLanguage: 'zh',
  isLearningInterfaceLanguage: false
};

const seedContent = getAdaptiveChatSeedContent(context);
// Returns enLearningAsian content with 4 specialized threads
```

## Adding Content

To modify seeded conversations, edit the `SPECIFIC_LEARNING_SEEDS` object:

- `enLearningAsian`: For English speakers learning Chinese/Japanese
- `asianLearningEn`: For Chinese/Vietnamese speakers learning English

Each thread needs:
- `id`: Unique identifier
- `title`: Display name 
- `systemPrompt`: LLM behavior instructions (roleplay only)
- `aiMessage`: Optional first message from AI

## API Reference

### `getChatSeedContent(languageCode: string): LocalizedChatSeed`
Returns localized seeding content for a language code. Falls back to English if unsupported.

### `getAdaptiveChatSeedContent(context: AdaptiveSeedingContext): LocalizedChatSeed`  
Returns adaptive seeding content based on learning context.

### `getAvailableChatSeedLanguages(): string[]`
Returns array of supported language codes.

### `isChatSeedLanguageSupported(languageCode: string): boolean`
Checks if a language code is supported for seeding.

## Best Practices

1. **Keep Thread IDs Consistent**: Use the same IDs across languages to avoid confusion
2. **Natural Translations**: Don't translate literally - adapt content to feel natural in each language  
3. **Cultural Sensitivity**: Consider cultural context in greetings and conversation starters
4. **Learning-Focused**: For adaptive content, prioritize language learning utility over general chat
5. **Graceful Fallbacks**: Always provide fallback content to prevent errors

## Testing

Test seeding by:
1. Clearing all chat threads from the database
2. Setting different `nativeLanguage` and `targetLanguage` combinations in settings
3. Reloading the chat interface to trigger seeding
4. Verifying correct language content appears

## Future Enhancements

Potential improvements:
- Dynamic seeding based on user proficiency level
- Integration with learning goals/interests 
- Seasonal or contextual variations
- User customization of default threads
- A/B testing different onboarding flows 