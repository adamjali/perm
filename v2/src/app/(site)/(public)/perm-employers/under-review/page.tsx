import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { EmployerStagesTable } from "@/components/employers/EmployerStagesTable";
import { ChartTips } from "@/components/data/ChartTips";
import { StatusRibbon, ribbonLegend, ribbonParts } from "@/components/employers/StatusRibbon";
import { stageMeta, stageSlug, hasStagePage } from "@/components/rfi/stageMeta";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import {
  HOLD_STATUS,
  QUEUE_STATUS,
  SHARE_FLOOR,
  breakdownParts,
  holdSincePhrase,
  longDate,
  holdSentence,
  nationalShare,
  rankByReview,
  rankByShare,
  type EmployerStageRow,
} from "@/lib/employerStages";
import { openGraphBase } from "@/lib/openGraphBase";
import { searchStageSlug } from "@/lib/searchStages";
import { getEmployerStages } from "@/lib/turso/employerStages";
import { withSocialCard } from "@/lib/socialCard";
import { formatInt, formatShare } from "@/lib/format";

/**
 * Employers by their PERM cases outside DOL's normal queue.
 *
 * WHY THIS PAGE EXISTS. When most of the cases on hold nationwide belong to
 * one employer, the next question is always "who else". This answers it from
 * the record, once a sweep, for every employer with pending cases, with the
 * date DOL confirmed the statuses.
 *
 * WHAT IT DOES NOT SAY. A hold, an RFI or an appeal is DOL's status for a
 * case, and nothing here calls it a finding. The page prints counts, shares
 * and dates; the reader decides what a concentration means.
 *
 * EVERY SENTENCE NAMES WHO ACTED. A heading like "Whose PERM cases DOL has
 * pulled aside" over a census that is nearly half appeals the employers
 * filed themselves says DOL did what the employers did. A hold, an RFI, a
 * NORD and supervised recruitment are DOL's doing; an appeal is the
 * employer's; the copy says so.
 *
 * NEVER A REASON DOL HASN'T GIVEN, AND NEVER ONE EMPLOYER'S NEXT TO ANOTHER'S.
 * A public explanation of one employer's hold, printed beside a different
 * employer's count, reads as an explanation of both. That is the one way this
 * page's true numbers could become a false statement, so explanations live in
 * the on-hold guide, named and sourced, and never here.
 *
 * THE DATES COME FROM THIS SITE'S OWN RECORD (`perm_case_events`, which begins
 * Aug 27 2026 Eastern). The sweep writes `holdSince` per employer and the
 * `holdMoves` feed into the same doc; a doc without them renders the counts
 * and hides the dated parts.
 */

const TITLE = "PERM Employers With Cases On Hold or Audited";
const DESCRIPTION =
  "Every employer with PERM cases outside DOL's normal queue: on hold, at RFI or NORD, or under appeal. Counts, shares and dates from DOL's live record.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-employers/under-review" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/perm-employers/under-review" },
}, "perm-employers-under-review");

// The document is rewritten by the 4:10 AM ET sweep; six hours keeps the
// page within a working day of it without a rebuild per visit.
export const revalidate = 21600;

/** The employer with the most cases at one status, or null when nobody has any. */
function topHolder(rows: readonly EmployerStageRow[], status: string): EmployerStageRow | null {
  let best: EmployerStageRow | null = null;
  for (const r of rows) {
    const n = r.byStatus[status] ?? 0;
    if (n > 0 && (best === null || n > (best.byStatus[status] ?? 0))) best = r;
  }
  return best;
}
const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

function breakdown(r: EmployerStageRow): string {
  const parts = breakdownParts(r);
  return parts.length ? `, ${parts.join(", ")}` : "";
}

const MOVES_SHOWN = 12;

