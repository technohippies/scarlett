import { MCQ } from '../../../src/features/exercises/MCQ';

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
  title: 'Features/Exercises/MCQ',
  component: MCQ,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    instructionText: { control: 'text' },
    sentenceToTranslate: { control: 'text' },
    options: { control: 'object' },
    correctOptionId: { control: 'text' },
    onCheck: { action: 'onCheck' },
    onContinue: { action: 'onContinue' },
  },
  args: {
    sentenceToTranslate: mockSentence,
    instructionText: "Default Instruction (Should be overridden)",
    options: mockOptions,
    correctOptionId: mockCorrectOptionId,
    onCheck: (isCorrect: boolean) => console.log(`Story: onCheck triggered. Correct: ${isCorrect}`),
    onContinue: () => console.log('Story: onContinue triggered (after feedback)'),
  },
};

// Basic render story
export const TranslateExample = {
  render: (args: any) => (
    <div class="h-screen w-full">
      <MCQ {...args} />
    </div>
  ),
  args: {
    instructionText: "Translate:",
    sentenceToTranslate: mockSentence,
    options: mockOptions,
    correctOptionId: mockCorrectOptionId,
  },
};

// --- Fill in the Blank Scenario Data ---
const mockFillSentence = "The dog chased the ____ ball."; // Representing the sentence with a blank
const mockFillOptions = [
  { id: 'a', text: "red" },
  { id: 'b', text: "quickly" },
  { id: 'c', text: "jumped" },
  { id: 'd', text: "bone" },
];
const mockFillCorrectId = 'a';

// Story for Fill in the Blank use case
export const FillInBlank = {
  render: (args: any) => (
    <div class="h-screen w-full">
      <MCQ {...args} />
    </div>
  ),
  args: {
    instructionText: "Fill in the blank:",
    sentenceToTranslate: mockFillSentence,
    options: mockFillOptions,
    correctOptionId: mockFillCorrectId,
    onCheck: (isCorrect: boolean) => console.log(`Story (FillInBlank): onCheck triggered. Correct: ${isCorrect}`),
    onContinue: () => console.log('Story (FillInBlank): onContinue triggered'),
  },
};
