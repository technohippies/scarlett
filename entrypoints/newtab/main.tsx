import { render } from 'solid-js/web';
// Import the local App root component for this entrypoint
import App from './App'; 
import 'virtual:uno.css';

// Render the App component
render(() => <App />, document.getElementById('root')!); 