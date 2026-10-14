import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

/**
 * The site's buttons. The lime one is the main action and there is one per
 * screen; it keeps a small hard edge in light mode, the only hard shadow left.
 * Hover and press darken the fill; nothing lifts or moves. The focus ring is
 * the green ink, shown for the keyboard only.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-heading text-sm font-bold border transition-colors duration-150 cursor-pointer disabled:pointer-events-none disabled:cursor-not-allowed disabled:shadow-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border-foreground bg-primary text-primary-foreground shadow-press hover:bg-primary-hover active:bg-primary-press",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border-input bg-card text-foreground hover:bg-accent active:bg-muted",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-accent active:bg-muted",
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
