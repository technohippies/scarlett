import type { ComponentProps } from "solid-js";
import { Checkbox } from "../../../src/components/ui/checkbox";
import { Label } from "../../../src/components/ui/label";

export default {
  title: 'Components/UI/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
    checked: { control: 'boolean' },
    // Add other relevant argTypes as needed
  },
  args: {
    disabled: false,
    indeterminate: false,
    // Default controlled state can be managed within render
  },
};

type StoryProps = ComponentProps<typeof Checkbox> & { labelText?: string, descriptionText?: string };

// Default Story based on the first CheckboxDemo
export const Default = {
  render: (props: StoryProps) => {
    // Use a unique ID for each story instance if needed, or pass via args
    const id = props.id || "terms-default";
    return (
      <div class="flex items-start space-x-2">
        <Checkbox id={id} {...props} />
        <div class="grid gap-1.5 leading-none">
          <Label for={`${id}-input`}>{props.labelText || "Accept terms and conditions"}</Label>
          <p class="text-sm text-muted-foreground">
            {props.descriptionText || "You agree to our Terms of Service and Privacy Policy."}
          </p>
        </div>
      </div>
    );
  },
  args: {
    // Default args for this specific story
  },
};

// Indeterminate Story
export const Indeterminate = {
  render: (props: StoryProps) => {
    const id = props.id || "terms-indeterminate";
    return (
      <div class="flex items-center space-x-2">
        <Checkbox id={id} {...props} />
        <Label for={`${id}-input`}>{props.labelText || "Indeterminate Checkbox"}</Label>
      </div>
    );
  },
  args: {
    indeterminate: true,
    labelText: "Indeterminate",
    // Note: Kobalte's indeterminate state visually overrides checked state
    checked: false, // Set explicitly if needed, but visual is indeterminate
  },
};

// Disabled Story
export const Disabled = {
  render: (props: StoryProps) => {
    const id = props.id || "terms-disabled";
    return (
      <div class="flex items-center space-x-2">
        <Checkbox id={id} {...props} />
        <Label for={`${id}-input`}>{props.labelText || "Disabled Checkbox"}</Label>
      </div>
    );
  },
  args: {
    disabled: true,
    labelText: "Disabled",
  },
}; 