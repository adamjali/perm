import type { Metadata } from "next";
import Link from "next/link";

import { BarRows } from "@/components/data/BarRows";
import { FinePrint } from "@/components/data/FinePrint";
import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import { daysToAnchor } from "@/lib/predictionLedger";
import { HORIZONS, type Cell } from "@/lib/scorecard/score";
import { getEstimatorBacktest, getScorecardSummary } from "@/lib/turso/predictions";
import { getScorecard } from "@/lib/turso/scorecard";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The estimate scorecard, in three layers, strongest evidence first.
 *
 * 1. The standing backtest (weekly, `scripts/backtest_queue.py`): the queue
 *    rebuilt as it stood on a past day and every in-line case near the front
 *    dated the way the site dates it, graded against thousands of real DOL
 *    decisions. It is what moved the estimator on 2026-09-26.
 * 2. The daily sample (`/api/cron/scorecard`): a few random pending cases
 *    from every filing month, recorded each morning BEFORE the outcome and
 *    graded when DOL decides. Forward, uncherry-pickable, and slow to fill.
 * 3. The hand-recorded ledger, kept as worked examples.
 *
 * A forecast that keeps no score is an opinion; this is the page that makes
 * the estimator answerable for its numbers.
 */

const TITLE = "PERM Estimate Scorecard";
const DESCRIPTION =
  "How close our PERM decision dates land: a weekly backtest over thousands of real DOL decisions, and a daily sample recorded before the outcome.";
const PATH = "/estimate-scorecard";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/estimate-scorecard" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "estimate-scorecard");

export const revalidate = 21600;

const longNoYear = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const long = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const pct = (x: number | null) => (x === null ? "none yet" : `${Math.round(x * 100)}%`);
const days = (x: number | null) => (x === null ? "none yet" : `${Math.round(x)} ${Math.round(x) === 1 ? "day" : "days"}`);
const int = (n: number) => n.toLocaleString("en-US");
const HORIZON_LABEL: Record<(typeof HORIZONS)[number], string> = {
  "0-30": "Dated within a month",
  "31-90": "One to three months out",
  "91-180": "Three to six months out",
  "181+": "More than six months out",
};

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 border-2 border-border bg-background p-4">
      <p className="text-sm font-bold text-foreground/70">{label}</p>{" "}
      <p className="mt-1 font-heading text-3xl font-black tabular-nums">{value}</p>{" "}
      <p className="mt-1 text-sm text-foreground/70">{note}</p>
    </div>
  );
}

function SampleCells({ cell, since }: { cell: Cell; since: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
      <Figure label="Recorded" value={int(cell.recorded)} note={since ? `predictions since ${long(since)}` : "predictions"} />
      <Figure label="Graded" value={int(cell.graded)} note="DOL has decided these (withdrawals left out)" />
      <Figure label="Typical miss" value={days(cell.typicalMissDays)} note="median distance, decided cases" />
      <Figure label="Inside the range" value={pct(cell.inBandShare)} note="decided between the range's two ends" />
    </div>
  );
}

