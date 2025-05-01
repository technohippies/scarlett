import { Component, createSignal } from 'solid-js';
import { Language } from '../../src/features/oninstall/Language';
// Import the new step
import { LearningGoal } from '../../src/features/oninstall/LearningGoal';
// Import other steps here later if needed
// import { Permissions } from '../../src/features/oninstall/Permissions';
// import { Final } from '../../src/features/oninstall/Final';

type Step = 'language' | 'learningGoal' | 'permissions' | 'final';

const App: Component = () => {
  const [currentStep, setCurrentStep] = createSignal<Step>('language');

  const goToNextStep = () => {
    if (currentStep() === 'language') {
      // TODO: Save language settings first
      console.log("Proceeding from language step...");
      setCurrentStep('learningGoal'); // Go to the new step
    } else if (currentStep() === 'learningGoal') {
      // TODO: Save learning goal
      console.log("Proceeding from learning goal step...");
      // TEMPORARY: Close tab after learning goal step for now
       browser.tabs.getCurrent().then(tab => {
        if (tab?.id) {
          browser.tabs.remove(tab.id);
        }
      });
      // In the future, might go to 'permissions'
      // setCurrentStep('permissions');
    } else if (currentStep() === 'permissions') {
      // setCurrentStep('final');
    } else if (currentStep() === 'final') {
      // Close the tab
      // browser.tabs.getCurrent().then(tab => { ... });
    }
  };

  const renderStep = () => {
    switch (currentStep()) {
      case 'language':
        return <Language onComplete={goToNextStep} />;
      case 'learningGoal': // Add case for the new step
        return <LearningGoal onComplete={goToNextStep} />;
      // case 'permissions':
      //   return <Permissions onComplete={goToNextStep} />;
      // case 'final':
      //   return <Final onComplete={goToNextStep} />;
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div class="bg-background text-foreground min-h-screen">
      {renderStep()}
    </div>
  );
};

export default App; 