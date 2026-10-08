import type { Metadata } from "next";
import Link from "next/link";

import { ChartTips } from "@/components/data/ChartTips";
import { PageBasics } from "@/components/data/PageBasics";
import { FinePrint } from "@/components/data/FinePrint";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FlagCaseBrowser, SEASONAL_PROGRAM } from "@/components/tools/FlagCaseBrowser";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getSeasonalPublishedSummary, getSeasonalSummary } from "@/lib/turso/seasonalCases";
import { getDailyDecisions, type DailyDecisions } from "@/lib/turso/publicData";
import { DailyDecisionsChart } from "@/components/tools/DailyDecisionsChart";
import { SEASONAL_FORMS } from "@/lib/seasonalForms";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { formatInt } from "@/lib/format";

/**
 * H-2A, H-2B and CW-1 filings, findable by employer as DOL confirms them.
 *
 * FLAG serves three temporary-labor forms from the same counter as PERM, PWD
 * and LCA: H-2A applications (`H-300-`, ETA-9142A), H-2B
 * applications (`H-400-`, ETA-9142B) and the prevailing wage requests filed
 * for H-2B jobs (`P-400-`), plus the CW-1 wage request (`P-500-`, the
 * Northern Mariana Islands' program). Live statuses only: DOL's quarterly H-2A and
 * H-2B disclosure files (the wage, the worker count, the worksite) are not
 * loaded, and the page says so.
 */

const TITLE = "H-2A, H-2B and CW-1 Case Search";
const DESCRIPTION =
  "Find an H-2A, H-2B or CW-1 filing by employer: DOL's current status, and the wage, workers and work period from its published files.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/seasonal-cases" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/seasonal-cases",
  },
}, "seasonal-cases");

export const revalidate = 86400;

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** The forms in the order a reader meets them: farm work and its job order, other seasonal work and its wage, then CW-1. */
const FORM_ORDER = ["H-300", "JO-A-300", "H-400", "P-400", "C-500", "P-500"] as const;

/** DOL's decisions per day in its H-2A, H-2B and CW-1 files (scripts/build_daily_decisions.py). */
const DECIDED_SERIES = [
  { visa: "H-2A", source: "dol-disclosure-h2a" },
  { visa: "H-2B", source: "dol-disclosure-h2b" },
  { visa: "CW-1", source: "dol-disclosure-cw1" },
] as const;

