import { Component, createSignal, For } from 'solid-js';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';

// Define props for the component
interface LearningGoalProps {
  onComplete: () => void; // Function to call when setup is done
}

// Define learning goal options
const learningGoals = [
  { id: 'work', label: '💼 For work' },
  { id: 'dating', label: '❤️ For dating' },
  { id: 'travel', label: '✈️ For traveling' },
  { id: 'school', label: '🎓 For school' },
  { id: 'self', label: '🌱 For self growth' },
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

    // Call the completion callback provided by the parent
    props.onComplete();
  };

  return (
    <div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center space-y-6 min-h-screen justify-center">
      {/* Image at the top - Same as Language step */}
      <img
        src="/images/scarlett-supercoach/scarlett-proud-512x512.png"
        alt="Scarlett Supercoach"
        class="w-32 h-32 md:w-48 md:h-48 object-contain mb-6"
      />

      {/* Question */}
      <div class="text-center text-xl md:text-2xl space-y-4">
        <p>Why are you learning [Target Language]?</p> {/* TODO: Dynamically insert target language */} 
      </div>

      {/* Learning Goal Grid Selector */}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg">
        <For each={learningGoals}>
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

      {/* Continue Button */}
      <div class="pt-6 w-full max-w-xs">
         <Button
           size="lg"
           class="w-full"
           onClick={handleSubmit}
           disabled={!selectedGoal()} // Disable if no goal selected
         >
           Continue
         </Button>
      </div>
    </div>
  );
}; 