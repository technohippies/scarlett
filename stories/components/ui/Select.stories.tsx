import { createSignal, ComponentProps } from "solid-js";
import * as SelectPrimitive from "@kobalte/core/select";
import { cn } from "../../../src/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../../../src/components/ui/select";

export default {
  title: 'Components/UI/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    // Define argTypes if necessary
  },
};

export const Default = {
  render: (props: Omit<ComponentProps<typeof Select>, 'itemComponent' | 'options'> & { placeholder?: string }) => {
    type FruitOption = { value: string; label: string };
    const [value, setValue] = createSignal<FruitOption | null>(null);
    const fruits: FruitOption[] = [
      { value: "Apple", label: "Apple" },
      { value: "Banana", label: "Banana" },
      { value: "Blueberry", label: "Blueberry" },
      { value: "Grapes", label: "Grapes" },
      { value: "Pineapple", label: "Pineapple" },
    ];

    return (
      <div class="flex w-[250px] flex-col items-center gap-4">
        <Select<FruitOption>
          value={value()}
          onChange={setValue}
          options={fruits}
          optionValue="value"
          optionTextValue="label"
          multiple={false}
          placeholder={props.placeholder || "Select a fruit…"}
          itemComponent={(itemProps: { item: SelectPrimitive.SelectItemProps['item'] }) => (
            <SelectPrimitive.Item
              item={itemProps.item}
              class={cn(
                "relative mt-0 flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              )}
            >
              <SelectPrimitive.ItemLabel>{itemProps.item.rawValue.label}</SelectPrimitive.ItemLabel>
              <SelectPrimitive.ItemIndicator class="absolute right-2 my-auto flex h-3.5 w-3.5 items-center justify-center opacity-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-4"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M5 12l5 5l10 -10" />
                </svg>
              </SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          )}
          {...props}
        >
          <SelectTrigger aria-label="Fruit" class="w-[180px]">
            <SelectValue<FruitOption>>
              {(state) => state.selectedOption()?.label || props.placeholder || "Select a fruit…"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
        <p class="pt-2 text-sm text-muted-foreground">Your favorite fruit is: {value()?.value || 'none'}</p>
      </div>
    );
  },
  args: {
    placeholder: "Select a fruit…",
  },
};

export const LongList = {
  render: (props: Omit<ComponentProps<typeof Select>, 'itemComponent' | 'options'> & { placeholder?: string }) => {
    type ItemOption = { value: string; label: string };
    const [value, setValue] = createSignal<ItemOption | null>(null);
    
    // Generate a long list of items
    const longListItems: ItemOption[] = Array.from({ length: 50 }, (_, i) => ({
      value: `item-${i + 1}`,
      label: `Item ${i + 1}`,
    }));

    return (
      <div class="flex w-[250px] flex-col items-center gap-4">
        <Select<ItemOption>
          value={value()}
          onChange={setValue}
          options={longListItems}
          optionValue="value"
          optionTextValue="label"
          multiple={false}
          placeholder={props.placeholder || "Select an item…"}
          itemComponent={(itemProps) => (
             // Use the imported SelectItem component for consistency
             <SelectItem item={itemProps.item}>
               {itemProps.item.rawValue.label}
             </SelectItem>
          )}
          {...props}
        >
          <SelectTrigger aria-label="Item" class="w-[180px]">
            <SelectValue<ItemOption>>
              {(state) => state.selectedOption()?.label || props.placeholder || "Select an item…"}
            </SelectValue>
          </SelectTrigger>
          {/* Apply max-height and overflow directly to SelectContent here */}
          <SelectContent class="max-h-72 overflow-y-auto" />
        </Select>
        <p class="pt-2 text-sm text-muted-foreground">Selected: {value()?.value || 'none'}</p>
      </div>
    );
  },
  args: {
    placeholder: "Select from long list…",
  },
}; 