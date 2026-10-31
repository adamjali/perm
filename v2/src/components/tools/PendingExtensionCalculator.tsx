"use client";

import { useId, useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { DateRuler } from "@/components/tools/DateRuler";
import { RuleNotes } from "@/components/tools/RuleNotes";
import { calculatePendingExtension, EXTENSION_PENDING_DAYS } from "@/lib/perm";

/**
 * The 240-day rule, 8 CFR 274a.12(b)(20): working for the same employer while a timely filed extension waits. The
 * rule is in `@/lib/perm` (f1Dates); this file asks for two dates and draws the 240 days.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export function PendingExtensionCalculator() {
  const ids = { end: useId(), filed: useId() };
  const [end, setEnd] = useState("");
  const [filed, setFiled] = useState("");
  const today = useMemo(() => localToday(), []);
  const r = useMemo(() => {
    if (!DATE_RE.test(end) || !DATE_RE.test(filed)) return null;
    try {
      return calculatePendingExtension({ i94Ends: end, extensionFiled: filed });
    } catch {
      return null;
    }
  }, [end, filed]);

  return (
    <div className="object p-5 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div>
          <Label htmlFor={ids.end}>I-94 end date</Label>{" "}
          <DateInput id={ids.end} value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">The end of the authorized stay.</p>
        </div>{" "}
        <div>
          <Label htmlFor={ids.filed}>Extension filed</Label>{" "}
          <DateInput id={ids.filed} value={filed} onChange={(e) => setFiled(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">The receipt date, by the same employer.</p>
        </div>
      </div>{" "}
      <DateRuler
        className="mt-6"
        from={r ? end : null}
        to={r ? r.lastDay : null}
        fromLabel="Stay ends"
        toLabel={`Day ${EXTENSION_PENDING_DAYS}`}
        inclusive
        today={today}
        emptyHint="Enter the I-94 end and the filing date"
      />{" "}
      {r ? (
        <div className="mt-4">
          {!r.filedInTime ? (
            <p className="mb-4 flex items-start gap-2 bg-tint p-3 text-sm border-2 border-border">
              <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> The extension was filed
              after the stay ended. The rule covers an extension timely filed, so these 240 days may not apply.
            </p>
          ) : null}
          <p className="text-base leading-relaxed">
            Counting the I-94&apos;s end date as day one, as &ldquo;beginning on the date of the expiration&rdquo; reads, day
            240 is <strong>{long(r.lastDay)}</strong>. Counted from the next day it&apos;s {long(r.lastDayCountingFromNext)}.
            A denial before then ends it at once.
          </p>{" "}
          <RuleNotes
            items={[
              "8 CFR 274a.12(b)(20): an H-1B, and the other listed classes, whose stay has expired but whose extension was timely filed may keep working for the same employer for up to 240 days beginning on the date the authorized stay expired.",
              "The same paragraph: a denial of the extension before the 240 days end ends the work authorization on notice of the denial.",
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
