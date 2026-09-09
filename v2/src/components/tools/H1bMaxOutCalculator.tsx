"use client";

import { useId, useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui";
import { calculateH1bMaxOut, PERM_ADVANCE_DAYS, type H1bMaxOutResult } from "@/lib/perm";

type Outcome = { kind: "error"; error: string } | { kind: "ok"; r: H1bMaxOutResult; warnings: string[] };

/**
 * The H-1B six-year limit against the PERM 365-day rule.
 *
 * Three inputs, all optional past the first: the day H-1B status began, days
 * spent outside the country (recapturable), and the PERM's filing date or
 * the date it is planned for. The answer is two dates and a verdict on the
 * third input, with the citations under it. Warnings sit above the dates:
 * a date computed from a doubtful input must not read as more certain than
 * the doubt about the input.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The reader's own calendar date. `toISOString()` is UTC, which after about 8 PM Eastern is already tomorrow. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const int = (n: number) => n.toLocaleString("en-US");
const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export function H1bMaxOutCalculator() {
  const startId = useId();
  const outsideId = useId();
  const permId = useId();
  const [start, setStart] = useState("");
  const [outside, setOutside] = useState("");
  const [perm, setPerm] = useState("");
  const today = useMemo(() => localToday(), []);

  const result = useMemo((): Outcome | null => {
    if (!DATE_RE.test(start)) return null;
    const days = outside.trim() === "" ? 0 : Number(outside);
    if (!Number.isFinite(days) || days < 0 || days > 2200) return { kind: "error", error: "Days outside must be a whole number between 0 and 2,200." };
    try {
      const r = calculateH1bMaxOut({ h1bStart: start, daysOutside: Math.floor(days), ...(DATE_RE.test(perm) ? { permFiled: perm } : {}) }, today);
      const warnings: string[] = [];
      if (start > today) warnings.push("The H-1B start date is in the future; the dates below assume status begins then.");
      if (DATE_RE.test(perm) && perm < start) warnings.push("The PERM filing date is before H-1B status began. Check both dates.");
      if (r.daysOfMargin !== null && r.daysOfMargin < 0) {
        warnings.push(
          `The last day to file a PERM under the 365-day rule was ${long(r.permFileBy)}. A one-year extension under section 106(a) now depends on a filing already made; a three-year extension under 104(c) needs an approved I-140 with no visa number available.`,
        );
      }
      return { kind: "ok", r, warnings };
    } catch {
      return { kind: "error", error: "Enter dates as YYYY-MM-DD." };
    }
  }, [start, outside, perm, today]);

  return (
    <div className="border-2 border-border bg-card p-5 shadow-hard sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <div>
          <Label htmlFor={startId}>First day of H-1B status</Label>{" "}
          <DateInput id={startId} value={start} onChange={(e) => setStart(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-xs text-muted-foreground">Or the earliest H-1B or L-1 start if the six years combine.</p>
        </div>{" "}
        <div>
          <Label htmlFor={outsideId}>Days outside the U.S. (optional)</Label>{" "}
          <input
            id={outsideId}
            type="number"
            inputMode="numeric"
            min={0}
            max={2200}
            value={outside}
            onChange={(e) => setOutside(e.target.value)}
            placeholder="0"
            className="mt-1.5 min-h-11 w-full min-w-0 border-2 border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />{" "}
          <p className="mt-1 text-xs text-muted-foreground">Time abroad during H-1B status can be recaptured.</p>
        </div>{" "}
        <div>
          <Label htmlFor={permId}>PERM filing date (optional)</Label>{" "}
          <DateInput id={permId} value={perm} onChange={(e) => setPerm(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-xs text-muted-foreground">Filed, or the date it is planned for.</p>
        </div>
      </div>{" "}

      {result?.kind === "error" ? (
        <p className="mt-5 flex items-start gap-2 border-2 border-border bg-background p-3 text-sm">
          <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {result.error}
        </p>
      ) : null}{" "}

      {result?.kind === "ok" ? (
        <div className="mt-6">
          {result.warnings.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {result.warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 border-2 border-border bg-background p-3 text-sm">
                  <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {w}
                </li>
              ))}
            </ul>
          ) : null}{" "}
          <dl className="border-t-2 border-border">
            <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border [&>*]:min-w-0 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
              <dt className="text-base">Last day in H-1B status (six-year limit{Number(outside) > 0 ? `, plus ${int(Math.floor(Number(outside)))} recaptured days` : ""})</dt>{" "}
              <dd className="font-heading text-xl font-black tabular-nums">{long(result.r.maxOutDate)}</dd>
            </div>{" "}
            <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border [&>*]:min-w-0 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
              <dt className="text-base">
                Last day to file the PERM for the 365-day rule
                {result.r.daysOfMargin !== null && result.r.daysOfMargin >= 0 ? (
                  <span className="text-foreground/70"> · {int(result.r.daysOfMargin)} days from today</span>
                ) : null}
              </dt>{" "}
              <dd className="font-heading text-xl font-black tabular-nums">{long(result.r.permFileBy)}</dd>
            </div>{" "}
            {result.r.perm ? (
              <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border [&>*]:min-w-0 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
                <dt className="text-base">
                  A PERM filed {long(result.r.perm.filed)} is {int(result.r.perm.daysBeforeMaxOut)} days before the limit
                </dt>{" "}
                <dd className={`font-heading text-xl font-black ${result.r.perm.qualifies ? "" : "text-foreground/70"}`}>
                  {result.r.perm.qualifies ? "Meets the 365-day rule" : `Short by ${int(PERM_ADVANCE_DAYS - result.r.perm.daysBeforeMaxOut)} days`}
                </dd>
              </div>
            ) : null}
          </dl>{" "}
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            {result.r.citations.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
