import { cva } from "class-variance-authority";

/**
 * A choice in a row of choices: a filter, a view, a toggle. The chosen one has
 * a green-ink edge on a tinted ground and says so with `aria-pressed`;
 * nothing inverts to black. One look for every such row on the site.
 */
export const choiceVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-1.5 border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground",
  {
    variants: {
      on: {
        true: "border-primary-text bg-tint font-semibold text-foreground",
        false: "border-input bg-card text-soft hover:border-foreground hover:text-foreground",
      },
    },
    defaultVariants: { on: false },
  },
);
