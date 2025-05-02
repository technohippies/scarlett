import { ExerciseFooter } from '../../../src/features/exercises/ExerciseFooter'; // Updated import name

export default {
  title: 'Features/Exercises/ExerciseFooter', // Updated title
  component: ExerciseFooter,
  parameters: {
    // Layout might need adjustment if footer is fixed
    layout: 'fullscreen', // Keep fullscreen for now, or use padded
  },
  tags: ['autodocs'],
  // Updated argTypes
  argTypes: {
    mode: { control: 'select', options: ['check', 'feedback'] },
    // Feedback props
    isCorrect: { control: 'boolean', if: { arg: 'mode', eq: 'feedback' } },
    correctAnswerText: { control: 'text', if: { arg: 'mode', eq: 'feedback' } },
    title: { control: 'text', if: { arg: 'mode', eq: 'feedback' } },
    continueLabel: { control: 'text', if: { arg: 'mode', eq: 'feedback' } },
    onContinue: { action: 'onContinue', if: { arg: 'mode', eq: 'feedback' } },
    // Check props
    isCheckDisabled: { control: 'boolean', if: { arg: 'mode', eq: 'check' } },
    checkLabel: { control: 'text', if: { arg: 'mode', eq: 'check' } },
    onCheck: { action: 'onCheck', if: { arg: 'mode', eq: 'check' } },
    // Removed isOpen and onClose
  },
};

// Simplified render function (no sheet logic needed)
const Template = (args: any) => (
    // Optional: Add some padding to the top of the story to see the fixed footer
    // Add a container to simulate page height if footer is fixed
    <div style={{"min-height": "300px", "position": "relative", "padding-bottom": "200px"}}>
      <p>Content above footer...</p>
      {/* Render footer potentially outside the main padding div if it's truly fixed */}
      <ExerciseFooter {...args} />
    </div>
);

// === Feedback Mode Stories ===

export const FeedbackCorrect = {
  render: Template,
  args: {
    mode: 'feedback',
    isCorrect: true,
    title: 'Excellent!',
    onContinue: () => console.log('Story: Continue triggered (Correct)'),
    continueLabel: 'Next Lesson',
  }
};

export const FeedbackIncorrect = {
  render: Template,
  args: {
    mode: 'feedback',
    isCorrect: false,
    // title prop is ignored in incorrect mode, defaults to "Correct solution:"
    correctAnswerText: 'I like learning French.',
    onContinue: () => console.log('Story: Continue triggered (Incorrect)'),
    continueLabel: 'Got it',
  }
};

// === Check Mode Stories ===

export const CheckEnabled = {
    render: Template,
    args: {
        mode: 'check',
        isCheckDisabled: false,
        onCheck: () => console.log('Story: Check triggered'),
        checkLabel: 'Check',
    }
};

export const CheckDisabled = {
    render: Template,
    args: {
        mode: 'check',
        isCheckDisabled: true,
        onCheck: () => console.log('Story: Check triggered (should not happen)'),
        checkLabel: 'Check',
    }
};