export default async function EstimateScorecardPage() {
  const [rows, sweep, sample, backtest] = await Promise.all([
    getScorecard(),
    getSweepCoverage().catch(() => null),
    getScorecardSummary().catch(() => null),
    getEstimatorBacktest().catch(() => null),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const asOf = sweep?.finishedOn ?? null;
  const perm = sample?.perm.bySource.ours ?? null;
  const pwd = sample?.pwd.bySource.ours ?? null;
  const cur = backtest?.current ?? null;
  const old = backtest?.allPending ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/methodology" className="underline underline-offset-2 hover:text-primary">
            Reference
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Estimate scorecard</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          How close our PERM decision dates land, graded against what DOL actually did.
        </p>
      </header>

      {backtest && cur && cur.typicalMissDays !== null ? (
        <section aria-labelledby="backtest-h" className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <h2 id="backtest-h" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Typical miss, real decisions
          </h2>{" "}
          <p className="mt-2 font-heading text-6xl font-black leading-none tabular-nums sm:text-7xl">
            {days(cur.typicalMissDays)}
          </p>{" "}
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
            Across {int(cur.decided)} cases DOL decided between {longNoYear(backtest.t0)} and {long(backtest.end)},
            each dated the way the site dates it, from the queue as it stood on the first of those days.
          </p>{" "}
          {old && old.typicalMissDays !== null ? (
            <BarRows
              className="mt-6 max-w-3xl"
              max={Math.max(cur.typicalMissDays, old.typicalMissDays)}
              rows={[
                {
                  key: "cur",
                  label: "Counting only the normal queue",
                  sub: "what every estimate here does now",
                  value: cur.typicalMissDays,
                  text: days(cur.typicalMissDays),
                },
                {
                  key: "old",
                  label: "Counting every pending case",
                  sub: "the rule until September 26, 2026, which also counted cases on hold, at an RFI or on appeal",
                  value: old.typicalMissDays,
                  text: days(old.typicalMissDays),
                  tone: "ink",
                },
              ]}
            />
          ) : null}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            <Figure label="Within a week" value={pct(cur.within7Share)} note="of those decisions" />
            {backtest.rangeCoverage?.insideShare != null ? (
              <Figure
                label="Inside the printed range"
                value={pct(backtest.rangeCoverage.insideShare)}
                note={`of ${int(backtest.rangeCoverage.judged)} cases dated a week or more before the end; a case still waiting counts as a miss`}
              />
            ) : null}
            <Figure
              label="Right about the window"
              value={pct(cur.decidedByEndRight)}
              note={`said "decided by ${long(backtest.end)}" or "not yet", and was right`}
            />
            <Figure label={"DOL\u2019s pace used"} value={`${int(Math.round(backtest.pace))} a day`} note="the measured average before the first day" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Recomputed every Monday. This run: {formatAsOf(new Date(backtest.computedAt).toISOString().slice(0, 10))}.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="sample-h" className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 id="sample-h" className="font-heading text-2xl font-black sm:text-3xl">A fresh sample, every morning</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80">
          Each day a few random pending cases from every filing month get the estimate the case page would show them,
          written down before DOL decides and graded once it has. Nobody picks the cases.
        </p>{" "}
        {perm ? (
          <>
            <div className="mt-6">
              <SampleCells cell={perm.all} since={sample?.perm.since ?? null} />
            </div>{" "}
            {perm.all.graded > 0 ? (
              <BarRows
                className="mt-6 max-w-3xl"
                rows={HORIZONS.filter((h) => perm.byHorizon[h].graded > 0).map((h) => ({
                  key: h,
                  label: HORIZON_LABEL[h],
                  sub: `${int(perm.byHorizon[h].graded)} graded of ${int(perm.byHorizon[h].recorded)} recorded`,
                  value: perm.byHorizon[h].typicalMissDays,
                  text: days(perm.byHorizon[h].typicalMissDays),
                }))}
              />
            ) : null}
            {sample && sample.recent.length > 0 ? (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-left text-base">
                  <caption className="mb-2 text-left text-sm font-bold text-foreground/70">Newest graded</caption>
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th scope="col" className="py-2 pr-3 font-bold">{"Case "}</th>
                      <th scope="col" className="py-2 pr-3 font-bold">{"Recorded "}</th>
                      <th scope="col" className="py-2 pr-3 font-bold">{"Predicted "}</th>
                      <th scope="col" className="py-2 pr-3 font-bold">{"Decided "}</th>
                      <th scope="col" className="py-2 text-right font-bold">{"Miss "}</th>
                    </tr>
                  </thead>
                  <tbody translate="no">
                    {sample.recent.map((r) => (
                      <tr key={`${r.caseNumber}-${r.recordedOn}`} className="border-b border-border/40">
                        <td className="py-2 pr-3 font-mono text-sm">{`${r.caseNumber} `}</td>
                        <td className="py-2 pr-3 tabular-nums">{`${r.recordedOn} `}</td>
                        <td className="py-2 pr-3 tabular-nums">{`${r.predicted} `}</td>
                        <td className="py-2 pr-3 tabular-nums">{`${r.decidedOn} `}</td>
                        <td className="py-2 text-right tabular-nums">
                          {`${signed(Math.round((Date.parse(r.decidedOn) - Date.parse(r.predicted)) / 86_400_000))} days `}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {perm.all.graded > 0 ? null : (
              <p className="mt-4 text-base text-foreground/80">
                None graded yet. The nearest sampled cases are due within weeks, and the grades appear here the morning
                after DOL decides each one.
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-base text-foreground/80">
            The first sample is recorded the morning after this page went live. Grades follow as DOL decides.
          </p>
        )}
        {pwd && pwd.all.recorded > 0 ? (
          <p className="mt-6 border-t-2 border-border pt-4 text-base text-foreground/80">
            <b className="font-bold text-foreground">Prevailing wage requests:</b> {int(pwd.all.recorded)} recorded,{" "}
            {int(pwd.all.graded)} graded
            {pwd.all.graded > 0 ? <>, typical miss {days(pwd.all.typicalMissDays)}</> : null}. That estimate names a
            month, so it is graded against the middle of the month.
          </p>
        ) : null}
      </section>

      <h2 className="mt-12 font-heading text-2xl font-black sm:text-3xl">Worked examples</h2>{" "}
      <p className="mt-2 max-w-2xl text-base text-foreground/80">
        Cases we wrote down by hand, before the outcome, exactly as the case page printed them.
      </p>

      <section className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-border">
              <th scope="col" className="py-2 pr-3 font-bold">Recorded{" "}</th>
              <th scope="col" className="py-2 pr-3 font-bold">Case{" "}</th>
              <th scope="col" className="py-2 pr-3 font-bold">Filed{" "}</th>
              <th scope="col" className="py-2 pr-3 font-bold">Anchor{" "}</th>
              <th scope="col" className="py-2 pr-3 font-bold">Window{" "}</th>
              <th scope="col" className="py-2 pr-3 font-bold">Status now{" "}</th>
              <th scope="col" className="py-2 pr-3 font-bold">Decided{" "}</th>
              <th scope="col" className="py-2 text-right font-bold">Error{" "}</th>
            </tr>
          </thead>
          <tbody translate="no">
            {rows.map((r) => {
              const p = r.prediction;
              const toAnchor = daysToAnchor(p, today);
              return (
                <tr key={p.caseNumber} className="border-b border-border/40 align-top">
                  <td className="py-3 pr-3 tabular-nums">{p.recorded}{" "}</td>
                  <td className="py-3 pr-3 font-mono text-sm">
                    <Link href={`/perm-case-status?case=${p.caseNumber}`} className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                      {p.caseNumber}
                    </Link>
                  {" "}</td>
                  <td className="py-3 pr-3 tabular-nums">{p.filed}{" "}</td>
                  <td className="py-3 pr-3">{p.anchor}{" "}</td>
                  <td className="py-3 pr-3 tabular-nums">
                    {p.windowFrom} to {p.windowTo}
                  {" "}</td>
                  <td className="py-3 pr-3">{r.status ?? "not in the index"}{" "}</td>
                  <td className="py-3 pr-3 tabular-nums">
                    {r.decidedOn ? long(r.decidedOn) : toAnchor >= 0 ? `pending, ${toAnchor} days to the anchor` : `pending, ${-toAnchor} days past the anchor`}
                  {" "}</td>
                  <td className="py-3 text-right tabular-nums">
                    {r.score ? `${signed(r.score.errorDays)} days, ${r.score.inWindow ? "inside" : "outside"} the window` : "not yet"}
                  {" "}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {rows.some((r) => r.prediction.note) ? (
        <section className="mt-8 max-w-3xl">
          <h2 className="font-heading text-xl font-black">Notes on the record</h2>{" "}
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/80">
            {rows
              .filter((r) => r.prediction.note)
              .map((r) => (
                <li key={r.prediction.caseNumber}>
                  <span className="font-mono text-xs font-bold">{r.prediction.caseNumber}</span>: {r.prediction.note}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <FinePrint className="mt-10" summary="How this is scored">
        <p>
          The error is the signed number of days between the date an estimate named and the day DOL&apos;s index first
          showed the case decided{asOf ? `, read from the sweep that finished ${formatAsOf(asOf)}` : ""}. Positive means
          DOL decided later than predicted. Withdrawals are recorded and never graded: an employer pulling a case isn&apos;t
          DOL&apos;s clock.
        </p>{" "}
        <p>
          Grading only decided cases would favour estimates that called an early decision, since those resolve first. So
          a prediction whose date passed more than 30 days ago counts as a miss while the case is still pending.
        </p>{" "}
        <p>
          The backtest rebuilds the queue from today&apos;s records and the change log: a case&apos;s status on the day
          is the one its first later change moved it from. Cases found after that day are counted as if we had known
          them, which slightly overstates what the site knew at the time.
        </p>{" "}
        <p>
          Entries are never edited. When the model changes after a prediction is recorded, the original prediction is
          still the one scored. Case numbers are public federal records; nothing here identifies the person who watched a
          case.
        </p>
      </FinePrint>
    </div>
  );
}
