import type { Metadata } from "next";
import Link from "next/link";

import { ChartTips } from "@/components/data/ChartTips";
import { PageBasics } from "@/components/data/PageBasics";
import { FinePrint } from "@/components/data/FinePrint";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FlagCaseBrowser, SEASONAL_PROGRAM } from "@/components/tools/FlagCaseBrowser";
import { openGraphBase } from "@/lib/openGraphBase";
import { getSeasonalSummary } from "@/lib/turso/seasonalCases";
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

const TITLE = "H-2A and H-2B Case Search";
const DESCRIPTION =
  "Find an H-2A or H-2B labor certification (ETA-9142A, 9142B) or H-2B wage request by employer, with DOL's current status from its daily check.";

// No card of its own yet (a card is a capture of the rendered page, made
// after it ships); until then the root home card stands in.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/seasonal-cases" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/seasonal-cases",
  },
};

export const revalidate = 86400;

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** The forms in the order a reader meets them: farm work and its job order, other seasonal work and its wage, then CW-1. */
const FORM_ORDER = ["H-300", "JO-A-300", "H-400", "P-400", "C-500", "P-500"] as const;

export default async function SeasonalCasesPage() {
  const summary = await getSeasonalSummary();
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
            number of workers and the worksite are in DOL&apos;s quarterly files, which this
            page doesn&apos;t load yet.
          </p>{" "}
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">
            Have the number? The{" "}
            <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              status lookup
            </Link>{" "}
            takes H-300, JO-A-300, H-400, P-400, C-500 and P-500 numbers, asks DOL directly, and can email you when the status changes.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <SearchParamsBoundary>
          <FlagCaseBrowser summary={summary} program={SEASONAL_PROGRAM} />
        </SearchParamsBoundary>
      </div>

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
            <b className="font-bold">Why one might be missing.</b> These forms were added on
            October 1, 2026, and the record is still being filled in backwards through earlier
            filings. A filing from today appears after the next check.
          </p>
        </div>
      </section>
      <PageBasics page="seasonal-cases" />{" "}
      <DataProvenance datasets={["seasonal-status"]} />
    </div>
  );
}
