import { createSignal } from 'solid-js';
import SubscriptionPlanPanel, { SubscriptionPlan } from '../../../src/components/ui/SubscriptionPlanPanel';

export default {
  title: 'Components/UI/SubscriptionPlanPanel',
  component: SubscriptionPlanPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export const Interactive = {
  render: () => {
    const [selectedPlan, setSelectedPlan] = createSignal<SubscriptionPlan | null>(null);
    const [isConnected, setConnected] = createSignal(false);
    const [isSubscribing, setIsSubscribing] = createSignal(false);
    const [isSubscribed, setSubscribed] = createSignal(false);

    const handleConnect = () => { setConnected(true); };
    const handleSubscribe = () => {
      setIsSubscribing(true);
      setTimeout(() => {
        setIsSubscribing(false);
        setSubscribed(true);
      }, 1000);
    };

    return (
      <div class="p-4 bg-background flex justify-center">
        <SubscriptionPlanPanel
          selectedPlan={selectedPlan()}
          onSelectPlan={setSelectedPlan}
          isConnected={isConnected()}
          onConnect={handleConnect}
          onSubscribe={handleSubscribe}
          isSubscribing={isSubscribing()}
          isSubscribed={isSubscribed()}
        />
      </div>
    );
  },
}; 