import { createSignal } from 'solid-js';
import ProSubscriptionPanel from '../../../src/components/ui/ProSubscriptionPanel';
import type { SubscriptionPlan } from '../../../src/components/ui/SubscriptionPlanPanel';

export default {
  title: 'Components/UI/ProSubscriptionPanel',
  component: ProSubscriptionPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export const Default = {
  render: () => {
    const [isConnected, setConnected] = createSignal(false);
    const [selectedPlan, setSelectedPlan] = createSignal<SubscriptionPlan | null>(null);
    const [isSubscribing, setIsSubscribing] = createSignal(false);
    const [isSubscribed, setSubscribed] = createSignal(false);

    const handleConnect = async () => {
      setConnected(true);
    };

    const handleSubscribe = async () => {
      setIsSubscribing(true);
      // simulate async purchase
      setTimeout(() => {
        setIsSubscribing(false);
        setSubscribed(true);
      }, 1000);
    };

    return (
      <div class="p-4 bg-base-100 flex justify-center">
        <ProSubscriptionPanel
          isConnected={isConnected()}
          onConnect={handleConnect}
          selectedPlan={selectedPlan()}
          onSelectPlan={setSelectedPlan}
          onSubscribe={handleSubscribe}
          isSubscribing={isSubscribing()}
          isSubscribed={isSubscribed()}
        />
      </div>
    );
  },
}; 