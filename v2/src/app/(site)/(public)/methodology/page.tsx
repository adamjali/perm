/**
 * The methodology page.
 *
 * Public PERM estimators disagree with each other by months on the same
 * filing date, and almost none of them say why. This page is the answer to
 * that, and it is the product's position stated once: every number carries
 * its source and its date, and a number we cannot support does not appear.
 */

import type { Metadata } from "next";
import { BarRows } from "@/components/data/BarRows";
import { withSocialCard } from "@/lib/socialCard";
import Link from "next/link";
import { DisclosureList } from "@/components/tools/FaqList";
import { ArrowRightIcon, ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";

import { openGraphBase } from "@/lib/openGraphBase";
import { DataProvenance } from "@/components/data/DataProvenance";
import { getDisclosureStats } from "@/lib/turso/publicData";
import { MoreText } from "@/components/data/MoreText";
import { describeDisclosureFiles } from "@/lib/disclosureFiles";

const TITLE = "How PERM Tracker's Estimates Work";
const DESCRIPTION =
  "Where every figure on PERM Tracker comes from, why PERM estimates can differ by months on the same case, and what we won't publish.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/methodology" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/methodology",
  },
}, "methodology");

/**
 * Not `force-static` any more, and the reason is a defect this page had.
 *
 * It carried "259,489 cases at last ingest" as a literal in the source list.
 * The corpus is 373,939 and has been for two ingests. A methodology page
 * printing a stale figure is worse than one printing none: its whole claim is
 * that every number on the site is traceable, and the first number a reader
 * can check was wrong. Every count here now comes from the same aggregate the
 * pages it describes read from.
 */
// QUARTERLY DATA, WEEKLY WINDOW, AND A TRIGGER. This reads DOL's quarterly
// disclosure files, which change four times a year; a one-day window meant
// ~364 expiries a year to express four real changes, and every expiry a
// visitor walks into is a paid ISR render of an identical page.
// `POST /api/revalidate-disclosure` expires this the moment a file lands, so
// the long window costs no freshness. It stays a WEEK rather than a month so a
// trigger that never fires bounds the staleness instead of stranding the page.
export const revalidate = 604800;

/**
 * Readings of the same headline number across the public tools, taken on one
 * day (2026-08-24). Kept as a dated record on purpose: the spread is the
 * point, and a live comparison would put us in the business of monitoring
 * other sites rather than DOL.
 */
/** `days` draws the bar; a range is drawn at its middle and printed whole. */
const SPREAD = [
  { source: "DOL's own published average", value: "372 days", days: 372 },
  { source: "Crowd-sourced tracker", value: "335 days", days: 335 },
  { source: "Queue estimator A", value: "387 days", days: 387 },
  { source: "Queue estimator B", value: "462-480 days", days: 471 },
  { source: "Analytics site", value: "467 days", days: 467 },
  { source: "Stale calculator (March data)", value: "503 days", days: 503 },
] as const;

/**
 * Every published figure, traced to the arithmetic behind it.
 *
 * The point of the page is that a reader can check any number on the site, and
 * a source list alone does not let them: knowing a figure came from the
 * disclosure files does not say whether withdrawn cases were counted, or which
 * population a median ran over. Each row names the page, the operation and the
 * denominator, because the denominator is where these things go wrong.
 */
