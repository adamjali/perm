import type { Metadata } from "next";
import Link from "next/link";

import ScreenshotFigure from "@/components/content/ScreenshotFigure";
import { BarRows } from "@/components/data/BarRows";
import { DataProvenance } from "@/components/data/DataProvenance";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { FinePrint } from "@/components/data/FinePrint";
import { PageSection } from "@/components/data/PageSection";
import { LayoffAnswersTable } from "@/components/layoffs/LayoffAnswersTable";
import { LayoffOutcomes } from "@/components/layoffs/LayoffOutcomes";
import { LayoffShareGrid } from "@/components/layoffs/LayoffShareGrid";
import { LayoffYears } from "@/components/layoffs/LayoffYears";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { SITE_URL } from "@/lib/constants/site";
import { getLayoffDisclosures } from "@/lib/db/layoffDisclosures";
import { firstThatFits } from "@/lib/describe";
import { longDate } from "@/lib/employerStages";
import { entityHref } from "@/lib/entityPayload";
import { formatInt, formatShareOf } from "@/lib/format";
import { newestYear, outcomeTotal, yearComplete, type LayoffDoc, type LayoffEmployer } from "@/lib/layoffDisclosures";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getDatasetSchema } from "@/lib/structuredData";
import { softFail } from "@/lib/softRead";

/**
 * What employers told DOL about layoffs on their PERM applications (Form 9089,
 * Section G, Item 12), from DOL's own files. Reads perm_docs['layoff_disclosures']
 * (scripts/build_layoff_disclosures.py, after each PERM load), so a weekly window,
 * and POST /api/revalidate-disclosure expires it when a file lands.
 */

export const revalidate = 604800;

const PATH = "/perm-layoff-disclosures";
const TITLE = "Layoffs Reported on PERM Applications";
const SHOWN = 10;
const FORM_PICTURE = "/images/content/figures/guides/perm-layoff-rule-for-employers-form-g12.webp";
const FORM_URL =
  "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/ETA-9089-Application-for-Perm-Employment-Certification-Expires02-28-29.pdf";

function fyLabel(doc: LayoffDoc): string {
  const y = newestYear(doc);
  return yearComplete(y) ? `fiscal year ${y.fy}` : `fiscal year ${y.fy} so far`;
}

function span(doc: LayoffDoc): string {
  const y = newestYear(doc);
  return y.from && y.through ? `${longDate(y.from)} to ${longDate(y.through)}` : `fiscal year ${y.fy}`;
}

/** The complete year with the highest share of yeses, as a sentence; nothing when no year is complete. */
function peakSentence(doc: LayoffDoc): string {
  const full = doc.years.filter((y) => yearComplete(y) && y.answered > 0);
  if (full.length === 0) return "";
  const peak = full.reduce((a, b) => (b.yes / b.answered > a.yes / a.answered ? b : a));
  return ` The highest share was fiscal year ${peak.fy}: ${formatInt(peak.yes)} applications, ${formatShareOf(peak.yes, peak.answered)} of that year's.`;
}

function faqs(doc: LayoffDoc | null) {
  const y = doc ? newestYear(doc) : null;
  return [
    {
      q: "Does a yes mean the case is denied?",
      a: y
        ? `No. The rule allows the filing; it asks more of the employer. Of the applications decided in ${fyLabel(doc!)} that said yes, ${formatShareOf(y.yesOutcomes.certified, outcomeTotal(y.yesOutcomes))} were certified, against ${formatShareOf(y.noOutcomes.certified, outcomeTotal(y.noOutcomes))} of those that said no. That's an association, and says nothing about why any one case ended as it did.`
        : "No. The rule allows the filing; it asks more of the employer.",
    },
    {
      q: "Can an employer that laid people off still file PERM?",
      a: "Yes. If it had a layoff in the job's occupation or a related one, in the area of intended employment, within the six months before filing, it must have notified and considered the laid-off U.S. workers who could do the job, and kept the record (20 CFR 656.17(k)). A layoff is any involuntary separation without cause, one person included.",
    },
    {
      q: "Is this the same as a WARN notice?",
      a: "No. A WARN notice is a large layoff or closing reported to a state under labor law. This is the employer's own answer on each PERM application, about the job's occupation in the job's area, and it covers a layoff of one person. A company can have one without the other.",
    },
    {
      q: "Where do these numbers come from?",
      a: "DOL's PERM disclosure files, which print each decided application's answer to the layoff question as Y or N. A blank answer is counted as unanswered, never as no. Each employer's spellings count on one page.",
    },
  ];
}

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLayoffDisclosures().catch(softFail("perm-layoff-disclosures/page.getLayoffDisclosures", null));
  const y = doc ? newestYear(doc) : null;
  const lead = y && doc ? `${formatInt(y.yes)} of ${formatInt(y.answered)} PERM applications decided in ${fyLabel(doc)} reported a layoff.` : "";
  const description = firstThatFits([
    `${lead} Which employers told DOL about a layoff in the job's occupation, year by year, from DOL's own files.`,
    `${lead} Which employers said so, from DOL's own files.`,
    "Which employers told DOL about a layoff in the job's occupation on their PERM applications, year by year, from DOL's own files.",
  ]);
  return withSocialCard(
    {
      title: TITLE,
      description,
      alternates: { canonical: PATH },
      openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description, url: PATH },
    },
    "perm-layoff-disclosures",
  );
}

