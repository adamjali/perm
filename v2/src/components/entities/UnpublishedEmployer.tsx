import { Fragment } from "react";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { statusMeaning } from "@/lib/caseStatusVocabulary";
import type { LiveCaseRow } from "@/lib/turso/cases";
import type { LiveEmployerRecord } from "@/lib/turso/liveEmployers";

/**
 * An employer's page when DOL has never published a thing about them.
 *
 * ## Why this page exists at all
 *
 * If we hold information about something, a person should be able to find it
 * everywhere they would reasonably look. A case is findable by number, and
 * that lookup names its employer - so the employer has to be findable by
 * name, and a search result that 404s on click is worse than no result. On
 * 2026-08-30 this covered 21,495 employers - 23% of the 93,007 we hold, and
 * 57% of the 37,813 the live feed names - every one of them invisible to
 * anyone who did not already know a case number.
 *
 * ## What it must never do
 *
 * Every figure on the ordinary employer page - approval rate, median days to
 * decision, median offered wage, rank, percentile, position in the field,
 * volume peers - is computed from DECIDED cases in DOL's quarterly disclosure
 * files. For these employers that corpus is EMPTY. Not small: empty. So none
 * of those figures appear here, in any form, including a dash in a stat card
 * where a number would go, because a card that says "Approval: -" still
 * asserts that an approval rate is the kind of thing this page is about.
 *
 * What it shows instead is the record we genuinely hold: the individual
 * cases, DOL's own live status on each, and the dates. The page says in
 * visible prose why the rest is missing rather than leaving a reader to infer
 * it from absence.
 *
 * ## Why it is noindex
 *
 * 17,681 of those 21,495 employers have exactly ONE case. A page listing one
 * pending case, times twenty thousand, is the scaled-thin-content pattern
 * Google's own policy names, whatever the intent behind it. These exist so a
 * HUMAN who is looking can find them. The route sets `robots: index: false`
 * and the sitemap - which is built from `perm_entities` and never reads this
 * table - does not list them.
 */

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function UnpublishedEmployer({
  record,
  cases,
  asOf,
}: {
  record: LiveEmployerRecord;
  /** The newest cases, already capped by the caller. */
  cases: LiveCaseRow[];
  /** As-of date of the live case corpus, ISO. */
  asOf: string | null;
}) {
  const { name, cases: total, pending, firstFiling, lastFiling, stages, otherNames } =
    record;
  const decided = Math.max(0, total - pending);
  const first = longDate(firstFiling);
  const last = longDate(lastFiling);
  const listed = cases.length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />

      <header className="max-w-3xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
          <Link
            href="/perm-employers"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            All sponsors
          </Link>{" "}
          · Live record only
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          {name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          We hold {fmt(total)} PERM {total === 1 ? "case" : "cases"} for this
          sponsor{first ? `, filed from ${first}` : ""}
          {last && last !== first ? ` to ${last}` : ""}. Name as DOL prints it
          on the application.
        </p>
      </header>

      {/* THE DOUBT GOES ABOVE THE FIGURES, same as every other entity page.
          A caveat under a number reads as a footnote to a fact; over it, the
          number arrives already qualified. Here the caveat is the larger part
          of the page's honesty budget, so it is the first thing after the H1. */}
      <section className="mt-8 border-2 border-data-warn bg-data-warn/8 p-5 sm:p-6">
        <h2 className="font-heading text-lg font-black sm:text-xl">
          Nothing about this sponsor has been published by DOL yet
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
          DOL releases its PERM disclosure files quarterly, and a case only
          appears in one once it has been decided. None of this sponsor&apos;s
          cases have made it into a published file, so there is no approval
          rate for them, no median time to a decision, no median offered wage,
          and no rank against other sponsors. Those figures are not small or
          uncertain here. They do not exist.
        </p>{" "}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/80">
          What is below is the record itself: the cases we hold, and the status
          DOL reports on each one. It is the same source the{" "}
          <Link
            href="/perm-case-status"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          >
            case-number lookup
          </Link>{" "}
          reads, and that lookup is always current where this page is a
          snapshot.
        </p>
      </section>

      {/* Only the counts we can stand behind, and each one labelled with the
          corpus it came from rather than presented as a lifetime figure. */}
      <section className="pop mt-8">
        <div className="grid [&>*]:min-w-0 grid-cols-2 gap-px border-2 border-border bg-border sm:grid-cols-3">
          {[
            {
              k: "Cases we hold",
              v: fmt(total),
              sub: "from DOL's live case record",
            },
            {
              k: "Waiting on a decision",
              v: fmt(pending),
              sub: decided > 0 ? `${fmt(decided)} already decided` : "all of them",
            },
            {
              k: "Newest filing",
              v: last ?? "—",
              sub: first && first !== last ? `oldest ${first}` : "",
            },
          ].map((d) => (
            <div key={d.k} className="bg-card p-5">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                {d.k}
              </p>{" "}
              <p className="mt-1.5 font-heading text-2xl font-black tabular-nums">
                {d.v}
              </p>{" "}
              {d.sub ? <p className="mt-1 text-xs text-foreground/70">{d.sub}</p> : null}
            </div>
          ))}
        </div>
      </section>

      {stages.length > 0 ? (
        <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <h2 className="font-heading text-xl font-black sm:text-2xl">
            Where those cases are standing
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
            DOL&apos;s own status on each case, counted. Ordered biggest first:
            these are not steps in a sequence, and a case can reach an audit
            without an RFI or re-enter after a decision.
          </p>
          <dl className="mt-5 space-y-4">
            {stages.map((s) => {
              const meaning = statusMeaning(s.status);
              const share = total > 0 ? (s.n / total) * 100 : 0;
              return (
                // Keyed Fragment with a leading space: array items render with
                // NOTHING between them, so a stage name welds to the previous
                // stage's count for anything walking the DOM.
                <Fragment key={`${s.status}-${String(s.isFinal)}`}>{" "}
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <dt className="font-mono text-xs font-bold uppercase tracking-[0.1em]">
                      {s.status}
                    </dt>{" "}
                    <dd className="font-mono text-sm font-bold tabular-nums">
                      {fmt(s.n)}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {share >= 0.5 ? `${share.toFixed(0)}%` : "<1%"}
                      </span>
                    </dd>
                  </div>
                  {meaning ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">
                      {meaning}
                    </p>
                  ) : null}
                </div>
                </Fragment>
              );
            })}
          </dl>
        </section>
      ) : null}

      <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          {listed === total
            ? `All ${fmt(total)} ${total === 1 ? "case" : "cases"}`
            : `The newest ${fmt(listed)} of ${fmt(total)} cases`}
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
          DOL&apos;s live record carries the case number, the job title and the
          status. The wage, the law firm and the worksite state arrive with
          publication, which is why they are missing here rather than blank.
          Each number links to its own live status.
        </p>
        <ul className="mt-4 divide-y divide-border/60">
          {cases.map((c) => (
            <Fragment key={c.caseNumber}>{" "}
            <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-base">
              <Link
                href={`/perm-case-status?case=${encodeURIComponent(c.caseNumber)}`}
                className="font-mono text-sm font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                {c.caseNumber}
              </Link>{" "}
              {c.jobTitle ? (
                <span className="text-foreground/70">{c.jobTitle}</span>
              ) : null}{" "}
              <span className="ml-auto text-sm text-foreground/70">
                {c.filingDate ? `filed ${c.filingDate}` : ""}
                {c.status ? ` · ${c.status}` : ""}
              </span>
            </li>
            </Fragment>
          ))}
        </ul>{" "}
        {/* The source-level glue gate does not carry `ul` in its tag list, so
            this pair reached the DOM as "...ANALYST REVIEWDOL live case
            record..." with the source check green. Caught by the RENDERED
            audit, which is why that one is the authoritative gate. */}
        <p className="mt-5 border-t-2 border-border pt-3 font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
          {asOf
            ? `DOL live case record, as of ${longDate(asOf) ?? asOf}`
            : "DOL live case record"}
        </p>
      </section>

      {otherNames.length > 0 ? (
        <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">
            Other spellings on the same applications
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
            DOL prints whatever went on the form, so one sponsor arrives under
            several spellings. These reduce to the same name and are counted
            together above.
          </p>
          <ul className="mt-3 space-y-1">
            {otherNames.map((n) => (
              <Fragment key={n}>{" "}
              <li className="text-base text-foreground/80">{n}</li>
              </Fragment>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Your case is with them?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            The{" "}
            <Link
              href="/perm-case-status"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              case-number lookup
            </Link>{" "}
            reads DOL live and can set an alert for the next change.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Where the queue stands</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            DOL works one national queue, oldest first, whoever filed the case.{" "}
            <Link
              href="/perm-processing-times"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              Processing times
            </Link>{" "}
            covers the whole of it.
          </p>
        </div>
      </section>

      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-foreground/70">
        This page is rebuilt periodically, so a status on it can lag DOL by
        days. The case lookup does not lag: it asks DOL at the moment you ask
        it.
      </p>

      <DataProvenance datasets={["perm-case-status"]} />
    </div>
  );
}
