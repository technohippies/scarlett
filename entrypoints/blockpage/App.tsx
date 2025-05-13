import { Component } from 'solid-js';
import { SettingsProvider } from '../../src/context/SettingsContext';
import StudyPage from '../../src/pages/study/StudyPage';
import { browser } from 'wxt/browser';

const App: Component = () => {

  const handleBlockPageStudyExit = () => {
    const newTabUrl = browser.runtime.getURL('newtab.html' as any);
    window.location.href = newTabUrl;
  };

  return (
    <SettingsProvider>
      {/* The outer div is now minimal, allowing StudyPage to control its own layout and background */}
      <StudyPage onNavigateBack={handleBlockPageStudyExit} />
    </SettingsProvider>
  );
};

export default App;
