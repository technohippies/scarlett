import type { Component, ComponentProps } from "solid-js"
import { splitProps } from "solid-js"

import { cn } from '../../lib/utils' // Adjusted path for utils

const Table: Component<ComponentProps<"table">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <div class="relative w-full overflow-auto"> {/* Added overflow-auto for responsiveness if table is too wide */}
      <table class={cn("w-full caption-bottom text-sm", local.class)} {...others} />
    </div>
  )
}

const TableHeader: Component<ComponentProps<"thead">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return <thead class={cn("[&_tr]:border-b", local.class)} {...others} />
}

const TableBody: Component<ComponentProps<"tbody">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return <tbody class={cn("[&_tr:last-child]:border-0", local.class)} {...others} />
}

const TableFooter: Component<ComponentProps<"tfoot">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <tfoot class={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", local.class)} {...others} /> // Adjusted styling slightly from original if any
  )
}

const TableRow: Component<ComponentProps<"tr">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <tr
      class={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        local.class
      )}
      {...others}
    />
  )
}

const TableHead: Component<ComponentProps<"th">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <th
      class={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", // Adjusted padding and height from original if any
        local.class
      )}
      {...others}
    />
  )
}

const TableCell: Component<ComponentProps<"td">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <td class={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", local.class)} {...others} /> // Adjusted padding from original if any
  )
}

const TableCaption: Component<ComponentProps<"caption">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return <caption class={cn("mt-4 text-sm text-muted-foreground", local.class)} {...others} />
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } 