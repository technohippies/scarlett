import { For, type ComponentProps, Component } from "solid-js";

import { Button } from "../../../src/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../../src/components/ui/sheet";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../../src/components/ui/text-field";

const SHEET_POSITIONS = ["top", "right", "bottom", "left"] as const;
type Position = (typeof SHEET_POSITIONS)[number];

// Define TriggerButton using ComponentProps inferred from our Button
const TriggerButton: Component<ComponentProps<typeof Button>> = (props) => (
  <Button variant="outline" {...props} />
);

export default {
  title: "Components/UI/Sheet",
  // We don't set a single component here as the story renders multiple Sheets
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    // Args might be less relevant here as the story controls positions
    // We could add args for content customization if needed
  },
};

// Story based on SheetDemo, showing all positions
export const Default = {
  render: () => (
    <div class="grid grid-cols-2 gap-2">
      <For each={SHEET_POSITIONS}>
        {(position: Position) => (
          <Sheet>
            {/* Use the wrapper component type for the 'as' prop */}
            <SheetTrigger as={TriggerButton}>
              {position}
            </SheetTrigger>
            <SheetContent position={position}>
              <SheetHeader>
                <SheetTitle>Edit profile</SheetTitle>
                <SheetDescription>
                  Make changes to your profile here. Click save when you're done.
                </SheetDescription>
              </SheetHeader>
              <div class="grid gap-4 py-4">
                <TextField class="grid grid-cols-4 items-center gap-4">
                  <TextFieldLabel class="text-right">Name</TextFieldLabel>
                  <TextFieldInput value="Pedro Duarte" class="col-span-3" type="text" />
                </TextField>
                <TextField class="grid grid-cols-4 items-center gap-4">
                  <TextFieldLabel class="text-right">Username</TextFieldLabel>
                  <TextFieldInput value="@peduarte" class="col-span-3" type="text" />
                </TextField>
              </div>
              <SheetFooter>
                {/* Use SheetClose for the closing action if needed, or just a regular button */}
                <Button type="submit">Save changes</Button>
                {/* <SheetClose as={Button<"button">} type="submit">Save changes</SheetClose> */}
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}
      </For>
    </div>
  ),
  args: {
    // Args for the story itself (not passed down directly in this case)
  },
}; 