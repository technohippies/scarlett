import { render } from 'solid-js/web';
import App from './App';
import 'virtual:uno.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error("Could not find root element in study/index.html");
}

// Render the App component into the root element
render(() => <App />, root); 