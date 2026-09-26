import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { EmployerStagesTable } from "@/components/employers/EmployerStagesTable";
import { StatusRibbon, ribbonLegend, ribbonParts } from "@/components/employers/StatusRibbon";
import { stageMeta, stageSlug, isReviewStage } from "@/components/rfi/stageMeta";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
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

/**
 * Employers by their PERM cases outside DOL's normal queue.
 *
 * WHY THIS PAGE EXISTS. On Sep 5 2026 a reader worked out by hand, from this
 * site's employer page and its "application on hold" stage page, that 1,831
 * of the 1,855 PERM cases on hold nationwide belonged to one employer. The
 * Inspector General confirmed the suspension three days later, and every
 * follow-up asked the same next question: who else. This is that question
 * answered from the record, once a sweep, for every employer with pending
 * cases, with the date DOL confirmed the statuses.
 *
 * WHAT IT DOES NOT SAY. A hold, an RFI or an appeal is DOL's status for a
 * case, and nothing here calls it a finding. The page prints counts, shares
 * and dates; the reader decides what a concentration means.
 *
 * EVERY SENTENCE NAMES WHO ACTED (Sep 25 2026). The first version was headed
 * "Whose PERM cases DOL has pulled aside" over 5,958 cases, 2,848 of them
 * appeals the employers filed themselves. It was quoted to 127,000 people on
 * X the day Adobe's holds landed. A hold, an RFI, a NORD and supervised
 * recruitment are DOL's doing; an appeal is the employer's; the copy says so.
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

const int = (n: number) => n.toLocaleString("en-US");

/** The employer with the most cases at one status, or null when nobody has any. */
function topHolder(rows: readonly EmployerStageRow[], status: string): EmployerStageRow | null {
  let best: EmployerStageRow | null = null;
  for (const r of rows) {
    const n = r.byStatus[status] ?? 0;
    if (n > 0 && (best === null || n > (best.byStatus[status] ?? 0))) best = r;
  }
  return best;
}
const pct = (x: number) => `${(x * 100).toFixed(x >= 0.1 ? 0 : 1)}%`;
const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

function breakdown(r: EmployerStageRow): string {
  const parts = breakdownParts(r);
  return parts.length ? `, ${parts.join(", ")}` : "";
}

const MOVES_SHOWN = 12;

