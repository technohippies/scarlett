import { OllamaCorsInstructions } from '../../../src/features/models/OllamaCorsInstructions';

export default {
    title: 'Features/Models/OllamaCorsInstructions',
    component: OllamaCorsInstructions,
    tags: ['autodocs'],
    argTypes: {
        _forceOS: {
            control: 'select',
            options: [undefined, 'linux', 'macos', 'windows', 'unknown'],
            description: 'Force instructions for a specific OS (or undefined to auto-detect)',
        },
    },
    args: {
         _forceOS: undefined, // Default to auto-detect
    },
};

// Use 'any' for args type to match the requested pattern
const Template = (args: any) => (
    <div class="p-4 bg-background max-w-xl mx-auto">
        <OllamaCorsInstructions {...args} />
    </div>
);

export const AutoDetect = {
    render: Template,
    args: {
        _forceOS: undefined,
    },
};

export const Linux = {
    render: Template,
    args: {
        _forceOS: 'linux',
    },
};

export const MacOS = {
    render: Template,
    args: {
        _forceOS: 'macos',
    },
};

export const Windows = {
     render: Template,
    args: {
        _forceOS: 'windows',
    },
};

export const Unknown = {
     render: Template,
    args: {
        _forceOS: 'unknown',
    },
}; 