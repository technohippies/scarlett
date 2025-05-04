import type { JSX, Component } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from '../../lib/utils'; // Corrected path

export interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  class?: string;
}

const Textarea: Component<TextareaProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "classList"]);

  return (
    <textarea
      class={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
        local.classList // Include classList for compatibility
      )}
      {...others}
    />
  );
};

export { Textarea }; 