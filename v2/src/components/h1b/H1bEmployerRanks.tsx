"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { RequestFailed } from "@/components/tools/RequestFailed";
import { useUrlSearchParams } from "@/hooks/useUrlSearchParams";
import { usePublicQuery } from "@/hooks/usePublicQuery";
import { formatInt } from "@/lib/format";
import {
  concentration,
  fyLabel,
  fyShort,
  hasBasis,
  LIST_SHOWN,
  NATION,
  parseView,
  placeName,
  rankedRows,
  shareWords,
  stateSlug,
  TOP_SHARE,
  viewQuery,
  willfulShown,
  type H1bBasis,
  type H1bRankRow,
  type H1bSummary,
  type H1bView,
} from "@/lib/h1bRanks";
import { US_STATE_NAMES } from "@/lib/usStateNames";

/**
 * The ranked list on /h1b-employers and its state pages.
 *
 * The page renders its default view on the server (the newest complete fiscal
 * year, ranked by DOL's LCAs), so a crawler and a first paint see the whole
 * list. A reader's other choices live in the URL (`?fy=`, `?by=`; the state is
 * the page's own address) and are read from /api/h1b-employers.
 *
 * A state view shows only the ranked source's figures: DOL's LCAs count the
 * WORKSITE's state and USCIS's approvals the PETITIONER's, so one row holding
 * both would set a job in Texas beside approvals filed from Washington.
 */

const FIELD =
  "min-h-[44px] w-full border-2 border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary";
const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";
const money = (n: number) => `$${formatInt(Math.round(n))}`;
const rankOf = (r: H1bRankRow, by: H1bBasis) => (by === "lca" ? r.rankLca : r.rankUscis);
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "");

interface Column {
  label: string;
  value: (r: H1bRankRow) => string;
  sub?: (r: H1bRankRow) => string | null;
  lead?: boolean;
}

function columns(by: H1bBasis, nation: boolean): Column[] {
  if (by === "lca") {
    const base: Column[] = [
      { label: "LCAs", value: (r) => formatInt(r.lcas), lead: true },
      { label: "Positions", value: (r) => formatInt(r.positions) },
      { label: "Median pay", value: (r) => (r.wageMedian !== null ? money(r.wageMedian) : "") },
    ];
    return nation
      ? [...base, {
          label: "USCIS approvals",
          value: (r) => (r.uscisAppr > 0 ? formatInt(r.uscisAppr) : ""),
          sub: (r) => (r.uscisNew > 0 ? `${formatInt(r.uscisNew)} new` : null),
        }]
      : [...base, { label: "Senior roles", value: (r) => (r.leveled >= 20 ? pct(r.senior, r.leveled) : "") }];
  }
  const base: Column[] = [
    { label: "Approvals", value: (r) => formatInt(r.uscisAppr), lead: true },
    { label: "New jobs", value: (r) => formatInt(r.uscisNew) },
    {
      label: "Denied",
      value: (r) => formatInt(r.uscisDen),
      sub: (r) => (r.uscisDen > 0 ? pct(r.uscisDen, r.uscisDen + r.uscisAppr) : null),
    },
  ];
  return nation ? [...base, { label: "LCAs", value: (r) => (r.lcas > 0 ? formatInt(r.lcas) : "") }] : base;
}

/**
 * What the record says about the employer, as plain labels. Not links: each
 * would be a 20px tap target pointing at a general page, and the employer's
 * own record, one tap away on its name, holds the detail.
 */
function Marks({ r }: { r: H1bRankRow }) {
  const marks: { key: string; text: string; tone: string }[] = [];
  if (r.debarred) marks.push({ key: "debarred", text: "Debarred now", tone: "border-data-bad-ink text-data-bad-ink" });
  if (willfulShown(r)) {
    marks.push({ key: "willful", text: "Willful violator on its LCAs", tone: "border-data-bad-ink text-data-bad-ink" });
  }
  if (r.onHold > 0) {
    marks.push({
      key: "hold",
      text: `${formatInt(r.onHold)} PERM ${r.onHold === 1 ? "case" : "cases"} on hold today`,
      tone: "border-data-warn-ink text-data-warn-ink",
    });
  }
  if (r.dependent) marks.push({ key: "dep", text: "H-1B dependent", tone: "border-border" });
  if (r.warn2y > 0) {
    marks.push({
      key: "warn",
      text: `${formatInt(r.warn2y)} layoff ${r.warn2y === 1 ? "notice" : "notices"} in 2 years`,
      tone: "border-border",
    });
  }
  if (marks.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="On the record">
      {marks.map((m) => (
        <li key={m.key} className={`inline-flex min-h-7 items-center border-2 bg-card px-2 text-sm font-semibold ${m.tone}`}>
          {m.text}{" "}
        </li>
      ))}
    </ul>
  );
}

