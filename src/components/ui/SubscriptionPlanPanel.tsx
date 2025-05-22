import { Component, For } from 'solid-js';
import { Button } from './button';
import { cn } from '../../lib/utils';

// Define subscription plan types
export type SubscriptionPlan = 'free' | 'hosted';

interface PlanOption {
  id: SubscriptionPlan;
  title: string;
  priceLabel: string;
  description: string;
  logoUrl: string;
}

const planOptions: PlanOption[] = [
  {
    id: 'free',
    title: 'Local LLM',
    priceLabel: 'Free',
    description: 'Slow and limited on a local LLM',
    logoUrl: '/images/scarlett-supercoach/scarlett-proud-512x512.png',
  },
  {
    id: 'hosted',
    title: 'Venice.AI Dolphin Mistral 24B',
    priceLabel: '$10 / month',
    description: 'Private uncensored superior intelligence',
    logoUrl: '/images/llm-providers/venice-ai.png',
  },
];

interface SubscriptionPlanPanelProps {
  selectedPlan: () => SubscriptionPlan | null;
  onSelectPlan: (plan: SubscriptionPlan) => void;
}

const SubscriptionPlanPanel: Component<SubscriptionPlanPanelProps> = (props) => {
  return (
    <div class="flex flex-col gap-4 w-full max-w-lg">
      <For each={planOptions}>
        {(plan) => {
          const isSelected = () => props.selectedPlan() === plan.id;
          return (
            <Button
              variant="outline"
              onClick={() => props.onSelectPlan(plan.id)}
              class={cn(
                'h-auto p-4 flex items-center justify-start space-x-4 border relative transition-colors duration-150 ease-in-out whitespace-normal',
                'cursor-pointer hover:bg-neutral-700 hover:border-neutral-600 focus:outline-none focus:ring-0 border-neutral-700',
                isSelected()
                  ? 'bg-neutral-700 text-foreground border-neutral-500 ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : ''
              )}
            >
              <div class="flex-shrink-0 w-24 h-24">
                <img
                  src={plan.logoUrl}
                  alt={plan.title}
                  class="w-full h-full object-contain rounded-full"
                />
              </div>
              <div class="flex flex-col space-y-1 text-left">
                <span class="text-xl font-normal">{plan.title}</span>
                <span class="text-lg text-muted-foreground">{plan.priceLabel}</span>
                <p class="text-base">{plan.description}</p>
              </div>
            </Button>
          );
        }}
      </For>
    </div>
  );
};

export default SubscriptionPlanPanel; 