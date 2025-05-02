import type { Component, JSX, ValidComponent } from "solid-js"
import { splitProps } from "solid-js"
 
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import * as ProgressPrimitive from "@kobalte/core/progress"
 
// Adjust the import path based on your project structure
import { Label } from "./label" 
 
type ProgressRootProps<T extends ValidComponent = "div"> =
  ProgressPrimitive.ProgressRootProps<T> & { children?: JSX.Element }
 
const Progress = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ProgressRootProps<T>>
) => {
  const [local, others] = splitProps(props as ProgressRootProps, ["children"])
  return (
    <ProgressPrimitive.Root {...others}>
      {local.children}
      {/* Modify track height and rounding here if needed */}
      <ProgressPrimitive.Track class="relative h-1 w-full overflow-hidden rounded-none bg-secondary"> 
        <ProgressPrimitive.Fill class="h-full w-[var(--kb-progress-fill-width)] flex-1 bg-primary transition-all" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}
 
const ProgressLabel: Component<ProgressPrimitive.ProgressLabelProps> = (props) => {
  return <ProgressPrimitive.Label as={Label} {...props} />
}
 
const ProgressValueLabel: Component<ProgressPrimitive.ProgressValueLabelProps> = (props) => {
  return <ProgressPrimitive.ValueLabel as={Label} {...props} />
}
 
export { Progress, ProgressLabel, ProgressValueLabel }
