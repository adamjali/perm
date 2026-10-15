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
  const tile = cn("grid shrink-0 place-items-center", compact ? "size-8" : "size-10");
  const icon = compact ? "size-4" : "size-5";
  return (
    // Side by side only where the box itself has the room, wherever it sits.
    <div className={cn("@container", className)}>
      <ul className={cn("grid gap-2", !compact && "@md:grid-cols-2 @md:gap-4")}>
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className={cn(tile, "bg-tint")}>
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