export default async function EmployersUnderReviewPage() {
  const doc = await getEmployerStages();
  const breadcrumbs = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "Employers", href: "/perm-employers" },
    { name: "Under review", href: "/perm-employers/under-review" },
  ]);

  const stages = doc
    ? Object.entries(doc.nationwide)
        .filter(([status]) => status !== QUEUE_STATUS)
        .sort((a, b) => b[1] - a[1])
    : [];
  const byReview = doc ? rankByReview(doc.employers, 10) : [];
  const byShare = doc ? rankByShare(doc.employers, 10) : [];
  const moves = doc ? doc.holdMoves.slice(0, MOVES_SHOWN) : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <JsonLdScript schema={breadcrumbs} />
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        Employers and wages
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        Employers with PERM cases on hold, at RFI or under appeal
      </h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-foreground/90">
        Most pending PERM cases wait in analyst review, DOL&apos;s normal queue.
        The rest are somewhere else: DOL has put them on hold, sent a request
        for information or a notice of deficiency, or placed them in
        supervised recruitment, or the employer has appealed a denial. This
        page counts those cases employer by employer from DOL&apos;s live
        record and dates the holds from this site&apos;s daily record.
      </p>{" "}
      <aside className="mt-6 max-w-3xl border-2 border-border bg-card p-5 shadow-hard">
        <p className="text-base font-bold">Waiting on one of these cases?</p>{" "}
        <p className="mt-1 text-base leading-relaxed text-foreground/85">
          <Link href="/perm-case-status" className={LINK}>
            Look up your case number
          </Link>{" "}
          to see DOL&apos;s current status and get an email the day it changes,
          or follow an employer from its page to hear when DOL moves its cases
          as a group.{" "}
          <Link href="/guides/perm-application-on-hold-meaning" className={LINK}>
            What &ldquo;on hold&rdquo; means
          </Link>{" "}
          covers what the status does and doesn&apos;t tell you.
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
              {int(doc.pendingTotal)} PERM cases are pending. {int(doc.nationwide[QUEUE_STATUS] ?? 0)} of them
              are in analyst review; the rest sit at one of these stages.
            </p>{" "}
            <dl className="mt-5 border-t-2 border-border">
              {stages.map(([status, n]) => (
                <Fragment key={status}>{" "}
                <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
                  <dt className="font-heading text-xl font-black tabular-nums tracking-tight sm:text-2xl">{int(n)}</dt>{" "}
                  <dd className="text-base leading-snug">
                    {isReviewStage(status) ? (
                      <Link href={`/perm-rfi-audit/${stageSlug(status)}`} className={LINK}>
                        {stageMeta(status).label}
                      </Link>
                    ) : (
                      stageMeta(status).label
                    )}
                  </dd>{" "}
                  <dd className="font-mono text-xs text-muted-foreground sm:text-right">
                    {(() => {
                      const top = topHolder(doc.employers, status);
                      return top ? `largest single employer holds ${pct(nationalShare(top, status, doc.nationwide))}` : "";
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
                <ol className="mt-4 divide-y-2 divide-border border-y-2 border-border">
                  {moves.map((m) => (
                    <Fragment key={`${m.date}-${m.slug ?? m.name}-${m.dir}-${m.to}`}>{" "}
                    <li className="grid grid-cols-1 gap-y-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-4">
                      <span className="font-mono text-sm font-semibold">{longDate(m.date)}</span>{" "}
                      <span className="text-base">
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
                  ))}
                </ol>
              )}
            </section>
          ) : null}{" "}

          <section className="mt-10">
            <h2 className="font-heading text-xl font-black sm:text-2xl">Most cases outside the normal queue</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              By count. The biggest filers lead this list because they file the
              most; the share list below corrects for size.
            </p>{" "}
            <ol className="mt-4 divide-y-2 divide-border border-y-2 border-border">
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
                      {`${int(r.review)} of ${int(r.pending)} pending${breakdown(r)}`}
                    </span>{" "}
                    <span className="mt-2 block max-w-sm">
                      <StatusRibbon
                        size="sm"
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
                    <span className="font-heading text-lg font-black tabular-nums">{pct(r.share)}</span>{" "}
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
          </section>{" "}

          <section className="mt-10">
            <h2 className="font-heading text-xl font-black sm:text-2xl">Highest share of their own queue</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              Employers with at least {SHARE_FLOOR} pending cases, ranked by the
              share outside the normal queue. Below that floor a share is noise:
              two of two is not a pattern.
            </p>{" "}
            <ol className="mt-4 divide-y-2 divide-border border-y-2 border-border">
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
                      {`${int(r.review)} of ${int(r.pending)} pending${breakdown(r)}`}
                    </span>{" "}
                    <span className="mt-2 block max-w-sm">
                      <StatusRibbon
                        size="sm"
                        parts={ribbonParts(r)}
                        label={ribbonLegend(ribbonParts(r)).map((l) => l.text).join("; ")}
                      />
                    </span>
                  </span>{" "}
                  <span className="flex flex-col items-end">
                    <span className="font-heading text-lg font-black tabular-nums">{pct(r.share)}</span>{" "}
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
          </section>{" "}

          <section className="mt-10">
            <h2 className="font-heading text-xl font-black sm:text-2xl">Every employer with five or more pending cases</h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
              {int(doc.employers.length)} employers. Search by name, sort any column, or
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
              &ldquo;On hold&rdquo;, &ldquo;RFI issued&rdquo; and the appeal stages are DOL&apos;s
              own status words for a case, read from its case system and
              confirmed on the date above. They describe where a case is and
              say nothing about why. A hold can be administrative; an RFI is a
              routine request; an appeal is the employer&apos;s own filing. This
              page ranks counts and shares and draws no conclusion from them.
            </p>{" "}
            <p className="mt-3 text-base leading-relaxed text-foreground/85">
              This site&apos;s record of status changes began on{" "}
              {longDate(doc.logFrom ?? "2026-08-27")}. A hold that was already in
              place then carries &ldquo;since before&rdquo; that date rather than a
              guess, and a case first found already on hold says so. The{" "}
              <Link href="/perm-decision-activity" className={LINK}>
                decision activity
              </Link>{" "}
              page shows the changes DOL made on each day since.
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
