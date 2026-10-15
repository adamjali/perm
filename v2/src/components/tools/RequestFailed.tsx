"use client";

import type { FetchFailure } from "@/lib/fetchFailure";
import { buttonVariants } from "@/components/ui/button";

/**
 * One failed public request, said the way the server said it.
 *
 * Replaces the per-page "didn't load, reloading usually clears it" lines,
 * which named no cause and gave the one piece of advice that is wrong under a
 * rate limit. `what` names the thing that didn't load ("The search", "The
 * live list"); the reason and the wait come from `failure`. The button asks
 * again in place, so nobody has to reload a page and lose what they typed.
 */
export function RequestFailed({
  what,
  failure,
  onRetry,
  after,
  className = "bg-tint p-4 border-2 border-border",
}: {
  what: string;
  failure: FetchFailure | null;
  onRetry?: () => void;
  /** An extra sentence, e.g. what still works while this is down. */
  after?: string;
  className?: string;
}) {
  const reason = failure?.message ?? "The request didn't come back. Try again.";
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <p className="min-w-0 flex-1 text-base leading-relaxed [overflow-wrap:anywhere]">
        <span className="font-bold">{what} didn&apos;t load.</span> {reason}
        {after ? ` ${after}` : ""}
      </p>{" "}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={buttonVariants({ variant: "outline", size: "default", className: "shrink-0" })}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
