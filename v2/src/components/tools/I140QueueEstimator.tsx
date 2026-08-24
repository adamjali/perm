"use client";

/**
 * I-140 queue depth by petition subtype.
 *
 * Shows two numbers that disagree, on purpose. USCIS publishes a processing
 * time measured over petitions it has already decided, and separately publishes
 * how many are still stacked up. For the national interest waiver those are 29
 * to 32 months and roughly 42 months of queue, and the gap is the story: NIW
 * intake is outrunning its output, so the pile is growing. Reporting only the
 * published figure would understate it and reporting only the queue would
 * overstate it.
 *
 * The chart is proportional shares rather than a timeline, which is a different
 * question from the prevailing-wage backlog chart and so a different drawing.
 * One shared chart fed different numbers reads as filler.
 */

import { useId, useMemo, useState } from "react";
import { FileText, TrendingUp, TriangleAlert } from "lucide-react";

import { estimateI140Queue, type I140QuarterStats } from "@/lib/perm";
import {
  formatMonthRange,
  getI140ProcessingTime,
  type I140Category,
} from "@/lib/processing-times/i140ProcessingTimes";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface I140QueueEstimatorProps {
  subtypes: readonly I140QuarterStats[];
  asOfQuarter: string | null;
  sourceFile: string | null;
  className?: string;
}

/** Which category each USCIS subtype belongs to, for the published-time lookup. */
const CATEGORY_OF: Record<string, I140Category> = {
  E11: "EB-1",
  E12: "EB-1",
  E13: "EB-1",
  E21: "EB-2",
  NIW: "EB-2-NIW",
  E31: "EB-3",
  E32: "EB-3",
  EW3: "EB-3",
};

