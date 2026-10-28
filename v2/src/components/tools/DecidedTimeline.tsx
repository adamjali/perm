import Link from "next/link";

import { PageSection } from "@/components/data/PageSection";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import { decidedTimeline, type TimelineTone } from "@/lib/decidedTimeline";
import type { DecidedTimelineRead } from "@/lib/db/decidedTimeline";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { shortDate } from "@convex/lib/months";

/** Each step's mark: the stage it belongs to (STAGE_VISUALS, the one map) and the outcome colour code. */
const MARK: Record<TimelineTone, string> = {
  pwd: STAGE_VISUALS.pwd.fill,
  recruitment: STAGE_VISUALS.recruitment.fill,
  quiet: cn("border-2 bg-hatch", STAGE_VISUALS.recruitment.border),
  filed: STAGE_VISUALS.eta9089.fill,
  certified: "bg-chart-green border-2 border-foreground",
  denied: "bg-destructive border-2 border-foreground",
  withdrawn: "bg-chart-purple border-2 border-foreground",
};

const day = (d: string) => shortDate(d) ?? d;

/**
 * A decided case from its wage request to DOL's decision, every date DOL's two files print,
 * with the quiet period's end and how soon after it the case went in. The wage request links
 * to its own page.
 */
export function DecidedTimeline({ read }: { read: DecidedTimelineRead | null }) {
  if (!read) return null;
  const t = decidedTimeline(read.record);
  if (t.steps.length < 3) return null;
  const { employees, since } = read.employer;
  const pwd = read.record.pwd;
  const facts = [
    employees ? `its size as ${formatInt(employees)} ${employees === 1 ? "employee" : "employees"}` : null,
    since ? `its founding year as ${since}` : null,
  ].filter(Boolean);
  return (
    <PageSection
      title="From wage request to decision"
      lede="Every date DOL's published files print for this case, in order."
      id="timeline"
    >
      <ol className="relative max-w-3xl before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-border">
        {t.steps.map((s) => (
          <li key={s.key} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4 pb-5 last:pb-0 sm:grid-cols-[1rem_9rem_minmax(0,1fr)]">
            <span aria-hidden="true" className={cn("relative mt-1 size-4", MARK[s.tone])} />{" "}
            <span className="font-mono text-sm tabular-nums text-soft max-sm:col-start-2">
              {s.until && s.until !== s.date ? `${day(s.date)} to ${day(s.until)}` : day(s.date)}
            </span>{" "}
            <span className="min-w-0 max-sm:col-start-2">
              <span className="block font-semibold">{s.label}</span>{" "}
              {s.detail ? (
                <span className={cn("block text-sm", s.key === "filed" ? "font-semibold text-foreground" : "text-soft")}>{s.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>{" "}
      {pwd || facts.length > 0 ? (
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-soft">
          {pwd ? (
            <>
              The wage request this case names:{" "}
              <Link href={`/perm-case-status?case=${encodeURIComponent(pwd.number)}`} className="link font-mono">
                {pwd.number}
              </Link>
              .{" "}
            </>
          ) : null}
          {facts.length > 0 ? `On the application, the employer gave ${facts.join(" and ")}.` : null}
        </p>
      ) : null}
    </PageSection>
  );
}
