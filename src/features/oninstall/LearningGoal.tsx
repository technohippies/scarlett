import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import type { Messages } from '../../types/i18n'; // Import Messages type

// Define props for the component
interface LearningGoalProps {
  onGoalChange: (id: string) => void;
  onBack: () => void;
  targetLanguageLabel: string;
  questionPrefix: string;
  questionSuffix: string;
  fallbackLabel: string;
  messages: Messages | undefined;
}

// Define stub type for goals (just id and emoji)
interface LearningGoalStub {
    id: string;
    emoji: string;
}

// Goal list only needs id and emoji now
const learningGoalsStubs: LearningGoalStub[] = [
  { id: 'work', emoji: '💼' },
  { id: 'dating', emoji: '❤️' },
  { id: 'travel', emoji: '✈️' },
  { id: 'school', emoji: '🎓' },
  { id: 'self', emoji: '🌱' },
  { id: 'other', emoji: '🤔' },
];

// Helper function to get translated goal name
const getGoalName = (id: string | undefined, messages: Messages | undefined): string => {
  if (!id || !messages) return '';
  const key = `learningGoal${id.charAt(0).toUpperCase() + id.slice(1)}`;
  return messages[key]?.message || id; // Fallback to id
};

export const LearningGoal: Component<LearningGoalProps> = (props) => {
  const [selectedGoalId, setSelectedGoalId] = createSignal<string | undefined>();

  // Helper to split target language label (remains the same)
  const getLanguageParts = (label: string | undefined) => {
    if (!label) return { name: props.fallbackLabel, emoji: '' };
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return { name: props.fallbackLabel, emoji: '' };

    const parts = trimmedLabel.split(' ');

    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      // Heuristic: if the last part is short (e.g., typical emoji/flag length)
      // AND it doesn't contain any English alphabet letters.
      const containsLetters = /[a-zA-Z]/.test(lastPart);
      if (!containsLetters && lastPart.length <= 2) {
        const name = parts.slice(0, -1).join(' ');
        return { name, emoji: lastPart };
      }
    }
    // If not parsed as "Name Emoji" (e.g. single word, or last part looks like a word),
    // then the whole label is the name, and there's no separate emoji.
    return { name: trimmedLabel, emoji: '' };
  };

  return (
    <div class="relative flex flex-col h-full bg-background text-foreground">
      {/* Content Area: Remove justify-center, adjust padding */}
      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24">
        {/* Image at the top - Same as Language step */}
        <img
          src="/images/scarlett-extending-handshake.png"
          alt="Scarlett Supercoach"
          class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6"
        />

        {/* Question - Limit width and center horizontally - Remove text-center */}
        <div class="text-xl md:text-2xl space-y-4 w-full max-w-lg mb-6 mx-auto">
          <p>
            {props.questionPrefix}
            {' '}
            <span class="font-semibold">
              {/* Display name first, then emoji */}
              {getLanguageParts(props.targetLanguageLabel).name}
              {' '}{/* Add space before emoji */}
              {getLanguageParts(props.targetLanguageLabel).emoji}
            </span>
            {' '}{/* Add space after emoji/span, before suffix */}
            {props.questionSuffix}
          </p> 
        </div>

        {/* Learning Goal Grid Selector - Limit width and center horizontally */}
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg mb-6 mx-auto">
          <For each={learningGoalsStubs}> 
            {(goalStub) => {
              // Get translated name
              const name = getGoalName(goalStub.id, props.messages);
              return (
                <Button
                  variant="outline"
                  onClick={() => { 
                    setSelectedGoalId(goalStub.id);
                    props.onGoalChange(goalStub.id);
                  }}
                  class={cn(
                    'h-32 aspect-square p-4 flex flex-col items-center justify-center space-y-2 text-base border',
                    'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0',
                    selectedGoalId() === goalStub.id
                      ? 'bg-neutral-800 text-foreground border-neutral-700'
                      : 'border-neutral-700'
                  )}
                >
                  <span class="text-2xl">{goalStub.emoji}</span>
                  <span class="text-center break-words">{name}</span>
                </Button>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}; 