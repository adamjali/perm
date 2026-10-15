import { BellRingingIcon, ClockCountdownIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * The two things a case number gets someone waiting, said before they type it:
 * when the case will likely be decided, and an email when DOL moves it. Those
 * are the reasons people come, so every case-lookup box names them, and the
 * bell sits on the lime because following the case is the step most worth
 * taking.
 */
export function CasePromises({ compact = false, className }: { compact?: boolean; className?: string }) {
  const text = cn("text-balance font-semibold leading-snug", compact ? "text-sm" : "text-base");
  const tile = cn("grid shrink-0 place-items-center border-2 border-black", compact ? "size-8" : "size-10");
  const icon = compact ? "size-4" : "size-5";
  return (
    // Side by side only where the box itself has the room, wherever it sits.
    <div className={cn("@container", className)}>
      {/* A row that wraps, the two promises side by side at their own width:
          a two-column grid spread them to opposite edges of a wide box. */}
      <ul className={cn("flex flex-col gap-2", !compact && "@md:flex-row @md:flex-wrap @md:gap-x-10 @md:gap-y-3")}>
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className={cn(tile, "bg-[#141414] text-primary")}>
            <ClockCountdownIcon weight="bold" className={icon} />
          </span>{" "}
          <span className={text}>When it&apos;ll likely be decided</span>
        </li>{" "}
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className={cn(tile, "bg-primary text-black")}>
            <BellRingingIcon weight="fill" className={icon} />
          </span>{" "}
          <span className={text}>An email when DOL moves it</span>
        </li>
      </ul>
    </div>
  );
}
