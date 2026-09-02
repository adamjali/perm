import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WarningIcon } from "@phosphor-icons/react/ssr";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { CaseNotFound, CaseStatusEmpty } from "@/components/tools/CaseNotFound";
import { CaseStatusResult } from "@/components/tools/CaseStatusResult";
import { PwdLookup } from "@/components/tools/PwdStatusResult";
import { LcaLookup } from "@/components/tools/LcaStatusResult";
import { buildWall, neighbourMonths } from "@/lib/casePosition";
import { isLegacyCaseNumber, normaliseCaseNumber } from "@/lib/caseNumberShape";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { findFront, type CohortMonth } from "@/lib/liveQueue";
import { openGraphBase } from "@/lib/openGraphBase";
import { parseCaseNumber } from "@/lib/permCaseNumber";
import { getMonthBacklog } from "@/lib/turso/backlog";
import { getCaseWageContext, getCohortDuration } from "@/lib/turso/caseContext";
import { lookupCase } from "@/lib/turso/caseLookup";
import { normalisePwdCaseNumber } from "@/lib/turso/pwdCases";
import { normaliseLcaCaseNumber } from "@/lib/turso/lcaCases";
import { getEstimatorData } from "@/lib/turso/estimate";
import { getAlphabet } from "@/lib/turso/alphabet";
import { getLiveBacklog, getLiveMirrorSize } from "@/lib/turso/publicData";

/**
 * One PERM case number in, everything we can honestly say about it out.
 *
 * THE ROUTE IS `/perm-case-status` AND NOT `/tools/case-status`. Two reasons,
 * and the first is the weaker one: the phrase people type is "check my PERM
 * case status", and the path carries it. The real reason is that `/tools/*`
 * on this site means a CALCULATOR, something you configure to get an
 * estimate, and this computes nothing. It reads a federal record and shows
 * it, which puts it with `/perm-cases`, `/perm-queue` and `/perm-employers`
 * at the top level, all of which it links into.
 *
 * A PLAIN GET FORM, SO THE ANSWER HAS AN ADDRESS. `?case=` makes a result
 * shareable and bookmarkable, which the I-485 work established as the single
 * thing attorneys get the most out of, and it means the page works with
 * JavaScript off. Two things follow that are easy to miss:
 *
 *   1. Query-string results are `noindex`. A case number in a URL is an
 *      unbounded crawl space, and it is a federal identifier that resolves to
 *      an employer and a job title. Neither belongs in a search index. The
 *      canonical is the bare path on every variant.
 *   2. The number would otherwise reach PostHog verbatim in `$current_url` on
 *      every autocaptured event. `redactCaseParam` in instrumentation-client
 *      strips it before send.
 *
 * THE SHELL RENDERS BEFORE THE LOOKUP. The reads are a second or two against
 * a remote SQLite, so the header, the form and the explainer sit outside the
 * Suspense boundary and paint immediately. Somebody who mistyped a digit can
 * start again without waiting for the answer to a question they did not mean
 * to ask.
 */

const TITLE = "Check Your PERM Case Status";
const DESCRIPTION =
  "Look up a PERM case number: its status in plain English, how many undecided cases were filed before it, and the employer's own record with DOL.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}): Promise<Metadata> {
  const { case: raw } = await searchParams;
  const hasCase = typeof raw === "string" && raw.trim().length > 0;
  return {
    title: TITLE,
    description: DESCRIPTION,
    // The bare path on every variant. A result page is one of ~412,000, and
    // they are all the same page with a different argument.
    alternates: { canonical: "/perm-case-status" },
    robots: hasCase ? { index: false, follow: true } : undefined,
    openGraph: {
      ...openGraphBase,
      title: `${TITLE} | PERM Tracker`,
      description: DESCRIPTION,
      url: "/perm-case-status",
    },
  };
}