const ROW_GRID = "grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 lg:grid-cols-[3.5rem_minmax(0,1fr)_repeat(4,7.5rem)] lg:items-center lg:gap-x-4";

function Row({ r, rank, max, cols, by }: { r: H1bRankRow; rank: number; max: number; cols: Column[]; by: H1bBasis }) {
  const value = by === "lca" ? r.lcas : r.uscisAppr;
  const width = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0;
  return (
    <li className={`${ROW_GRID} border-t-2 border-border py-4`}>
      <span className="font-heading text-2xl font-black leading-none tabular-nums lg:text-3xl" aria-label={`Rank ${rank}`}>
        {rank}
      </span>{" "}
      <div className="min-w-0">
        {r.linked ? (
          <Link href={`/perm-employers/${r.slug}`} className={`${LINK} text-base [overflow-wrap:anywhere] lg:text-lg`}>
            {r.name}
          </Link>
        ) : (
          <span className="text-base font-bold [overflow-wrap:anywhere] lg:text-lg">{r.name}</span>
        )}{" "}
        <span className="mt-2 block h-3.5 border-2 border-border bg-background" aria-hidden="true">
          <span className="block h-full bg-foreground" style={{ width: `${width}%` }} />
        </span>{" "}
        <Marks r={r} />
      </div>{" "}
      <dl className="col-span-2 mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:contents [&>*]:min-w-0">
        {cols.map((c) => {
          const sub = c.sub?.(r) ?? null;
          return (
            <div key={c.label} className="min-w-0 lg:text-right">
              <dt className="text-sm text-muted-foreground lg:sr-only">{c.label}</dt>{" "}
              <dd className={`font-mono text-base tabular-nums ${c.lead ? "font-bold" : ""}`}>
                {c.value(r)}
                {sub ? " " : null}
                {sub ? (
                  <span className="block text-sm text-muted-foreground">{sub}</span>
                ) : null}
              </dd>{" "}
            </div>
          );
        })}
      </dl>
    </li>
  );
}

