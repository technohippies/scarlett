import { render } from 'solid-js/web';
import { Component, createSignal, onMount } from 'solid-js';

// Import shared styles or components if needed later
// import 'virtual:uno.css'; // If using UnoCSS

const NewTabPage: Component = () => {
  const [message, setMessage] = createSignal('Loading new tab...');

  onMount(() => {
    // TODO: Add logic here to fetch due cards, display study UI, etc.
    console.log('[NewTab] Page component mounted.');
    setMessage('Scarlett Study Page - Ready!');
  });

  return (
    <div style={ { padding: '2rem' } }>
      <h1>{message()}</h1>
      <p>This page will contain the study interface.</p>
      {/* Add Study Button, Due Cards List, etc. here */}
    </div>
  );
};

// Render the component into the root element of newtab.html
render(() => <NewTabPage />, document.getElementById('root')!); 