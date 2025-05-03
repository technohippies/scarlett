import { render } from 'solid-js/web';
import App from '../../src/pages/newtab/App'; // Import the new root component
import 'virtual:uno.css';

// Render the App component
render(() => <App />, document.getElementById('root')!); 