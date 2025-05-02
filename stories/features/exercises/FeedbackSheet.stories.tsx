import { createSignal, createEffect } from 'solid-js';
import { FeedbackSheet } from '../../../src/features/exercises/FeedbackSheet';

export default {
  title: 'Features/Exercises/FeedbackSheet',
  component: FeedbackSheet,
  parameters: {
    layout: 'centered', // Center story for better viewing of sheet
  },
  tags: ['autodocs'],
  // Define argTypes for controls
  argTypes: {
    isOpen: { control: 'boolean' },
    isCorrect: { control: 'boolean' },
    correctAnswerText: { control: 'text' },
    title: { control: 'text' },
    continueLabel: { control: 'text' },
    // Actions can be logged
    onContinue: { action: 'onContinue' },
    onClose: { action: 'onClose' },
  },
};

// Keep the render logic separate for reuse
const renderFeedbackSheet = (args: any) => {
  const [isOpen, setIsOpen] = createSignal(args.isOpen);

  // Update signal when arg changes via Storybook controls
  createEffect(() => {
    // Check if args.isOpen is defined to avoid errors during initial render
    if (typeof args.isOpen !== 'undefined') {
        setIsOpen(args.isOpen);
    }
  });

  const handleClose = () => {
    if (args.onClose) args.onClose(); // Log the action
    setIsOpen(false);
  };

  return (
    <>
      {/* Button to manually open the sheet in the story */}
      <button onClick={() => setIsOpen(true)} class="mb-4 p-2 border rounded">
         Open Sheet Manually (for testing)
      </button>
      <FeedbackSheet
        {...args}
        isOpen={isOpen()} // Pass signal value
        onClose={handleClose}
      />
    </>
  );
}


// Story for Correct state - Now an object
export const Correct = {
  render: renderFeedbackSheet, // Use the render function
  args: {
    isOpen: true,
    isCorrect: true,
    title: 'Correct!',
    onContinue: () => console.log('Story: Continue triggered (Correct)'),
    onClose: () => console.log('Story: Close triggered (Correct)'),
    continueLabel: 'Next',
  }
};

// Story for Incorrect state - Now an object
export const Incorrect = {
  render: renderFeedbackSheet,
  args: {
    isOpen: true,
    isCorrect: false,
    title: 'Try again!',
    correctAnswerText: 'I like learning French.',
    onContinue: () => console.log('Story: Continue triggered (Incorrect)'),
    onClose: () => console.log('Story: Close triggered (Incorrect)'),
    continueLabel: 'Next',
  }
};

// Story starting closed - Now an object
export const InitiallyClosed = {
  render: renderFeedbackSheet,
  args: {
    // Inherit args from Correct story manually
    ...Correct.args,
    isOpen: false, // Override isOpen to start closed
  }
};