const TRACE: {
  figure: string;
  where: { href: string; label: string };
  how: string;
  population: string;
}[] = [
  {
    figure: "Analyst review queue month",
    where: { href: "/perm-processing-times", label: "Processing times" },
    how: "No computation. The value DOL prints in that row, with the date DOL attached to it. Where DOL prints a dash, the page says so instead of substituting anything.",
    population: "DOL's published snapshot, read weekly and kept, since DOL overwrites its own.",
  },
  {
    figure: "Average days to a determination",
    where: { href: "/perm-processing-times", label: "Processing times" },
    how: "DOL's own figure, unmodified. It describes cases DOL finished in the reported month, so it looks backwards and includes audited cases that ran long.",
    population: "Determinations issued in the month DOL names.",
  },
  {
    figure: "Queue advance rate",
    where: { href: "/perm-processing-times", label: "Processing times" },
    how: "For each month of determinations, the filing month at their median; then the change in filing month divided by the change in calendar month. The range comes from rolling three-month windows, because adjacent months are lumpy enough to produce rates of 0 and 2.0 that describe scheduling rather than pace.",
    population: "Every decided case in the unioned disclosure files. DOL publishes today's position and keeps no archive, so this cannot be read from DOL at all.",
  },
  {
    figure: "Decisions per month",
    where: { href: "/perm-processing-times", label: "Processing times" },
    how: "A count of determinations by the month DOL issued them.",
    population: "Every decided case in the unioned files. Lags the weekly queue page by a quarter.",
  },
  {
    figure: "Denial rate",
    where: { href: "/perm-denial-risk", label: "Denial rates" },
    how: "Denied divided by decided, where decided is certified plus denied. Withdrawn cases sit on neither side: a withdrawal is neither an approval nor a refusal, and putting it in either place moves the rate.",
    population: "Decided cases only. Pending cases are absent from these files entirely.",
  },
  {
    figure: "Share of denials",
    where: { href: "/perm-denial-risk", label: "Denial rates" },
    how: "A group's denials divided by every denial in the corpus. Published next to the rate rather than instead of it, and never multiplied together into an expected count.",
    population: "The same decided cases the rate runs over.",
  },
  {
    figure: "95% range on a rate",
    where: { href: "/perm-denial-risk", label: "Denial rates" },
    how: "A Wilson score interval on the denied count over the decided count. It's asymmetric near zero, which a plain plus-or-minus is not, and near zero is where most of these rates sit.",
    population: "That group's decided cases. Groups under the population floor carry no rate at all.",
  },
  {
    figure: "Filing concentration by state",
    where: { href: "/perm-by-state", label: "By state" },
    how: "A state's biggest occupation or employer divided by its total filings. Occupations are grouped on the SOC code without its O*NET suffix, and employers on the slug rather than the spelling, because DOL writes the same firm and the same job several ways.",
    population: "Every case with a worksite state, decided or withdrawn. It's a share of a census, so it needs no population floor; the counts are printed beside every bar.",
  },
  {
    figure: "Median wage and wage percentiles",
    where: { href: "/perm-wages", label: "Wages" },
    how: "The offered wage annualised through its unit of pay, then kept only between $15,000 and $1,000,000. Outside that band a value is a data-entry artefact, most often an hourly rate recorded as an annual one.",
    population: "Certified cases only. A denied case's offered wage is what an employer proposed and DOL rejected, which is not what the job pays. Cells with fewer than 50 wages carry no percentiles.",
  },
  {
    figure: "Median days to a decision",
    where: { href: "/perm-by-state", label: "By state" },
    how: "The median of decision date minus received date.",
    population: "Decided cases in that group. DOL works one national queue, so this barely moves by state.",
  },
  {
    figure: "Cases pending, by filing month",
    where: { href: "/perm-queue", label: "Live queue" },
    how: "A count of cases whose status is not final. Pending is read off the case's own final flag, never off a list of status names: sixteen statuses appear in the data and a hardcoded list silently mis-buckets the next one DOL adds.",
    population: "A per-case read of DOL's own case-status system. Every case is re-read each morning and the pending ones again each afternoon, so a status change is seen within a day. A different source from the quarterly files, which contain no pending cases at all.",
  },
  {
    figure: "Requests ahead of yours in the wage queue",
    where: { href: "/tools/pwd-calculator", label: "Prevailing wage queue" },
    how: "A running total of DOL's published pending counts from the oldest receipt month to yours. Arithmetic on DOL's own figures, with no rate applied.",
    population: "Pending prevailing-wage requests as of DOL's stated date.",
  },
  {
    figure: "Every PERM deadline",
    where: { href: "/tools/perm-deadline-calculator", label: "Deadlines" },
    how: "20 CFR 656 arithmetic, not an estimate. The filing window closes at the earlier of 180 days after the first recruitment step and the wage determination's expiry, and the tool says which one applied.",
    population: "Your dates only. Nothing about anyone else's case enters it.",
  },
  {
    figure: "Applications ahead of a priority date",
    where: { href: "/tools/i485-queue-position", label: "I-485 queue position" },
    how: "USCIS suppresses its smallest counts, so a total built from published cells has a known floor and an unknown remainder. The answer is a floor and a ceiling, never a point.",
    population: "USCIS's published employment-based adjustment inventory.",
  },
  {
    figure: "Visa bulletin cutoff history",
    where: { href: "/tools/priority-date-calculator", label: "Priority dates" },
    how: "Parsed from the published charts. A cell reading C means the category was open to every priority date and U means it was shut to all of them; those are opposites, so they are drawn as different states rather than one shaded band.",
    population: "Both charts, employment and family, as the State Department published them, read from its own pages each month as a bulletin appears. Months before the direct read came from the Internet Archive's copies of the same pages.",
  },
];