export default async function EmployersUnderReviewPage() {
  const doc = await getEmployerStages();

  const stages = doc
    ? Object.entries(doc.nationwide)
        .filter(([status]) => status !== QUEUE_STATUS)
        .sort((a, b) => b[1] - a[1])
    : [];
  const byReview = doc ? rankByReview(doc.employers, 10) : [];
  const byShare = doc ? rankByShare(doc.employers, 10) : [];
  const allMoves = doc ? doc.holdMoves : [];
  const moves = allMoves.slice(0, MOVES_SHOWN);
  const earlier = allMoves.slice(MOVES_SHOWN);
  const moveItem = (m: (typeof allMoves)[number]) => (
    <Fragment key={`${m.date}-${m.slug ?? m.name}-${m.dir}-${m.to}`}>{" "}
    <li className="grid grid-cols-1 gap-y-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-4">
      <span className="font-mono text-sm font-semibold">{longDate(m.date)}</span>{" "}
      <span className="text-base [overflow-wrap:anywhere]">
        {m.slug ? (
          <Link href={`/perm-employers/${m.slug}`} className={`font-bold ${LINK}`}>
            {m.name}
          </Link>
        ) : (
          <span className="font-bold">{m.name}</span>
        )}
        {`: ${holdSentence(m)}`}
      </span>
    </li>
    </Fragment>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        Employers with PERM cases on hold, at RFI or under appeal
      </h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-foreground/90">
        Most pending PERM cases wait in DOL&apos;s normal queue. This page counts the rest by employer:
        cases DOL has put on hold, questioned (an RFI or a deficiency notice) or placed in supervised
        recruitment, and denials the employer has appealed.
      </p>{" "}
      <aside className="mt-6 max-w-3xl border-2 border-border bg-card p-5 shadow-hard">
        <p className="text-base font-bold">Waiting on one of these cases?</p>{" "}
        <p className="mt-1 text-base leading-relaxed text-foreground/85">
          <Link href="/perm-case-status" className={LINK}>
            Look up your case number
          </Link>{" "}
          for its current status and an email when it changes, or follow an employer from its page.{" "}
          <Link href="/guides/perm-application-on-hold-meaning" className={LINK}>
            What &ldquo;on hold&rdquo; means
          </Link>
          .
        </p>
      </aside>{" "}

      {!doc ? (
        <p className="mt-10 border-2 border-border bg-card p-5 text-base">
          The employer census has not been written yet, or is more than eight
          days old. It is rebuilt by the daily sweep of DOL&apos;s case system;
          until then the{" "}
          <Link href="/perm-rfi-audit" className={LINK}>
            stage pages
          </Link>{" "}
          carry the same cases one stage at a time.
        </p>
      ) : (
        <>
          <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
            <h2 className="font-heading text-xl font-black sm:text-2xl">Nationwide, as of {longDate(doc.asOf)}</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              {formatInt(doc.pendingTotal)} PERM cases are pending. {formatInt(doc.nationwide[QUEUE_STATUS] ?? 0)} of them
              are in analyst review; the rest sit at one of these stages.
            </p>{" "}
            <dl className="mt-5 border-t-2 border-border">
              {stages.map(([status, n]) => (
                <Fragment key={status}>{" "}
                <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
                  <dt className="font-heading text-xl font-black tabular-nums tracking-tight sm:text-2xl">{formatInt(n)}</dt>{" "}
                  <dd className="text-base leading-snug">
                    {hasStagePage(status) ? (
                      <Link href={`/perm-rfi-audit/${stageSlug(status)}`} className={LINK}>
                        {stageMeta(status).label}
                      </Link>
                    ) : (
                      stageMeta(status).label
                    )}
                  </dd>{" "}
                  <dd className="font-mono text-sm text-muted-foreground sm:text-right">
                    {(() => {
                      const top = topHolder(doc.employers, status);
                      return top ? `largest single employer holds ${formatShare(nationalShare(top, status, doc.nationwide))}` : "";
                    })()}
                  </dd>
                </div>
                </Fragment>
              ))}
            </dl>
          </section>{" "}

          {doc.logFrom ? (
            <section className="mt-10">
              <h2 className="font-heading text-xl font-black sm:text-2xl">When DOL moved an employer&apos;s cases</h2>{" "}
              <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
                Days on which DOL moved five or more of one employer&apos;s
                cases into or out of hold, from this site&apos;s daily record
                since {longDate(doc.logFrom)}. Each line is a date and a count.
                DOL publishes no reason with a status change.
              </p>{" "}
              {moves.length === 0 ? (
                <p className="mt-4 text-base text-foreground/80">None since {longDate(doc.logFrom)}.</p>
              ) : (
                <>
                  <ol className="mt-4 divide-y-2 divide-border border-y-2 border-border">
                    {moves.map(moveItem)}
                  </ol>{" "}
                  {earlier.length > 0 ? (
                    <details className="mt-3">
                      <summary className="min-h-11 cursor-pointer py-2 text-base font-bold underline decoration-primary decoration-2 underline-offset-2">
                        {`The ${MOVES_SHOWN} newest of ${allMoves.length.toLocaleString("en-US")}. Show the other ${earlier.length.toLocaleString("en-US")}`}
                      </summary>
                      <ol className="mt-2 divide-y-2 divide-border border-y-2 border-border">
                        {earlier.map(moveItem)}
                      </ol>
                    </details>
                  ) : null}
                </>
              )}
            </section>
          ) : null}{" "}

          <section className="mt-10">
            <h2 className="font-heading text-xl font-black sm:text-2xl">Most cases outside the normal queue</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              By count. The biggest filers lead this list because they file the
              most; the share list below corrects for size.
            </p>{" "}
            <ChartTips label="Pending cases outside the normal queue, by employer" className="mt-4">
            <ol className="divide-y-2 divide-border border-y-2 border-border">
              {byReview.map((r, i) => (
                <Fragment key={r.slug ?? r.name}>{" "}
                <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-3">
                  <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>{" "}
                  <span>
                    {r.slug ? (
                      <Link href={`/perm-employers/${r.slug}`} className={`font-bold ${LINK}`}>
                        {r.name}
                      </Link>
                    ) : (
                      <span className="font-bold">{r.name}</span>
                    )}{" "}
                    <span className="text-sm text-foreground/70">
                      {`${formatInt(r.review)} of ${formatInt(r.pending)} pending${breakdown(r)}`}
                    </span>{" "}
                    <span className="mt-2 block max-w-sm">
                      <StatusRibbon
                        size="sm"
                        name={r.name}
                        parts={ribbonParts(r)}
                        label={ribbonLegend(ribbonParts(r)).map((l) => l.text).join("; ")}
                      />
                    </span>{" "}
                    {(() => {
                      const since = holdSincePhrase(r, doc.logFrom);
                      return since ? <span className="mt-0.5 block text-sm text-foreground/70">{`${since.charAt(0).toUpperCase()}${since.slice(1)}.`}</span> : null;
                    })()}
                  </span>{" "}
                  <span className="flex flex-col items-end">
                    <span className="font-heading text-lg font-black tabular-nums">{formatShare(r.share)}</span>{" "}
                    {r.slug ? (
                      <Link
                        href={`/perm-employers/${r.slug}#follow`}
                        className={`inline-flex min-h-[44px] items-center text-sm font-bold ${LINK}`}
                        aria-label={`Follow ${r.name}`}
                      >
                        Follow
                      </Link>
                    ) : null}
                  </span>
                </li>
                </Fragment>
              ))}
            </ol>
            </ChartTips>
          </section>{" "}

          <section className="mt-10">
            <h2 className="font-heading text-xl font-black sm:text-2xl">Highest share of their own queue</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              Employers with at least {SHARE_FLOOR} pending cases, ranked by the
              share outside the normal queue. Below that floor a share is noise:
              two of two is not a pattern.
            </p>{" "}
            <ChartTips label="Share of each employer's queue outside the normal queue" className="mt-4">
            <ol className="divide-y-2 divide-border border-y-2 border-border">
              {byShare.map((r, i) => (
                <Fragment key={r.slug ?? r.name}>{" "}
                <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-3">
                  <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>{" "}
                  <span>
                    {r.slug ? (
                      <Link href={`/perm-employers/${r.slug}`} className={`font-bold ${LINK}`}>
                        {r.name}
                      </Link>
                    ) : (
                      <span className="font-bold">{r.name}</span>
                    )}{" "}
                    <span className="text-sm text-foreground/70">
                      {`${formatInt(r.review)} of ${formatInt(r.pending)} pending${breakdown(r)}`}
                    </span>{" "}
                    <span className="mt-2 block max-w-sm">
                      <StatusRibbon
                        size="sm"
                        name={r.name}
                        parts={ribbonParts(r)}
                        label={ribbonLegend(ribbonParts(r)).map((l) => l.text).join("; ")}
                      />
                    </span>
                  </span>{" "}
                  <span className="flex flex-col items-end">
                    <span className="font-heading text-lg font-black tabular-nums">{formatShare(r.share)}</span>{" "}
                    {r.slug ? (
                      <Link
                        href={`/perm-employers/${r.slug}#follow`}
                        className={`inline-flex min-h-[44px] items-center text-sm font-bold ${LINK}`}
                        aria-label={`Follow ${r.name}`}
                      >
                        Follow
                      </Link>
                    ) : null}
                  </span>
                </li>
                </Fragment>
              ))}
            </ol>
            </ChartTips>
          </section>{" "}

          <section className="mt-10">
            <h2 className="font-heading text-xl font-black sm:text-2xl">Every employer with five or more pending cases</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              {formatInt(doc.employers.length)} employers. Search by name, sort any column, or
              download the table. Each name opens the employer&apos;s page; to see the
              cases themselves, open the{" "}
              <Link href={`/case-search?stage=${searchStageSlug(HOLD_STATUS) ?? ""}`} className={LINK}>
                case search with a stage selected
              </Link>{" "}
              and type the employer.
            </p>{" "}
            <div className="mt-5">
              <EmployerStagesTable rows={doc.employers} asOf={doc.asOf} logFrom={doc.logFrom} />
            </div>
          </section>{" "}

          <section className="mt-10 max-w-3xl">
            <h2 className="font-heading text-xl font-black sm:text-2xl">What a count here does and does not mean</h2>{" "}
            <p className="mt-3 text-base leading-relaxed text-foreground/85">
              These are DOL&apos;s own status words, confirmed on the date above. They say where a case is,
              never why: a hold can be administrative, an RFI is routine, and an appeal is the
              employer&apos;s own filing.
            </p>{" "}
            <p className="mt-3 text-base leading-relaxed text-foreground/85">
              This site&apos;s record of status changes began on {longDate(doc.logFrom ?? "2026-08-27")}, so a
              hold already in place then reads &ldquo;since before&rdquo; that date.{" "}
              <Link href="/perm-decision-activity" className={LINK}>
                Decision activity
              </Link>{" "}
              shows each day&apos;s changes since.
            </p>
          </section>
        </>
      )}{" "}

      <DataProvenance datasets={["perm-case-status"]} />

      <ToolPageFooter
        currentHref="/perm-employers/under-review"
        reading={[
          { href: "/perm-rfi-audit", label: "RFIs, audits and appeals", note: "the same cases, stage by stage" },
          { href: "/perm-employers", label: "Every PERM employer", note: "filings, approval rates and wages from DOL's files" },
          { href: "/case-search", label: "Case search", note: "an employer, a stage, a filing month, combined" },
        ]}
      />
    </div>
  );
}
