import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { prettyStatus, statusTone, type StatusTone } from "@/lib/statusTone"

/**
 * A badge is a chip with an ink edge. A status badge is filled with its
 * meaning's colour (round 2, Oct 15 2026: the dot alone left every table
 * grey); the words always say the same thing, so colour is never the only
 * signal.
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1.5 border-2 px-2 py-0.5 text-sm font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3.5 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden transition-colors",
  {
    variants: {
      variant: {
        default: "border-foreground bg-primary text-primary-foreground [a&]:hover:bg-primary-hover",
        secondary: "border-foreground bg-muted text-foreground [a&]:hover:bg-accent",
        destructive: "border-foreground bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        outline: "border-foreground bg-transparent text-foreground [a&]:hover:bg-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

/** Each meaning's fill; black words read on all three colours in both themes. */
const TONE_FILL = {
  good: "bg-data-good text-black",
  bad: "bg-data-bad text-black",
  warn: "bg-data-warn text-black",
  flat: "bg-muted text-foreground",
} as const

/** A chip filled with what it says: good, bad, warning or neither, beside its own words. */
function ToneBadge({
  tone,
  className,
  children,
  ...props
}: {
  tone: StatusTone
  className?: string
  children: React.ReactNode
} & Omit<React.ComponentProps<"span">, "children" | "className">) {
  return (
    <Badge variant="outline" className={cn(TONE_FILL[tone], className)} {...props}>
      {children}
    </Badge>
  )
}

/**
 * A DOL status as a chip: its own words (capitalised as a name, acronyms kept)
 * on the colour of what they mean. One look for every status in every table
 * and list.
 */
function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <ToneBadge tone={statusTone(status)} className={className}>
      <span translate="no">{prettyStatus(status)}</span>
    </ToneBadge>
  )
}

export { Badge, badgeVariants, StatusBadge, ToneBadge }
