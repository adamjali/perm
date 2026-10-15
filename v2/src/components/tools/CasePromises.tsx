import { BellRingingIcon, ClockCountdownIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * The two things a case number gets someone waiting, said before they type it:
 * when the case will likely be decided, and an email the day DOL moves it.
 * Those are the reasons people come, so every case-lookup box names them, and
 * the bell sits on the lime because following the case is the step most worth
 * taking.
 */
export function CasePromises({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <ul className={cn("grid gap-2", !compact && "sm:grid-cols-2 sm:gap-4", className)}>
      <li className="flex items-center gap-3">
        <span aria-hidden="true" className={cn("grid shrink-0 place-items-center bg-tint", compact ? "size-8" : "size-10")}>
          <ClockCountdownIcon weight="bold" className={compact ? "size-4" : "size-5"} />
        </span>{" "}
        <span className={cn("font-semibold leading-snug", compact ? "text-sm" : "text-base")}>
          When it&apos;ll likely be decided
        </span>
      </li>{" "}
      <li className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn("grid shrink-0 place-items-center bg-primary text-black", compact ? "size-8" : "size-10")}
        >
          <BellRingingIcon weight="fill" className={compact ? "size-4" : "size-5"} />
        </span>{" "}
        <span className={cn("font-semibold leading-snug", compact ? "text-sm" : "text-base")}>
          An email the day DOL moves it
        </span>
      </li>
    </ul>
  );
}
