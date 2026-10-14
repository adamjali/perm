import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { prettyStatus, statusTone, type StatusTone } from "@/lib/statusTone"

/**
 * A badge is a quiet chip: muted ground, plain text. Status colour, where it
 * means something, goes in a dot beside the word, never as the whole fill.
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1.5 border px-2 py-0.5 text-sm font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3.5 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-muted text-foreground [a&]:hover:bg-accent",
        secondary: "border-transparent bg-muted text-muted-foreground [a&]:hover:bg-accent",
        destructive: "border-transparent bg-destructive/10 text-destructive-text [a&]:hover:bg-destructive/15",
        outline: "border-border bg-transparent text-foreground [a&]:hover:bg-accent",
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

const TONE_DOT = {
  good: "bg-data-good-ink",
  bad: "bg-data-bad-ink",
  warn: "bg-data-warn-ink",
  flat: "bg-muted-foreground",
} as const

/** A quiet chip whose dot says good, bad, warning or neither, beside its own words. */
function ToneBadge({
  tone,
  className,
  children,
}: {
  tone: StatusTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <Badge className={cn("font-normal", className)}>
      <span aria-hidden="true" className={cn("size-2 shrink-0", TONE_DOT[tone])} />
      {children}
    </Badge>
  )
}

/**
 * A DOL status as a quiet chip: its own words (capitalised as a name, acronyms kept)
 * and a dot whose colour repeats what the words say. One look for every
 * status in every table and list.
 */
function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <ToneBadge tone={statusTone(status)} className={className}>
      <span translate="no">{prettyStatus(status)}</span>
    </ToneBadge>
  )
}

export { Badge, badgeVariants, StatusBadge, ToneBadge }
