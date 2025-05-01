import { render } from 'solid-js/web';
// Revert import back to without extension
import App from './App';

// Import UnoCSS utilities for this entrypoint
import 'virtual:uno.css';

// Remove the shared stylesheet import
// import '../popup/style.css';

// Explicitly render the App component
render(() => <App />, document.getElementById('root')!);