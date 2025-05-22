import { Component, JSX } from 'solid-js';
import SubscriptionPlanPanel, { SubscriptionPlan } from './SubscriptionPlanPanel';

export interface ProSubscriptionPanelProps {
  isConnected: boolean;
  onConnect: () => Promise<void> | void;
  selectedPlan: SubscriptionPlan | null;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  onSubscribe: () => Promise<void> | void;
  isSubscribing: boolean;
  isSubscribed: boolean;
}

// Define plan-specific details for tagline and features
const planDetails: Record<SubscriptionPlan, { tagline: string; features: string[] }> = {
  free: {
    tagline: 'Local LLM with limited performance',
    features: [
      'Local model (on-device)',
      'Limited speed and capacity',
      'No long-term memory',
      'Censored or filtered responses'
    ]
  },
  hosted: {
    tagline: 'Get the ultimate version of Scarlett with Dolphin Mistral 24B which has the lowest refusal rate for uncensored prompting.',
    features: [
      'Unlimited messaging',
      'Near instant responses',
      'Fully uncensored outputs',
      'Long-term memory'
    ]
  }
};

const ProSubscriptionPanel: Component<ProSubscriptionPanelProps> = (props) => {
  return (
    <div class="flex flex-col items-center gap-6 p-6 bg-background rounded-lg shadow-md">
      {/* Plan details: tagline + features */}
      {props.selectedPlan && (
        <div class="w-full max-w-md text-left">
          <p class="text-lg font-semibold mb-2">
            {planDetails[props.selectedPlan].tagline}
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm mb-4">
            {planDetails[props.selectedPlan].features.map((feat) => (
              <li>{feat}</li>
            ))}
          </ul>
        </div>
      )}
      {/* Plan selector */}
      <SubscriptionPlanPanel
        selectedPlan={() => props.selectedPlan}
        onSelectPlan={props.onSelectPlan}
      />
      {/* Action button for hosted plan */}
      {props.selectedPlan === 'hosted' && (
        <button
          class="mt-4 px-6 py-3 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 disabled:opacity-50"
          disabled={props.isSubscribing || props.isSubscribed}
          onClick={props.isConnected ? props.onSubscribe : props.onConnect}
        >
          {props.isSubscribed
            ? 'Subscribed ✓'
            : props.isSubscribing
            ? 'Subscribing...'
            : props.isConnected
            ? 'Subscribe $10 / month'
            : 'Connect Wallet to Subscribe'}
        </button>
      )}
    </div>
  );
};

export default ProSubscriptionPanel; 