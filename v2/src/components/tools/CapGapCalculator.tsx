"use client";

import { useId, useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { DateRuler } from "@/components/tools/DateRuler";
import { RuleNotes } from "@/components/tools/RuleNotes";
import { formatInt } from "@/lib/format";
import { calculateCapGap, calculateOptUnemployment } from "@/lib/perm";
import { cn } from "@/lib/utils";

/**
 * Two F-1 dates, each from its regulation: how far the cap-gap carries a student's status and OPT to the H-1B, and
 * how many OPT unemployment days are left. The rules live in `@/lib/perm` (f1Dates); this file asks and draws.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const SELECT =
  "mt-1.5 block min-h-11 w-full min-w-0 border-2 border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const INPUT =
  "mt-1.5 min-h-11 w-full min-w-0 border-2 border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 bg-tint p-3 text-sm border-2 border-border">
      <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {children}
    </p>
  );
}

export function CapGapPart() {
  const ids = { opt: useId(), start: useId(), filed: useId(), approved: useId() };
  const [optEnds, setOptEnds] = useState("");
  const [start, setStart] = useState("");
  const [filed, setFiled] = useState("");
  const [approved, setApproved] = useState("");
  const today = useMemo(() => localToday(), []);
  const r = useMemo(() => {
    if (![optEnds, start, filed].every((d) => DATE_RE.test(d))) return null;
    try {
      return calculateCapGap({ optEnds, requestedStart: start, filed, ...(DATE_RE.test(approved) ? { approvedStart: approved } : {}) });
    } catch {
      return null;
    }
  }, [optEnds, start, filed, approved]);

  return (
    <div className="object p-5 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <div>
          <Label htmlFor={ids.opt}>OPT ends</Label>{" "}
          <DateInput id={ids.opt} value={optEnds} onChange={(e) => setOptEnds(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">The end date on the EAD.</p>
        </div>{" "}
        <div>
          <Label htmlFor={ids.start}>H-1B start asked for</Label>{" "}
          <DateInput id={ids.start} value={start} onChange={(e) => setStart(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">Usually October 1.</p>
        </div>{" "}
        <div>
          <Label htmlFor={ids.filed}>H-1B petition filed</Label>{" "}
          <DateInput id={ids.filed} value={filed} onChange={(e) => setFiled(e.target.value)} className="mt-1.5" />
        </div>{" "}
        <div>
          <Label htmlFor={ids.approved}>Approved start (optional)</Label>{" "}
          <DateInput id={ids.approved} value={approved} onChange={(e) => setApproved(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">Once USCIS approves it.</p>
        </div>
      </div>{" "}
      <DateRuler
        className="mt-6"
        from={r ? optEnds : null}
        to={r ? r.until : null}
        fromLabel="OPT ends"
        toLabel={r?.byApproval ? "Extended until the approved start" : "Extended until"}
        today={today}
        leftWord="to go"
        marks={r && !r.byApproval ? [{ at: start, label: "H-1B start asked for", tone: "good" as const }] : []}
        emptyHint="Enter the OPT end, the H-1B start and the filing date"
      />{" "}
      {r ? (
        <div className="mt-4">
          {!r.gap ? <Note>The OPT runs past the H-1B start, so there is no gap to bridge.</Note> : null}
          {!r.optValidAtFiling ? (
            <Note>
              The OPT had ended by the day the petition was filed. The rule extends the student&apos;s status and the OPT work
              authorization the student holds; with the OPT over, there&apos;s none to extend. Ask the school&apos;s DSO what
              the record shows.
            </Note>
          ) : null}
          <p className="mt-4 text-base leading-relaxed">
            For the fiscal year {r.fiscalYear} cap, the extension runs until <strong>{long(r.until)}</strong>
            {r.byApproval
              ? ", the approved petition's start date, which comes before April 1."
              : " while the petition is pending. Once it's approved, it runs until the approved start date if that's earlier."}{" "}
            It ends at once if the petition, or the change of status in it, is rejected, denied, revoked or withdrawn.
          </p>{" "}
          <RuleNotes
            items={[
              "8 CFR 214.2(f)(5)(vii)(A): an F-1 student named in a timely filed, nonfrivolous H-1B cap petition asking for a change of status keeps the status and any OPT work authorization until April 1 of that fiscal year, or the approved petition's start date if earlier.",
              "8 CFR 214.2(f)(5)(vii)(B): the extension ends on the petition's rejection, denial, revocation or withdrawal, or the change of status being denied or withdrawn.",
              "April 1 since the H-1B modernization rule, 89 FR 103054, effective January 17, 2025. It was October 1 before.",
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

export function OptDaysPart() {
  const ids = { stem: useId(), used: useId(), since: useId() };
  const [stem, setStem] = useState("no");
  const [used, setUsed] = useState("");
  const [since, setSince] = useState("");
  const today = useMemo(() => localToday(), []);
  const usedNum = used.trim() === "" ? 0 : Number(used);
  const bad = !Number.isFinite(usedNum) || usedNum < 0 || usedNum > 400;
  const r = useMemo(() => {
    if (bad || (used.trim() === "" && !DATE_RE.test(since))) return null;
    try {
      return calculateOptUnemployment({ stem: stem === "yes", usedBefore: usedNum, ...(DATE_RE.test(since) ? { unemployedSince: since } : {}), today });
    } catch {
      return null;
    }
  }, [bad, used, since, stem, usedNum, today]);
  const share = r ? Math.min(1, r.used / r.limit) : 0;

  return (
    <div className="object p-5 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <div>
          <Label htmlFor={ids.stem}>STEM extension granted</Label>{" "}
          <select id={ids.stem} value={stem} onChange={(e) => setStem(e.target.value)} className={SELECT}>
            <option value="no">No: post-completion OPT</option>
            <option value="yes">Yes: 24-month STEM OPT</option>
          </select>
        </div>{" "}
        <div>
          <Label htmlFor={ids.used}>Days without work so far</Label>{" "}
          <input
            id={ids.used}
            type="number"
            inputMode="numeric"
            min={0}
            max={400}
            value={used}
            onChange={(e) => setUsed(e.target.value)}
            placeholder="0"
            className={INPUT}
          />{" "}
          <p className="mt-1 text-sm text-muted-foreground">Before any stretch going on now.</p>
        </div>{" "}
        <div>
          <Label htmlFor={ids.since}>Without work since (optional)</Label>{" "}
          <DateInput id={ids.since} value={since} onChange={(e) => setSince(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">The first day of a stretch going on now.</p>
        </div>
      </div>{" "}
      {bad ? <Note>Days must be a whole number from 0 to 400.</Note> : null}{" "}
      <figure className="mt-6 bg-tint p-4 sm:p-5 border-2 border-border">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <p className="text-sm text-muted-foreground">Unemployment days used</p>{" "}
          <p className="font-heading text-2xl font-bold tabular-nums sm:text-3xl">
            {r ? `${formatInt(r.used)} of ${formatInt(r.limit)}` : <span aria-hidden="true" className="inline-block h-6 w-28 bg-foreground/10 align-middle" />}
          </p>
        </div>{" "}
        <div aria-hidden="true" className="relative mt-4 h-10 border border-input">
          {r ? (
            <div className={cn("absolute inset-y-0 left-0", r.over ? "bg-data-bad" : "bg-foreground")} style={{ width: `${share * 100}%` }} />
          ) : (
            <div className="flex h-full items-center justify-center bg-hatch">
              <span className="bg-background px-2 text-sm font-bold text-muted-foreground">Enter the days used</span>
            </div>
          )}
        </div>{" "}
        {r ? (
          <p className="mt-4 border-t-2 border-border pt-3 text-base">
            {r.over ? (
              <>
                <strong>Over the limit</strong> by {formatInt(r.used - r.limit)} {r.used - r.limit === 1 ? "day" : "days"}.
              </>
            ) : (
              <>
                <span className="font-heading text-3xl font-bold tabular-nums">{formatInt(r.left)}</span> {r.left === 1 ? "day" : "days"} left
                {r.lastDay ? (
                  <>
                    . Without work from here on, day {formatInt(r.limit)} is <strong>{long(r.lastDay)}</strong>.
                  </>
                ) : (
                  "."
                )}
              </>
            )}
          </p>
        ) : null}
      </figure>{" "}
      {r ? (
        <div className="mt-4">
          <RuleNotes
            items={[
              "8 CFR 214.2(f)(10)(ii)(E): no more than 90 days of unemployment in all during post-completion OPT; 150 in all once a 24-month STEM extension is granted, the first OPT period included.",
              "The rule counts days of unemployment, not working days. Which days count as employment is the record the school's DSO keeps.",
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
