import { PageSection } from "@/components/data/PageSection";
import { formatInt } from "@/lib/format";
import { shortDate } from "@convex/lib/months";
import { HISTORY_FROM, statusHistory, type StatusEvent } from "@/lib/statusHistory";
import { CASE_STATUS_FILL, caseStatusTint, prettyStatus } from "@/lib/statusTone";
import { cn } from "@/lib/utils";

/**
 * Every status DOL's record showed for this case, oldest first, each with the day it changed and how long it
 * held. Nothing renders until our checks have seen the case change at least once. DOL's status words are marked
 * not to be translated, as the rest of the case page does.
 */
export function StatusHistory({
  events,
  filedOn = null,
}: {
  events: readonly StatusEvent[] | null;
  filedOn?: string | null;
}) {
  const steps = events ? statusHistory(events, filedOn) : [];
  if (steps.length === 0) return null;
  const day = (d: string) => shortDate(d) ?? d;
  const now = steps.length - 1;
  return (
    <PageSection
      title="Every status DOL has shown"
      lede={`Each change dated to the day DOL made it, as our checks saw it. Our dated record runs from ${day(HISTORY_FROM)}.`}
      id="history"
    >
      <ol className="relative max-w-3xl before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-border">
        {steps.map((s, i) => (
          <li
            key={`${s.status}-${s.since ?? "start"}`}
            className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4 pb-5 last:pb-0 sm:grid-cols-[1rem_9rem_minmax(0,1fr)]"
          >
            <span
              aria-hidden="true"
              className={cn("relative mt-1 size-4 border-2 border-foreground", CASE_STATUS_FILL[caseStatusTint(s.status)])}
            />{" "}
            <span className="font-mono text-sm tabular-nums text-soft max-sm:col-start-2">
              {s.since === null ? `By ${day(HISTORY_FROM)}` : s.filed ? `Filed ${day(s.since)}` : day(s.since)}
            </span>{" "}
            <span className="min-w-0 max-sm:col-start-2">
              <span className="block font-semibold">
                <span translate="no">{prettyStatus(s.status)}</span>
                {i === now ? <span className="font-normal text-soft">{" "}(now)</span> : null}
              </span>{" "}
              {s.days !== null ? (
                <span className="block text-sm text-soft">{`Held for ${formatInt(s.days)} ${s.days === 1 ? "day" : "days"}`}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </PageSection>
  );
}
