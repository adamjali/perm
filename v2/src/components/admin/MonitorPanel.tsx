"use client";

/**
 * The admin page's Monitor tab: the newest daily operator report
 * (convex/dailyReport.ts) and two weeks of verdicts. The same report the
 * morning email carries, sections needing a person first.
 */

import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import {
  type DailyReport,
  type SectionStatus,
  STATUS_RANK,
  dayLabel,
  readReport,
} from "../../../convex/lib/dailyReportCompose";
import { Skeleton } from "@/components/ui/skeleton";

const WORD: Record<SectionStatus, string> = {
  fail: "Failing",
  warn: "Watch",
  unknown: "Unread",
  off: "Off",
  ok: "OK",
};

const CHIP: Record<SectionStatus, string> = {
  fail: "bg-destructive text-background",
  warn: "bg-data-warn-ink text-background",
  unknown: "bg-muted text-foreground",
  off: "bg-muted text-foreground",
  ok: "bg-primary text-primary-foreground",
};

const asStatus = (s: string): SectionStatus => (s in STATUS_RANK ? (s as SectionStatus) : "unknown");

export function MonitorPanel() {
  const data = useQuery(api.dailyReport.latest);
  if (data === undefined) return <Skeleton className="h-96" />;
  const report: DailyReport | null = readReport(data.report);
  if (!report) {
    return (
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-xl font-black">Daily monitor</h2>{" "}
        <p className="mt-2 text-base text-muted-foreground">
          No report yet. The first one arrives the morning after the daily-monitor workflow is live, around 7:30 AM
          Eastern.
        </p>
      </section>
    );
  }
  const sections = [...report.sections].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);

  return (
    <div className="space-y-6">
      <section aria-labelledby="monitor-h" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="monitor-h" className="font-heading text-xl font-black">
          {`Daily report, ${dayLabel(report.day)}`}
        </h2>{" "}
        <ol className="mt-4 flex flex-wrap gap-2" aria-label="Verdicts, newest first">
          {data.history.map((h) => (
            <li
              key={h.day}
              className={`border-2 border-border px-2 py-1 text-sm font-bold ${CHIP[asStatus(h.overall)]}`}
            >
              {`${dayLabel(h.day)}: ${WORD[asStatus(h.overall)]}`}{" "}
            </li>
          ))}
        </ol>
      </section>{" "}
      <ul className="space-y-4">
        {sections.map((s) => (
          <li key={s.key} className="border-2 border-border bg-card p-4 shadow-hard-sm sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`border-2 border-border px-2 py-0.5 text-sm font-black uppercase ${CHIP[s.status]}`}>
                {WORD[s.status]}
              </span>{" "}
              <h3 className="font-heading text-lg font-black">{s.title}</h3>{" "}
              <p className="text-base">{s.summary}</p>
            </div>{" "}
            {s.lines.length > 0 ? (
              <ul className="mt-3 space-y-1 border-l-2 border-border pl-3 font-mono text-sm">
                {s.lines.map((l, i) => (
                  <li key={i}>{l} </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
