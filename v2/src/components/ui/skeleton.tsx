import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "line" | "block" | "circle"
}

function Skeleton({ className, variant = "block", ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "skeleton-pulse",
        variant === "line" && "h-4 w-full rounded-full",
        variant === "block" && "h-12 w-full rounded-sm",
        variant === "circle" && "h-10 w-10 rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
