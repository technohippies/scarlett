import { Component, createSignal, Match, Switch } from 'solid-js';
// Import the actual page content component
import NewTabPage from '../../src/pages/newtab/NewTabPage';
import BookmarksPage from '../../src/pages/bookmarks/BookmarksPage';
import StudyPage from '../../src/pages/study/StudyPage';
import SettingsPage from '../../src/pages/settings/SettingsPage'; // Import the container Page component
// --- Import the SettingsProvider ---
import { SettingsProvider } from '../../src/context/SettingsContext';

type ActiveView = 'newtab' | 'bookmarks' | 'study' | 'settings';

const App: Component = () => {
  const [activeView, setActiveView] = createSignal<ActiveView>('newtab');

  const navigateTo = (view: ActiveView) => {
    setActiveView(view);
  };

  return (
    // --- Wrap the Switch with SettingsProvider ---
    <SettingsProvider>
      <Switch fallback={<div>Unknown View</div>}>
        <Match when={activeView() === 'newtab'}>
          {/* Pass navigation functions to NewTabPage if its View needs them */}
          <NewTabPage 
            // Assuming NewTabPage or its View will eventually need these
             onNavigateToBookmarks={() => navigateTo('bookmarks')}
             onNavigateToStudy={() => navigateTo('study')}
             onNavigateToSettings={() => navigateTo('settings')}
          />
        </Match>
        <Match when={activeView() === 'bookmarks'}>
          {/* Pass navigation function to BookmarksPage if its View needs it (via Header) */}
          <BookmarksPage 
             onNavigateBack={() => navigateTo('newtab')} 
          />
        </Match>
        <Match when={activeView() === 'study'}>
          {/* Pass navigation function to StudyPage if its View needs it (via Header) */}
          <StudyPage 
             onNavigateBack={() => navigateTo('newtab')}
          />
        </Match>
        <Match when={activeView() === 'settings'}>
          {/* SettingsPage is now inside the provider */}
          <SettingsPage onNavigateBack={() => navigateTo('newtab')} /> 
        </Match>
      </Switch>
    </SettingsProvider>
  );
};

export default App;
