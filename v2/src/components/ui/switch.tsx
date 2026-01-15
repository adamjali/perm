"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * Switch Component
 *
 * Neobrutalist toggle switch with Forest Green (#228B22) when ON.
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
        // Base styles
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
        // Border and shadow
        "border-2 border-border shadow-hard-sm",
        // Transition - snappy 150ms
        "transition-all duration-150 ease-out",
        // OFF state
        "bg-muted",
        // ON state - Forest Green
        "data-[state=checked]:bg-[#228B22] data-[state=checked]:border-[#228B22]",
        // Focus states
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Active state - push effect like buttons
        "active:scale-95",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          // Base thumb styles
          "pointer-events-none block h-5 w-5 rounded-full bg-white",
          // Border for neobrutalist look
          "border-2 border-border",
          // Shadow
          "shadow-hard-xs",
          // Transition - snappy 150ms
          "transition-transform duration-150 ease-out",
          // Position - OFF state
          "data-[state=unchecked]:translate-x-0",
          // Position - ON state
          "data-[state=checked]:translate-x-[1.125rem]",
          // ON state thumb border matches green
          "data-[state=checked]:border-[#1a6b1a]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
