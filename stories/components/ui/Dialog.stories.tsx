import { Button } from "../../../src/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../../../src/components/ui/dialog"
import { TextField, TextFieldInput, TextFieldLabel } from "../../../src/components/ui/text-field"

// Helper component from the example
export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger as={Button<"button">}>Edit Profile</DialogTrigger>
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Storybook meta
export default {
    title: 'Components/UI/Dialog',
    component: DialogDemo, // Use the demo component for the story
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
};

// Default story using the demo
export const Default = {
    render: () => <DialogDemo />
};
