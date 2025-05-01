import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';

// Define props for the component
interface LearningGoalProps {
  onComplete: (goalId: string) => void; // Modify onComplete to pass the selected goal ID
  targetLanguageLabel: string; // Add prop for the language label
  // Add props for translated strings
  questionPrefix: string;
  questionSuffix: string;
  fallbackLabel: string;
  continueLabel: string;
}

// Corrected label For self growth
const learningGoalsCorrected = [
  { id: 'work', label: '💼 For work' },
  { id: 'dating', label: '❤️ For dating' },
  { id: 'travel', label: '✈️ For traveling' },
  { id: 'school', label: '🎓 For school' },
  { id: 'self', label: '🌱 For self growth' }, // Corrected label
  { id: 'other', label: '🤔 Something else' },
];

export const LearningGoal: Component<LearningGoalProps> = (props) => {
  const [selectedGoal, setSelectedGoal] = createSignal<string | undefined>();

  const handleSubmit = () => {
    const goal = selectedGoal();
    if (!goal) return; // Should be disabled, but double-check

    console.log('Saving Learning Goal:', goal);
    // TODO: Replace with actual storage service call
    // await settingsService.setLearningGoal(goal);

    // Call the completion callback provided by the parent, passing the selected data
    props.onComplete(goal);
  };

  // Helper to split the label into emoji and name
  const getLanguageParts = (label: string | undefined) => {
    if (!label) return { name: props.fallbackLabel, emoji: '' };
    const parts = label.split(' ');
    const emoji = parts[0] || ''; 
    const name = parts.slice(1).join(' ') || label; // Fallback to full label if split fails
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

      {/* Learning Goal Grid Selector - Use corrected array */}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg">
        <For each={learningGoalsCorrected}>
          {(goal) => (
            <Button
              variant="outline"
              onClick={() => setSelectedGoal(goal.id)}
              class={cn(
                'h-auto p-4 flex flex-col items-center justify-center space-y-2 text-base border',
                'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0',
                selectedGoal() === goal.id
                  ? 'bg-neutral-800 text-foreground border-neutral-700'
                  : 'border-neutral-700'
              )}
            >
              {/* Split label for potential styling if needed, like emoji vs text */}
              <span class="text-2xl">{goal.label.split(' ')[0]}</span> {/* Emoji/Icon */}
              <span>{goal.label.split(' ').slice(1).join(' ')}</span> {/* Text */}
            </Button>
          )}
        </For>
      </div>

      {/* Continue Button - Use prop */}
      <div class="pt-6 w-full max-w-xs">
         <Button
           size="lg"
           class="w-full"
           onClick={handleSubmit}
           disabled={!selectedGoal()} // Disable if no goal selected
         >
           {/* Use prop */} 
           {props.continueLabel} 
         </Button>
      </div>
    </div>
  );
}; 