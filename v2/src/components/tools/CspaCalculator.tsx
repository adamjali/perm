"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { CheckCircleIcon, WarningIcon, XCircleIcon, HourglassMediumIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { DateRuler } from "@/components/tools/DateRuler";
import { RequestFailed } from "@/components/tools/RequestFailed";
import { RuleNotes } from "@/components/tools/RuleNotes";
import { usePublicQuery } from "@/hooks/usePublicQuery";
import { formatInt } from "@/lib/format";
import { calculateCspa, CSPA_FINAL_ACTION_POLICY_FROM, parseCutoff, type Age, type ChartKind, type CountryKey, type CspaResult } from "@/lib/perm";
import { bulletinsOf, type BulletinLine, type LineChartSet } from "@/lib/bulletinLineHistory";
import { cn } from "@/lib/utils";

/**
 * Whether a child still counts as under 21 for a parent's green card, by the Child Status Protection Act.
 *
 * The reader gives the dates on their own papers (the child's birth, the petition's receipt and approval, the
 * priority date, and when the child filed, if they have); the line's history comes from the bulletin archive, one
 * line at a time. The answer is the CSPA age, the day the visa counted as available, and the deadline that matters
 * now. Every rule lives in `calculateCspa`; this file only asks for the dates and draws the answer.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The reader's own calendar date. `toISOString()` is UTC, which after about 8 PM Eastern is already tomorrow. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const COUNTRIES: { code: CountryKey; label: string }[] = [
  { code: "worldwide", label: "All other countries" },
  { code: "india", label: "India" },
  { code: "china", label: "China (mainland born)" },
  { code: "mexico", label: "Mexico" },
  { code: "philippines", label: "Philippines" },
];

const CATEGORY_LABELS: Record<string, string> = {
  EB1: "EB-1",
  EB2: "EB-2",
  EB3: "EB-3",
  EW3: "EB-3 other workers",
  EB4: "EB-4",
  EB5: "EB-5 unreserved",
  EB5R: "EB-5 rural",
  EB5HU: "EB-5 high unemployment",
  EB5I: "EB-5 infrastructure",
  F1: "F1 (unmarried sons and daughters of citizens)",
  F2A: "F2A (spouses and children of residents)",
  F2B: "F2B (adult children of residents)",
  F3: "F3 (married sons and daughters of citizens)",
  F4: "F4 (brothers and sisters of citizens)",
};

const SELECT =
  "mt-1.5 block min-h-11 w-full min-w-0 border-2 border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const monthLong = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });

function ageWords(a: Age): string {
  const part = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return [part(a.years, "year"), part(a.months, "month"), part(a.days, "day")].join(", ");
}

type Tone = "good" | "bad" | "wait";

/** The answer in one line, and a sentence under it saying what it rests on. */
function verdict(r: CspaResult, pd: string): { tone: Tone; head: string; body: string } {
  const w = r.counted;
  const lastDay = r.lastQualifyingDay ? long(r.lastQualifyingDay) : null;
  switch (r.status) {
    case "pending-petition":
      return {
        tone: "wait",
        head: "The petition is still pending",
        body: `Every day it waits comes off the child's age. Approved today, a visa would have to become available by ${long(r.lastQualifyingDayIfApprovedToday!)} for the child to count as under 21, and that day moves later each day it waits.`,
      };
    case "not-yet-available":
      return {
        tone: "wait",
        head: `Under 21 if a visa is available by ${lastDay}`,
        body: `The Final Action chart hasn't reached a priority date of ${long(pd)} since the petition was approved. A bulletin month starting on or before ${lastDay} that shows it current keeps the child under 21; then the child has a year to file.`,
      };
    case "filed-waiting":
      return {
        tone: "wait",
        head: `Filed. Under 21 if the Final Action chart reaches the date by ${lastDay}`,
        body: "Filing counts as seeking to acquire, so the one-year rule is met. The age is fixed on the first day the Final Action chart shows the priority date current.",
      };
    case "open":
      return w!.underTwentyOne
        ? {
            tone: "good",
            head: `Under 21 if the child files by ${long(w!.seekBy)}`,
            body: `The visa counted as available on ${long(w!.availableFrom)}, so the CSPA age is ${ageWords(w!.cspaAge!)}. Filing within a year of that day fixes it.`,
          }
        : {
            tone: "bad",
            head: `21 or over on this availability: ${ageWords(w!.cspaAge!)}`,
            body: `The visa counted as available on ${long(w!.availableFrom)}. Less the days the petition was pending, the child was already 21.`,
          };
    case "locked":
      return w!.underTwentyOne
        ? {
            tone: "good",
            head: `Counts as a child: CSPA age ${ageWords(w!.cspaAge!)}`,
            body: `The age was fixed on ${long(w!.availableFrom)}, the day the visa counted as available, and the child sought to acquire within the year. It holds through the decision as long as the child stays unmarried.`,
          }
        : {
            tone: "bad",
            head: `Aged out: CSPA age ${ageWords(w!.cspaAge!)}`,
            body: `On ${long(w!.availableFrom)}, the day the visa counted as available, the child was 21 or over even after the pending days came off.`,
          };
    case "lost":
      return {
        tone: "bad",
        head: "The year to file passed",
        body: `The visa was available every month from ${long(w!.availableFrom)} through ${long(w!.seekBy)}. If the child filed nothing in that year, the CSPA age no longer applies unless USCIS finds extraordinary circumstances. If the child did file, enter the date above.`,
      };
  }
}

