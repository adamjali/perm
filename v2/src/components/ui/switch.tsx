"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * Switch Component
 *
 * Neobrutalist toggle switch, brand lime when ON.
 * Features 2px border, snappy 150ms animation, and hard shadow.
 *
 * @example
 * ```tsx
 * <Switch
 *   checked={enabled}
 *   onCheckedChange={setEnabled}
 * />
 * ```
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-input bg-muted",
        "transition-colors duration-150 ease-out",
        "data-[state=checked]:border-primary-text data-[state=checked]:bg-primary-text",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // Disabled reads at full contrast, never faded.
        "disabled:cursor-not-allowed disabled:border-border disabled:bg-muted",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full border border-input bg-card",
          // The thumb slides because the visitor flipped it.
          "transition-transform duration-150 ease-out",
          "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[1.125rem] data-[state=checked]:border-primary-text",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
