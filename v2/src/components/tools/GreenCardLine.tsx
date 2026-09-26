"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { UsersThreeIcon, WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui";
import { monthsToReach, type PaceBasis } from "@/lib/bulletinNext";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import {
  FAMILY_SIZE,
  LINE_CATEGORIES,
  LINE_CATEGORY_LABEL,
  LINE_COUNTRIES,
  LINE_COUNTRY_LABEL,
  PERM_MONTHS_BEFORE_MEASURED,
  estimateLine,
  type LineCategory,
  type LineSnapshot,
} from "@/lib/greenCardLine";
import type { CountryKey } from "@/lib/perm";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "mt-2 block min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";
const EYEBROW_CLASS = "font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground";

/** Rounded the way a count this uncertain deserves: tens, hundreds, then thousands. */
export function roundPeople(n: number): string {
  const step = n < 1000 ? 10 : n < 10000 ? 100 : 1000;
  return (Math.round(n / step) * step).toLocaleString("en-US");
}

export function formatYears(y: number): string {
  if (y > 99) return "more than 99";
  return y < 10 ? y.toFixed(1) : String(Math.round(y));
}

export function rangeText(low: number, high: number): string {
  const a = roundPeople(low);
  const b = roundPeople(high);
  return a === b ? `about ${a}` : `${a} to ${b}`;
}

function yearsText(low: number, high: number): string {
  const a = formatYears(low);
  const b = formatYears(high);
  return a === b ? a : `${a} to ${b}`;
}

export interface GreenCardLineProps {
  snapshot: LineSnapshot;
  /** Bulletin pace per line, keyed `${category}|${country}` in bulletin keys. */
  pace: Record<string, PaceBasis>;
  /** Preselected line, e.g. from the EB-3 Other Workers guide. */
  defaultCategory?: LineCategory;
  defaultCountry?: CountryKey;
  /** Hide the category select, for a page about one category. */
  lockCategory?: boolean;
  /**
   * Divide the line by last year's visas and print years. OFF by default: the
   * site's published rule is that it doesn't turn a count into a wait
   * (`guides/approved-i140-no-visa-number-eb2-india`), and reversing that is
   * the owner's call. Off, the supply is printed as a fact beside the count.
   */
  showYears?: boolean;
  className?: string;
}