/** The three visas' days summed into one series, for the one chart. */
function combine(series: readonly (readonly DailyDecisions[])[]): DailyDecisions[] {
  const by = new Map<string, DailyDecisions>();
  for (const days of series) {
    for (const d of days) {
      const t = by.get(d.date) ?? { date: d.date, total: 0, certified: 0, denied: 0, withdrawn: 0 };
      t.total += d.total;
      t.certified += d.certified;
      t.denied += d.denied;
      t.withdrawn += d.withdrawn;
      by.set(d.date, t);
    }
  }
  return [...by.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export default async function SeasonalCasesPage() {
  const [summary, published, ...decided] = await Promise.all([
    getSeasonalSummary(),
    getSeasonalPublishedSummary().catch(() => []),
    // A series that can't be read draws nothing; the page never fails for it.
    ...DECIDED_SERIES.map((s) => getDailyDecisions(s.source).catch(() => [] as DailyDecisions[])),
  ]);
  // Each visa's outcomes over the whole file: the chart above them carries the
  // rate, so one rate is printed and the cards can't disagree with it.
  const perVisa = DECIDED_SERIES.map((s, i) => {
    const days = decided[i] ?? [];
    const sum = (k: "total" | "certified" | "denied" | "withdrawn") => days.reduce((n, d) => n + d[k], 0);
    return { visa: s.visa, total: sum("total"), certified: sum("certified"), denied: sum("denied"), withdrawn: sum("withdrawn") };
  }).filter((v) => v.total > 0);
  const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
  const allDecided = combine(decided);
  const earliest = summary?.byMonth.length
    ? [...summary.byMonth].map((m) => m.month).sort()[0] ?? null
    : null;
  const hasForms = !!summary && FORM_ORDER.some((p) => (summary.byPrefix[p] ?? 0) > 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />

      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          Find an H-2A, H-2B or CW-1 filing
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          Seasonal farm and non-farm work. Search the employer to get the number, the job and DOL&apos;s status.
        </p>
      </header>

      {summary ? (
        <section aria-label="What DOL has confirmed so far" className="mt-8">
          {hasForms ? (
            <ChartTips label="Each form's share of the filings DOL has confirmed">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
              {FORM_ORDER.map((p) => {
                const f = SEASONAL_FORMS[p];
                const n = summary.byPrefix[p] ?? 0;
                const pending = summary.pendingByPrefix[p] ?? 0;
                const share = summary.total > 0 ? Math.round((n / summary.total) * 100) : 0;
                if (!f) return null;
                return (
                  <li key={p} className="border-2 border-border bg-card p-4 shadow-hard">
                    <p className="font-mono text-sm font-bold">
                      {p}- <span className="text-foreground/60">· {f.form}</span>
                    </p>{" "}
                    <p className="mt-1 font-heading text-lg font-black">{f.label}</p>{" "}
                    <p className="mt-2 font-heading text-3xl font-black">{formatInt(n)}</p>{" "}
                    <p className="text-sm text-foreground/70">{formatInt(pending)} still in process</p>{" "}
                    {/* Drawn to measure: the bar is this form's share of every filing held. */}
                    <div
                      className="mt-3 h-2 w-full bg-muted"
                      aria-hidden="true"
                      data-tip={`${p}- ${f.label}\n${share}% of the ${formatInt(summary.total)} filings held\n${formatInt(n)} filings, ${formatInt(pending)} still in process`}
                    >
                      <div className="h-2 bg-primary" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            </ChartTips>
          ) : (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
              <div className="border-2 border-border bg-card p-4 shadow-hard">
                <dt className="text-sm font-bold text-foreground/70">Confirmed by DOL&apos;s daily check</dt>{" "}
                <dd className="mt-1 font-heading text-3xl font-black">{formatInt(summary.total)}</dd>
              </div>{" "}
              <div className="border-2 border-border bg-card p-4 shadow-hard">
                <dt className="text-sm font-bold text-foreground/70">Still in process</dt>{" "}
                <dd className="mt-1 font-heading text-3xl font-black">{formatInt(summary.pending)}</dd>
              </div>{" "}
              <div className="border-2 border-border bg-tint-primary p-4 shadow-hard">
                <dt className="text-sm font-bold text-foreground/70">Decided</dt>{" "}
                <dd className="mt-1 font-heading text-3xl font-black">{formatInt(summary.decided)}</dd>
              </div>
            </dl>
          )}{" "}
          {earliest ? (
            <p className="mt-3 text-sm text-foreground/70">
              Filings from {longDate(`${earliest}-01`) ?? earliest} on; checked {longDate(summary.asOf) ?? "daily"}.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8 max-w-3xl">
        <div className="border-2 border-border bg-tint-primary p-5 sm:p-6">
          <h2 className="font-heading text-lg font-black">What&apos;s in here, and what isn&apos;t</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            Every status comes from DOL&apos;s case system, pending ones included. The wage, the
            workers and the worksite come from DOL&apos;s quarterly H-2A, H-2B and CW-1 files once
            a case is decided, and, for an application DOL has accepted but not yet decided, from
            its SeasonalJobs feed.
          </p>{" "}
          {published.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-foreground/75">
              {published.map(({ visa, summary: pub }) => (
                <li key={visa}>
                  <span className="font-bold">{visa}:</span> {formatInt(pub.rows)} decided cases in DOL&apos;s file
                  {pub.latestDecision ? `, decided through ${longDate(pub.latestDecision) ?? pub.latestDecision}` : ""}.
                </li>
              ))}
            </ul>
          ) : null}{" "}
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">
            Have the number? The{" "}
            <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              status lookup
            </Link>{" "}
            takes H-300, JO-A-300, H-400, P-400, C-500 and P-500 numbers, asks DOL directly, and can email you when the status changes.
          </p>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            What each status means, and when DOL decides:{" "}
            <Link href="/guides/h2a-case-status-and-timing" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              H-2A
            </Link>{" "}
            and{" "}
            <Link href="/guides/h2b-and-cw1-case-status-and-timing" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              H-2B and CW-1
            </Link>
            .
          </p>
        </div>
      </section>

      <div className="mt-10">
        <SearchParamsBoundary>
          <FlagCaseBrowser summary={summary} program={SEASONAL_PROGRAM} />
        </SearchParamsBoundary>
      </div>

      {allDecided.length > 0 ? (
        <section aria-labelledby="seasonal-decided" className="mt-14">
          <h2 id="seasonal-decided" className="font-heading text-2xl font-black">
            What DOL decides, week by week
          </h2>{" "}
          <p className="mt-1 text-sm text-foreground/70">
            H-2A, H-2B and CW-1 together, by DOL&apos;s own decision date in its published files,{" "}
            {longDate(allDecided[0]!.date) ?? allDecided[0]!.date} to{" "}
            {longDate(allDecided[allDecided.length - 1]!.date) ?? allDecided[allDecided.length - 1]!.date}.
            {/* Measured Oct 7 2026: no H-2A, H-2B or CW-1 decision from Oct 1 to Oct 30, 2025, the
                weeks DOL's own notice says OFLC stopped all processing for the shutdown. */}
            {allDecided.some((d) => d.date.startsWith("2025-10"))
              ? " The drop in October 2025 is the government shutdown, when DOL stopped processing."
              : null}
          </p>{" "}
          <DailyDecisionsChart points={allDecided} className="mt-4" />{" "}
          <ChartTips label="How each visa's decisions came out">
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
              {perVisa.map((v) => {
                const parts = [
                  { key: "certified", n: v.certified, word: "certified", cls: "bg-data-good" },
                  { key: "denied", n: v.denied, word: "denied or rejected", cls: "bg-data-bad" },
                  { key: "withdrawn", n: v.withdrawn, word: "withdrawn", cls: "bg-data-none" },
                ];
                return (
                  <li key={v.visa} className="border-2 border-border bg-card p-4">
                    <p className="font-heading text-lg font-black">{v.visa}</p>{" "}
                    <p className="mt-1 font-heading text-3xl font-black tabular-nums">{pct(v.certified, v.total)}%</p>{" "}
                    <p className="text-sm text-foreground/70">certified, of {formatInt(v.total)} decided</p>{" "}
                    {/* Drawn to measure: each segment is that outcome's share of the visa's decisions. */}
                    <div className="mt-3 flex h-3 w-full overflow-hidden border border-border" aria-hidden="true">
                      {parts.map((part) =>
                        part.n > 0 ? (
                          <div
                            key={part.key}
                            className={part.cls}
                            style={{ width: `${(part.n / v.total) * 100}%` }}
                            data-tip={`${v.visa}: ${formatInt(part.n)} ${part.word}\n${pct(part.n, v.total)}% of ${formatInt(v.total)} decided`}
                          />
                        ) : null,
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </ChartTips>
        </section>
      ) : null}{" "}

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">How this works</h2>{" "}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground/80">
          <FinePrint summary="Where the rows come from">
            <p>
              DOL numbers every filing, PERM and H-1B included, from one running counter. This
              site walks it twice a day for new filings and re-checks each one until DOL decides.{" "}
            </p>
          </FinePrint>{" "}
          <p>
            <b className="font-bold">Why one might be missing.</b> These forms joined the live
            record on October 1, 2026, and it is still being filled in backwards; DOL&apos;s
            quarterly files reach further back and are loaded year by year. A filing from today
            appears after the next check.
          </p>
        </div>
      </section>
      <PageBasics page="seasonal-cases" />{" "}
      <DataProvenance datasets={["seasonal-status"]} />
    </div>
  );
}
