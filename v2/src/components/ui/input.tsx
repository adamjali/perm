import * as React from "react"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles - neobrutalist with hard shadow
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-11 w-full min-w-0 border-2 bg-background px-3 py-1 text-base shadow-hard-sm transition-all duration-150 outline-none md:text-sm flex items-center",
        // File input button styling - neobrutalist
        "file:mr-3 file:h-7 file:px-3 file:my-auto file:border-2 file:border-border file:bg-secondary file:text-secondary-foreground file:text-sm file:font-semibold file:cursor-pointer file:transition-all file:duration-150 file:hover:bg-primary file:hover:text-primary-foreground file:hover:border-primary file:active:opacity-70 file:active:scale-95",
        // Hover state - slight lift
        "hover:shadow-hard hover:-translate-y-[1px]",
        // Focus state - upgrade shadow
        "focus:shadow-hard focus:ring-2 focus:ring-ring focus-visible:border-ring focus:-translate-y-[1px]",
        // Disabled state - remove shadow and hover
        "disabled:shadow-none disabled:hover:shadow-none disabled:hover:translate-y-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Invalid state
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
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
