import { Component, createSignal, Match, Switch } from 'solid-js';
// Import the actual page content component
import NewTabPage from '../../src/pages/newtab/NewTabPage';
import BookmarksPage from '../../src/pages/bookmarks/BookmarksPage';
import StudyPage from '../../src/pages/study/StudyPage';

type ActiveView = 'newtab' | 'bookmarks' | 'study';

const App: Component = () => {
  const [activeView, setActiveView] = createSignal<ActiveView>('newtab');

  const navigateTo = (view: ActiveView) => {
    setActiveView(view);
  };

  return (
    <Switch fallback={<div>Unknown View</div>}>
      <Match when={activeView() === 'newtab'}>
        {/* Pass navigation functions to NewTabPage if its View needs them */}
        <NewTabPage 
          // Assuming NewTabPage or its View will eventually need these
           onNavigateToBookmarks={() => navigateTo('bookmarks')}
           onNavigateToStudy={() => navigateTo('study')}
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
    </Switch>
  );
};

export default App;
