import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import type { Messages } from '../../types/i18n'; // Import Messages type

// Define props for the component
interface LearningGoalProps {
  onComplete: (goalId: string) => void;
  targetLanguageLabel: string;
  questionPrefix: string;
  questionSuffix: string;
  fallbackLabel: string;
  continueLabel: string;
  // Add messages prop
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

  const handleSubmit = () => { 
    const goal = selectedGoalId();
    if (!goal) return;
    props.onComplete(goal);
  };

  // Helper to split target language label (remains the same)
  const getLanguageParts = (label: string | undefined) => {
    if (!label) return { name: props.fallbackLabel, emoji: '' };
    const parts = label.split(' ');
    const emoji = parts[0] || ''; 
    const name = parts.slice(1).join(' ') || label;
    return { name, emoji };
  };

  return (
    <div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center space-y-6 min-h-screen justify-center">
      {/* Image at the top - Same as Language step */}
      <img
        src="/images/scarlett-supercoach/scarlett-proud-512x512.png"
        alt="Scarlett Supercoach"
        class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6"
      />

      {/* Question - Reordered language name and emoji */} 
      <div class="text-center text-xl md:text-2xl space-y-4">
        <p>
          {props.questionPrefix}
          {' '}
          <span class="font-semibold">
            {/* Display name first, then emoji */}
            {getLanguageParts(props.targetLanguageLabel).name}
            {' '}{/* Add space before emoji */}
            {getLanguageParts(props.targetLanguageLabel).emoji}
          </span>
          {props.questionSuffix}
        </p> 
      </div>

      {/* Learning Goal Grid Selector - Use messages */} 
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg">
        <For each={learningGoalsStubs}> 
          {(goalStub) => {
            // Get translated name
            const name = getGoalName(goalStub.id, props.messages);
            return (
              <Button
                variant="outline"
                onClick={() => setSelectedGoalId(goalStub.id)}
                class={cn(
                  'h-auto p-4 flex flex-col items-center justify-center space-y-2 text-base border',
                  'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0',
                  selectedGoalId() === goalStub.id
                    ? 'bg-neutral-800 text-foreground border-neutral-700'
                    : 'border-neutral-700'
                )}
              >
                <span class="text-2xl">{goalStub.emoji}</span>
                <span>{name}</span> 
              </Button>
            );
          }}
        </For>
      </div>

      {/* Continue Button - Use prop */}
      <div class="pt-6 w-full max-w-xs">
         <Button
           size="lg"
           class="w-full"
           onClick={handleSubmit}
           disabled={!selectedGoalId()}
         >
           {props.continueLabel}
         </Button>
      </div>
    </div>
  );
}; 