import { render } from 'solid-js/web';
import App from './App';
import 'virtual:uno.css';

// Render the App component into the root element
const rootElement = document.getElementById('root');

if (rootElement) {
  render(() => <App />, rootElement);
} else {
  console.error('Root element not found for bookmarks page.');
} 