import { createSignal, createEffect, For, /*Show,*/ Component } from 'solid-js';
import { Player /*, type AnimationItem*/ } from 'lottie-solid';

// Define mood types
export type Mood = 'happy' | 'slightly-happy' | 'neutral' | 'slightly-frowning' | 'sad';

interface MoodOption {
  mood: Mood;
  lottieSrc: string; // Path to the Lottie JSON file
  label: string; // For aria-label
}

// Define the Lottie JSON file paths relative to the public directory
const moodOptions: MoodOption[] = [
  { mood: 'happy', lottieSrc: '/lottie/happy.json', label: 'Happy' },
  { mood: 'slightly-happy', lottieSrc: '/lottie/slightly-happy.json', label: 'Slightly Happy' },
  { mood: 'neutral', lottieSrc: '/lottie/neutral.json', label: 'Neutral' },
  { mood: 'slightly-frowning', lottieSrc: '/lottie/slightly-frowning.json', label: 'Slightly Frowning' },
  { mood: 'sad', lottieSrc: '/lottie/sad.json', label: 'Sad' },
];

export interface MoodSelectorProps {
  initialMood?: Mood | null;
  onSelect: (mood: Mood | null) => void;
  disabled?: boolean;
  class?: string;
}

export const MoodSelector: Component<MoodSelectorProps> = (props) => {
  const [selectedMood, setSelectedMood] = createSignal<Mood | null>(props.initialMood ?? null);
  // No need for lottieData, isLoading, or error signals related to fetching JSON, 
  // as lottie-solid Player handles src loading.
  // We might still want a general loading/error state if the component itself had other async ops.

  createEffect(() => {
    setSelectedMood(props.initialMood ?? null);
  });

  const handleSelect = (mood: Mood) => {
    if (props.disabled) return;
    const newMood = selectedMood() === mood ? null : mood;
    setSelectedMood(newMood);
    props.onSelect(newMood);
  };

  // We need to ensure lottie files are in the public folder, e.g., public/lottie/happy.json

  return (
    <div class={`flex items-center space-x-2 p-4 bg-background rounded-md ${props.class ?? ''}`}>
      <For each={moodOptions}>
        {(option) => {
          const isSelected = () => selectedMood() === option.mood;
          // For lottie-solid, we manage lottieRef per player if we need to interact with specific instances
          // let lottiePlayerRef: AnimationItem | undefined; // Removed as it's not used

          return (
            <button
              type="button"
              onClick={() => handleSelect(option.mood)}
              disabled={props.disabled}
              aria-label={`Select ${option.label} Mood`}
              aria-pressed={isSelected()}
              class={`
                p-2 rounded-full transition-transform duration-150 ease-in-out flex items-center justify-center flex-shrink-0
                hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                ${isSelected() ? 'ring-2 ring-blue-600 ring-offset-1 bg-blue-100' : 'bg-gray-50'}
                ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              style={{
                width: '60px',
                height: '60px',
                'border-radius': '50%',
                overflow: 'hidden',
                'box-sizing': 'border-box',
              }}
            >
              <Player
                // lottieRef={(ref: AnimationItem) => (lottiePlayerRef = ref)} // Removed as lottiePlayerRef is not used
                src={option.lottieSrc} 
                autoplay={true} // Autoplay seems desired
                loop={isSelected()} // Loop only if selected
                style={{ width: '100%', height: '100%' }}
                // controls={false} // Explicitly false, default is false but good to be clear
              />
              {/* Fallback for if lottieSrc is bad is handled by Player component, 
                  though it might just show nothing or an error in console. 
                  Storybook might need a way to show a placeholder if src is intentionally bad for a story.*/}
            </button>
          );
        }}
      </For>
    </div>
  );
}; 