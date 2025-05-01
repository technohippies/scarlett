import { For, Show, type Component, type JSXElement, mergeProps } from "solid-js"
import { cn } from "../../lib/utils" // Adjust path as needed

// --- Types ---

export type TimelinePropsItem = {
  title: JSXElement
  description?: JSXElement
  bullet?: JSXElement // Optional custom bullet content
}

export type TimelineProps = {
  items: TimelinePropsItem[]
  activeItem: number // Index of the *last completed* step. -1 for none active.
  bulletSize?: number
  lineSize?: number
  class?: string
  itemClass?: string // Class for each timeline item li
  bulletClass?: string // Class for the bullet div
  lineClass?: string // Class for the line div
  contentClass?: string // Class for the content div
}

// --- Default Values ---

const defaultProps = {
  bulletSize: 16,
  lineSize: 2,
  activeItem: -1
}

// --- Main Timeline Component ---

export const Timeline: Component<TimelineProps> = (rawProps) => {
  const props = mergeProps(defaultProps, rawProps)

  return (
    <ul class={cn("flex flex-col", props.class)}>
      <For each={props.items}>
        {(item, index) => {
          const isLast = () => index() === props.items.length - 1
          // Line is active if the *next* item's bullet is active
          const isActive = () => props.activeItem >= index() + 1
          // Bullet is active if this item *or any subsequent* item is active
          const isActiveBullet = () => props.activeItem >= index()

          return (
            <TimelineItem
              title={item.title}
              description={item.description}
              bulletContent={item.bullet}
              isLast={isLast()}
              isActive={isActive()}
              isActiveBullet={isActiveBullet()}
              bulletSize={props.bulletSize}
              lineSize={props.lineSize}
              itemClass={props.itemClass}
              bulletClass={props.bulletClass}
              lineClass={props.lineClass}
              contentClass={props.contentClass}
            />
          )
        }}
      </For>
    </ul>
  )
}

// --- Timeline Item ---

type TimelineItemProps = {
  title: JSXElement
  description?: JSXElement
  bulletContent?: JSXElement
  isLast: boolean
  isActive: boolean // Is the line connecting to the *next* item active?
  isActiveBullet: boolean // Is this item's bullet active?
  bulletSize: number
  lineSize: number
  itemClass?: string
  bulletClass?: string
  lineClass?: string
  contentClass?: string
}

const TimelineItem: Component<TimelineItemProps> = (props) => {
  // Calculate approximate vertical center based on title line-height (adjust if needed)
  const approxTitleCenterY = "0.75rem" // Approx half of typical line height for text-base

  return (
    <li
      class={cn("flex gap-4", props.itemClass)} // Use gap for spacing
      style={{
        // Space below item, except for the last one
        "padding-bottom": props.isLast ? "0" : "1.5rem" // Adjust spacing between items
      }}
    >
      {/* Left Column: Bullet and Line */}
      <div
        class="relative flex flex-col items-center"
        style={{ width: `${props.bulletSize}px` }} // Fixed width for alignment
      >
        {/* Line (behind bullet) */}
        <Show when={!props.isLast}>
          <div
            class={cn(
              "absolute top-0 bottom-0 w-full",
              props.isActive ? "bg-primary" : "bg-border",
              props.lineClass
            )}
            style={{
              width: `${props.lineSize}px`,
              left: `calc(50% - ${props.lineSize / 2}px)`, // Center the line horizontally
              top: approxTitleCenterY, // Start line below title center
              bottom: `calc(-1.5rem)` // Extend line into padding-bottom (adjust based on padding)
            }}
            aria-hidden="true"
          />
        </Show>

        {/* Bullet (on top of line) */}
        <div
          class={cn(
            // Use z-10 or similar if needed to ensure bullet is above line
            "z-10 flex items-center justify-center rounded-full border bg-background",
            props.isActiveBullet ? "border-primary" : "border-border",
            props.bulletClass
          )}
          style={{
            width: `${props.bulletSize}px`,
            height: `${props.bulletSize}px`,
            "border-width": `${props.lineSize}px`,
            "box-sizing": "border-box",
            // Position bullet vertically centered around the title's approximate center
            "margin-top": `calc(${approxTitleCenterY} - ${props.bulletSize / 2}px)`
          }}
          aria-hidden="true"
        >
          {props.bulletContent}
        </div>
      </div>

      {/* Right Column: Content */}
      <div class={cn("flex-1 pt-px", props.contentClass)}> {/* pt-px or similar to align baseline with bullet center */}
        <div class="mb-1 text-base font-semibold leading-tight text-foreground">
          {props.title}
        </div>
        <Show when={props.description}>
          <p class="text-sm text-muted-foreground">{props.description}</p>
        </Show>
      </div>
    </li>
  )
}
