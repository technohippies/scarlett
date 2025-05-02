import { Translate } from '../../../src/features/exercises/Translate';

// Mock data for the story
const mockSentence = "J'aime apprendre le français.";
const mockOptions = [
  { id: 1, text: "I like learning French." },
  { id: 2, text: "I like eating cheese." },
  { id: 3, text: "He likes learning French." },
  { id: 4, text: "She likes apples." },
];
const mockCorrectOptionId = 1;

export default {
  title: 'Features/Exercises/Translate',
  component: Translate,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    sentenceToTranslate: mockSentence,
    options: mockOptions,
    correctOptionId: mockCorrectOptionId,
    onCheck: (isCorrect: boolean) => console.log(`Story: onCheck triggered. Correct: ${isCorrect}`),
    checkLabel: 'Check Answer',
  },
};

// Basic render story
export const Default = {
  // Wrap in a div to provide height context
  render: (args: any) => (
    <div class="h-screen w-full">
      <Translate {...args} />
    </div>
  ),
};