function Headline({ view, rows }: { view: H1bView; rows: H1bRankRow[] }) {
  if (!view.totals) return null;
  const c = concentration(rows, view.totals, view.by);
  if (!(c.whole > 0)) return null;
  const where = view.state === NATION ? "" : view.by === "lca" ? ` for jobs in ${placeName(view.state)}` : ` for employers in ${placeName(view.state)}`;
  const what = view.by === "lca" ? `H-1B LCAs DOL certified${where}` : `H-1B approvals by USCIS${where}`;
  const seg = (n: number) => (c.whole > 0 ? Math.max(n > 0 ? 1 : 0, (n / c.whole) * 100) : 0);
  const bands = [
    { key: "top", n: c.top, count: c.topCount, label: `The ${c.topCount} busiest`, swatch: "bg-primary" },
    { key: "next", n: c.next, count: c.nextCount, label: `The next ${c.nextCount}`, swatch: "bg-foreground" },
    { key: "rest", n: c.rest, count: c.restCount, label: `${formatInt(c.restCount)} other employers`, swatch: "bg-data-none" },
  ].filter((b) => b.n > 0);
  return (
    <section aria-label="The year in three figures" className="mt-8 border-2 border-border bg-card p-5 sm:p-6">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 [&>*]:min-w-0">
        <div className="col-span-2 sm:col-span-1">
          <dt className="sr-only">{what}</dt>{" "}
          <dd className="font-heading text-4xl font-black leading-none tabular-nums sm:text-5xl">{formatInt(c.whole)}</dd>{" "}
          <dd className="mt-2 text-base">{what}</dd>
        </div>{" "}
        <div>
          <dt className="sr-only">Employers</dt>{" "}
          <dd className="font-heading text-3xl font-black leading-none tabular-nums sm:text-5xl">{formatInt(c.employers)}</dd>{" "}
          <dd className="mt-2 text-base">employers</dd>
        </div>{" "}
        {c.topCount >= TOP_SHARE ? (
          <div>
            <dt className="sr-only">Share of the {TOP_SHARE} busiest</dt>{" "}
            <dd className="font-heading text-3xl font-black leading-none sm:text-5xl">{shareWords(c.top, c.whole)}</dd>{" "}
            <dd className="mt-2 text-base">came from the {TOP_SHARE} busiest</dd>
          </div>
        ) : null}
      </dl>{" "}
      <div className="mt-6 flex h-7 border-2 border-border" aria-hidden="true">
        {bands.map((b, i) => (
          <span
            key={b.key}
            className={`${b.swatch} ${i < bands.length - 1 ? "border-r-2 border-border" : ""}`}
            style={{ width: `${seg(b.n)}%` }}
          />
        ))}
      </div>{" "}
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {bands.map((b) => (
          <li key={b.key} className="flex items-center gap-2">
            <span className={`inline-block size-3.5 border-2 border-border ${b.swatch}`} aria-hidden="true" />{" "}
            <span>
              {b.label}: <span className="font-mono font-bold tabular-nums">{formatInt(b.n)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function H1bEmployerRanks({
  summary,
  initial,
  states,
}: {
  summary: H1bSummary;
  /** The page's own default view, rendered on the server. */
  initial: H1bView;
  /** The state codes with a page, for the place picker. */
  states: readonly string[];
}) {
  const params = useUrlSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = initial.state;
  const asked = parseView(params, summary, state);
  const sameAsInitial = asked.year.fy === initial.fy && asked.by === initial.by;
  const url = sameAsInitial ? "skip" : `/api/h1b-employers?fy=${asked.year.fy}&state=${state}&by=${asked.by}`;
  const q = usePublicQuery<H1bView>(url);
  const view: H1bView | undefined = sameAsInitial ? initial : (q.data ?? q.previous);
  const loading = !sameAsInitial && q.data === undefined && !q.failed;
  const by = view?.by ?? asked.by;
  const year = summary.years.find((y) => y.fy === (view?.fy ?? asked.year.fy)) ?? asked.year;
  const rows = useMemo(() => (view ? rankedRows(view.rows, view.by) : []), [view]);
  const cols = columns(by, state === NATION);
  const max = rows.length > 0 ? (by === "lca" ? rows[0]!.lcas : rows[0]!.uscisAppr) : 0;

  const go = (fy: number, nextBy: H1bBasis, nextState = state) => {
    const base = nextState === NATION ? "/h1b-employers" : `/h1b-employers/${stateSlug(nextState)}`;
    const href = `${base}${viewQuery(fy, nextBy, summary, nextState)}`;
    if (base === pathname) router.replace(href, { scroll: false });
    else router.push(href);
  };
  const chooseYear = (fy: number) => {
    const y = summary.years.find((x) => x.fy === fy);
    const nextBy = y && !hasBasis(y, by, state) && hasBasis(y, by === "lca" ? "uscis" : "lca", state)
      ? (by === "lca" ? "uscis" : "lca")
      : by;
    go(fy, nextBy);
  };

  const lcaYear = hasBasis(year, "lca", state);
  const uscisYear = hasBasis(year, "uscis", state);
  const shown = rows.slice(0, LIST_SHOWN);
  const folded = rows.slice(LIST_SHOWN);

  return (
    <div>
      <div className="border-2 border-border bg-card p-4 shadow-hard sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end [&>*]:min-w-0">
          <label className="block text-sm font-bold">
            Fiscal year
            <select value={year.fy} onChange={(e) => chooseYear(Number(e.target.value))} className={`mt-1 ${FIELD}`}>
              {summary.years.map((y) => (
                <option key={y.fy} value={y.fy}>
                  {fyShort(y, hasBasis(y, by, state) ? by : by === "lca" ? "uscis" : "lca")}
                </option>
              ))}
            </select>
          </label>{" "}
          <label className="block text-sm font-bold">
            Place
            <select value={state} onChange={(e) => go(year.fy, by, e.target.value)} className={`mt-1 ${FIELD}`}>
              <option value={NATION}>Whole country</option>
              {[...states]
                .sort((a, b) => (US_STATE_NAMES[a] ?? a).localeCompare(US_STATE_NAMES[b] ?? b))
                .map((code) => (
                  <option key={code} value={code}>
                    {US_STATE_NAMES[code] ?? code}
                  </option>
                ))}
            </select>
          </label>{" "}
          <fieldset className="min-w-0">
            <legend className="text-sm font-bold">Ranked by</legend>{" "}
            <div className="mt-1 grid grid-cols-2 [&>*]:min-w-0">
              {(["lca", "uscis"] as const).map((b, i) => {
                const on = by === b;
                const usable = b === "lca" ? lcaYear : uscisYear;
                return (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={on}
                    disabled={!usable}
                    onClick={() => go(year.fy, b)}
                    className={`min-h-[44px] border-2 border-border px-2 text-sm font-bold sm:px-3 sm:text-base ${i > 0 ? "-ml-0.5" : ""} ${
                      on ? "bg-foreground text-background" : "bg-background hover:bg-muted"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {b === "lca" ? "DOL's LCAs" : "USCIS approvals"}{" "}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>{" "}
        <p className="mt-3 text-sm text-muted-foreground">
          {fyLabel(year, by)}.{" "}
          {by === "lca"
            ? state === NATION
              ? "LCAs DOL certified, counted where the job is."
              : `LCAs DOL certified for jobs in ${placeName(state)}.`
            : state === NATION
              ? "Workers USCIS approved on its first decision."
              : `Workers USCIS approved for employers whose petitions give an address in ${placeName(state)}.`}
          {!lcaYear && uscisYear && by === "uscis" ? " DOL's LCA files here start with FY2020." : ""}
        </p>
      </div>

      {q.failed ? (
        <RequestFailed what="This ranking" failure={q.failure} onRetry={q.retry} className="mt-6 border-2 border-border bg-tint-primary p-4" />
      ) : null}

      <div className={loading ? "opacity-60 transition-opacity motion-reduce:transition-none" : ""} aria-busy={loading}>
        {view ? <Headline view={view} rows={rows} /> : null}{" "}
        {view && rows.length === 0 ? (
          <p className="mt-8 border-2 border-border bg-card p-5 text-base">
            {by === "lca"
              ? `DOL's files hold no certified H-1B LCAs for ${placeName(state)} in FY${year.fy}.`
              : `USCIS's counts hold no H-1B approvals for ${placeName(state)} in FY${year.fy}.`}
          </p>
        ) : null}{" "}
        {rows.length > 0 ? (
          <section aria-labelledby="h1b-ranked" className="mt-10">
            <h2 id="h1b-ranked" className="font-heading text-2xl font-black sm:text-3xl">
              The {rows.length} busiest, FY{year.fy}
            </h2>{" "}
            <div className={`${ROW_GRID} mt-4 hidden pb-2 text-sm font-bold lg:grid`} aria-hidden="true">
              <span>Rank</span> <span>Employer</span>{" "}
              {cols.map((c) => (
                <Fragment key={c.label}>
                  {" "}
                  <span className="text-right">{c.label}</span>
                </Fragment>
              ))}
            </div>{" "}
            <ol className="mt-2 lg:mt-0">
              {shown.map((r, i) => (
                <Row key={r.slug} r={r} rank={rankOf(r, by) ?? i + 1} max={max} cols={cols} by={by} />
              ))}
            </ol>{" "}
            {folded.length > 0 ? (
              <details className="group border-t-2 border-border">
                <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 py-3 font-heading text-base font-bold [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex min-h-[44px] items-center border-2 border-border bg-card px-4 shadow-hard-sm group-open:hidden">
                    Show ranks {LIST_SHOWN + 1} to {rows.length}
                  </span>{" "}
                  <span className="hidden min-h-[44px] items-center border-2 border-border bg-card px-4 group-open:inline-flex">
                    Hide ranks {LIST_SHOWN + 1} to {rows.length}
                  </span>
                </summary>{" "}
                <ol>
                  {folded.map((r, i) => (
                    <Row key={r.slug} r={r} rank={rankOf(r, by) ?? LIST_SHOWN + i + 1} max={max} cols={cols} by={by} />
                  ))}
                </ol>
              </details>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
