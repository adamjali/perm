"use client";

import { useId, useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui";
import { calculatePWDExpiration } from "@/lib/perm";

/**
 * When a prevailing wage determination expires, from its determination date.
 *
 * The rule in 20 CFR 656.40(c) is not "plus 90 days": a determination
 * issued between July 1 and April 1 runs to the next June 30, because the
 * OEWS wage year turns over then. The canonical calculator carries the
 * three cases; this file names which one applied so the reader can check it
 * against the regulation rather than trust the date.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The reader's own calendar date. `toISOString()` is UTC, which after about 8 PM Eastern is already tomorrow. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function whichRule(determination: string): string {
  const month = Number(determination.slice(5, 7));
  const day = Number(determination.slice(8, 10));
  if ((month === 4 && day >= 2) || month === 5 || month === 6) return "Issued between April 2 and June 30: valid for 90 days.";
  if (month >= 7) return "Issued between July 1 and December 31: valid until June 30 of the following year, when the wage year turns over.";
  return "Issued between January 1 and April 1: valid until June 30 of the same year, when the wage year turns over.";
}

export function PwdValidityCalculator() {
  const detId = useId();
  const [det, setDet] = useState("");
  const today = useMemo(() => localToday(), []);

  const result = useMemo(() => {
    if (!DATE_RE.test(det)) return null;
    try {
      const expires = calculatePWDExpiration(det);
      return { expires, left: daysBetween(today, expires), valid: daysBetween(det, expires), rule: whichRule(det) };
    } catch {
      return null;
    }
  }, [det, today]);

  return (
    <div className="border-2 border-border bg-card p-5 shadow-hard sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div>
          <Label htmlFor={detId}>Determination date</Label>{" "}
          <DateInput id={detId} value={det} onChange={(e) => setDet(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-xs text-muted-foreground">The date on the ETA-9141 determination, not the date it was requested.</p>
        </div>
      </div>{" "}

      {result ? (
        <div className="mt-6">
          {result.left < 0 ? (
            <p className="mb-4 flex items-start gap-2 border-2 border-border bg-background p-3 text-sm">
              <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> This determination expired {Math.abs(result.left)}{" "}
              {Math.abs(result.left) === 1 ? "day" : "days"} ago. A PERM that did not start recruitment or file inside the window needs a new
              wage request.
            </p>
          ) : null}{" "}
          <dl className="border-t-2 border-border">
            <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border [&>*]:min-w-0 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
              <dt className="text-base">
                Determination expires ({result.valid} days of validity)
                {result.left >= 0 ? <span className="text-foreground/70"> · {result.left} {result.left === 1 ? "day" : "days"} from today</span> : null}
              </dt>{" "}
              <dd className="font-heading text-xl font-black tabular-nums">{long(result.expires)}</dd>
            </div>
          </dl>{" "}
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">{result.rule}</p>{" "}
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            <li>20 CFR 656.40(c): a determination is valid for no less than 90 days and no more than one year, and the employer must file the application or begin recruitment inside that period.</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
