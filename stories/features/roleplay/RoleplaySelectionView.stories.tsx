import type { Meta, StoryObj } from '@storybook/html'; // Assuming @storybook/html for SolidJS
import { Component } from 'solid-js';
import { RoleplaySelectionView, RoleplaySelectionViewProps, ScenarioOption } from '../../../src/features/roleplay/RoleplaySelectionView';

const meta: Meta<RoleplaySelectionViewProps> = {
  title: 'Features/Roleplay/RoleplaySelectionView',
  component: RoleplaySelectionView as Component<RoleplaySelectionViewProps>,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    scenarios: { control: 'object' },
    onScenarioSelect: { action: 'onScenarioSelect' },
    isLoading: { control: 'boolean' },
    titleText: { control: 'text' },
    onGenerateNewSet: { action: 'onGenerateNewSet' },
  },
};

export default meta;
type Story = StoryObj<RoleplaySelectionViewProps>;

const mockScenarios: ScenarioOption[] = [
  {
    id: 'scenario1',
    title: "Ordering Coffee in Paris",
    description: "You're at a bustling Parisian café. Try to order a coffee and a croissant. Don't forget to be polite! (Native Language Description)",
  },
  {
    id: 'scenario2',
    title: "Asking for Directions to the Museum",
    description: "You're a bit lost in Berlin and need to find your way to the art museum. Ask a local for directions. (Native Language Description)",
  },
  {
    id: 'scenario3',
    title: "Checking into a Hotel in Tokyo",
    description: "You've just arrived at your hotel in Tokyo. Go through the check-in process with the receptionist. (Native Language Description)",
  },
];

export const Default: Story = {
  args: {
    scenarios: mockScenarios,
    onScenarioSelect: (id: ScenarioOption['id']) => console.log("Scenario selected:", id),
    isLoading: false,
    titleText: "Choose Your Conversation Practice",
    onGenerateNewSet: () => console.log("Generate new set clicked"),
  },
};

export const Loading: Story = {
  args: {
    scenarios: [],
    onScenarioSelect: (id: ScenarioOption['id']) => console.log("Scenario selected:", id),
    isLoading: true,
    titleText: "Finding Scenarios For You...",
    onGenerateNewSet: () => console.log("Generate new set clicked (while loading - should be disabled or not shown)"),
  },
};

export const EmptyState: Story = {
  args: {
    scenarios: [],
    onScenarioSelect: (id: ScenarioOption['id']) => console.log("Scenario selected:", id),
    isLoading: false,
    titleText: "No Scenarios Found",
    onGenerateNewSet: () => console.log("Generate new set clicked from empty state"),
  },
};

export const SingleScenario: Story = {
    args: {
      scenarios: [mockScenarios[0]],
      onScenarioSelect: (id: ScenarioOption['id']) => console.log("Scenario selected:", id),
      isLoading: false,
      onGenerateNewSet: () => console.log("Generate new set clicked"),
    },
  }; 