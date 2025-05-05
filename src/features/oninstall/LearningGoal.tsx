import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import type { Messages } from '../../types/i18n'; // Import Messages type
import { ArrowLeft } from 'phosphor-solid'; // Import icon

// Define props for the component
interface LearningGoalProps {
  onComplete: (goalId: string) => void;
  onBack: () => void; // Add onBack prop
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
    <div class="relative flex flex-col h-full bg-background text-foreground">
      {/* Content Area: Remove justify-center, adjust padding */}
      <div class="flex-grow overflow-y-auto flex flex-col items-center p-4 pt-24 md:p-8 md:pt-24">
        {/* Image at the top - Same as Language step */}
        <img
          src="/images/scarlett-supercoach/scarlett-proud-512x512.png"
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
      </div>
      {/* Footer Area: Add the fixed footer structure */}
      <div class="flex-shrink-0 p-4 md:p-6 border-t border-neutral-800 bg-background flex justify-center">
          <div class="w-full max-w-xs"> {/* Maintain max-width for button */}
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
    </div>
  );
}; 