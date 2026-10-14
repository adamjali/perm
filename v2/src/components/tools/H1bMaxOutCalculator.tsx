"use client";

import { useId, useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { DateRuler } from "@/components/tools/DateRuler";
import { RuleNotes } from "@/components/tools/RuleNotes";
import { calculateH1bMaxOut, PERM_ADVANCE_DAYS, type H1bMaxOutResult } from "@/lib/perm";
import { formatInt } from "@/lib/format";

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
    <div className="border border-border bg-card p-5 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <div>
          <Label htmlFor={startId}>First day of H-1B status</Label>{" "}
          <DateInput id={startId} value={start} onChange={(e) => setStart(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">Or the earliest H-1B or L-1 start if the six years combine.</p>
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
            className="mt-1.5 min-h-11 w-full min-w-0 border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />{" "}
          <p className="mt-1 text-sm text-muted-foreground">Time abroad during H-1B status can be recaptured.</p>
        </div>{" "}
        <div>
          <Label htmlFor={permId}>PERM filing date (optional)</Label>{" "}
          <DateInput id={permId} value={perm} onChange={(e) => setPerm(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">Filed, or the date it is planned for.</p>
        </div>
      </div>{" "}

      <DateRuler
        className="mt-6"
        from={result?.kind === "ok" ? start : null}
        to={result?.kind === "ok" ? result.r.maxOutDate : null}
        fromLabel="H-1B status began"
        toLabel={Number(outside) > 0 ? "Six years end, with days recaptured" : "Six years end"}
        today={today}
        marks={
          result?.kind === "ok"
            ? [
                { at: result.r.permFileBy, label: "File the PERM by", tone: "warn" as const },
                ...(result.r.perm
                  ? [{ at: result.r.perm.filed, label: "PERM filed", tone: result.r.perm.qualifies ? ("good" as const) : ("warn" as const) }]
                  : []),
              ]
            : []
        }
        emptyHint="Enter the first day of H-1B status"
      />{" "}

      {result?.kind === "error" ? (
        <p className="mt-5 flex items-start gap-2 border border-border bg-background p-3 text-sm">
          <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {result.error}
        </p>
      ) : null}{" "}

      {result?.kind === "ok" ? (
        <div className="mt-4">
          {result.warnings.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {result.warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 border border-border bg-background p-3 text-sm">
                  <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {w}
                </li>
              ))}
            </ul>
          ) : null}{" "}
          {result.r.perm ? (
            <dl className="mb-2 border-y border-border">
              <div className="grid grid-cols-1 gap-y-1 border-b border-border [&>*]:min-w-0 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
                <dt className="text-base">
                  A PERM filed {long(result.r.perm.filed)} is {formatInt(result.r.perm.daysBeforeMaxOut)} days before the limit
                </dt>{" "}
                <dd className={`font-heading text-xl font-bold ${result.r.perm.qualifies ? "" : "text-muted-foreground"}`}>
                  {result.r.perm.qualifies ? "Meets the 365-day rule" : `Short by ${formatInt(PERM_ADVANCE_DAYS - result.r.perm.daysBeforeMaxOut)} days`}
                </dd>
              </div>
            </dl>
          ) : null}{" "}
          <RuleNotes items={result.r.citations} />
        </div>
      ) : null}
    </div>
  );
}
