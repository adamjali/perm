import * as React from "react"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // A control: the darker control line (3:1 on every surface), 16px text
        // at every width so iOS never zooms, and the green focus ring.
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-11 w-full min-w-0 border bg-card px-3 py-1 text-base transition-colors duration-150 outline-none flex items-center",
        "file:mr-3 file:h-7 file:px-3 file:my-auto file:border file:border-border file:bg-secondary file:text-secondary-foreground file:text-sm file:font-semibold file:cursor-pointer file:transition-colors file:duration-150 file:hover:bg-accent",
        "focus:ring-2 focus:ring-ring focus:border-ring",
        // Disabled reads at full contrast on a muted ground, never faded.
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        // Valid state, opt-in via data-valid="true".
        "data-[valid=true]:border-primary-text",
        className
      )}
      {...props}
    />
  )
}

export interface InputWithLoadingProps extends React.ComponentProps<"input"> {
  loading?: boolean;
}

function InputWithLoading({
  className,
  type,
  loading = false,
  ...props
}: InputWithLoadingProps) {
  return (
    <div className="relative w-full">
      <Input
        type={type}
        className={cn(loading && "pr-10", className)}
        disabled={loading || props.disabled}
        {...props}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  )
}

export { Input, InputWithLoading }
