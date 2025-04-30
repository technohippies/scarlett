import { Button } from '~/components/ui/button';

export default {
  title: 'Components/UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
    // We don't directly control 'class' via args, but good to acknowledge it exists
    // class: { control: 'text' },
  },
  // Default args for all stories
  args: {
    children: 'Button',
    disabled: false,
  },
};

// CSF 3 Format: Export named constants for stories

export const Default = {
  args: {
    variant: 'default',
    size: 'default',
  },
};

export const Secondary = {
  args: {
    variant: 'secondary',
  },
};

export const Destructive = {
  args: {
    variant: 'destructive',
  },
};

export const Outline = {
  args: {
    variant: 'outline',
  },
};

export const Ghost = {
  args: {
    variant: 'ghost',
  },
};

export const Link = {
  args: {
    variant: 'link',
    children: 'Link Button',
  },
};

export const Icon = {
  args: {
    variant: 'outline', // or any other variant
    size: 'icon',
    children: ( // Example SVG icon
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
};

export const Small = {
  args: {
    size: 'sm',
    children: 'Small Button',
  },
};

export const Large = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
};

export const Disabled = {
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
}; 