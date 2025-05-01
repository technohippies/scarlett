import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemLabel,
  ComboboxSection,
  ComboboxTrigger
} from "../../../src/components/ui/combobox"; // Adjusted path

// Example data structure from docs
interface Food {
  value: string;
  label: string;
  disabled: boolean;
}
interface Category {
  label: string;
  options: Food[];
}
const ALL_OPTIONS: Category[] = [
  {
    label: "Fruits",
    options: [
      { value: "apple", label: "Apple", disabled: false },
      { value: "banana", label: "Banana", disabled: false },
      { value: "blueberry", label: "Blueberry", disabled: false },
      { value: "grapes", label: "Grapes", disabled: true },
      { value: "pineapple", label: "Pineapple", disabled: false }
    ]
  },
  {
    label: "Meat",
    options: [
      { value: "beef", label: "Beef", disabled: false },
      { value: "chicken", label: "Chicken", disabled: false },
      { value: "lamb", label: "Lamb", disabled: false },
      { value: "pork", label: "Pork", disabled: false }
    ]
  }
];

// Default export defining metadata (like Button/Card stories)
export default {
  title: "Components/UI/Combobox",
  component: Combobox, // Root component for Storybook
  parameters: {
    layout: "centered", // Or 'padded' if it needs more space
  },
  tags: ["autodocs"],
  argTypes: {
    // Define argTypes for Combobox props if needed (e.g., placeholder)
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    // Note: options, itemComponent, etc. are complex and usually handled in render
  },
};

// Named export for the specific story (like Button/Card stories)
export const Default = {
  args: {
    // Default arguments for this specific story
    placeholder: "Search a food…",
    disabled: false,
  },
  // Render function for this story, similar to Card story
  render: (props: any) => (
    // Add a wrapper for better layout in Storybook canvas
    <div style={{ padding: "20px", width: "300px" }}> 
      <Combobox<Food, Category>
        options={ALL_OPTIONS}
        optionValue="value" // Key for the value of an option
        optionTextValue="label" // Key for the text representation
        optionLabel="label" // Key for the display label (often same as text value)
        optionDisabled="disabled" // Key for the disabled state
        optionGroupChildren="options" // Key for nested options in categories
        placeholder={props.placeholder} // Use placeholder from args
        disabled={props.disabled} // Use disabled from args
        itemComponent={(itemProps) => (
          <ComboboxItem item={itemProps.item}>
            <ComboboxItemLabel>{itemProps.item.rawValue.label}</ComboboxItemLabel>
            <ComboboxItemIndicator />
          </ComboboxItem>
        )}
        sectionComponent={(sectionProps) => (
          <ComboboxSection>{sectionProps.section.rawValue.label}</ComboboxSection>
        )}
        // Optional: Add state management for selection if needed for interaction demo
        // value={...} 
        // onChange={...}
        multiple={false} // Assuming single selection
        class="w-full" // Make the combobox take full width of its container
      >
        <ComboboxControl aria-label="Food"> {/* Control contains input and trigger */} 
          <ComboboxInput />
          <ComboboxTrigger />
        </ComboboxControl>
        {/* Content contains the listbox */}
        <ComboboxContent /> 
      </Combobox>
    </div>
  ),
};

// Example for a simpler list (no categories)
const SIMPLE_OPTIONS = ["Apple", "Banana", "Blueberry", "Grapes", "Pineapple"];

export const SimpleList = {
  args: {
    placeholder: "Search a simple fruit...",
    disabled: false,
  },
  render: (props: any) => (
    <div style={{ padding: "20px", width: "300px" }}>
      <Combobox<string>
        options={SIMPLE_OPTIONS}
        placeholder={props.placeholder}
        disabled={props.disabled}
        itemComponent={(itemProps) => (
          <ComboboxItem item={itemProps.item}>
            <ComboboxItemLabel>{itemProps.item.rawValue}</ComboboxItemLabel>
            <ComboboxItemIndicator />
          </ComboboxItem>
        )}
        multiple={false}
        class="w-full"
      >
        <ComboboxControl aria-label="Simple Fruit">
          <ComboboxInput />
          <ComboboxTrigger />
        </ComboboxControl>
        <ComboboxContent />
      </Combobox>
    </div>
  ),
};
