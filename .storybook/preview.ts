import 'virtual:uno.css'; // Import UnoCSS entry point

const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Configure Storybook Backgrounds addon using the older values/default API
    backgrounds: {
      values: [
        // Define our dark theme background
        { name: 'Dark', value: 'hsl(240 4.8% 9.8%)' },
        // { name: 'TestRed', value: '#FF0000' }, // Reverted test color
        // Can add a light option too if needed
        // { name: 'Light', value: '#F8F8F8' },
      ],
      // Set the default background using the name from the values array
      default: 'Dark', 
    },
  },
  // Removed initialGlobals as we are using the older API
  // initialGlobals: {
  //   backgrounds: { value: 'dark' }, 
  // },
};

export default preview; 