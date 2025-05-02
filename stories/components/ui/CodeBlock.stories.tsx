import { CodeBlock } from '../../../src/components/ui/CodeBlock';

const multiLineCode = 
`sudo systemctl edit ollama.service
#[Service]
#Environment="OLLAMA_HOST=0.0.0.0"
#Environment="OLLAMA_ORIGINS=*"
sudo service ollama restart`;

const singleLineCode = `npm install @wxt-dev/vite-plugin-solid`;

export default {
  title: 'Components/UI/CodeBlock',
  component: CodeBlock,
  parameters: {
    layout: 'padded', // Use padded to give it some space
  },
  tags: ['autodocs'],
  argTypes: {
    code: { control: 'text', description: 'The code string to display' },
    language: { control: 'text', description: 'Highlight.js language (e.g., bash, javascript)' },
    class: { control: 'text', description: 'Additional CSS classes for the container' },
    label: { control: 'text', description: 'Optional label text displayed above the code block' },
  },
};

// Multi-line Bash Example
export const MultiLineBash = {
    args: {
        code: multiLineCode,
        language: 'bash',
    },
};

// Single-line Example
export const SingleLine = {
    args: {
        code: singleLineCode,
        // language: 'bash' // Language defaults to bash if not provided
    },
};

// JavaScript Example
export const JavaScript = {
    args: {
        code: `console.log('Hello, World!');\nconst x = 10;`,
        language: 'javascript',
    },
};

// Example with Label
export const WithLabel = {
    args: {
        code: 'ollama run mistral',
        label: 'Run this command:',
        language: 'bash',
    },
}; 