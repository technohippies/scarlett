import 'virtual:uno.css'; // Import UnoCSS entry point
import '../src/assets/theme.css'; // Import theme variables instead of popup styles

const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview; 