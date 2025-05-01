import { Component, splitProps } from "solid-js";
import { cn } from "../../lib/utils"; 

export const Spinner: Component<{ class?: string }> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={cn("animate-spin h-5 w-5 text-muted-foreground", local.class)} // Added text color
      {...others}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}; 