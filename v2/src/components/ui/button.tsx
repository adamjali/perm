import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium border-2 border-border transition-all duration-150 cursor-pointer disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-hard hover:-translate-y-[2px] hover:shadow-hard-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        destructive:
          "bg-destructive text-white shadow-hard hover:-translate-y-[2px] hover:shadow-hard-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-hard hover:-translate-y-[2px] hover:shadow-hard-lg hover:bg-accent hover:text-accent-foreground active:translate-x-[2px] active:translate-y-[2px] active:shadow-none dark:bg-input/30 dark:border-input",
        secondary:
          "bg-secondary text-secondary-foreground shadow-hard hover:-translate-y-[2px] hover:shadow-hard-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        ghost:
          "border-transparent shadow-none text-foreground hover:bg-accent hover:text-accent-foreground dark:text-foreground dark:hover:bg-accent/50",
        link: "border-transparent shadow-none text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Mobile-first: 44px (h-11) touch targets on mobile, smaller on desktop (md:)
        default: "h-11 md:h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-11 md:h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        xs: "h-10 md:h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5",
        lg: "h-11 md:h-10 px-6 has-[>svg]:px-4",
        icon: "size-11 md:size-9",
        "icon-sm": "size-11 md:size-8",
        "icon-xs": "size-10 md:size-6",
        "icon-lg": "size-11 md:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"

  // When asChild is true, Slot expects exactly one child element.
  // Loading state is incompatible with asChild - just pass children through.
  const content = asChild ? (
    children
  ) : (
    <>
      {loading && <Spinner size={size === "sm" ? "sm" : "default"} />}
      {loading && loadingText ? loadingText : children}
    </>
  )

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size, className }),
        loading && "cursor-not-allowed opacity-70"
      )}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </Comp>
  )
}

export { Button, buttonVariants }