const SOURCES = [
  {
    name: "DOL FLAG processing times",
    seal: "/agency/dol-seal.png",
    sealAlt: "Seal of the US Department of Labor",
    what: "Queue positions and average days, the figures on the processing times page.",
    cadence: "Checked daily. A new snapshot is stored only when the figures change.",
    href: "https://flag.dol.gov/processingtimes",
  },
  {
    name: "DOL PERM disclosure files",
    seal: "/agency/dol-seal.png",
    sealAlt: "Seal of the US Department of Labor",
    what: "Case-level decisions, the basis of the timeline calculator's cohort record. The files are unioned and de-duplicated by case number.",
    cadence: "Quarterly, when DOL publishes.",
    href: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  },
  {
    name: "USCIS I-140 quarterly counts",
    seal: "/agency/dhs-seal.png",
    sealAlt: "Seal of the US Department of Homeland Security",
    what: "Pending and completed petitions by category, the I-140 calculator's queue.",
    cadence: "Quarterly, when USCIS publishes.",
    href: "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data",
  },
  {
    name: "USCIS quarterly performance workbooks",
    seal: "/agency/dhs-seal.png",
    sealAlt: "Seal of the US Department of Homeland Security",
    what: "Every form's median months to a decision, the I-485 by field office, approved I-140s awaiting a visa number by category and country, and I-140 approvals by class and country. Each sheet is reconciled against USCIS's own totals before it is written.",
    cadence: "Quarterly, when USCIS publishes; discovered from USCIS's listing, never constructed.",
    href: "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data",
  },
  {
    name: "USCIS Case Status API",
    seal: "/agency/dhs-seal.png",
    sealAlt: "Seal of the US Department of Homeland Security",
    what: "USCIS's own status text and dated history for one receipt number, read at lookup time under credentials issued to PERM Tracker LLC. Off until USCIS grants access; the lookup page says so.",
    cadence: "On demand, per lookup.",
    href: "https://developer.uscis.gov/api/case-status",
  },
  {
    name: "State Department visa bulletin",
    seal: "/agency/dos-seal.png",
    sealAlt: "Seal of the US Department of State",
    what: "Cutoff dates from every bulletin since October 2014 and most back to June 2005, read from the State Department's own pages as each one appears, with some months from the Internet Archive's copies of the same pages. A few older months are missing, where State's pages don't parse or aren't linked. Paces and backward steps are measured from October 2014. Nothing in it is forecast.",
    cadence: "Monthly.",
    href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
  },
] as const;