const FAQS = [
  {
    q: "Where do I find my PERM case number?",
    a: "On the ETA-9089 filing receipt, and on any status notice DOL sent the employer. Current ones look like G-100-26125-868956; cases filed in 2022 and 2023 use a shorter form like A-23043-00641, and both work here. The employer's attorney has it if you don't.",
  },
  {
    q: "Is this DOL's official status?",
    a: "Close to it, and the chain is worth stating. These statuses come from DOL's own case-status search, which we sweep against every pending case twice a day and against the full corpus daily. DOL publishes no documented API for it, so this is the same endpoint their search page uses rather than a supported one. It is a sweep, not a live reading: a case decided since the last sweep will show at DOL first, and DOL is the authority for any single case."
  },
  {
    q: "Is the decision date on this page a prediction for my case?",
    a: "It's an estimate, labeled as one, and the label is doing real work. The window comes from a named model over this case's own filing month, read at the percentile its current stage implies: a case at RFI reads its month's p90, not the median, because the audited tail is measured. It is checkable arithmetic over DOL's decided cases, and it is not a promise about any single case.",
  },
  {
    q: "Why won't you tell me my odds of being certified?",
    a: "A single odds figure would read as precision the data cannot support. The measured denial factors are not independent, so blending them into one score hides which one is doing the work. The denial-rate pages publish the measured rates separately and refuse the blend on purpose. What is real, and shown, is the employer's published record across its own decided cases.",
  },
  {
    q: "My case isn't here. Is something wrong?",
    a: "Almost certainly not. The per-case snapshot covers filings from mid-2023 and rebuilds on a schedule, so a very recent filing can be genuinely pending and genuinely absent. DOL's published decision files start at fiscal year 2024. A wrong digit in the serial is also worth ruling out, since it still makes a well-formed case number.",
  },
  {
    q: "What does my case number actually mean?",
    a: "The current format encodes its own filing date. In G-100-26125-868956, the 26 is the year and the 125 is the day of that year, so it decodes to May 5, 2026. Measured against 20,000 cases in DOL's records, that decoded date matches exactly 89% of the time and is a day or two off otherwise. The older three-part format, like A-23043-00641, does not: the same reading lands 13% of the time, so this page refuses to decode one rather than guess a filing month.",
  },
  {
    q: "Do you store the case number I type in?",
    a: "No. It goes into the page's address so you can bookmark or share the result, and it's stripped out of analytics before anything is sent. Nothing is written down and nothing goes to a third party.",
  },
];