const TONE: Record<Tone, { box: string; Icon: typeof CheckCircleIcon }> = {
  good: { box: "bg-soft-good", Icon: CheckCircleIcon },
  bad: { box: "bg-soft-bad", Icon: XCircleIcon },
  wait: { box: "bg-soft-wait", Icon: HourglassMediumIcon },
};

export function CspaCalculator({
  employmentCategories,
  familyCategories,
}: {
  employmentCategories: readonly string[];
  familyCategories: readonly string[];
}) {
  // Read in the browser: nothing below uses it until the reader has entered dates, so the server render never does.
  const today = useMemo(() => localToday(), []);
  const ids = {
    birth: useId(),
    set: useId(),
    category: useId(),
    country: useId(),
    pd: useId(),
    filed: useId(),
    approved: useId(),
    sought: useId(),
    chart: useId(),
  };
  const [birth, setBirth] = useState("");
  const [set, setSet] = useState<LineChartSet>("employment");
  const [category, setCategory] = useState(employmentCategories.includes("EB2") ? "EB2" : (employmentCategories[0] ?? ""));
  const [country, setCountry] = useState<CountryKey>("india");
  const [pd, setPd] = useState("");
  const [filed, setFiled] = useState("");
  const [approved, setApproved] = useState("");
  const [sought, setSought] = useState("");
  const [chart, setChart] = useState<ChartKind>("finalAction");

  const categories = set === "family" ? familyCategories : employmentCategories;
  const formerPolicyFiling = DATE_RE.test(sought) && sought < CSPA_FINAL_ACTION_POLICY_FROM;
  const usedChart: ChartKind = formerPolicyFiling ? chart : "finalAction";

  const ready = DATE_RE.test(birth) && DATE_RE.test(pd) && DATE_RE.test(filed) && category !== "";
  const line = usePublicQuery<{ ok: true; line: BulletinLine }>(
    ready ? `/api/bulletin-line?set=${set}&category=${encodeURIComponent(category)}&country=${country}` : "skip",
  );

  const outcome = useMemo(() => {
    if (!ready || !line.data) return null;
    try {
      const r = calculateCspa({
        birthDate: birth,
        petitionFiled: filed,
        ...(DATE_RE.test(approved) ? { petitionApproved: approved } : {}),
        priorityDate: pd,
        category,
        country,
        bulletins: bulletinsOf(line.data.line),
        ...(DATE_RE.test(sought) ? { soughtToAcquire: sought } : {}),
        chart: usedChart,
        today,
      });
      const warnings: string[] = [];
      if (pd > filed) warnings.push("The priority date is after the petition's receipt date. A priority date is usually the receipt date or earlier; check both.");
      if (birth > filed) warnings.push("The child was born after the petition was filed. A child born later can still be a derivative; the arithmetic below is the same.");
      if (DATE_RE.test(sought) && sought > today) warnings.push("The filing date is in the future; the answer below assumes the child files then.");
      return { kind: "ok" as const, r, warnings };
    } catch (e) {
      const message = e instanceof Error && /approved before/.test(e.message) ? "The approval date is before the receipt date. Check both." : "Enter each date as it appears on the notice.";
      return { kind: "error" as const, message };
    }
  }, [ready, line.data, birth, filed, approved, pd, category, country, sought, usedChart, today]);

  const r = outcome?.kind === "ok" ? outcome.r : null;
  // The newest cutoff on the chart the answer reads, in words: how far the line has to go.
  const newest = useMemo(() => {
    const months = line.data?.line.months ?? [];
    const last = months[months.length - 1];
    if (!last) return null;
    const cutoff = parseCutoff((usedChart === "finalAction" ? last.finalAction : last.datesForFiling) ?? undefined);
    if (!cutoff) return null;
    const words = cutoff.kind === "current" ? "Current (C)" : cutoff.kind === "unavailable" ? "Unavailable (U)" : long(cutoff.iso);
    return { month: last.month, words };
  }, [line.data, usedChart]);
  const v = r ? verdict(r, pd) : null;

  return (
    <div className="object p-5 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        <div>
          <Label htmlFor={ids.birth}>The child&apos;s date of birth</Label>{" "}
          <DateInput id={ids.birth} value={birth} onChange={(e) => setBirth(e.target.value)} className="mt-1.5" />
        </div>{" "}
        <div>
          <Label htmlFor={ids.set}>Green card through</Label>{" "}
          <select
            id={ids.set}
            value={set}
            onChange={(e) => {
              const next = e.target.value as LineChartSet;
              setSet(next);
              const list = next === "family" ? familyCategories : employmentCategories;
              setCategory(list.includes("EB2") ? "EB2" : (list[0] ?? ""));
            }}
            className={SELECT}
          >
            <option value="employment">A job (employment-based)</option>
            <option value="family">Family</option>
          </select>
        </div>{" "}
        <div>
          <Label htmlFor={ids.category}>Category</Label>{" "}
          <select id={ids.category} value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </div>{" "}
        <div>
          <Label htmlFor={ids.country}>Country the line is charged to</Label>{" "}
          <select id={ids.country} value={country} onChange={(e) => setCountry(e.target.value as CountryKey)} className={SELECT}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>{" "}
        <div>
          <Label htmlFor={ids.pd}>Priority date</Label>{" "}
          <DateInput id={ids.pd} value={pd} onChange={(e) => setPd(e.target.value)} className="mt-1.5" />
        </div>{" "}
        <div>
          <Label htmlFor={ids.filed}>{set === "family" ? "I-130 receipt date" : "The parent's I-140 receipt date"}</Label>{" "}
          <DateInput id={ids.filed} value={filed} onChange={(e) => setFiled(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">The petition the green card rests on.</p>
        </div>{" "}
        <div>
          <Label htmlFor={ids.approved}>Its approval date</Label>{" "}
          <DateInput id={ids.approved} value={approved} onChange={(e) => setApproved(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">Leave empty while it&apos;s pending.</p>
        </div>{" "}
        <div>
          <Label htmlFor={ids.sought}>When the child filed (optional)</Label>{" "}
          <DateInput id={ids.sought} value={sought} onChange={(e) => setSought(e.target.value)} className="mt-1.5" />{" "}
          <p className="mt-1 text-sm text-muted-foreground">The I-485 receipt date, the DS-260, or the visa fee.</p>
        </div>{" "}
        {formerPolicyFiling ? (
          <div>
            <Label htmlFor={ids.chart}>Chart USCIS named for filing</Label>{" "}
            <select id={ids.chart} value={chart} onChange={(e) => setChart(e.target.value as ChartKind)} className={SELECT}>
              <option value="finalAction">Final Action Dates</option>
              <option value="datesForFiling">Dates for Filing</option>
            </select>{" "}
            <p className="mt-1 text-sm text-muted-foreground">Filed before Aug 15, 2025: the chart USCIS named that month.</p>
          </div>
        ) : null}
      </div>{" "}

      <DateRuler
        className="mt-6"
        from={r ? filed : null}
        to={r ? (r.lastQualifyingDay ?? r.lastQualifyingDayIfApprovedToday) : null}
        fromLabel="Petition filed"
        toLabel="Under 21 if a visa is available by"
        today={today}
        marks={
          r
            ? [
                { at: r.turns21, label: "Turns 21", tone: "ink" as const },
                ...(DATE_RE.test(approved) ? [{ at: approved, label: "Approved", tone: "ink" as const }] : []),
                ...(r.counted ? [{ at: r.counted.availableFrom, label: "Visa available", tone: r.counted.underTwentyOne ? ("good" as const) : ("warn" as const) }] : []),
                ...(r.status === "open" && r.counted ? [{ at: r.counted.seekBy, label: "File by", tone: "warn" as const }] : []),
              ]
            : []
        }
        emptyHint="Enter the birth date, priority date and petition date"
      />{" "}

      {line.failed ? (
        <RequestFailed className="mt-5 bg-tint p-4 border-2 border-border" what="The bulletin history for this line" failure={line.failure} onRetry={line.retry} />
      ) : null}{" "}
      {ready && !line.data && !line.failed ? (
        <p role="status" className="mt-5 text-sm text-muted-foreground">
          Reading every bulletin for this line…
        </p>
      ) : null}{" "}
      {outcome?.kind === "error" ? (
        <p className="mt-5 flex items-start gap-2 bg-tint p-3 text-sm border-2 border-border">
          <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {outcome.message}
        </p>
      ) : null}{" "}

      {r && v && outcome?.kind === "ok" ? (
        <div className="mt-5">
          {[...outcome.warnings, ...r.caveats].length > 0 ? (
            <ul className="mb-4 space-y-2">
              {[...outcome.warnings, ...r.caveats].map((w) => (
                <li key={w} className="flex items-start gap-2 bg-tint p-3 text-sm border-2 border-border">
                  <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {w}
                </li>
              ))}
            </ul>
          ) : null}{" "}
          <div role="status" className={cn("flex items-start gap-3 border-2 border-border p-4 sm:p-5", TONE[v.tone].box)}>
            {(() => {
              const Icon = TONE[v.tone].Icon;
              return <Icon size={28} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />;
            })()}{" "}
            <div className="min-w-0">
              <p className="font-heading text-xl font-bold leading-snug sm:text-2xl">{v.head}</p>{" "}
              <p className="mt-1.5 text-base leading-relaxed">{v.body}</p>
            </div>
          </div>{" "}

          <dl className="mt-4 grid grid-cols-1 border-y-2 border-border sm:grid-cols-3 [&>*]:min-w-0">
            <div className="border-b-2 border-border py-3 sm:border-b-0 sm:border-r-2 sm:pr-4">
              <dt className="text-sm text-muted-foreground">Turns 21</dt>{" "}
              <dd className="font-heading text-lg font-bold tabular-nums">{long(r.turns21)}</dd>
            </div>{" "}
            <div className="border-b-2 border-border py-3 sm:border-b-0 sm:border-r-2 sm:px-4">
              <dt className="text-sm text-muted-foreground">{r.pendingDays === null ? "Pending so far" : "Petition pending"}</dt>{" "}
              <dd className="font-heading text-lg font-bold tabular-nums">{formatInt((r.pendingDays ?? r.pendingSoFar)!)} days</dd>
            </div>{" "}
            <div className="py-3 sm:pl-4">
              {r.counted?.cspaAge ? (
                <>
                  <dt className="text-sm text-muted-foreground">CSPA age</dt>{" "}
                  <dd className="font-heading text-lg font-bold tabular-nums">{ageWords(r.counted.cspaAge)}</dd>
                </>
              ) : newest ? (
                <>
                  <dt className="text-sm text-muted-foreground">{usedChart === "finalAction" ? "Final Action" : "Dates for Filing"} cutoff, {monthLong(newest.month)}</dt>{" "}
                  <dd className="font-heading text-lg font-bold tabular-nums">{newest.words}</dd>
                </>
              ) : null}
            </div>
          </dl>{" "}

          {r.windows.length > 0 ? (
            <section className="mt-5" aria-label="When the visa was available">
              <h3 className="font-heading text-base font-bold">When the visa was available since the approval</h3>{" "}
              <ul className="mt-2 space-y-2">
                {r.windows.map((w) => (
                  <Fragment key={w.availableFrom}>
                    {" "}
                    <li
                      className={cn(
                        "grid grid-cols-1 gap-1 border-2 border-border p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4 [&>*]:min-w-0",
                        w === r.counted ? "bg-tint" : "",
                      )}
                    >
                      <span>
                        <span className="font-bold tabular-nums">{long(w.availableFrom)}</span> to{" "}
                        <span className="font-bold tabular-nums">{w.open ? `${monthLong(r.newestBulletin!)} and on` : long(w.through)}</span>
                        {w.fullYear ? ", a full year or more" : w.open ? ", still current" : ", under a year"}
                        {w === r.counted ? ". The one that counts." : "."}{" "}
                      </span>{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {w.underTwentyOne === null ? "" : w.underTwentyOne ? `Under 21 (${w.cspaAge!.years})` : `21 or over (${w.cspaAge!.years})`}
                      </span>
                    </li>
                  </Fragment>
                ))}
              </ul>
            </section>
          ) : null}{" "}

          <div className="mt-4">
            <RuleNotes items={r.citations} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