export default async function MethodologyPage() {
  const stats = await getDisclosureStats();
  const corpus = stats?.uniqueCases ?? null;
  const window = stats?.sourceFiles?.length
    ? `DOL's disclosure files for ${describeDisclosureFiles(stats.sourceFiles)}`
    : null;


  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <header className="pt-10 sm:pt-12">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          How these numbers are computed
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          On one day in August 2026, public PERM tools reported the same
          headline figure as anywhere from 335 to 503 days, while DOL&apos;s own
          published average was 372.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-heading text-2xl font-bold">
          One number, six answers
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Readings taken 2026-08-24, all describing average PERM processing
          time. Most of the spread has a mechanical cause.
        </p>
        {/* Six readings of one figure on one scale, shortest first, DOL's own
            in ink: the spread is the point. */}
        <div className="mt-6 max-w-3xl border border-border bg-card p-5 sm:p-6">
          <BarRows
            rows={[...SPREAD]
              .sort((a, b) => a.days - b.days)
              .map((row) => ({
                key: row.source,
                label: row.source,
                value: row.days,
                text: row.value,
                tone: row.source.startsWith("DOL") ? ("ink" as const) : ("primary" as const),
              }))}
            label="Average PERM processing time, as six sources reported it on 2026-08-24"
          />
        </div>
        <MoreText gist={"Four choices explain nearly every difference between tools' numbers."} className="mt-4">
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Four causes account for nearly all of it. A tool can measure cases
            <em> decided</em> recently or cases <em>filed</em> in a month, and
            those are different populations. It can include audited cases or set
            them aside. It can run on this quarter&apos;s data or on a file from
            March. And a tool built on crowd reports measures its own users
            rather than the queue. None of these choices is wrong on its own. What
            matters is saying which one produced the number.
          </p>
        </MoreText>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">What our figures are</h2>
        <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-4">
          {SOURCES.map((s, i) => (
            <div
              key={s.name}
              className={
                "border border-border p-6 " +
                (i % 2 === 0 ? "bg-card" : "bg-tint")
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {/* The agency's own seal, sourced from its published
                      artwork - identification, not endorsement. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.seal}
                    alt={s.sealAlt}
                    width={44}
                    height={44}
                    loading="lazy"
                    className="h-11 w-11 shrink-0"
                  />
                  <h3 className="font-heading text-lg font-bold">{s.name}</h3>
                </div>{" "}
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold underline underline-offset-2 hover:text-primary"
                >
                  Source
                  <ArrowSquareOutIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">{s.what}</p>{" "}
              <p className="mt-2 text-sm font-bold text-muted-foreground">
                {s.cadence}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* The page's own claim, made checkable. A source list says where a
          number came from; it does not say what was counted, and the
          denominator is where these go wrong. One record per published figure,
          each linking to the page it governs. */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">Every figure, traced</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {corpus !== null && window ? (
            <>
              Most of these run over the same corpus: {corpus.toLocaleString("en-US")}{" "}
              unique cases from {window}, unioned and de-duplicated by case
              number.{" "}
            </>
          ) : null}
          Where a figure needs a rule that isn&apos;t obvious, the rule is here
          rather than in a footnote on the page that uses it.
        </p>
        {/* A REGISTER, NOT AN ESSAY. Each figure's rule stays in the DOM for
            search and opens on demand; the figure and where it lives are the
            row a reader scans. Measured 2026-09-13: this page was 87% prose. */}
        <DisclosureList
          items={TRACE.map((t) => ({
            term: t.figure,
            hint: t.where.label,
            body: (
              <>
                <p className="text-base leading-relaxed text-muted-foreground">{t.how}</p>{" "}
                <p className="mt-2 text-base leading-relaxed">
                  <span className="text-sm font-bold text-muted-foreground">
                    Counted over
                  </span>{" "}
                  <span className="text-muted-foreground">{t.population}</span>
                </p>{" "}
                <p className="mt-2">
                  <Link
                    href={t.where.href}
                    className="text-sm font-bold underline underline-offset-2 hover:text-primary"
                  >
                    Open {t.where.label}
                  </Link>
                </p>
              </>
            ),
          }))}
        />
      </section>

      <section className="mt-12" id="reference-sources">
        <h2 className="font-heading text-2xl font-bold">The sources beside the PERM record</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Occupation and city pages also draw on six other federal sources. Each is loaded from the agency&apos;s own
          file, checked against that file&apos;s own totals or shape before it&apos;s used, and dated on the page.
        </p>{" "}
        <dl className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0">
          <div className="border border-border bg-card p-5" id="onet">
            <dt className="font-heading text-lg font-bold">O*NET, what a job is</dt>{" "}
            <dd className="mt-2 text-base leading-relaxed text-soft">
              Descriptions, tasks, Job Zones and reported education from the O*NET Database, and the Bright Outlook list
              from O*NET OnLine, both by the U.S. Department of Labor, Employment and Training Administration
              (USDOL/ETA), used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. What we changed: we show
              the six core tasks O*NET rates most important rather than every task, round the education shares to whole
              percents and leave out levels under 5%, and show eight of the titles workers report. Nothing is reworded.
              USDOL/ETA has not approved, endorsed, or tested these changes.
            </dd>
          </div>{" "}
          <div className="border border-border bg-card p-5">
            <dt className="font-heading text-lg font-bold">BLS, what a job pays and where it&apos;s heading</dt>{" "}
            <dd className="mt-2 text-base leading-relaxed text-soft">
              Market pay from the Bureau of Labor Statistics&apos; Occupational Employment and Wage Statistics: what
              employers report paying everyone in a job, nationally, by state and by metro, as five percentiles. The
              ten-year employment projections and typical entry education come from BLS&apos;s projections tables. A
              percentile BLS publishes as top-coded is shown as &quot;at least&quot; its ceiling, never as a number.
            </dd>
          </div>{" "}
          <div className="border border-border bg-card p-5">
            <dt className="font-heading text-lg font-bold">DOL&apos;s wage tables, every year since 2021-22</dt>{" "}
            <dd className="mt-2 text-base leading-relaxed text-soft">
              The four prevailing wage levels for every job in every area, from the tables the Office of Foreign Labor
              Certification publishes each July, both the all-industries table and the one for universities and research
              employers (ACWIA). Most levels are hourly in DOL&apos;s files and shown a year at 2,080 hours, as DOL
              computes them. Jobs DOL publishes yearly (teachers, professors, pilots) are shown as published: DOL
              labels them from 2023-24 on, and in the two older years we read a figure of $5,000 or more as yearly,
              since no hourly level in any year comes near it. DOL&apos;s own average column is for the H-2 programs and
              is never shown as a level.
            </dd>
          </div>{" "}
          <div className="border border-border bg-card p-5">
            <dt className="font-heading text-lg font-bold">Census, where a city is</dt>{" "}
            <dd className="mt-2 text-base leading-relaxed text-soft">
              A worksite city is matched to Census&apos;s place and county-subdivision files (which is where New England
              towns and New Jersey townships are), then to its county and metro area, then to the DOL wage area that
              county belongs to. A place in several counties takes the county nearest its center, and the page says
              so. Two places with the same name in one state, or a name Census doesn&apos;t list, stay unmatched rather
              than guessed.
            </dd>
          </div>{" "}
          <div className="border border-border bg-card p-5">
            <dt className="font-heading text-lg font-bold">BEA, what prices are where</dt>{" "}
            <dd className="mt-2 text-base leading-relaxed text-soft">
              Regional price parities from the Bureau of Economic Analysis: a metro&apos;s price level against 100 for
              the country, for all items and for housing rents, read through BEA&apos;s API.
            </dd>
          </div>{" "}
          <div className="border border-border bg-card p-5">
            <dt className="font-heading text-lg font-bold">State, the visas issued</dt>{" "}
            <dd className="mt-2 text-base leading-relaxed text-soft">
              The State Department&apos;s monthly immigrant visa issuances since March 2017, by visa class and by
              country or consulate. A month is used only when its rows add up exactly to State&apos;s own grand total.
              Categories follow State&apos;s symbol legend. These are consular issuances only.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12 border border-border bg-foreground p-6 text-background sm:p-8">
        <h2 className="font-heading text-2xl font-bold">What we refuse to publish</h2>{" "}
        <ul className="mt-4 grid gap-3 text-base leading-relaxed text-background/80">
          <li className="border-l-2 border-primary pl-4">
            A single blended estimate. Each calculator shows every model its
            data supports, labelled, and lets them disagree.
          </li>{" "}
          <li className="border-l-2 border-primary pl-4">
            Medians over immature cohorts. A month whose only decided cases are
            instant withdrawals has a median of one day.
          </li>{" "}
          <li className="border-l-2 border-primary pl-4">
            Stages nobody can measure. Where a wait depends on visa-number
            availability, the timeline says so instead of inventing a figure.
          </li>{" "}
          <li className="border-l-2 border-primary pl-4">
            Undated numbers. Every figure carries the date of the data behind it.
          </li>
        </ul>
      </section>

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 border border-border bg-card p-6 sm:p-8">
        <div>
          <h2 className="font-heading text-xl font-bold">See it applied</h2>{" "}
          <p className="mt-1 text-base text-muted-foreground">
            The calculators put all of this into practice.
          </p>
        </div>
        <Link
          href="/tools"
          className="inline-flex min-h-[44px] items-center gap-2 border border-border bg-primary px-5 py-2.5 font-bold text-black transition-colors duration-150"
        >
          Open the calculators
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <DataProvenance
        datasets={[
          "perm-cases",
          "processing-times",
          "perm-case-status",
          // This page's whole job is to name every source behind every figure,
          // and it stopped at PERM while the site also tracked wage requests
          // and LCAs. A reader could not learn those existed from the one page
          // written to tell them.
          "pwd-status",
          "lca-status",
          "seasonal-status",
          "pw-disclosure",
          "visa-bulletin",
          "i485-inventory",
          "i140-trends",
        ]}
      />
    </div>
  );
}
