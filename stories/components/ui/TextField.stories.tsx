import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
  TextFieldDescription,
  TextFieldErrorMessage
} from '../../../src/components/ui/text-field';

// Define the type for the args based on argTypes
// type StoryArgs = {
//   disabled?: boolean;
//   invalid?: boolean;
//   required?: boolean;
//   readOnly?: boolean;
//   placeholder?: string;
//   labelText?: string;
//   descriptionText?: string;
//   errorMessageText?: string;
// };

const meta = {
  title: 'Components/UI/TextField',
  component: TextField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    // Args for TextField Root
    disabled: { control: 'boolean', description: 'Disables the text field' },
    invalid: { control: 'boolean', description: 'Marks the field as invalid' },
    required: { control: 'boolean', description: 'Marks the field as required' },
    readOnly: { control: 'boolean', description: 'Makes the field read-only' },
    // Args for TextFieldInput specific props (can't directly control type via args)
    placeholder: { control: 'text', description: 'Input placeholder text' },
    // Args for Label/Description/Error Message content (example)
    labelText: { control: 'text', description: 'Content for the Label' },
    descriptionText: { control: 'text', description: 'Content for the Description' },
    errorMessageText: { control: 'text', description: 'Content for the Error Message (shown when invalid)' },
  },
  // Default args for demonstration
  args: {
    disabled: false,
    invalid: false,
    required: false,
    readOnly: false,
    placeholder: 'Enter text here...',
    labelText: 'Field Label',
    descriptionText: 'This is a helpful description.',
    errorMessageText: 'This field is required.',
  },
};

export default meta;
// type Story = StoryObj<typeof meta>;

// Basic Input Story
export const Default = {
  render: (args: any) => (
    <TextField
      class="w-64"
      disabled={args.disabled}
      required={args.required}
      readOnly={args.readOnly}
      validationState={args.invalid ? 'invalid' : 'valid'} // Use validationState instead of invalid prop
    >
      <TextFieldLabel>{args.labelText}</TextFieldLabel>
      <TextFieldInput placeholder={args.placeholder} />
      <TextFieldDescription>{args.descriptionText}</TextFieldDescription>
      <TextFieldErrorMessage>{args.errorMessageText}</TextFieldErrorMessage>
    </TextField>
  ),
};

// Email Input Story
export const EmailInput = {
  render: (args: any) => (
    <TextField
      class="w-64"
      disabled={args.disabled}
      required={args.required}
      readOnly={args.readOnly}
      validationState={args.invalid ? 'invalid' : 'valid'}
    >
      <TextFieldLabel for="email-input">{args.labelText}</TextFieldLabel>
      <TextFieldInput type="email" id="email-input" placeholder={args.placeholder} />
      <TextFieldDescription>{args.descriptionText}</TextFieldDescription>
      <TextFieldErrorMessage>{args.errorMessageText}</TextFieldErrorMessage>
    </TextField>
  ),
  args: {
    placeholder: 'you@example.com',
    labelText: 'Email Address',
    descriptionText: "We'll never share your email.",
    errorMessageText: 'Please enter a valid email address.',
  },
};

// Text Area Story
export const TextArea = {
  render: (args: any) => (
    <TextField
      class="w-64"
      disabled={args.disabled}
      required={args.required}
      readOnly={args.readOnly}
      validationState={args.invalid ? 'invalid' : 'valid'}
    >
      <TextFieldLabel>{args.labelText}</TextFieldLabel>
      <TextFieldTextArea placeholder={args.placeholder} />
      <TextFieldDescription>{args.descriptionText}</TextFieldDescription>
      <TextFieldErrorMessage>{args.errorMessageText}</TextFieldErrorMessage>
    </TextField>
  ),
  args: {
    placeholder: 'Type your message here...',
    labelText: 'Your Message',
    descriptionText: 'Enter your feedback here.',
    errorMessageText: 'A message is required.',
  },
};

// Invalid State Story
export const Invalid = {
  args: {
    invalid: true, // Set the invalid arg for the story control
    labelText: 'Invalid Field',
    // Other args inherit from meta.args
  },
  render: Default.render, // Reuse the default render function
};

// Disabled State Story
export const Disabled = {
  args: {
    disabled: true, // Set the disabled arg for the story control
    labelText: 'Disabled Field',
     // Other args inherit from meta.args
  },
  render: Default.render, // Reuse the default render function
}; 