import type { ComponentProps } from "solid-js";
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "../../../src/components/ui/switch";

export default {
  title: "Components/UI/Switch",
  component: Switch,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    checked: { control: "boolean" },
    // Add other relevant argTypes as needed
  },
  args: {
    disabled: false,
    // Default controlled state can be managed within render if needed
    // checked: false,
  },
};

type StoryProps = ComponentProps<typeof Switch> & { labelText?: string };

// Default Story based on the SwitchDemo
export const Default = {
  render: (props: StoryProps) => (
    <Switch class="flex items-center space-x-2" {...props}>
      <SwitchControl>
        <SwitchThumb />
      </SwitchControl>
      <SwitchLabel>{props.labelText || "Airplane Mode"}</SwitchLabel>
    </Switch>
  ),
  args: {
    // Default args for this specific story
  },
};

// Disabled Story
export const Disabled = {
  render: (props: StoryProps) => (
    <Switch class="flex items-center space-x-2" {...props}>
      <SwitchControl>
        <SwitchThumb />
      </SwitchControl>
      <SwitchLabel>{props.labelText || "Disabled Switch"}</SwitchLabel>
    </Switch>
  ),
  args: {
    disabled: true,
    labelText: "Disabled",
  },
}; 