import { cn } from "@/lib/utils"

/**
 * Loading placeholder.
 *
 * This is the first thing a visitor sees on all nine authenticated loading
 * routes, and it used to be the least house-styled component in the app: pill
 * and rounded corners on a design system whose radius token is 0px, and a
 * `.skeleton-pulse` class that swept an infinite gradient across two hardcoded
 * greys. Perpetual motion is banned, and the greys were theme-blind.
 *
 * It now draws what it stands in for: a square-cornered box on the muted
 * ground with a real --border edge. Both the ground and the edge come from
 * tokens, so it is correct in dark mode for the first time.
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