export function I140QueueEstimator({
  subtypes,
  asOfQuarter,
  sourceFile,
  className,
}: I140QueueEstimatorProps) {
  const selectId = useId();
  const [code, setCode] = useState<string>(() => subtypes[0]?.code || "NIW");

  const estimate = useMemo(() => {
    if (subtypes.length === 0) return null;
    try {
      return estimateI140Queue({ code, stats: subtypes, asOfQuarter: asOfQuarter || "" });
    } catch {
      // A subtype that vanished from a later USCIS publication reaches here
      // rather than throwing the page away.
      return null;
    }
  }, [code, subtypes, asOfQuarter]);

  const published = useMemo(() => {
    const category = CATEGORY_OF[code];
    if (!category) return null;
    const range = getI140ProcessingTime(category);
    if (!range) return null;
    return range.subtypes.find((s) => s.code === code) || null;
  }, [code]);

  if (subtypes.length === 0 || !estimate) {
    return (
      <div className={cn("border-2 border-border bg-card p-6 shadow-hard", className)}>
        <p className="text-base leading-relaxed">
          USCIS&apos;s quarterly I-140 figures are being fetched. Until they land,{" "}
          <a
            href="https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data"
            className="font-bold underline underline-offset-2 hover:text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            USCIS publishes them directly
          </a>
          .
        </p>
      </div>
    );
  }

  const maxPending = Math.max(...subtypes.map((s) => s.pending));

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        {/* The icon sits beside the heading only. Wrapping the copy in
            the icon flex indented it 36px against the form below, which
            reads as the inputs sticking out to the left. */}
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">
            How deep is the I-140 queue?
          </h2>
        </div>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Pick your petition type. The counts are USCIS&apos;s own, published
          quarterly.
        </p>

        <div className="mt-6">
          <Label htmlFor={selectId} className="text-sm font-bold">
            Petition type
          </Label>
          <select
            id={selectId}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-2 block min-h-[44px] w-full border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-md"
          >
            {subtypes.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-px border-b-2 border-border bg-border sm:grid-cols-2">
        <div className="bg-primary/10 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
            Petitions waiting
          </p>
          <p className="mt-2 font-heading text-4xl font-black leading-none">
            {estimate.pending.toLocaleString("en-US")}
          </p>
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            {Math.round(estimate.shareOfAllPending * 100)}% of every I-140 USCIS
            has pending.
          </p>
        </div>
        <div className="bg-card p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
            Decided last quarter
          </p>
          <p className="mt-2 font-heading text-4xl font-black leading-none">
            {estimate.completedInQuarter.toLocaleString("en-US")}
          </p>
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            Approvals and denials both, since either one clears a petition.
          </p>
        </div>
      </div>

      {/* The two figures side by side. They disagree, and the disagreement is
          the most useful thing on the page. */}
      <div className="grid gap-px border-b-2 border-border bg-border sm:grid-cols-2">
        {published ? (
          <div className="bg-card p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              USCIS published time
            </p>
            <p className="mt-2 font-heading text-2xl font-black leading-none">
              {formatMonthRange(published.lowMonths, published.highMonths)}
            </p>
            <p className="mt-3 text-base leading-relaxed text-foreground/70">
              Measured over petitions already decided.
            </p>
          </div>
        ) : null}
        {estimate.monthsToClear !== null ? (
          <div className="bg-card p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              Queue at this pace
            </p>
            <p className="mt-2 font-heading text-2xl font-black leading-none">
              {estimate.monthsToClear} months
            </p>
            <p className="mt-3 text-base leading-relaxed text-foreground/70">
              {estimate.pending.toLocaleString("en-US")} waiting divided by{" "}
              {estimate.completedInQuarter.toLocaleString("en-US")} a quarter.
            </p>
          </div>
        ) : null}
      </div>

      {estimate.backlogGrowing ? (
        <div className="flex items-start gap-3 border-b-2 border-border bg-muted p-6 sm:p-8">
          <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
          <p className="text-base leading-relaxed">
            <strong>This queue is growing.</strong>{" "}
            {estimate.receivedInQuarter.toLocaleString("en-US")} arrived last
            quarter against {estimate.completedInQuarter.toLocaleString("en-US")}{" "}
            decided, so the pile got {estimate.netChange.toLocaleString("en-US")}{" "}
            longer.
          </p>
        </div>
      ) : null}

      <div className="border-b-2 border-border p-6 sm:p-8">
        <h3 className="font-heading text-lg font-black">Where the backlog sits</h3>
        <p className="mt-2 text-base leading-relaxed text-foreground/70">
          Every I-140 petition type USCIS reports, and how many are waiting on
          each.
        </p>
        <ol className="mt-6 space-y-2">
          {[...subtypes]
            .sort((a, b) => b.pending - a.pending)
            .map((s) => (
              <li
                key={s.code}
                className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[16rem_1fr_5rem]"
              >
                <span
                  className={cn(
                    "truncate text-sm",
                    s.code === code ? "font-black" : "text-foreground/70",
                  )}
                >
                  <span className="sm:hidden">{s.code}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </span>
                <span className="h-6 w-full border-2 border-border bg-muted">
                  <span
                    className={cn(
                      "block h-full",
                      s.code === code ? "bg-primary" : "bg-foreground/25",
                    )}
                    style={{ width: `${Math.max((s.pending / maxPending) * 100, 1.5)}%` }}
                  />
                </span>
                <span
                  className={cn(
                    "text-right text-sm tabular-nums",
                    s.code === code ? "font-black" : "text-foreground/70",
                  )}
                >
                  {s.pending.toLocaleString("en-US")}
                </span>
              </li>
            ))}
        </ol>
      </div>

      <div className="bg-muted p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70" aria-hidden="true" />
          <div>
            <h3 className="font-heading text-base font-black">What this cannot tell you</h3>
            <ul className="mt-3 space-y-2">
              {estimate.caveats.map((c) => (
                <li key={c} className="text-base leading-relaxed text-foreground/70">
                  {c}
                </li>
              ))}
            </ul>
            {asOfQuarter ? (
              <p className="mt-4 text-sm text-foreground/60">
                USCIS counts for {asOfQuarter}
                {sourceFile ? `, from ${sourceFile}` : ""}.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
