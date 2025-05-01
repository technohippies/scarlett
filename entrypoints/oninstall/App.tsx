import { Component, createSignal } from 'solid-js';
// Removed unused storage import
import { Language } from '../../src/features/oninstall/Language';
import { LearningGoal } from '../../src/features/oninstall/LearningGoal';
// Import the storage item (removed unused type import)
import { userConfigurationStorage } from '../../src/services/storage';

// Only include currently used steps
type Step = 'language' | 'learningGoal';

const App: Component = () => {
  const [currentStep, setCurrentStep] = createSignal<Step>('language');
  // Add signal to store the target language label
  const [targetLangLabel, setTargetLangLabel] = createSignal<string>('');

  // Function to handle language selection completion
  const handleLanguageComplete = async (selectedLangs: { native: string; target: string; targetLabel: string }) => {
    console.log('[App] Language Complete Callback Received:', selectedLangs);
    // Store the label in the signal
    setTargetLangLabel(selectedLangs.targetLabel);

    const currentConfig = await userConfigurationStorage.getValue();
    const updatedConfig = {
      ...currentConfig,
      nativeLanguage: selectedLangs.native,
      targetLanguage: selectedLangs.target,
      // Note: We are not saving the label itself to storage, just the value
    };
    await userConfigurationStorage.setValue(updatedConfig);
    console.log('[App] Config after saving languages:', updatedConfig);
    setCurrentStep('learningGoal');
  };

  // Function to handle learning goal selection completion
  const handleLearningGoalComplete = async (goalId: string) => {
    console.log('[App] Learning Goal Complete Callback Received:', goalId);
    const currentConfig = await userConfigurationStorage.getValue();
    const finalConfig = {
      ...currentConfig,
      learningGoal: goalId,
      onboardingComplete: true,
    };
    await userConfigurationStorage.setValue(finalConfig);
    console.log('[App] Final config after saving goal:', finalConfig);

    console.log('[App] Onboarding complete, attempting to close tab.');
    browser.tabs.getCurrent().then(tab => {
      if (tab?.id) {
        console.log(`[App] Closing tab with ID: ${tab.id}`);
        browser.tabs.remove(tab.id);
      } else {
        console.log('[App] Could not get current tab ID to close.');
      }
    }).catch(error => {
      console.error('[App] Error getting current tab:', error);
    });
  };

  // Removed unused handlePermissionsComplete and handleFinalComplete functions

  const renderStep = () => {
    switch (currentStep()) {
      case 'language':
        return <Language onComplete={handleLanguageComplete} />;
      case 'learningGoal':
        // Pass the target language label signal value as a prop
        return <LearningGoal 
                   onComplete={handleLearningGoalComplete} 
                   targetLanguageLabel={targetLangLabel()} // Pass label here
               />;
      default:
        console.error('Unknown onboarding step:', currentStep());
        return <div>Error: Unknown step</div>;
    }
  };

  return (
    <div class="bg-background text-foreground min-h-screen">
      {renderStep()}
    </div>
  );
};

export default App; 