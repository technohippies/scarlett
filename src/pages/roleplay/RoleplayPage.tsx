import { Component, createSignal, onMount } from 'solid-js';
import { Button } from '../../components/ui/button';
import { RoleplaySelectionView, ScenarioOption } from '../../features/roleplay/RoleplaySelectionView';
import { generateRoleplayScenarios } from '../../services/roleplay/generateRoleplayScenarios';

interface RoleplayPageProps {
  onNavigateBack: () => void;
}

const RoleplayPage: Component<RoleplayPageProps> = (props) => {
  const [scenarios, setScenarios] = createSignal<ScenarioOption[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(async () => {
    const opts = await generateRoleplayScenarios();
    setScenarios(opts);
    setIsLoading(false);
  });

  return (
    <div class="p-6 font-sans">
      <Button variant="ghost" onClick={props.onNavigateBack} class="mb-4">
        Back
      </Button>
      <RoleplaySelectionView
        scenarios={scenarios()}
        isLoading={isLoading()}
        onScenarioSelect={(id: string | number) => {
          console.log('Scenario selected:', id);
          // TODO: navigate to conversation view
        }}
      />
    </div>
  );
};

export default RoleplayPage; 