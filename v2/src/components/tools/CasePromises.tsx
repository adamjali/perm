import { BellRingingIcon, CalendarCheckIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * The two things a case number gets someone waiting, said before they type it:
 * when the case will likely be decided, and an email when DOL moves it. Those
 * are the reasons people come, so every case-lookup box names them, and the
 * bell sits on the lime because following the case is the step most worth
 * taking.
 *
 * The two squares are one pair: the same size and ink edge, the glyph more than
 * half the square so it reads at a glance (a 16px countdown clock in a 32px
 * square read as a smudge), and theme colours so neither vanishes on a dark
 * card. A day ticked on a calendar says "decided on a date", which is what the estimate
 * gives. Both squares are filled, so they read as badges: an outlined one beside
 * the lime read as an unticked checkbox.
 */
export function CasePromises({ compact = false, className }: { compact?: boolean; className?: string }) {
  const text = cn("text-balance font-semibold leading-snug", compact ? "text-sm" : "text-base");
  const tile = cn("grid shrink-0 place-items-center border-2 border-foreground", compact ? "size-9" : "size-11");
  const icon = compact ? "size-6" : "size-7";
  return (
    // Side by side only where the box itself has the room, wherever it sits.
    <div className={cn("@container", className)}>
      {/* A row that wraps, the two promises side by side at their own width:
          a two-column grid spread them to opposite edges of a wide box. */}
      <ul className={cn("flex flex-col gap-2.5", !compact && "@md:flex-row @md:flex-wrap @md:gap-x-10 @md:gap-y-3")}>
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className={cn(tile, "bg-foreground text-background")}>
            <CalendarCheckIcon weight="bold" className={icon} />
          </span>{" "}
          <span className={text}>When it&apos;ll likely be decided</span>
        </li>{" "}
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className={cn(tile, "bg-primary text-black")}>
            <BellRingingIcon weight="bold" className={icon} />
          </span>{" "}
          <span className={text}>An email when DOL moves it</span>
        </li>
      </ul>
    </div>
  );
}
