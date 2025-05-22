import { createSignal } from 'solid-js';
import SubscriptionPlanPanel, { SubscriptionPlan } from '../../../src/components/ui/SubscriptionPlanPanel';

export default {
  title: 'Components/UI/SubscriptionPlanPanel',
  component: SubscriptionPlanPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    // No external args; selection state is internal to the story
  },
};

const BaseRender = () => {
  const [selectedPlan, setSelectedPlan] = createSignal<SubscriptionPlan | null>(null);
  return (
    <div class="p-4 bg-background flex justify-center">
      <SubscriptionPlanPanel
        selectedPlan={selectedPlan}
        onSelectPlan={(plan) => setSelectedPlan(plan)}
      />
    </div>
  );
};

export const Default = {
  render: BaseRender,
}; 