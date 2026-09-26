"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, ScalesIcon, WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui";
import { rangeText, roundPeople } from "@/components/tools/GreenCardLine";
import { cutoffLabel } from "@/lib/bulletinNext";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import { LINE_COUNTRIES, LINE_COUNTRY_LABEL, type LineResult, type LineSnapshot } from "@/lib/greenCardLine";
import { compareLines, plausibleRange, type Fewer } from "@/lib/greenCardLineCompare";
import type { CountryKey } from "@/lib/perm";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "mt-2 block min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";
const EYEBROW_CLASS = "font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground";

const LINE_NAME = { EB2: "EB-2", EB3: "EB-3" } as const;
type Pair = keyof typeof LINE_NAME;

export interface Eb2VsEb3Props {
  snapshot: LineSnapshot;
  defaultCountry?: CountryKey;
  className?: string;
}

/**
 * EB-2 and EB-3 for one country and one priority date, side by side: what the
 * bulletin prints for each, and how many people stand ahead in each. Names a
 * line as having fewer ahead only when the ranges don't overlap
 * (`lib/greenCardLineCompare.ts`). People, not waits: each card prints the
 * visas its line got last year and doesn't divide by them.
 */
export function Eb2VsEb3({ snapshot, defaultCountry = "india", className }: Eb2VsEb3Props) {
  const uid = useId();
  const [country, setCountry] = useState<CountryKey>(defaultCountry);
  const [priorityDate, setPriorityDate] = useState("");
  // Nothing is written to the URL until it has been read (see GreenCardLine).
  const [ready, setReady] = useState(false);

  // Read ?country=&pd= after mount so the page stays static.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const k = q.get("country");
    if (k && (LINE_COUNTRIES as readonly string[]).includes(k)) setCountry(k as CountryKey);
    const pd = q.get("pd");
    if (pd && /^\d{4}-\d{2}-\d{2}$/.test(pd)) setPriorityDate(pd);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams({ country });
    if (priorityDate) q.set("pd", priorityDate);
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
  }, [ready, country, priorityDate]);

  const cmp = useMemo(
    () => (priorityDate ? compareLines(country, priorityDate, snapshot) : null),
    [country, priorityDate, snapshot],
  );

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <ScalesIcon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">Compare the two lines</h2>
        </div>{" "}
        <div className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-2">
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
            <DateInput id={`${uid}-pd`} value={priorityDate} onChange={(e) => setPriorityDate(e.target.value)} className="mt-2" />
          </div>
        </div>
      </div>

      {!cmp ? (
        <div className="p-6 sm:p-8">
          <p className="text-base text-foreground/70">
            Pick a priority date and this sets EB-2 and EB-3 next to each other: what this month&apos;s bulletin prints
            for each, and how many people stand ahead of you in each line.
          </p>
        </div>
      ) : (
        <>
          <Verdict fewer={cmp.fewer} cmp={cmp} priorityDate={priorityDate} country={country} />
          <RangeRows cmp={cmp} />
          <div className="grid grid-cols-1 [&>*]:min-w-0 md:grid-cols-2">
            {(["EB2", "EB3"] as const).map((line) => (
              <LineCard
                key={line}
                line={line}
                result={cmp[line]}
                snapshot={snapshot}
                country={country}
                priorityDate={priorityDate}
                fewer={cmp.fewer === line}
              />
            ))}
          </div>
          <details className="group border-t-2 border-border p-6 sm:p-8">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-heading text-lg font-black marker:content-none">
              Before thinking about switching lines
            </summary>
            <div className="mt-3 max-w-3xl space-y-3 text-base leading-relaxed text-foreground/80">
              <p>
                A second I-140 in the other category can be filed on the same certified PERM when the job&apos;s
                requirements support it, and it keeps the original priority date under 8 CFR 204.5(e).{" "}
                <Link href="/guides/eb2-vs-eb3-perm" className="font-semibold underline underline-offset-2 hover:text-primary">
                  EB-2 vs EB-3 on a PERM
                </Link>{" "}
                covers what decides the category and what a downgrade keeps.
              </p>{" "}
              <p>
                Fewer people ahead isn&apos;t the same as a shorter wait. The two lines got different numbers of green
                cards last year, printed on each card, and spillover moves both from year to year.
              </p>
            </div>
          </details>{" "}
          <details className="group border-t-2 border-border p-6 sm:p-8">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-heading text-lg font-black marker:content-none">
              What this leaves out
            </summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground/80">
              <li>PERMs still at the Department of Labor with earlier priority dates.</li>{" "}
              <li>
                People counted in both lines. Someone who downgraded holds an approved I-140 in each, and USCIS counts
                every petition, so both counts run high by the same people.
              </li>{" "}
              <li>People who leave the line. Nobody publishes how many, so nobody is taken out.</li>{" "}
              <li>
                Each count is worked out the same way as{" "}
                <Link href="/tools/green-card-line" className="font-semibold underline underline-offset-2 hover:text-primary">
                  the green card line
                </Link>
                , which shows the method and where each part comes from.
              </li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

function Verdict({
  fewer,
  cmp,
  priorityDate,
  country,
}: {
  fewer: Fewer | null;
  cmp: ReturnType<typeof compareLines>;
  priorityDate: string;
  country: CountryKey;
}) {
  const date = formatAsOf(priorityDate);
  const where = LINE_COUNTRY_LABEL[country];
  let head: string;
  let body: string;
  if (fewer === null) {
    const reason = cmp.EB2.kind === "no-data" ? cmp.EB2.reason : cmp.EB3.kind === "no-data" ? cmp.EB3.reason : "";
    head = "Can't compare these two lines";
    body = reason;
  } else if (fewer === "both-current") {
    head = "Both lines are current for you";
    body = `A ${date} priority date is ahead of this month's final action date in EB-2 and EB-3 for ${where}.`;
  } else if (fewer === "overlap") {
    head = "Too close to call";
    body = `The two ranges overlap, so the counts can't say which line has fewer people ahead of ${date}.`;
  } else {
    const other: Pair = fewer === "EB2" ? "EB3" : "EB2";
    const mine = cmp[fewer];
    head =
      mine.kind === "current"
        ? `${LINE_NAME[fewer]} is current for you; ${LINE_NAME[other]} isn't`
        : `${LINE_NAME[fewer]} has fewer people ahead of you`;
    const theirs = cmp[other];
    body =
      mine.kind === "estimate" && theirs.kind === "estimate"
        ? `For ${where} at ${date}: ${rangeLabel(mine)} in ${LINE_NAME[fewer]} against ${rangeLabel(theirs)} in ${LINE_NAME[other]}.`
        : `For ${where} at ${date}.`;
  }
  const good = fewer === "both-current" || ((fewer === "EB2" || fewer === "EB3") && cmp[fewer].kind === "current");
  return (
    <div className={cn("border-b-2 border-border p-6 sm:p-8", good && "bg-tint-primary")}>
      <p className={EYEBROW_CLASS}>{LINE_COUNTRY_LABEL[country]}</p>{" "}
      <p className="mt-2 font-heading text-3xl font-black leading-tight sm:text-4xl">{head}</p>{" "}
      {body ? <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/80">{body}</p> : null}
    </div>
  );
}

function rangeLabel(r: Extract<LineResult, { kind: "estimate" }>): string {
  const p = plausibleRange(r);
  return rangeText(p.low, p.high);
}

/**
 * The two ranges on one scale, so overlap is something you see rather than
 * something you're told. A disagreeing EB-2 check draws its raw range solid
 * and the scaled part as an outline: the answer is somewhere in the whole bar.
 */
function RangeRows({ cmp }: { cmp: ReturnType<typeof compareLines> }) {
  const rows = (["EB2", "EB3"] as const).map((line) => ({ line, r: cmp[line] }));
  const max = Math.max(
    1,
    ...rows.map(({ r }) => (r.kind === "estimate" ? plausibleRange(r).high : 0)),
  );
  if (!rows.some(({ r }) => r.kind === "estimate")) return null;
  const pct = (n: number) => `${(n / max) * 100}%`;
  return (
    <div className="border-b-2 border-border p-6 sm:p-8">
      <h3 className="font-heading text-lg font-black">People ahead, on one scale</h3>{" "}
      <div className="mt-4 space-y-4">
        {rows.map(({ line, r }) => (
          <div key={line} className="grid grid-cols-[3.5rem_1fr] items-center gap-3 [&>*]:min-w-0 sm:grid-cols-[4.5rem_1fr]">
            <span className="font-heading text-lg font-black">{LINE_NAME[line]}</span>{" "}
            {r.kind === "estimate" ? (
              <div className="relative h-8 border-2 border-border bg-background" role="img" aria-label={`${LINE_NAME[line]}: ${rangeLabel(r)} people ahead`}>
                {r.check?.scaled ? (
                  <span
                    className="absolute inset-y-0 border-2 border-dashed border-foreground/60"
                    style={{ left: pct(plausibleRange(r).low), width: pct(plausibleRange(r).high - plausibleRange(r).low) }}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className="absolute inset-y-0 bg-foreground"
                  style={{ left: pct(r.peopleAhead.low), width: `max(4px, ${pct(r.peopleAhead.high - r.peopleAhead.low)})` }}
                  aria-hidden="true"
                />
              </div>
            ) : (
              <span className="text-base font-semibold text-foreground/80">
                {r.kind === "current" ? "Current, nobody ahead in the line" : "Not available"}
              </span>
            )}
          </div>
        ))}
      </div>{" "}
      <p className="mt-3 font-mono text-sm text-muted-foreground tabular-nums">0 to {roundPeople(max)} people</p>
    </div>
  );
}

function LineCard({
  line,
  result,
  snapshot,
  country,
  priorityDate,
  fewer,
}: {
  line: Pair;
  result: LineResult;
  snapshot: LineSnapshot;
  country: CountryKey;
  priorityDate: string;
  fewer: boolean;
}) {
  const headingId = `${useId()}-${line}`;
  const fa = snapshot.latest?.finalAction[line]?.[country] ?? null;
  const dff = snapshot.latest?.datesForFiling[line]?.[country] ?? null;
  const month = snapshot.latest?.bulletinMonth;
  const href = `/tools/green-card-line?category=${line}&country=${country}&pd=${priorityDate}`;
  return (
    <section
      className={cn(
        "border-border p-6 sm:p-8 md:[&:first-child]:border-r-2 max-md:[&:first-child]:border-b-2",
        fewer ? "bg-tint-primary" : "",
      )}
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className="font-heading text-2xl font-black">
        {LINE_NAME[line]}
      </h3>{" "}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base [&>*]:min-w-0">
        <dt className="text-foreground/70">Final action{month ? `, ${formatMonth(month)}` : ""}</dt>{" "}
        <dd className="font-bold tabular-nums">{cutoffLabel(fa)}</dd>{" "}
        <dt className="text-foreground/70">Dates for filing</dt>{" "}
        <dd className="font-bold tabular-nums">{cutoffLabel(dff)}</dd>
      </dl>{" "}
      {result.kind === "current" ? (
        <p className="mt-5 font-heading text-3xl font-black leading-tight">Current for you</p>
      ) : result.kind === "no-data" ? (
        <p className="mt-5 text-base text-foreground/80">{result.reason}</p>
      ) : (
        <>
          <p className="mt-5 font-heading text-3xl font-black leading-tight tabular-nums">
            {rangeText(result.peopleAhead.low, result.peopleAhead.high)}
          </p>{" "}
          <p className="font-heading text-lg font-bold">people ahead</p>{" "}
          {result.counted && result.counted.low > 0 ? (
            <p className="mt-2 text-base text-foreground/75">
              USCIS counted at least{" "}
              <b className="font-bold text-foreground tabular-nums">{result.counted.low.toLocaleString("en-US")}</b> of them
              in its I-485 inventory.
            </p>
          ) : null}{" "}
          {result.check?.disagrees && result.check.scaled ? (
            <p className="mt-3 flex items-start gap-2 text-base leading-relaxed">
              <WarningIcon className="mt-1 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
              <span>
                Rough for this line: it runs {result.check.ratio.toFixed(1)} times USCIS&apos;s own count where both
                exist. If it overcounts that much everywhere, the line ahead is{" "}
                {rangeText(result.check.scaled.low, result.check.scaled.high)}.
              </span>
            </p>
          ) : null}
        </>
      )}{" "}
      {result.kind === "estimate" && result.supply ? (
        <p className="mt-4 text-base text-foreground/75">
          <b className="font-bold text-foreground tabular-nums">{result.supply.perYear.toLocaleString("en-US")}</b> green
          cards to this line and country in fiscal {result.supply.fy}, families included (State&apos;s Table V).
        </p>
      ) : null}{" "}
      {result.kind === "estimate" ? (
        <Link
          href={href}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 font-semibold underline underline-offset-2 hover:text-primary"
        >
          Where they sit in {LINE_NAME[line]}
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}
