/**
 * The methodology page.
 *
 * Public PERM estimators disagree with each other by months on the same
 * filing date, and almost none of them say why. This page is the answer to
 * that, and it is the product's position stated once: every number carries
 * its source and its date, and a number we cannot support does not appear.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowSquareOut } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { DataProvenance } from "@/components/data/DataProvenance";
import { getDisclosureStats } from "@/lib/turso/publicData";

const TITLE = "How These Numbers Are Computed";
const DESCRIPTION =
  "Why PERM estimators disagree by months on the same case, where our figures come from, and what we refuse to publish.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/methodology" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/methodology",
  },
};

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
export const revalidate = 86400;

/**
 * Readings of the same headline number across the public tools, taken on one
 * day (2026-08-24). Kept as a dated record on purpose: the spread is the
 * point, and a live comparison would put us in the business of monitoring
 * competitors rather than DOL.
 */
const SPREAD = [
  { source: "DOL's own published average", value: "372 days" },
  { source: "Crowd-sourced tracker", value: "335 days" },
  { source: "Queue estimator A", value: "387 days" },
  { source: "Queue estimator B", value: "462-480 days" },
  { source: "Analytics site", value: "467 days" },
  { source: "Stale calculator (March data)", value: "503 days" },
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
    population: "A per-case scan of DOL's case-status pages, refreshed on a rolling basis. A different source from the quarterly files, which contain no pending cases at all.",
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
    population: "Employment-based charts only, read from the Internet Archive because the live site refuses automated readers. It lags the current month, which is why it is framed as a history.",
  },
];

const SOURCES = [
  {
    name: "DOL FLAG processing times",
    seal: "/agency/dol-seal.png",
    sealAlt: "Seal of the US Department of Labor",
    what: "Queue positions and average days, the figures on the processing times page.",
    cadence: "Checked weekly. A new snapshot is stored only when the figures change.",
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
    name: "State Department visa bulletin",
    seal: "/agency/dos-seal.png",
    sealAlt: "Seal of the US Department of State",
    what: "Employment-based cutoff dates. The live page refuses automated readers, so our series comes from the Internet Archive and lags the current month. That’s why the priority date calculator is framed as a history.",
    cadence: "Monthly.",
    href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
  },
] as const;

export default async function MethodologyPage() {
  const stats = await getDisclosureStats();
  const corpus = stats?.uniqueCases ?? null;
  const window = stats?.sourceFiles?.length
    ? stats.sourceFiles
        .map((f) => f.replace(/^PERM_Disclosure_Data_/, "").replace(/\.xlsx$/, ""))
        .join(" + ")
    : null;

  const breadcrumb = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "Methodology", href: "/methodology" },
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <JsonLdScript schema={breadcrumb} />      <header className="pt-10 sm:pt-12">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Methodology
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          How these numbers are computed
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          On one day in August 2026, public PERM tools reported the same
          headline figure as anywhere from 335 to 503 days, while DOL&apos;s own
          published average was 372.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-heading text-2xl font-black">
          One number, six answers
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
          Readings taken 2026-08-24, all describing average PERM processing
          time. Most of the spread has a mechanical cause.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-2 border-border text-left text-sm shadow-hard-sm">
            <thead className="bg-foreground text-background">
              <tr>
                <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">
                  Source
                {" "}</th>
                <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">
                  Reported
                </th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {SPREAD.map((row) => (
                <tr key={row.source} className="border-t border-border/40">
                  <td className="p-3">{row.source}{" "}</td>
                  <td className="p-3 font-mono font-bold tabular-nums">{row.value}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/70">
          Four causes account for nearly all of it. A tool can measure cases
          <em> decided</em> recently or cases <em>filed</em> in a month, and
          those are different populations. It can include audited cases or set
          them aside. It can run on this quarter&apos;s data or on a file from
          March. And a tool built on crowd reports measures its own users
          rather than the queue. None of these choices is wrong on its own. What
          matters is saying which one produced the number.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">What our figures are</h2>
        <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-4">
          {SOURCES.map((s, i) => (
            <div
              key={s.name}
              className={
                "border-2 border-border p-6 shadow-hard-sm " +
                (i % 2 === 0 ? "bg-card" : "bg-tint-primary")
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
                  <h3 className="font-heading text-lg font-black">{s.name}</h3>
                </div>{" "}
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold underline underline-offset-2 hover:text-primary"
                >
                  Source
                  <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-2 text-base leading-relaxed text-foreground/70">{s.what}</p>{" "}
              <p className="mt-2 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
        <h2 className="font-heading text-2xl font-black">Every figure, traced</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
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
        <div className="mt-6 divide-y-2 divide-border border-2 border-border bg-card shadow-hard">
          {TRACE.map((t) => (
            <div key={t.figure} className="p-6 sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-heading text-lg font-black leading-tight">
                  {t.figure}
                </h3>{" "}
                <Link
                  href={t.where.href}
                  className="font-mono text-xs font-bold uppercase tracking-wider underline underline-offset-2 hover:text-primary"
                >
                  {t.where.label}
                </Link>
              </div>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                {t.how}
              </p>{" "}
              <p className="mt-2 text-base leading-relaxed">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Counted over
                </span>{" "}
                <span className="text-foreground/70">{t.population}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">What we refuse to publish</h2>{" "}
        <ul className="mt-4 grid gap-3 text-base leading-relaxed text-background/80">
          <li className="border-l-4 border-primary pl-4">
            A single blended estimate. Each calculator shows every model its
            data supports, labelled, and lets them disagree.
          </li>{" "}
          <li className="border-l-4 border-primary pl-4">
            Medians over immature cohorts. A month whose only decided cases are
            instant withdrawals has a median of one day.
          </li>{" "}
          <li className="border-l-4 border-primary pl-4">
            Stages nobody can measure. Where a wait depends on visa-number
            availability, the timeline says so instead of inventing a figure.
          </li>{" "}
          <li className="border-l-4 border-primary pl-4">
            Undated numbers. Every figure carries the date of the data behind it.
          </li>
        </ul>
      </section>

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <div>
          <h2 className="font-heading text-xl font-black">See it applied</h2>{" "}
          <p className="mt-1 text-base text-foreground/70">
            The calculators put all of this into practice.
          </p>
        </div>
        <Link
          href="/tools"
          className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-5 py-2.5 font-bold text-black shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
        >
          Open the calculators
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <DataProvenance
        datasets={[
          "perm-cases",
          "processing-times",
          "perm-case-status",
          "visa-bulletin",
          "i485-inventory",
          "i140-trends",
        ]}
      />
    </div>
  );
}
