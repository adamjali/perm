"use client";

import { useId, useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { DateRuler } from "@/components/tools/DateRuler";
import { RuleNotes } from "@/components/tools/RuleNotes";
import { calculatePWDExpiration } from "@/lib/perm";
import { daysBetween } from "@/lib/time";

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
    <div className="object p-5 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div>
          <Label htmlFor={detId}>Determination date</Label>{" "}
          <DateInput id={detId} value={det} onChange={(e) => setDet(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">The date on the ETA-9141 determination, not the date it was requested.</p>
        </div>
      </div>{" "}

      <DateRuler
        className="mt-6"
        from={result ? det : null}
        to={result ? result.expires : null}
        fromLabel="Determination issued"
        toLabel="Determination expires"
        today={today}
        emptyHint="Enter the determination date"
      />{" "}

      {result ? (
        <div className="mt-4">
          {result.left < 0 ? (
            <p className="mb-4 flex items-start gap-2 bg-tint p-3 text-sm">
              <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> A PERM that didn&apos;t start
              recruitment or file inside the window needs a new wage request.
            </p>
          ) : null}{" "}
          <p className="text-base leading-relaxed">{result.rule}</p>{" "}
          <RuleNotes
            items={[
              "20 CFR 656.40(c): a determination is valid for no less than 90 days and no more than one year, and the employer must file the application or begin recruitment inside that period.",
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
