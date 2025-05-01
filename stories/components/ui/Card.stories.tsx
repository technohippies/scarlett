import { For, type ComponentProps } from "solid-js";
import { Bell, Check } from 'phosphor-solid'; // Import icons

import { Button } from "../../../src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../src/components/ui/card";
import {
  Switch,
  SwitchControl,
  SwitchThumb,
} from "../../../src/components/ui/switch";

const notifications = [
  {
    title: "Your call has been confirmed.",
    description: "1 hour ago",
  },
  {
    title: "You have a new message!",
    description: "1 hour ago",
  },
  {
    title: "Your subscription is expiring soon!",
    description: "2 hours ago",
  },
];

export default {
  title: "Components/UI/Card",
  component: Card,
  parameters: {
    // Adjust layout as Card might not fit well centered
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    // Add argTypes for sub-components if needed
  },
};

type StoryProps = ComponentProps<typeof Card>;

// Story based on CardDemo
export const Default = {
  render: (props: StoryProps) => (
    <Card class="w-[380px]" {...props}>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread messages.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <div class=" flex items-center space-x-4 rounded-md border p-4">
          <Bell class="size-6" /> {/* Use Phosphor icon */}
          <div class="flex-1 space-y-1">
            <p class="text-sm font-medium leading-none">Push Notifications</p>
            <p class="text-sm text-muted-foreground">Send notifications to device.</p>
          </div>
          <Switch>
            <SwitchControl>
              <SwitchThumb />
            </SwitchControl>
          </Switch>
        </div>
        <div>
          <For each={notifications}>
            {(notification) => (
              <div class="mb-4 grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                <span class="flex size-2 translate-y-1 rounded-full bg-sky-500" />
                <div class="space-y-1">
                  <p class="text-sm font-medium leading-none">{notification.title}</p>
                  <p class="text-sm text-muted-foreground">{notification.description}</p>
                </div>
              </div>
            )}
          </For>
        </div>
      </CardContent>
      <CardFooter>
        <Button class="w-full">
          <Check class="mr-2 size-4" /> {/* Use Phosphor icon */}
          Mark all as read
        </Button>
      </CardFooter>
    </Card>
  ),
  args: {
    // Args for the Card component itself
  },
}; 