/**
 * UTC, deliberately, and shared by every elapsed figure on the page.
 *
 * Every date in this project is a UTC ISO string from DOL, and `daysElapsed`
 * parses both ends as UTC. Deriving "today" from the server's local zone
 * instead would make a filing date and the day count disagree by one for a
 * few hours each night, on a page whose whole argument is that its figures
 * are checkable.
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PermCaseStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: raw } = await searchParams;
  const typed = typeof raw === "string" ? raw : "";
  // A prevailing wage number (P-100-...) takes its own path: same page, same
  // form, a different table and a different queue. Checked FIRST, because the
  // PERM shape rule accepts any letter and would otherwise send it to the
  // PERM lookup, which refuses to record it and reports "not found".
  const pwdNumber = typed.trim().length > 0 ? normalisePwdCaseNumber(typed) : null;
  const lcaNumber = !pwdNumber && typed.trim().length > 0 ? normaliseLcaCaseNumber(typed) : null;
  const caseNumber =
    !pwdNumber && !lcaNumber && typed.trim().length > 0 ? normaliseCaseNumber(typed) : null;
  const malformed =
    typed.trim().length > 0 && caseNumber === null && pwdNumber === null && lcaNumber === null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question" as const,
      name: f.q,
      acceptedAnswer: { "@type": "Answer" as const, text: f.a },
    })),
  };
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Data", href: "/tools" },
    { name: "Case status", href: "/perm-case-status" },
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumbSchema} />

      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            Data
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Check a PERM case
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80">
          A case number gets you the status in plain English, what the queue in
          front of it looks like, and the employer&apos;s own record. It will
          not get you a decision date, and the page says why. Prevailing wage
          (P-100-...) and LCA (I-200-...) numbers work here too.
        </p>
      </header>

      <div className="mt-8 border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <CaseLookupForm defaultValue={typed} />
      </div>

      {/* The warning sits ABOVE anything it qualifies and nothing is computed
          from bad input. A figure the reader has already absorbed cannot be
          un-absorbed by a note underneath it. */}
      {malformed ? (
        <p className="mt-6 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base leading-relaxed text-foreground/80">
          <WarningIcon
            className="mt-1 h-4 w-4 shrink-0 text-data-warn-ink"
            weight="fill"
            aria-hidden="true"
          />{" "}
          <span>
            <b className="font-bold text-data-warn-ink">
              That is not the shape of a PERM case number,
            </b>{" "}
            so nothing was looked up. Current ones run letter, three digits,
            five digits, then a serial, like G-100-26125-868956. Cases from
            2022 and 2023 use a shorter form, like A-23043-00641. Either is on
            the ETA-9089 receipt. A prevailing wage request starts with P
            (P-100-26240-200135) and an H-1B LCA with I (I-200-26239-199948).
          </span>
        </p>
      ) : null}

      <div className="mt-8">
        {pwdNumber ? (
          <Suspense key={pwdNumber} fallback={<LookupSkeleton />}>
            <PwdLookup caseNumber={pwdNumber} />
          </Suspense>
        ) : lcaNumber ? (
          <Suspense key={lcaNumber} fallback={<LookupSkeleton />}>
            <LcaLookup caseNumber={lcaNumber} />
          </Suspense>
        ) : caseNumber ? (
          <Suspense key={caseNumber} fallback={<LookupSkeleton />}>
            <Lookup caseNumber={caseNumber} />
          </Suspense>
        ) : (
          <Suspense fallback={<LookupSkeleton />}>
            <Empty />
          </Suspense>
        )}
      </div>

      <section className="mt-14">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>{" "}
        <FaqList items={FAQS} />
      </section>

      <DataProvenance
        datasets={["perm-case-status", "perm-cases", "processing-times"]}
      />
      <p className="mt-2 text-sm text-muted-foreground">
        These statuses are read from DOL directly. The FLAG case-status search answers a batch lookup, and we run it against every undecided case every 12 hours and against all of them weekly. DOL publishes no documented API for this, so it is the same endpoint their own search page uses rather than a supported one. The date shown on each case is
        when the tracker saw it, not when we did, and it is a snapshot rather
        than a live feed. DOL is the authority for any case and this page is
        never a substitute for the determination letter.{" "}
        <a
          href="https://flag.dol.gov"
          rel="noopener noreferrer"
          className="font-bold underline underline-offset-2 hover:text-primary"
        >
          Check it yourself at flag.dol.gov
        </a>
        .
      </p>

      <ToolPageFooter
        currentHref="/perm-case-status"
        reading={[
          {
            href: "/tools/perm-timeline-calculator",
            label: "How long the wait runs",
            note: "This page counts what is in front of a case. That one gives the envelope, from cases DOL has actually decided.",
          },
          {
            href: "/perm-queue",
            label: "The whole queue",
            note: "Every filing month DOL still has undecided cases in, and where the work front sits.",
          },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The reads, arranged so the slow ones overlap.
 *
 * `lookupCase` runs its own joins and is the long pole, so the three reads
 * that do not depend on its result go alongside it rather than after it. The
 * month-shaped reads have to wait, because the authoritative filing month is
 * the one in DOL's record, not the one decoded from the number: those agree
 * for 89% of cases and a month boundary is exactly where the other 11% would
 * silently produce a cohort belonging to somebody else.
 *
 * Every read is defaulted rather than allowed to throw. A frontend deployed
 * ahead of its data hits precisely this window, and each section renders its
 * own absence.
 */
async function Lookup({ caseNumber }: { caseNumber: string }) {
  const today = todayUtc();

  const [result, backlog, estimator, mirrorSize] = await Promise.all([
    lookupCase(caseNumber).catch(() => null),
    getLiveBacklog().catch((): CohortMonth[] => []),
    getEstimatorData().catch(() => null),
    getLiveMirrorSize().catch(() => 0),
  ]);

  const publishedFront = estimator?.frontier?.analystQueueMonth ?? null;
  const publishedAsOf = estimator?.frontier?.asOf ?? null;

  const found = !!result && (result.live !== null || result.decided !== null);
  const parsed = parseCaseNumber(caseNumber);

  // The record's month when we have one, the decoded month otherwise. The
  // second is only ever used to give a NOT-FOUND number some context, and
  // that section labels every figure as belonging to the month rather than
  // to the case.
  const month =
    result?.live?.filingDate?.slice(0, 7) ??
    result?.decided?.receivedDate?.slice(0, 7) ??
    parsed?.filingMonth ??
    null;

  const wall = month ? buildWall(backlog, month) : null;
  const neighbours = month ? neighbourMonths(backlog, month, 2) : [];
  const cohortRow = month
    ? (backlog.find((m) => m.month === month) ?? null)
    : null;

  if (!found) {
    return (
      <CaseNotFound
        caseNumber={caseNumber}
        parsed={parsed}
        isLegacy={isLegacyCaseNumber(caseNumber)}
        cohort={cohortRow}
        wall={wall}
        neighbours={neighbours}
        publishedFront={publishedFront}
        publishedAsOf={publishedAsOf}
        mirrorSize={mirrorSize || null}
      />
    );
  }

  const isDecided = result.decided !== null;
  const [monthBacklog, wage, duration, alphabet] = await Promise.all([
    month ? getMonthBacklog(month).catch(() => null) : Promise.resolve(null),
    // Only for a decided case: a pending one has no wage in DOL's files, and
    // asking for one is a round trip that can only ever return null.
    isDecided
      ? getCaseWageContext(caseNumber).catch(() => null)
      : Promise.resolve(null),
    isDecided && month
      ? getCohortDuration(month).catch(() => null)
      : Promise.resolve(null),
    getAlphabet().catch(() => null),
  ]);

  // The employer's initial costs the reader nothing to supply here: DOL names
  // the employer, so it is derived from a fact already on the page. The shift
  // itself is looked up from the measured table and is never invented - if the
  // document is missing, the estimate simply runs without the term.
  const employerName =
    result.live?.employerName ?? result.decided?.employerName ?? null;
  const initial = (employerName ?? "").trim().slice(0, 1).toUpperCase();
  const letterDelta =
    alphabet && initial >= "A" && initial <= "Z"
      ? alphabet.letters.find((l) => l.letter === initial)?.deltaDays ?? null
      : null;

  return (
    <CaseStatusResult
      result={result}
      backlog={backlog}
      cohortStatuses={monthBacklog?.statuses ?? []}
      wall={wall}
      neighbours={neighbours}
      publishedFront={publishedFront}
      publishedAsOf={publishedAsOf}
      wage={wage}
      duration={duration}
      estimator={estimator}
      letterDelta={letterDelta}
      letterInitial={letterDelta === null ? null : initial}
      today={today}
    />
  );
}

/** The page with nothing typed in: still the national picture, not a blank. */
async function Empty() {
  const [backlog, estimator, mirrorSize] = await Promise.all([
    getLiveBacklog().catch((): CohortMonth[] => []),
    getEstimatorData().catch(() => null),
    getLiveMirrorSize().catch(() => 0),
  ]);
  const front = findFront(backlog);
  return (
    <CaseStatusEmpty
      front={front?.month ?? null}
      wallTotal={front?.wallTotal ?? null}
      publishedFront={estimator?.frontier?.analystQueueMonth ?? null}
      publishedAsOf={estimator?.frontier?.asOf ?? null}
      mirrorSize={mirrorSize || null}
    />
  );
}

/**
 * A reservation the size of the answer, not a spinner.
 *
 * The block it stands in for is tall, so a short placeholder would let the
 * FAQ jump up into view and back down again a second later.
 */
function LookupSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
      <div className="h-40 border-2 border-border bg-muted" />
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="h-48 border-2 border-border bg-muted" />
        <div className="h-48 border-2 border-border bg-muted" />
      </div>
      <div className="mt-8 h-64 border-2 border-border bg-muted" />
    </div>
  );
}
