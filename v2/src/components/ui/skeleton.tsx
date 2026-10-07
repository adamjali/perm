import { cn } from "@/lib/utils"

/**
 * Loading placeholder.
 *
 * It draws what it stands in for: a square-cornered box (the radius token is
 * 0px) on the muted ground with a real --border edge. Both come from tokens,
 * so it is right in dark mode. A slow band sweeps across it while it waits
 * (`.skeleton-pulse` in globals.css), so a loading page reads as working, not
 * frozen; reduced motion keeps the still ground.
 *
 * The `circle` variant keeps its radius on purpose. It stands in for an
 * avatar, which is genuinely round; squaring it would misdescribe the thing
 * that is loading.
 */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "line" | "block" | "circle"
}

function Skeleton({ className, variant = "block", ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "skeleton-pulse border border-border",
        variant === "line" && "h-4 w-full",
        variant === "block" && "h-12 w-full",
        variant === "circle" && "h-10 w-10 rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
