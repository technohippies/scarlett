import { Callout, CalloutTitle, CalloutContent } from '../../../src/components/ui/callout';

const loremIpsum = "Lorem ipsum dolor sit amet consectetur, adipisicing elit. Tempora cupiditate sapiente officiis ullam, nulla nam sunt? Ipsa facilis ut aspernatur debitis. Qui dolorem modi, assumenda nihil eligendi commodi tempore eos?"

export default {
  title: 'Components/UI/Callout',
  component: Callout, // Main component for docs generation
  parameters: {
    layout: 'padded', // Use padded for better spacing between examples
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'error', 'warning', 'success'],
      // Description for the main Callout component variant
      description: 'Controls the color scheme and border of the Callout container.',
      table: { 
          category: 'Callout Props', // Group under Callout props in docs table
          type: { summary: "'default' | 'error' | 'warning' | 'success'" },
          defaultValue: { summary: 'default' },
      }
    },
    // No title/children controls for the base Callout needed anymore
    class: {
        control: 'text',
        description: 'Additional CSS classes for the Callout container.',
        table: { category: 'Callout Props' }
    },
  },
  // Default args for the main Callout wrapper in the stories
  args: {
    variant: 'default',
    class: 'w-full max-w-2xl', // Set width for stories
  },
};

// CSF 3 Format: Use render function for compound components

export const Default = {
  render: (args: any) => (
    <Callout {...args} variant="default">
      <CalloutTitle>Default</CalloutTitle>
      <CalloutContent>{loremIpsum}</CalloutContent>
    </Callout>
  ),
};

export const Error = {
  render: (args: any) => (
    <Callout {...args} variant="error">
      <CalloutTitle>Error</CalloutTitle>
      <CalloutContent>{loremIpsum}</CalloutContent>
    </Callout>
  ),
};

export const Warning = {
  render: (args: any) => (
    <Callout {...args} variant="warning">
      <CalloutTitle>Warning</CalloutTitle>
      <CalloutContent>{loremIpsum}</CalloutContent>
    </Callout>
  ),
};

export const Success = {
  render: (args: any) => (
    <Callout {...args} variant="success">
      <CalloutTitle>Success</CalloutTitle>
      <CalloutContent>{loremIpsum}</CalloutContent>
    </Callout>
  ),
};

// Story demonstrating usage without a title
export const ContentOnly = {
    name: 'Content Only (Error Example)', // Clearer story name
    render: (args: any) => (
        <Callout {...args} variant="error">
            {/* No CalloutTitle */}
            <CalloutContent>
                This is an error message without a specific title, using only CalloutContent.
            </CalloutContent>
        </Callout>
    ),
};
