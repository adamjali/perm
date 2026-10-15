"use client";

import { useId, useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { DateRuler } from "@/components/tools/DateRuler";
import { RuleNotes } from "@/components/tools/RuleNotes";
import { calculateRFIDueDate, RFI_DUE_DAYS } from "@/lib/perm";
import { daysBetween } from "@/lib/time";

/**
 * The RFI and audit response deadline, from the date on DOL's letter.
 *
 * One input, the 30 days drawn as a ruler, and the count of days left. The regulation counts
 * from the date of the letter, not the day it was opened, so the label says
 * so. The canonical calculator does the arithmetic; this file only renders.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The reader's own calendar date. `toISOString()` is UTC, which after about 8 PM Eastern is already tomorrow. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const WEEKDAY = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long" });

export function RfiDeadlineCalculator() {
  const letterId = useId();
  const [letter, setLetter] = useState("");
  const today = useMemo(() => localToday(), []);

  const result = useMemo(() => {
    if (!DATE_RE.test(letter)) return null;
    try {
      const due = calculateRFIDueDate(letter);
      const left = daysBetween(today, due);
      const weekday = WEEKDAY(due);
      const weekend = weekday === "Saturday" || weekday === "Sunday";
      return { due, left, weekday, weekend };
    } catch {
      return null;
    }
  }, [letter, today]);

  return (
    <div className="object p-5 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div>
          <Label htmlFor={letterId}>Date on DOL&apos;s letter</Label>{" "}
          <DateInput id={letterId} value={letter} onChange={(e) => setLetter(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">The date printed on the RFI or audit letter, not the day it was opened.</p>
        </div>
      </div>{" "}

      <DateRuler
        className="mt-6"
        from={result ? letter : null}
        to={result ? result.due : null}
        fromLabel="Date on DOL's letter"
        toLabel={`Response due (day ${RFI_DUE_DAYS})`}
        today={today}
        emptyHint="Enter the letter's date"
      />{" "}

      {result ? (
        <div className="mt-4">
          {result.weekend ? (
            <p className="mb-4 flex items-start gap-2 bg-tint p-3 text-sm">
              <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> The 30th day is a {result.weekday}. The
              regulation does not move a deadline that lands on a weekend; send the response before it.
            </p>
          ) : null}{" "}
          {result.left < 0 ? (
            <p className="mb-4 flex items-start gap-2 bg-tint p-3 text-sm">
              <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> An application with no response is
              denied under 20 CFR 656.20, and the attorney of record should already be in contact with the Certifying Officer.
            </p>
          ) : null}{" "}
          <RuleNotes
            items={[
              "20 CFR 656.20(b): the employer must respond within 30 days of the date of the audit letter.",
              "20 CFR 656.20: an application whose employer does not respond is denied, and the employer may be placed in supervised recruitment for up to two years.",
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
