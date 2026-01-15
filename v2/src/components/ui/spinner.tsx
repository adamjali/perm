import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const spinnerVariants = cva(
  "inline-block rounded-full border-2 animate-spin",
  {
    variants: {
      variant: {
        default: "border-current border-t-transparent",
        accent: "border-primary border-t-transparent",
        muted: "border-muted-foreground border-t-transparent",
      },
      size: {
        sm: "size-4",
        default: "size-5",
        lg: "size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {}

function Spinner({ className, variant, size, ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(spinnerVariants({ variant, size, className }))}
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

export { Spinner, spinnerVariants }
