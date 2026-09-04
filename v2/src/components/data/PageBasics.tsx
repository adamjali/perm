import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The basics block: plain-English grounding at the bottom of a data page.
 *
 * WHY VISIBLE PROSE AND NOT SCHEMA. These pages assumed their reader knew
 * what a PERM wage or an audit was; most arrivals don't, and the engines
 * that quote answers read VISIBLE text (schema-only facts scored zero
 * retrievals in the best published test). So each entry is a question in
 * the reader's own words, answered in two or three self-contained
 * sentences, with the figure dated and the deeper page linked. The block
 * sits at the bottom: context for whoever needs it, out of the way of the
 * data for whoever doesn't.
 *
 * House rules for entries: the question phrased the way people search it
 * ("approved", "audit"), the official term taught in passing, every
 * statistic stamped with its window, PERM Tracker named rather than "we"
 * where the sentence stands alone.
 */

export interface BasicsEntry {
  q: string;
  a: ReactNode;
}

const link =
  "font-bold underline underline-offset-2 hover:text-primary";

export const BASICS: Record<string, BasicsEntry[]> = {
  "perm-wages": [
    {
      q: "What is a PERM salary, exactly?",
      a: (
        <>
          The annual wage an employer committed to on the ETA-9089 filing, as
          published in the Department of Labor&apos;s own disclosure files. It
          isn&apos;t a survey estimate or a self-report: every figure on this
          page came off a federal filing, from 259,489 decided cases across
          FY2024 to FY2026 as of August 2026.
        </>
      ),
    },
    {
      q: "Why do green-card salaries matter?",
      a: (
        <>
          A PERM filing must offer at least the prevailing wage DOL determines
          for the job and place, so these figures show what sponsorship
          actually pays by occupation. The{" "}
          <Link href="/tools/salary-explorer" className={link}>
            salary explorer
          </Link>{" "}
          breaks the same data down by state and year.
        </>
      ),
    },
  ],
  "perm-employers": [
    {
      q: "Is my company still filing PERM?",
      a: (
        <>
          Search it above. Each employer&apos;s page shows filings by year and
          pending cases in the live queue, so a sponsorship pause shows up as
          filings stopping. The data records what was filed, never company
          policy: it can&apos;t say whether a pause ends.
        </>
      ),
    },
    {
      q: "Why does one company appear more than once?",
      a: (
        <>
          Names appear exactly as DOL prints them, and DOL prints one company
          under several legal entities and spellings. PERM Tracker links the
          spellings it can match on each employer&apos;s page rather than
          silently merging federal records.
        </>
      ),
    },
  ],
  "perm-attorneys": [
    {
      q: "What does the law firm on a filing actually do?",
      a: (
        <>
          The firm named on a PERM filing represents the employer, not the
          worker - which is why applicants so often hear nothing. Your case
          number still works without them:{" "}
          <Link href="/perm-case-status" className={link}>
            check it yourself
          </Link>
          , free.
        </>
      ),
    },
    {
      q: "Do approval rates differ much between firms?",
      a: (
        <>
          Less than the rankings suggest: across the whole list they cluster
          above 99% in the FY2024-FY2026 window. One caution stated on every
          firm page: DOL prints a single practice under several spellings, so
          a big firm&apos;s true total can span more than one row.
        </>
      ),
    },
  ],
  "perm-by-state": [
    {
      q: "Is PERM faster in some states?",
      a: (
        <>
          No. DOL works one national queue, oldest filings first, so the
          worksite state changes the wage and the volume, not the wait. The
          differences on this page are about industry concentration, not a
          faster line.
        </>
      ),
    },
  ],
  "perm-queue": [
    {
      q: "What does “pending” mean here?",
      a: (
        <>
          A case DOL has received and not yet decided, counted from the
          per-case status feed PERM Tracker reads from DOL twice a day. The
          front of the queue - the filing month DOL is working now - is on the{" "}
          <Link href="/perm-processing-times" className={link}>
            processing times page
          </Link>
          , from DOL&apos;s own publication.
        </>
      ),
    },
    {
      q: "Why isn't my month finished when DOL has passed it?",
      a: (
        <>
          A request for information, an audit or a hold takes a case out of
          filing order into its own slower queue, so every month keeps a tail
          of open cases after DOL moves on. That split is measured on the{" "}
          <Link href="/perm-rfi-audit" className={link}>
            RFI and audits page
          </Link>
          .
        </>
      ),
    },
  ],
  "perm-cases": [
    {
      q: "Which cases can be searched here?",
      a: (
        <>
          Decided ones: everything DOL has published in its quarterly
          disclosure files, FY2024 to FY2026. A case still pending has no
          disclosure row yet - for those,{" "}
          <Link href="/perm-case-status" className={link}>
            the case status page
          </Link>{" "}
          reads the live per-case feed instead.
        </>
      ),
    },
  ],
  "perm-rfi-audit": [
    {
      q: "My case got audited. Is that bad?",
      a: (
        <>
          An audit is a request for proof, not a denial: DOL asks for the
          recruitment file and the case waits in a separate, slower queue
          while it answers. Most audited cases are still certified - the
          funnel above shows the measured outcomes rather than a guess.
        </>
      ),
    },
    {
      q: "What's the difference between an audit and an RFI?",
      a: (
        <>
          People say &quot;audit&quot; for both, but DOL treats them
          differently: an audit review is the formal documentation check under
          20 CFR 656.20, while a request for information (RFI) is a narrower
          question about one part of the filing - and DOL has leaned toward
          RFIs since 2025. Supervised recruitment is a third, rarer escalation
          with its own clock.
        </>
      ),
    },
  ],
  "pwd-cases": [
    {
      q: "What is a prevailing wage determination?",
      a: (
        <>
          Before an employer can file a PERM, it has to ask the Department of
          Labor what the job legally has to pay. That request is form ETA-9141,
          DOL answers with a prevailing wage determination, and the PERM
          offer cannot come in under it. Case numbers start with{" "}
          <b className="font-bold">P-</b>. PERM Tracker holds 634,638 decided
          wage requests, covering determinations from October 2023 to June
          2026.
        </>
      ),
    },
    {
      q: "Can I look up a pending wage request?",
      a: (
        <>
          Yes. DOL answers per case for anything still moving, so a{" "}
          <b className="font-bold">P-</b> number that has no decision yet still
          resolves here, and PERM Tracker asks DOL directly if it has not seen
          the number before. What a pending record cannot show is the wage
          itself: DOL publishes that only when the case reaches a quarterly
          disclosure file. Look one up on{" "}
          <Link href="/perm-case-status" className={link}>
            case status
          </Link>
          .
        </>
      ),
    },
    {
      q: "How long does a prevailing wage determination take?",
      a: (
        <>
          DOL publishes the filing month it is currently working rather than an
          average wait, and it runs two separate queues: one for jobs priced
          from the OEWS survey and a slower one for everything else. The{" "}
          <Link href="/tools/pwd-calculator" className={link}>
            wage-request calculator
          </Link>{" "}
          reads today&apos;s published position and estimates from it, and{" "}
          <Link href="/perm-processing-times" className={link}>
            processing times
          </Link>{" "}
          carries DOL&apos;s own figure with the date it published it.
        </>
      ),
    },
  ],
  "lca-cases": [
    {
      q: "What is an LCA?",
      a: (
        <>
          A Labor Condition Application, form ETA-9035, is what an employer
          files before petitioning for an H-1B. It commits them to a wage and a
          named worksite, and DOL certifies it in days rather than months.
          Numbers start with <b className="font-bold">I-200</b> or{" "}
          <b className="font-bold">I-203</b>. PERM Tracker holds 437,496
          certified LCAs from DOL&apos;s FY2026 disclosure file, decided
          October 2025 to June 2026.
        </>
      ),
    },
    {
      q: "Is an LCA the same as an H-1B approval?",
      a: (
        <>
          No, and the gap matters. An LCA is a wage-and-worksite promise
          certified by the Department of Labor; the H-1B petition itself is
          decided later by USCIS, a different agency. A certified LCA means the
          employer cleared the first step, not that anyone has been approved to
          work.
        </>
      ),
    },
    {
      q: "What does an LCA show that a PERM does not?",
      a: (
        <>
          The wage an employer offered for a specific job at a specific
          worksite, published within months rather than years, which makes it
          the freshest public read on what a sponsor pays. A{" "}
          <Link href="/perm-cases" className={link}>
            PERM filing
          </Link>{" "}
          is the permanent-residence route and takes far longer to appear. The
          two answer different questions about the same employer.
        </>
      ),
    },
  ],
  "case-search": [
    {
      q: "Can I search PERM, wage requests and LCAs at once?",
      a: (
        <>
          That is what this page is for. DOL runs the three programs on one
          case-number counter but publishes them in three separate files, so an
          employer&apos;s record is normally split across three searches. Here
          one employer name reaches all three, and each result says which
          program it came from.
        </>
      ),
    },
    {
      q: "What can I search by without a case number?",
      a: (
        <>
          An employer name, a law firm, a worksite state or an occupation, and
          they combine: every case a firm filed in Texas for one occupation is
          a single query. DOL names the law firm on 91% of wage-request records
          and about three quarters of LCAs, so a firm search reaches all three
          programs rather than PERM alone.
        </>
      ),
    },
    {
      q: "Why do some results have no wage or law firm?",
      a: (
        <>
          Because DOL returns five fields on a case that is still moving: the
          number, the employer, the job title, the filing date and the status.
          The wage, the worksite, the occupation and the firm arrive only when
          the case is published in a quarterly disclosure file. A blank column
          on an open filing is DOL withholding it, not a gap in the record.
        </>
      ),
    },
  ],
  "perm-decision-activity": [
    {
      q: "How many PERM cases does DOL decide a day?",
      a: (
        <>
          The chart above is the measured answer, working day by working day,
          from the per-case status feed. Output is a weekday affair with a
          strong weekly shape, which is why estimates on this site count
          business days rather than calendar ones.
        </>
      ),
    },
  ],
  calculators: [
    {
      q: "Are these estimates or deadlines?",
      a: (
        <>
          Both live here, and they are different things. The timeline tools
          estimate from measured queues and say so, with their spread shown;
          the{" "}
          <Link href="/tools/perm-deadline-calculator" className={link}>
            deadline calculator
          </Link>{" "}
          computes the regulatory dates themselves (20 CFR 656), which are
          not estimates at all.
        </>
      ),
    },
    {
      q: "Why does a tool sometimes refuse to answer?",
      a: (
        <>
          Because the honest answer is sometimes &quot;too early to say&quot;.
          A filing month DOL has barely started can&apos;t support a median,
          and a nearly-finished one is dominated by audits with a different
          clock - so the tools withhold there instead of printing a confident
          wrong number. The{" "}
          <Link href="/methodology" className={link}>
            methodology page
          </Link>{" "}
          documents every rule.
        </>
      ),
    },
  ],
};

export function PageBasics({ page }: { page: keyof typeof BASICS | string }) {
  const entries = BASICS[page];
  if (!entries || entries.length === 0) return null;
  return (
    <section className="mt-14 border-t-3 border-border pt-8">
      <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
        The basics
      </p>{" "}
      <div className="mt-4 grid grid-cols-1 gap-6 [&>*]:min-w-0 md:grid-cols-2">
        {entries.map((e) => (
          <div key={e.q}>
            <h3 className="font-heading text-lg font-black">{e.q}</h3>{" "}
            <p className="mt-2 max-w-prose text-base leading-relaxed text-foreground/70">
              {e.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