function employerLabel(r: LayoffEmployer) {
  return r.slug ? (
    <Link href={entityHref("employer", r.slug)} className="link py-[10px] sm:py-0">
      {r.name}
    </Link>
  ) : (
    r.name
  );
}

export default async function Page() {
  const doc = await getLayoffDisclosures();
  const qa = faqs(doc);
  const schemas: object[] = [
    getDatasetSchema(SITE_URL, {
      name: "Layoffs reported on PERM applications",
      description:
        "Each employer's answer to Form 9089's layoff question (Section G, Item 12) on its decided PERM applications, by fiscal year, employer and occupation, from DOL's PERM disclosure files.",
      url: `${SITE_URL}${PATH}`,
      isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
      temporalCoverage: doc ? `${doc.years[0]!.from ?? `${doc.years[0]!.fy - 1}-10-01`}/${doc.newestThrough ?? ".."}` : "2015-10-01/..",
      variableMeasured: ["Applications reporting a layoff", "Applications answering the layoff question", "Outcomes"],
    }),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: qa.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  const y = doc ? newestYear(doc) : null;
  const top = doc?.employers[0] ?? null;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      {schemas.map((s, i) => (
        <JsonLdScript key={i} schema={s} />
      ))}
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Layoffs reported on PERM applications</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Every PERM application asks whether the employer laid off workers in the job&apos;s occupation, in the area, in the
          six months before filing. DOL publishes each answer once the case is decided.
        </p>
      </header>{" "}
      {doc && y ? (
        <>
          <section className="mt-10" aria-label="The year in figures">
            <p className="mb-3 text-base text-soft">
              {yearComplete(y) ? `Fiscal year ${y.fy}` : `Fiscal year ${y.fy} so far`}: applications DOL decided from {span(doc)}, its
              newest published file.
            </p>{" "}
            <FigureRow>
              <Figure
                label="Said yes"
                value={formatInt(y.yes)}
                note={`${formatShareOf(y.yes, y.answered)} of ${formatInt(y.answered)} decided applications`}
              />{" "}
              <Figure
                label="Employers"
                value={formatInt(doc.employersYes)}
                note={`said yes at least once, of ${formatInt(doc.employersAnswering)} that answered`}
              />{" "}
              <Figure
                label="Certified after a yes"
                value={formatShareOf(y.yesOutcomes.certified, outcomeTotal(y.yesOutcomes))}
                note={`${formatShareOf(y.noOutcomes.certified, outcomeTotal(y.noOutcomes))} after a no`}
              />
            </FigureRow>
          </section>{" "}
          {top ? (
            <PageSection
              id="employers"
              title="Whose applications said yes"
              lede={`The applications that said yes in ${fyLabel(doc)}, by employer.`}
            >
              <LayoffShareGrid topName={top.name} topSlug={top.slug} topYes={top.yes} totalYes={y.yes} fyLabel={fyLabel(doc)} />{" "}
              <h3 className="mt-12 font-heading text-lg font-bold">The {Math.min(SHOWN, doc.employers.length)} with the most</h3>{" "}
              <BarRows
                className="mt-4"
                inline
                label={`Employers by PERM applications that reported a layoff, ${fyLabel(doc)}`}
                rows={doc.employers.slice(0, SHOWN).map((r, i) => ({
                  key: r.slug ?? r.name,
                  label: (
                    <>
                      <span className="mr-1.5 font-mono tabular-nums text-muted-foreground">{i + 1}</span> {employerLabel(r)}
                    </>
                  ),
                  sub: `${formatShareOf(r.yes, r.answered)} of its ${formatInt(r.answered)} applications`,
                  value: r.yes,
                  text: formatInt(r.yes),
                  tone: i === 0 ? "primary" : "blue",
                  tip: [r.name, `${formatInt(r.yes)} said yes`, `${formatShareOf(r.yes, r.answered)} of ${formatInt(r.answered)} applications`, `${formatInt(r.certified)} of the yeses certified`].join("\n"),
                }))}
              />
            </PageSection>
          ) : null}{" "}
          <PageSection
            id="years"
            title="Year by year"
            lede={`Every fiscal year DOL's files carry the answer, from ${doc.years[0]!.fy} on, by the year DOL decided the case.${peakSentence(doc)}`}
          >
            <LayoffYears years={doc.years} />
          </PageSection>{" "}
          {doc.jobs.length > 0 ? (
            <PageSection id="jobs" title="Which jobs" lede={`The occupations with the most yeses in ${fyLabel(doc)}.`}>
              <BarRows
                inline
                label={`Occupations by PERM applications that reported a layoff, ${fyLabel(doc)}`}
                rows={doc.jobs.map((j, i) => ({
                  key: j.code,
                  label: j.slug ? (
                    <Link href={entityHref("occupation", j.slug)} className="link py-[10px] sm:py-0">
                      {j.title}
                    </Link>
                  ) : (
                    j.title
                  ),
                  sub: `${j.code}, ${formatShareOf(j.yes, j.answered)} of ${formatInt(j.answered)} applications`,
                  value: j.yes,
                  text: formatInt(j.yes),
                  tone: i === 0 ? "primary" : "blue",
                }))}
              />
            </PageSection>
          ) : null}{" "}
          <PageSection
            id="outcomes"
            title="How the cases ended"
            lede={`Applications decided in ${fyLabel(doc)}, by their answer. An association only: it says nothing about why one case ended as it did.`}
          >
            <LayoffOutcomes yes={y.yesOutcomes} no={y.noOutcomes} fyLabel={fyLabel(doc)} />
          </PageSection>{" "}
          <PageSection
            id="all"
            title="Every employer that said yes"
            lede={`${formatInt(doc.employersYes)} employers, ${span(doc)}. Search by name.`}
          >
            <LayoffAnswersTable rows={doc.employers} fy={y.fy} through={y.through ?? ""} />
          </PageSection>
        </>
      ) : (
        <p className="mt-8 bg-tint p-5 text-base">
          The figures aren&apos;t built yet. They&apos;re made from DOL&apos;s PERM files after each load.
        </p>
      )}{" "}
      <PageSection id="question" title="The question, as DOL asks it" lede="Form ETA-9089, Section G, question 12.">
        <div>
          <ScreenshotFigure
            src={FORM_PICTURE}
            alt="Question 12 of Section G on Form ETA-9089, highlighted: has the employer had a layoff in the occupation involved in this application, or a related one, within the 6 months before filing, in the area of intended employment? Yes or No"
            credit="Form ETA-9089, Section G, page 4, U.S. Department of Labor"
            creditHref={FORM_URL}
            aspectRatio={1600 / 192}
            maxWidth={1600}
          />{" "}
          <ul className="mt-2 grid grid-cols-1 gap-6 text-base leading-relaxed md:grid-cols-3 [&>*]:min-w-0">
            <li>
              <strong>A yes doesn&apos;t stop a filing.</strong> The employer must show it told the laid-off workers about the job
              and considered those who could do it (20 CFR 656.17(k)).
            </li>{" "}
            <li>
              <strong>One person counts.</strong> A layoff is any involuntary separation without cause, in the job&apos;s
              occupation or a related one, in the area, within the six months before filing.
            </li>{" "}
            <li>
              <strong>It&apos;s the employer&apos;s own answer.</strong> DOL prints it as filed.{" "}
              <Link href="/guides/perm-layoff-rule-for-employers" className="link">
                The layoff rule, step by step
              </Link>
            </li>
          </ul>
        </div>
      </PageSection>{" "}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
        <FaqList items={qa} openFirst={false} />
      </section>{" "}
      <FinePrint summary="How the figures are made" className="mt-8">
        <p>
          DOL&apos;s PERM disclosure files print each decided application&apos;s answer: OTHER_REQ_EMP_LAYOFF on the form in use
          since 2023, LAYOFF_IN_PAST_SIX_MONTHS and RI_LAYOFF_IN_PAST_SIX_MONTHS on the old one (Section I.e, item 26). A year
          is shown when most of its decided cases carry an answer. Shares are of the applications that answered.
        </p>{" "}
        <p>
          Cases count in the fiscal year DOL decided them, October to September. A year DOL is still publishing runs to the
          last day its newest file reaches. Each employer&apos;s spellings are counted on one page; a name with no page is
          listed as DOL printed it, without a link.
        </p>
      </FinePrint>{" "}
      <nav aria-label="Related" className="mt-8 flex flex-wrap gap-x-6 text-base">
        <Link href="/layoffs" className="link inline-flex min-h-11 items-center">
          Layoff notices (WARN)
        </Link>{" "}
        <Link href="/perm-recruitment" className="link inline-flex min-h-11 items-center">
          PERM recruitment
        </Link>{" "}
        <Link href="/perm-employers/under-review" className="link inline-flex min-h-11 items-center">
          Employers under review
        </Link>{" "}
        <Link href="/perm-denial-risk" className="link inline-flex min-h-11 items-center">
          Denial rates
        </Link>{" "}
        <Link href="/guides/employer-layoffs-and-your-perm" className="link inline-flex min-h-11 items-center">
          When your employer has layoffs
        </Link>
      </nav>{" "}
      <DataProvenance datasets={["perm-cases"]} />
    </div>
  );
}
