import { createSignal, Accessor } from 'solid-js';
import { StudyStreakPanel } from '../../../src/features/srs/StudyStreakPanel';
import type { Messages } from '../../../src/types/i18n';

// const meta: Meta<typeof StudyStreakPanel> = {
export default {
  title: 'Features/SRS/StudyStreakPanel',
  component: StudyStreakPanel,
  tags: ['autodocs'],
  argTypes: {
    messages: { control: 'object' },
    class: { control: 'text' },
    // currentStreak, longestStreak, isLoading are Accessors and set via createAccessorProps
    // Direct Storybook controls for these are not configured here.
  },
};

// type Story = StoryObj<typeof StudyStreakPanel>;

// Helper to create an object with accessor props from simple values
interface CreateAccessorValues {
  currentStreak?: number;
  longestStreak?: number;
  isLoading?: boolean;
}

const createAccessorProps = (values: CreateAccessorValues): {
  currentStreak: Accessor<number | undefined>;
  longestStreak: Accessor<number | undefined>;
  isLoading: Accessor<boolean>;
} => ({
  currentStreak: createSignal(values.currentStreak === undefined ? undefined : values.currentStreak)[0],
  longestStreak: createSignal(values.longestStreak === undefined ? undefined : values.longestStreak)[0],
  isLoading: createSignal(values.isLoading ?? false)[0],
});

const mockMessages: Messages = {
  newTabPageStreakTitle: { message: 'Your Streak' },
  newTabPageLabelCurrent: { message: 'Current' },
  newTabPageLabelLongest: { message: 'Longest' },
};

export const Default = {
  args: {
    ...createAccessorProps({
      currentStreak: 5,
      longestStreak: 10,
      isLoading: false,
    }),
    messages: mockMessages,
    class: '',
  },
};

export const Loading = {
  args: {
    ...createAccessorProps({
      currentStreak: undefined,
      longestStreak: undefined,
      isLoading: true,
    }),
    messages: mockMessages,
    class: '',
  },
};

export const ZeroStreaks = {
  args: {
    ...createAccessorProps({
      currentStreak: 0,
      longestStreak: 0,
      isLoading: false,
    }),
    messages: mockMessages,
    class: '',
  },
};

export const WithCustomClass = {
  args: {
    ...createAccessorProps({
      currentStreak: 3,
      longestStreak: 7,
      isLoading: false,
    }),
    messages: mockMessages,
    class: 'border-2 border-blue-500',
  },
}; 