import Link from "next/link";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";
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
  "uscis-processing-times": [
    {
      q: "What is a USCIS processing time?",
      a: (
        <>
          USCIS publishes two. The processing-times page gives, per form and
          subtype, the months within which most recently completed cases
          finished, and tells you to wait that long before asking about yours.
          The quarterly performance data gives the median: the months it took
          to decide half the cases finished that quarter. This page shows the
          median for every form, dated to its quarter, and the processing-times
          figure beside it for the I-140.
        </>
      ),
    },
    {
      q: "How long does an I-140 take?",
      a: (
        <>
          In USCIS&apos;s quarterly data the median I-140 decided in the third
          quarter of FY2026 (April to June 2026) took 3.9 months. USCIS&apos;s
          processing-times page gives longer figures per subtype, from a few
          months for an advanced-degree professional to nearly three years for
          extraordinary ability, because it measures the slow tail. The{" "}
          <Link href="/tools/i140-calculator" className={link}>
            I-140 queue page
          </Link>{" "}
          shows how many are pending in each category.
        </>
      ),
    },
    {
      q: "How long does an employment-based I-485 take?",
      a: (
        <>
          The median employment-based I-485 decided in April to June 2026 took 6
          months, against 7 for family-based and 25.6 for asylum-based, in
          USCIS&apos;s own quarterly data. Where a case is decided matters too:
          the{" "}
          <Link href="/i485-by-field-office" className={link}>
            I-485 by field office
          </Link>{" "}
          page shows each office&apos;s pile.
        </>
      ),
    },
    {
      q: "Why did USCIS processing times go up or down?",
      a: (
        <>
          The median is measured over cases completed in the quarter, so a
          quarter in which USCIS cleared old cases reads slower than one in
          which it cleared new ones, and USCIS&apos;s I-90 note says exactly
          that about FY2023. Read a change together with the completions count
          beside it.
        </>
      ),
    },
  ],
  "i485-by-field-office": [
    {
      q: "Which USCIS field office handles my I-485?",
      a: (
        <>
          The one USCIS assigns by the applicant&apos;s address. Employment-based
          applications are received at a service center and routed from there,
          and many are decided at the National Benefits Center without an
          interview; a field office decides the cases sent to it for one. USCIS
          publishes each office&apos;s counts every quarter, which is what this
          page shows.
        </>
      ),
    },
    {
      q: "How many I-485 applications are pending at USCIS?",
      a: (
        <>
          USCIS&apos;s quarterly data for April to June 2026 puts employment-based
          I-485 applications pending at 268,408 across every office and service
          center, with 611,067 family-based. Your place inside that pile by
          priority date is on the{" "}
          <Link href="/tools/i485-queue-position" className={link}>
            I-485 queue position
          </Link>{" "}
          page, from USCIS&apos;s monthly inventory.
        </>
      ),
    },
    {
      q: "What is a field office code?",
      a: (
        <>
          USCIS&apos;s three-letter code for the office (NYC for New York, SFR for
          San Francisco, NBC for the National Benefits Center). It appears on
          notices and in USCIS&apos;s own data, and this page keys every office
          by it.
        </>
      ),
    },
    {
      q: "Does a busy office mean a longer wait?",
      a: (
        <>
          Usually, but the file does not say by how much. It gives each
          office&apos;s pending pile and its quarter&apos;s decisions; dividing
          them is quarters of work at that pace, which this page shows as a
          comparison between offices, never as a date for one case.
        </>
      ),
    },
  ],
  "i140-awaiting-visa": [
    {
      q: "What does 'awaiting visa availability' mean on an approved I-140?",
      a: (
        <>
          The petition is approved but the visa bulletin&apos;s final action date
          for the category and country has not reached the priority date, so
          the beneficiary cannot yet be approved for a green card. USCIS counts
          these petitions every quarter by preference and country of birth,
          primary beneficiaries only, and this page prints that count.
        </>
      ),
    },
    {
      q: "How many people are waiting for an EB-2 India green card?",
      a: (
        <>
          USCIS counted 356,360 approved petitions for India-born beneficiaries
          in EB-2 as of June 2026, 91% of everyone waiting in that category,
          before dependents. The count, not a wait in years, is what USCIS
          publishes; how the cutoff has actually moved is on the{" "}
          <Link href="/visa-bulletin" className={link}>
            visa bulletin page
          </Link>
          .
        </>
      ),
    },
    {
      q: "Is this the same as the I-485 backlog?",
      a: (
        <>
          No. This count is approved petitions whose beneficiary has not been
          able to file or be approved for adjustment; the{" "}
          <Link href="/tools/i485-queue-position" className={link}>
            I-485 inventory
          </Link>{" "}
          is applications already filed and pending. They sit on either side of
          the visa bulletin line.
        </>
      ),
    },
    {
      q: "Why are dependents not counted?",
      a: (
        <>
          USCIS counts petitions, and a petition names one beneficiary. The
          visa limit counts every person, spouse and children included, so the
          visas these petitions will use is larger than the count shown.
          USCIS&apos;s note on the sheet says so, and this page repeats it rather
          than estimating a multiplier.
        </>
      ),
    },
  ],
  "uscis-case-status": [
    {
      q: "What is a USCIS receipt number?",
      a: (
        <>
          The 13-character identifier USCIS assigns to a filing, three letters
          and ten digits, printed at the top of every I-797 notice. USCIS&apos;s
          glossary names the letters as the office that took the case (EAC,
          WAC, LIN, SRC, NBC, MSC or IOE). It is USCIS&apos;s key to the
          petition, the way a G-100 number is DOL&apos;s key to the{" "}
          <Link href="/perm-case-status" className={link}>
            PERM case
          </Link>{" "}
          that came before it.
        </>
      ),
    },
    {
      q: "Which USCIS forms follow a PERM?",
      a: (
        <>
          The I-140 immigrant petition, filed by the employer within 180 days
          of the PERM certification, and then the I-485 adjustment of status
          once a visa number is available. Each gets its own receipt number.
          The{" "}
          <Link href="/tools/i140-calculator" className={link}>
            I-140 queue
          </Link>{" "}
          and{" "}
          <Link href="/tools/i485-queue-position" className={link}>
            I-485 queue position
          </Link>{" "}
          pages read USCIS&apos;s published figures for those stages.
        </>
      ),
    },
    {
      q: "Why does this page not show a status yet?",
      a: (
        <>
          Because PERM Tracker&apos;s USCIS API access is pending, and a
          status this site did not get from USCIS is not one it will show. The
          page decodes the receipt and links to USCIS&apos;s own status page,
          which answers any receipt today. When USCIS issues keys, the same
          page reads its Case Status API and prints USCIS&apos;s own words with
          the time they were read.
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
      {/* QUESTIONS VISIBLE, ANSWERS ON DEMAND. This is the answer-engine
          layer: questions phrased the way people search, each an <h3> so the
          outline carries them, with the answer in the DOM whether open or
          shut - native <details> keeps its body for every crawler, which is
          the only reason collapsing it is safe. Measured 2026-09-14: as open
          prose it was 100 to 250 words on each of twelve pages, and on the
          chart pages it was most of what remained after the captions were
          cut. The <h3> sits INSIDE the <summary> so the heading survives. */}
      <div className="mt-4 divide-y-2 divide-border border-2 border-border bg-card shadow-hard">
        {entries.map((e) => (
          <details key={e.q} className="group">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 [&::-webkit-details-marker]:hidden">
              <h3 className="font-heading text-base font-bold">{e.q}</h3>{" "}
              <CaretDownIcon
                className="h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </summary>{" "}
            <p className="max-w-prose border-t-2 border-border/40 px-5 pb-4 pt-3 text-base leading-relaxed text-foreground/70 sm:px-6">
              {e.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
