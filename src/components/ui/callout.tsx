import type { Component, ComponentProps } from "solid-js"
import { splitProps } from "solid-js"

import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

import { cn } from '../../lib/utils'; // Adjusted path

// Updated variants to match the example style
const calloutVariants = cva("relative w-full rounded-md border-l-4 p-4 pl-4", { // Added relative, w-full, adjusted padding
  variants: {
    variant: {
      // Mapped example colors to standard Tailwind (adjust if theme vars exist)
      default: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300", // Info -> Blue
      success: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", // Success -> Emerald
      warning: "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300", // Warning -> Yellow
      error: "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300" // Error -> Red (using 700 for text contrast)
    }
  },
  defaultVariants: {
    variant: "default"
  }
})

type CalloutProps = ComponentProps<"div"> & VariantProps<typeof calloutVariants>

// Main Callout container component
const Callout: Component<CalloutProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "variant"])
  return <div class={cn(calloutVariants({ variant: local.variant }), local.class)} {...others} />
}

// Callout Title component
const CalloutTitle: Component<ComponentProps<"h5">> = (props) => { // Using h5 for semantic consistency with previous version
  const [local, others] = splitProps(props, ["class"])
  // Adjusted styling: larger text, bold
  return <h5 class={cn("mb-1 font-semibold tracking-tight text-base", local.class)} {...others} /> 
}

// Callout Content component
const CalloutContent: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  // Adjusted styling: default text size, margin-top implied by title margin-bottom
  return <div class={cn("[&_p]:leading-relaxed", local.class)} {...others} /> 
}

export { Callout, CalloutTitle, CalloutContent }
