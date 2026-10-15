import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

/**
 * The site's buttons. The middle ground (Oct 15 2026, round 2): a 2px ink
 * edge and a small hard shadow, a lift of one pixel on hover and a press on
 * click (both only when the visitor allows motion), the fill darkening as it
 * does. The lime one is the main action. The focus ring is the green ink,
 * shown for the keyboard only.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-heading text-sm font-bold border-2 transition-[color,background-color,border-color,box-shadow,transform] duration-150 cursor-pointer disabled:pointer-events-none disabled:cursor-not-allowed disabled:shadow-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border-foreground bg-primary text-primary-foreground shadow-hard-sm hover:bg-primary-hover motion-safe:hover:-translate-y-px hover:shadow-hard active:bg-primary-press motion-safe:active:translate-x-px motion-safe:active:translate-y-px active:shadow-none",
        destructive:
          "border-foreground bg-destructive text-destructive-foreground shadow-hard-sm hover:bg-destructive/90 motion-safe:hover:-translate-y-px hover:shadow-hard active:bg-destructive/80 motion-safe:active:translate-x-px motion-safe:active:translate-y-px active:shadow-none",
        outline:
          "border-foreground bg-card text-foreground shadow-hard-sm hover:bg-accent motion-safe:hover:-translate-y-px hover:shadow-hard active:bg-muted motion-safe:active:translate-x-px motion-safe:active:translate-y-px active:shadow-none",
        secondary:
          "border-foreground bg-secondary text-secondary-foreground shadow-hard-sm hover:bg-accent motion-safe:hover:-translate-y-px hover:shadow-hard active:bg-muted motion-safe:active:translate-x-px motion-safe:active:translate-y-px active:shadow-none",
        ghost:
          "border-transparent text-foreground hover:bg-accent active:bg-muted",
        link: "border-transparent text-primary underline underline-offset-4 decoration-1 hover:decoration-2",
      },
      size: {
        // 44px (h-11) on touch screens; smaller from md, where a pointer is precise.
        default: "h-11 md:h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-11 md:h-9 gap-1.5 px-3 has-[>svg]:px-2.5",
        xs: "h-10 md:h-8 gap-1 px-2 text-sm has-[>svg]:px-1.5",
        lg: "h-12 px-6 text-base has-[>svg]:px-4",
        icon: "size-11 md:size-10",
        "icon-sm": "size-11 md:size-9",
        "icon-xs": "size-10 md:size-8",
        "icon-lg": "size-12",
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
        // Disabled reads as disabled at full contrast: grey fill, grey ink, a
        // quieter border. Fading the whole control to 50% turned the lime into
        // a washed pastel with unreadable text. A loading button keeps its own
        // colours, because the action is under way, not unavailable.
        disabled && !loading && "bg-muted text-muted-foreground border-border",
        loading && "cursor-wait"
      )}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </Comp>
  )
}

export { Button, buttonVariants }