export function GreenCardLine({
  snapshot,
  pace,
  defaultCategory = "EB2",
  defaultCountry = "india",
  lockCategory = false,
  showYears = false,
  className,
}: GreenCardLineProps) {
  const uid = useId();
  const [category, setCategory] = useState<LineCategory>(defaultCategory);
  const [country, setCountry] = useState<CountryKey>(defaultCountry);
  const [priorityDate, setPriorityDate] = useState("");
  // Nothing is written to the URL until it has been read. Without this the
  // writer below ran in the same commit as the reader, with the INITIAL state,
  // and replaced a shared ?category=EW3 link with EB2/India; StrictMode's
  // second pass of the reader then read that back.
  const [ready, setReady] = useState(false);

  // Read ?category=&country=&pd= AFTER mount, so the page stays static: a
  // server read of searchParams would make it a render per visit.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get("category");
    if (c && (LINE_CATEGORIES as readonly string[]).includes(c) && !lockCategory) setCategory(c as LineCategory);
    const k = q.get("country");
    if (k && (LINE_COUNTRIES as readonly string[]).includes(k)) setCountry(k as CountryKey);
    const pd = q.get("pd");
    if (pd && /^\d{4}-\d{2}-\d{2}$/.test(pd)) setPriorityDate(pd);
    setReady(true);
  }, [lockCategory]);

  // Keep the URL shareable without a navigation.
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams();
    if (!lockCategory) q.set("category", category);
    q.set("country", country);
    if (priorityDate) q.set("pd", priorityDate);
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
  }, [ready, category, country, priorityDate, lockCategory]);

  const result = useMemo(
    () => (priorityDate ? estimateLine({ category, country, priorityDate }, snapshot) : null),
    [category, country, priorityDate, snapshot],
  );

  const paceCell = pace[`${category}|${country}`] ?? null;
  const reach = paceCell && priorityDate ? monthsToReach(paceCell, priorityDate) : null;
  const lineLabel = `${LINE_CATEGORY_LABEL[category]}, ${LINE_COUNTRY_LABEL[country]}`;

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <UsersThreeIcon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">Who is ahead of you?</h2>
        </div>{" "}
        <div className={cn("mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0", lockCategory ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          {lockCategory ? null : (
            <div>
              <Label htmlFor={`${uid}-cat`} className="text-sm font-bold">
                Category
              </Label>
              <select
                id={`${uid}-cat`}
                value={category}
                onChange={(e) => setCategory(e.target.value as LineCategory)}
                className={SELECT_CLASS}
              >
                {LINE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {LINE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor={`${uid}-country`} className="text-sm font-bold">
              Country of chargeability
            </Label>
            <select
              id={`${uid}-country`}
              value={country}
              onChange={(e) => setCountry(e.target.value as CountryKey)}
              className={SELECT_CLASS}
            >
              {LINE_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {LINE_COUNTRY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${uid}-pd`} className="text-sm font-bold">
              Priority date
            </Label>
            <DateInput
              id={`${uid}-pd`}
              value={priorityDate}
              onChange={(e) => setPriorityDate(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
      </div>

      {!result ? (
        <div className="p-6 sm:p-8">
          <p className="text-base text-foreground/70">
            Pick a priority date and this fills in: how many people stand ahead of you in
            this line, where they sit, and how long that is at the pace the line last moved.
          </p>
        </div>
      ) : result.kind === "no-data" ? (
        <div className="p-6 sm:p-8">
          <p className="text-base text-foreground/80">{result.reason}</p>
        </div>
      ) : result.kind === "current" ? (
        <div className="bg-tint-primary p-6 sm:p-8">
          <p className={EYEBROW_CLASS}>{lineLabel}</p>{" "}
          <p className="mt-2 font-heading text-3xl font-black leading-tight sm:text-4xl">
            Your priority date is current
          </p>{" "}
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
            {result.cutoff.kind === "current"
              ? `The ${formatMonth(result.bulletinMonth)} bulletin's final action chart reads C for this line: every priority date is current.`
              : result.cutoff.kind === "date"
                ? `The ${formatMonth(result.bulletinMonth)} bulletin's final action date for this line is ${formatAsOf(result.cutoff.iso)}, and yours is earlier.`
                : `Your date is earlier than this line's last published final action date. The ${formatMonth(result.bulletinMonth)} bulletin shows no numbers for it this month, so a green card waits until numbers return.`}{" "}
            What&apos;s left is USCIS or the consulate finishing the case.
          </p>
        </div>
      ) : (
        <LineAnswer
          result={result}
          lineLabel={lineLabel}
          category={category}
          reach={reach}
          priorityDate={priorityDate}
          showYears={showYears}
        />
      )}
    </div>
  );
}

type Estimate = Extract<ReturnType<typeof estimateLine>, { kind: "estimate" }>;

function LineAnswer({
  result,
  lineLabel,
  category,
  reach,
  priorityDate,
  showYears,
}: {
  result: Estimate;
  lineLabel: string;
  category: LineCategory;
  reach: ReturnType<typeof monthsToReach>;
  priorityDate: string;
  showYears: boolean;
}) {
  const { parts } = result;
  const segs = [
    { key: "current", label: "Current, not finished", note: "I-485s USCIS holds with a visa number available", value: (parts.currentUnfinished.low + parts.currentUnfinished.high) / 2, cls: "bg-data-good" },
    { key: "approved", label: "Approved, waiting for the bulletin", note: "USCIS's own count, spread across priority dates", value: (parts.approvedWaiting.low + parts.approvedWaiting.high) / 2, cls: "bg-foreground" },
    { key: "pending", label: "Waiting for I-140 approval", note: "pending petitions at the rate USCIS approves them", value: (parts.pendingApproval.low + parts.pendingApproval.high) / 2, cls: "bg-data-warn" },
  ];
  const total = segs.reduce((n, s) => n + s.value, 0);

  return (
    <>
      <div className="border-b-2 border-border p-6 sm:p-8">
        <p className={EYEBROW_CLASS}>{lineLabel}</p>{" "}
        <p className="mt-2 font-heading text-4xl font-black leading-[1.05] tabular-nums sm:text-5xl">
          {rangeText(result.peopleAhead.low, result.peopleAhead.high)}
        </p>{" "}
        <p className="mt-1 font-heading text-xl font-bold">people ahead of you</p>{" "}
        {showYears && result.years && result.supply ? (
          <p className="mt-4 text-lg leading-relaxed">
            <b className="font-bold">{yearsText(result.years.low, result.years.high)} years</b>{" "}
            <span className="text-foreground/75">
              at FY{result.supply.fy}&apos;s pace: {result.supply.perYear.toLocaleString("en-US")} green cards
              went to this line and country that year (State&apos;s Table V), families included.
            </span>
          </p>
        ) : result.supply ? (
          <p className="mt-4 text-lg leading-relaxed">
            <b className="font-bold tabular-nums">{result.supply.perYear.toLocaleString("en-US")}</b>{" "}
            <span className="text-foreground/75">
              green cards went to this line and country in fiscal {result.supply.fy}, families included
              (State&apos;s Table V). The yearly number moves with spillover, so it isn&apos;t a promise.
            </span>
          </p>
        ) : null}{" "}
        {result.counted && result.counted.low > 0 ? (
          <p className="mt-2 text-base text-foreground/75">
            USCIS counted at least{" "}
            <b className="font-bold text-foreground tabular-nums">{result.counted.low.toLocaleString("en-US")}</b> of
            them in its I-485 inventory{result.i485AsOf ? ` of ${formatAsOf(result.i485AsOf)}` : ""}.
          </p>
        ) : null}

        {result.check?.disagrees && result.check.scaled ? (
          <div className="mt-5 flex items-start gap-3 border-2 border-data-warn bg-data-warn/10 p-4">
            <WarningIcon className="mt-0.5 h-5 w-5 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
            <p className="text-base leading-relaxed">
              <b className="font-bold">Treat this as rough for this line.</b>{" "}
              At the dates-for-filing cutoff ({formatAsOf(result.check.at)}), this estimate puts{" "}
              {rangeText(result.check.estimate.low, result.check.estimate.high)} people where USCIS counted{" "}
              {roundPeople(result.check.counted.low)} who filed, {result.check.ratio.toFixed(1)} times as many. If it
              runs that far over everywhere, the line ahead is{" "}
              <b className="font-bold">{rangeText(result.check.scaled.low, result.check.scaled.high)}</b> people
              {showYears && result.supply && result.supply.perYear > 0
                ? `, about ${yearsText(result.check.scaled.low / result.supply.perYear, result.check.scaled.high / result.supply.perYear)} years`
                : ""}
              .
            </p>
          </div>
        ) : null}
      </div>

      <div className="border-b-2 border-border p-6 sm:p-8">
        <h3 className="font-heading text-lg font-black">Who they are</h3>{" "}
        <div className="mt-4 flex h-8 w-full overflow-hidden border-2 border-border" role="img" aria-label="The three groups ahead of you, to scale">
          {total > 0
            ? segs.map((s) => (
                <span
                  key={s.key}
                  className={cn("h-full", s.cls)}
                  style={{ width: `${(s.value / total) * 100}%` }}
                  aria-hidden="true"
                />
              ))
            : null}
        </div>{" "}
        <ul className="mt-4 grid grid-cols-1 gap-3 [&>*]:min-w-0 sm:grid-cols-3">
          {segs.map((s) => (
            <Fragment key={s.key}>
              {" "}
              <li className="flex items-start gap-2">
                <span className={cn("mt-1.5 h-3 w-3 shrink-0 border-2 border-border", s.cls)} aria-hidden="true" />{" "}
                <span>
                  <b className="block font-bold tabular-nums">{roundPeople(s.value)}</b>{" "}
                  <span className="block text-base font-semibold">{s.label}</span>{" "}
                  <span className="block text-sm text-foreground/70">{s.note}</span>
                </span>
              </li>
            </Fragment>
          ))}
        </ul>
      </div>

      <LineStrip histogram={result.histogram} front={result.front.iso} you={priorityDate} />

      {reach ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black">The bulletin&apos;s own pace, for comparison</h3>{" "}
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
            Over the {reach.basis.spanMonths} months this site holds, this line&apos;s final action date moved{" "}
            {Math.round(reach.basis.movedDays / 30.44)} months of priority dates
            {reach.basis.retrogressions > 0 ? `, with ${reach.basis.retrogressions} step${reach.basis.retrogressions === 1 ? "" : "s"} backwards` : ""}.
            At that pace it reaches your date in about{" "}
            <b className="font-bold">{formatYears(reach.months / 12)} years</b>. The pace is the past, and the line
            behind the cutoff grew fastest in the last three years, so the count above is the better guide.
          </p>
        </div>
      ) : null}

      <details className="group border-b-2 border-border p-6 sm:p-8">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-heading text-lg font-black marker:content-none">
          What this leaves out
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground/80">
          <li>PERMs still at the Department of Labor with an earlier priority date. They join ahead of you once certified.</li>{" "}
          <li>Consular cases already current and waiting for an interview abroad.</li>{" "}
          <li>
            People who leave the line: who give up, switch category or get a green card another way. Nobody publishes
            how many, so nobody is taken out. That makes the count high.
          </li>{" "}
          <li>
            Duplicates. USCIS says one person can hold several approved petitions, and each counts. That makes the
            count high too.
          </li>{" "}
          <li>
            Priority dates kept from an earlier petition. Someone who files a new I-140 and keeps an older date sits
            earlier in the line than their filing year, and this spread can&apos;t see it.
          </li>
        </ul>
      </details>

      <details className="group p-6 sm:p-8">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-heading text-lg font-black marker:content-none">
          How this is worked out
        </summary>
        <div className="mt-3 max-w-3xl space-y-3 text-base leading-relaxed text-foreground/80">
          <p>
            USCIS counted <b className="font-bold">{result.awaitingTotal.toLocaleString("en-US")}</b> approved
            petitions in this line waiting for a visa number as of {formatMonth(result.awaitingAsOf)}, primary
            applicants only. It doesn&apos;t say which priority dates they hold, so this spreads them by how USCIS
            approved I-140s year by year, each moved back by the time the PERM took (a priority date is the day DOL
            received the PERM).
          </p>{" "}
          <p>
            That time is measured from DOL&apos;s decided cases for petitions filed since October 2023 (about 11 to 17
            months), plus up to six months to file the I-140, since a certification lasts 180 days. For older
            petitions this site holds no DOL decisions, so it assumes {PERM_MONTHS_BEFORE_MEASURED.low} to{" "}
            {PERM_MONTHS_BEFORE_MEASURED.high} months. National interest waivers skip the PERM and keep their filing
            date. The range above carries both.
          </p>{" "}
          <p>
            Each petition becomes {FAMILY_SIZE[category].low.toFixed(2)} to {FAMILY_SIZE[category].high.toFixed(2)}{" "}
            people, the ratio DHS measured when this category got green cards in fiscal 2023 and 2024. Pending I-140s
            are counted at the share USCIS approved in complete years. The I-485s already current come straight from
            USCIS&apos;s monthly inventory, where cells of 1 to 10 are withheld, so they&apos;re a range too.
          </p>{" "}
          {result.check ? (
            <p>
              Checked where both views exist: at the dates-for-filing cutoff ({formatAsOf(result.check.at)}) the
              estimate is {rangeText(result.check.estimate.low, result.check.estimate.high)} and USCIS counted{" "}
              {roundPeople(result.check.counted.low)} who filed.{" "}
              {result.check.comparable
                ? "Most of this category adjusts inside the US, so the two should be close."
                : "Most of this category gets its visa abroad, which the I-485 inventory can't count, so a gap here is expected."}
            </p>
          ) : null}
        </div>
      </details>
    </>
  );
}

/**
 * The line itself: people ahead by priority-date month, from the bulletin's
 * cutoff on the left to the reader's date on the right. Months are grouped
 * into quarters past four years so a bar never gets thinner than a pixel.
 */
function LineStrip({ histogram, front, you }: { histogram: Array<{ month: string; people: number }>; front: string; you: string }) {
  // Two calculators can share a page (EB-2 beside EB-3), so the id is per instance.
  const titleId = `${useId()}-strip`;
  const bars = useMemo(() => {
    if (histogram.length <= 48) return histogram.map((h) => ({ label: h.month, people: h.people }));
    const out: Array<{ label: string; people: number }> = [];
    for (let i = 0; i < histogram.length; i += 3) {
      const chunk = histogram.slice(i, i + 3);
      out.push({ label: chunk[0]!.month, people: chunk.reduce((n, c) => n + c.people, 0) });
    }
    return out;
  }, [histogram]);
  if (bars.length === 0) return null;
  const max = Math.max(...bars.map((b) => b.people), 1);
  const W = 720;
  const H = 180;
  const PAD = { l: 8, r: 8, t: 12, b: 32 };
  const bw = (W - PAD.l - PAD.r) / bars.length;
  const first = bars[0]!.label;
  const last = bars[bars.length - 1]!.label;
  return (
    <div className="border-b-2 border-border p-6 sm:p-8">
      <h3 className="font-heading text-lg font-black">Where they sit in the line</h3>{" "}
      <p className="mt-1 text-base text-foreground/70">
        People ahead of you by priority date, from the bulletin&apos;s cutoff ({formatAsOf(front)}) to yours.
      </p>{" "}
      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px] text-foreground" role="img" aria-labelledby={titleId}>
          <title id={titleId}>{`People ahead by priority-date month, ${formatMonth(first)} to ${formatMonth(last)}`}</title>
          {bars.map((b, i) => {
            const h = ((H - PAD.t - PAD.b) * b.people) / max;
            return (
              <rect
                key={b.label}
                x={PAD.l + i * bw + 0.5}
                y={H - PAD.b - h}
                width={Math.max(bw - 1, 0.5)}
                height={h}
                className="fill-foreground/75"
              >
                <title>{`${formatMonth(b.label)}: about ${roundPeople(b.people)} people`}</title>
              </rect>
            );
          })}
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="stroke-foreground" strokeWidth={2} />
          <text x={PAD.l} y={H - 8} fontSize={16} className="fill-foreground">{`${formatMonth(first)} `}</text>
          <text x={W - PAD.r} y={H - 8} fontSize={16} textAnchor="end" className="fill-foreground font-bold">{`You: ${formatMonth(you.slice(0, 7))} `}</text>
        </svg>
      </div>
    </div>
  );
}
