import { cva } from "class-variance-authority";

/**
 * A choice in a row of choices: a filter, a view, a toggle. The chosen one is
 * solid lime with an ink edge and a small hard shadow, and says so with
 * `aria-pressed` (round 2, Oct 15 2026: the tinted pick read as nothing
 * chosen). One look for every such row on the site.
 */
export const choiceVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-1.5 border-2 px-4 text-sm transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground",
  {
    variants: {
      on: {
        true: "border-foreground bg-primary font-bold text-primary-foreground shadow-hard-sm",
        false: "border-foreground bg-card text-foreground hover:bg-accent",
      },
    },
    defaultVariants: { on: false },
  },
);
