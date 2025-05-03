import { Component } from 'solid-js';
// Import the actual page content component
import NewTabPage from '../../src/pages/newtab/NewTabPage'; 

const App: Component = () => {
  // This component simply renders the main page component.
  // Layout wrappers, context providers, etc., could be added here later.
  return <NewTabPage />;
};

export default App;
