import type { Metadata } from "next";
import Link from "next/link";

import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import { daysToAnchor, summarizeScores } from "@/lib/predictionLedger";
import { getScorecard } from "@/lib/turso/scorecard";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";

/**
 * The estimate scorecard: every prediction this site made for a real case,
 * written down before the outcome, scored against DOL's decision once the
 * sweep sees it. A forecast that keeps no score is an opinion; this is the
 * page that makes the estimator answerable for its numbers.
 */

const TITLE = "PERM Estimate Scorecard";
const DESCRIPTION =
  "Every decision-date estimate this site recorded for a real PERM case, with its anchor and window, the day DOL decided, and the error in days. Never edited.";
const PATH = "/estimate-scorecard";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/estimate-scorecard" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
};

export const revalidate = 21600;

const long = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default async function EstimateScorecardPage() {
  const [rows, sweep] = await Promise.all([getScorecard(), getSweepCoverage().catch(() => null)]);
  const today = new Date().toISOString().slice(0, 10);
  const scored = rows.filter((r) => r.score !== null);
  const summary = summarizeScores(scored.map((r) => r.score!));
  const asOf = sweep?.finishedOn ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/methodology" className="underline underline-offset-2 hover:text-primary">
            Reference
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Estimate scorecard</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Every decision-date estimate this site made for a real case, recorded
          before the outcome and never edited. When DOL decides, the sweep sees
          the final status and the score fills itself in.
        </p>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <div className="border-2 border-border bg-card p-5 shadow-hard">
          <p className="text-sm text-foreground/70">Predictions recorded</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{rows.length}</p>
        </div>{" "}
        <div className="border-2 border-border bg-card p-5 shadow-hard">
          <p className="text-sm text-foreground/70">Scored so far</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{summary.n}</p>
        </div>{" "}
        <div className="border-2 border-border bg-card p-5 shadow-hard">
          <p className="text-sm text-foreground/70">Median miss, scored predictions</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">
            {summary.medianAbsErrorDays === null ? "none yet" : `${summary.medianAbsErrorDays} days`}
          </p>
        </div>
      </section>

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
          <tbody>
            {rows.map((r) => {
              const p = r.prediction;
              const toAnchor = daysToAnchor(p, today);
              return (
                <tr key={p.caseNumber} className="border-b border-border/40 align-top">
                  <td className="py-3 pr-3 tabular-nums">{p.recorded}{" "}</td>
                  <td className="py-3 pr-3 font-mono text-xs">
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

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">How this is scored</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          An estimate is recorded with the anchor and the window exactly as the case page printed them on the day. The
          error is the signed number of days between the anchor and the day DOL&apos;s index first showed a final status
          {asOf ? `, read from the sweep that finished ${formatAsOf(asOf)}` : ""}. A decision inside the printed window
          counts as inside; one outside counts against the estimate whatever the anchor said.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          Entries are never edited. When the model changes after a prediction is recorded, the change is noted beside the
          entry and the original prediction is still the one scored, because a ledger that rewrites its own predictions
          scores nothing. The estimator&apos;s backtested error over decided cases, about 50 days at the median, is on{" "}
          <Link href="/guides/how-accurate-are-perm-estimates" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the accuracy guide
          </Link>
          ; this page is the forward test, one real case at a time.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          Case numbers are public federal records. Nothing here identifies the person who watched the case.
        </p>
      </section>
    </div>
  );
}
