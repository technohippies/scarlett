import { CodeBlock } from '../../../src/components/ui/CodeBlock';

export default {
  title: 'Components/UI/CodeBlock',
  component: CodeBlock,
  parameters: {
    layout: 'padded', // Use padded layout for better spacing
  },
  tags: ['autodocs'],
  argTypes: {
    code: { control: 'text' },
    class: { control: 'text' },
    language: { control: 'text' }, // Add language control
  },
  args: {
    // Default to a single line example
    code: `npx solidui-cli@latest add toast`,
    class: 'w-full', // Removed max-w-xl for wider display
    language: 'bash',
  },
};

// Single Line Story
export const SingleLine = {};

// Multi Line Story
export const MultiLine = {
    args: {
        code: `launchctl setenv OLLAMA_ORIGINS '${window.location.origin}'\nlaunchctl setenv OLLAMA_HOST '0.0.0.0'`,
        language: 'bash',
    }
};

// Longer Multi Line Story
export const MultiLineLonger = {
    args: {
        code: `[Service]
Environment="OLLAMA_ORIGINS=${window.location.origin}"
# Or Environment="OLLAMA_ORIGINS=*" for all
Environment="OLLAMA_HOST=0.0.0.0" # Optional

sudo systemctl daemon-reload && sudo systemctl restart ollama`,
        language: 'bash',
    }
}; 