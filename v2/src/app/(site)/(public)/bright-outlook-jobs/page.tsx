import type { Metadata } from "next";
import Link from "next/link";

import { BarRows } from "@/components/data/BarRows";
import { DataProvenance } from "@/components/data/DataProvenance";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { FinePrint } from "@/components/data/FinePrint";
import { PageSection } from "@/components/data/PageSection";
import { ROW_LINK } from "@/components/entities/caseRows";
import { OnetCredit } from "@/components/reference/OnetCredit";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { ScrollBox } from "@/components/ui/scroll-box";
import { BRIGHT_CATEGORIES, brightTotals, growingAndSponsored, type BrightJob } from "@/lib/brightOutlook";
import { SITE_URL } from "@/lib/constants/site";
import { getBrightOutlook } from "@/lib/db/brightOutlook";
import { getCasesMeta } from "@/lib/db/publicData";
import { onetReference } from "@/lib/db/reference";
import { formatInt, formatShare } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getDatasetSchema } from "@/lib/structuredData";
import { longDate } from "@convex/lib/months";

/**
 * O*NET's Bright Outlook jobs (projected to grow fast, with many openings, or new and emerging) beside the PERM
 * cases DOL decided under each code and the certified H-1B LCAs filed under it (lib/brightOutlook.ts). Every
 * source moves quarterly at most, so a weekly window; POST /api/revalidate-disclosure expires it when a file lands.
 */

export const revalidate = 604800;

const PATH = "/bright-outlook-jobs";
const TITLE = "Fast-Growing Jobs and Their Sponsorship";
const SHOWN = 25;
const GROWING_SHOWN = 15;

const FAQS = [
  {
    q: "What makes a job Bright Outlook?",
    a: "O*NET's own words: Bright Outlook occupations \"are expected to grow rapidly in the next several years, will have large numbers of job openings, or are new and emerging occupations.\" Rapid Growth means BLS projects employment to rise 5% or more from 2025 to 2035, Numerous Job Openings means 75,000 or more openings over those years, and New and Emerging is O*NET's own classification.",
  },
  {
    q: "Does a Bright Outlook job get a faster PERM or a better chance?",
    a: "No. DOL decides each PERM case on its own recruitment and paperwork, and it works the queue in filing order whatever the job. Growth only says the field is hiring. The certified share beside each job is what DOL decided for that code in its own files.",
  },
  {
    q: "Why does a job show no H-1B count?",
    a: "The count covers job codes with 30 or more certified H-1B LCAs since October 2019. Older LCAs used the 2010 job codes, so a job whose code changed in the 2018 list (software developers were 15-1132 before 15-1252) counts only the filings under its new code.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const description =
    "The jobs O*NET expects to grow fast, with BLS's 2025-35 growth, the PERM cases DOL decided under each and its certified H-1B LCAs.";
  return withSocialCard(
    {
      title: TITLE,
      description,
      alternates: { canonical: PATH },
      openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description, url: PATH },
    },
    "bright-outlook-jobs",
  );
}

function pct(v: number | null): string {
  if (v === null) return "No projection";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function money(v: number | null): string {
  return v === null ? "Not published" : `$${formatInt(Math.round(v))}`;
}

function jobName(j: BrightJob, className = "link py-[10px] sm:py-0") {
  return j.permSlug ? (
    <Link href={`/perm-wages/${j.permSlug}`} className={className}>
      {j.title}
    </Link>
  ) : (
    j.title
  );
}

function subLine(j: BrightJob): string {
  const parts: string[] = [j.soc7, j.categories.join(", ")];
  if (j.growthPct !== null) parts.push(`${pct(j.growthPct)} jobs by 2035`);
  if (j.lcaCertified) parts.push(`${formatInt(j.lcaCertified)} H-1B LCAs`);
  return parts.join(" · ");
}

export default async function Page() {
  const [{ jobs, lcaFloor }, meta, onet] = await Promise.all([
    getBrightOutlook(),
    getCasesMeta<{ firstDecisionDate?: string; lastDecisionDate?: string }>(),
    onetReference(),
  ]);
  const totals = brightTotals(jobs);
  const sponsored = jobs.filter((j) => j.permDecided > 0);
  const growing = growingAndSponsored(jobs).slice(0, GROWING_SHOWN);
  const span =
    meta?.firstDecisionDate && meta?.lastDecisionDate
      ? `from ${longDate(meta.firstDecisionDate)} to ${longDate(meta.lastDecisionDate)}`
      : "in DOL's files";
  const schemas: object[] = [
    getDatasetSchema(SITE_URL, {
      name: "Bright Outlook jobs and their sponsorship",
      description:
        "O*NET's Bright Outlook occupations with BLS's 2025-35 employment projections, the PERM cases DOL decided under each job code and its certified H-1B LCAs.",
      url: `${SITE_URL}${PATH}`,
      isBasedOn: "https://www.onetonline.org/find/bright",
      variableMeasured: ["Projected employment change", "Annual openings", "PERM cases decided", "Certified H-1B LCAs"],
    }),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      {schemas.map((s, i) => (
        <JsonLdScript key={i} schema={s} />
      ))}
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Fast-growing jobs that get sponsored</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          O*NET marks a job Bright Outlook when it&apos;s projected to grow fast, to have many openings, or is new and emerging.
          Here each one sits beside the PERM cases DOL decided for it and the H-1B LCAs employers filed.
        </p>
      </header>{" "}
      {jobs.length > 0 ? (
        <>
          <section className="mt-10" aria-label="The list in figures">
            <FigureRow>
              <Figure tone="lime" label="Bright Outlook jobs" value={formatInt(totals.jobs)} note="By job code, O*NET's list" />{" "}
              <Figure label="With PERM cases" value={formatInt(totals.withPerm)} note={`Decided ${span}`} />{" "}
              <Figure label="With H-1B LCAs" value={formatInt(totals.withLca)} note={lcaFloor ? `${lcaFloor} or more certified` : undefined} />{" "}
              {BRIGHT_CATEGORIES.map((c) => (
                <Figure key={c} label={c} value={formatInt(totals.byCategory[c])} />
              ))}
            </FigureRow>
          </section>{" "}
          <PageSection
            id="sponsored"
            title="The ones employers sponsor most"
            lede={`By PERM cases DOL decided ${span}, every job title under the code together.`}
          >
            <BarRows
              label="Bright Outlook jobs by PERM cases decided"
              rows={sponsored.slice(0, SHOWN).map((j, i) => ({
                key: j.soc7,
                label: (
                  <>
                    <span className="mr-1.5 font-mono tabular-nums text-muted-foreground">{i + 1}</span> {jobName(j)}
                  </>
                ),
                sub: subLine(j),
                value: j.permDecided,
                text: formatInt(j.permDecided),
                tone: i === 0 ? "primary" : "blue",
                tip: [
                  j.title,
                  `${formatInt(j.permDecided)} PERM cases decided`,
                  j.approval !== null ? `${formatShare(j.approval)} of certified and denied were certified` : null,
                  subLine(j),
                ]
                  .filter(Boolean)
                  .join("\n"),
              }))}
            />
          </PageSection>{" "}
          {growing.length > 0 ? (
            <PageSection
              id="growing"
              title="Growing fastest, among the sponsored"
              lede="BLS's projected change in jobs from 2025 to 2035, for the Bright Outlook jobs with 10 or more PERM cases decided."
            >
              <BarRows
                label="Sponsored Bright Outlook jobs by projected growth, 2025 to 2035"
                inline
                rows={growing.map((j, i) => ({
                  key: j.soc7,
                  label: jobName(j),
                  sub: `${formatInt(j.permDecided)} PERM cases · median pay ${money(j.blsMedian)}`,
                  value: j.growthPct,
                  text: pct(j.growthPct),
                  tone: i === 0 ? "primary" : "green",
                }))}
              />
            </PageSection>
          ) : null}{" "}
          <PageSection id="every-job" title="Every Bright Outlook job" lede={`All ${formatInt(totals.jobs)}, busiest in PERM first.`}>
            <FinePrint summary={`The ${formatInt(totals.jobs)} jobs as a table`}>
              <ScrollBox label="Every Bright Outlook job" className="border-2 border-border">
                <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Every Bright Outlook job with its projected growth, openings, median pay, PERM cases and H-1B LCAs{" "}
                  </caption>
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th scope="col" className="p-2.5 font-semibold">Job{" "}</th>
                      <th scope="col" className="p-2.5 font-semibold">Outlook{" "}</th>
                      <th scope="col" className="p-2.5 text-right font-semibold">Growth to 2035{" "}</th>
                      <th scope="col" className="p-2.5 text-right font-semibold">Openings a year{" "}</th>
                      <th scope="col" className="p-2.5 text-right font-semibold">Median pay{" "}</th>
                      <th scope="col" className="p-2.5 text-right font-semibold">PERM cases{" "}</th>
                      <th scope="col" className="p-2.5 text-right font-semibold">Certified{" "}</th>
                      <th scope="col" className="p-2.5 text-right font-semibold">H-1B LCAs{" "}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.soc7} className="border-b border-border/40 align-top last:border-b-0">
                        <th scope="row" className="p-2.5 font-semibold">
                          {jobName(j, ROW_LINK)}{" "}
                          <span className="block font-mono text-sm font-normal text-muted-foreground">{j.soc7}{" "}</span>
                          {j.marked.length > 0 ? (
                            <span className="block text-sm font-normal text-muted-foreground">
                              O*NET marks {j.marked.join(" and ")}{" "}
                            </span>
                          ) : null}
                        </th>
                        <td className="p-2.5">{j.categories.join(", ")}{" "}</td>
                        <td className="p-2.5 text-right font-mono tabular-nums">{pct(j.growthPct)}{" "}</td>
                        <td className="p-2.5 text-right font-mono tabular-nums">{j.openings !== null ? formatInt(j.openings) : "None published"}{" "}</td>
                        <td className="p-2.5 text-right font-mono tabular-nums">{money(j.blsMedian)}{" "}</td>
                        <td className="p-2.5 text-right font-mono tabular-nums">{formatInt(j.permDecided)}{" "}</td>
                        <td className="p-2.5 text-right font-mono tabular-nums">{j.approval !== null ? formatShare(j.approval) : "Too few"}{" "}</td>
                        <td className="p-2.5 text-right font-mono tabular-nums">{j.lcaCertified !== null ? formatInt(j.lcaCertified) : "Under the floor"}{" "}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollBox>
            </FinePrint>
          </PageSection>
        </>
      ) : (
        <p className="mt-8 border-2 border-border bg-sage p-5 text-base">
          The list isn&apos;t built yet. It&apos;s made from O*NET&apos;s occupation data, BLS&apos;s projections and DOL&apos;s files.
        </p>
      )}{" "}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
        <FaqList items={FAQS} openFirst={false} />
      </section>{" "}
      <FinePrint summary="How the list is made" className="mt-8">
        <p>
          O*NET marks occupations, some of them detailed jobs inside a code (15-1299.08 inside 15-1299). DOL&apos;s files record
          the 7-digit code, so each row is the code, and where O*NET marks only detailed jobs inside it, the row names them.
          Growth, openings and median pay are BLS&apos;s 2025-35 projections for the code. PERM cases are every decided case
          under the code {span}, every job title together; the certified share needs 30 certified or denied. H-1B LCAs are
          certified LCAs since October 2019 under the code, for codes with {lcaFloor ?? 30} or more.
        </p>
      </FinePrint>{" "}
      <OnetCredit version={onet.version} note="Bright Outlook occupations grouped by SOC code" className="mt-6" compact />{" "}
      <nav aria-label="Related" className="mt-8 flex flex-wrap gap-x-6 text-base">
        <Link href="/perm-wages" className="link inline-flex min-h-11 items-center">
          PERM wages by job
        </Link>{" "}
        <Link href="/soc-codes" className="link inline-flex min-h-11 items-center">
          Find a SOC code
        </Link>{" "}
        <Link href="/lca-wages" className="link inline-flex min-h-11 items-center">
          H-1B salaries
        </Link>{" "}
        <Link href="/h1b-employers" className="link inline-flex min-h-11 items-center">
          Top H-1B employers
        </Link>
      </nav>{" "}
      <DataProvenance datasets={["onet", "bls-projections", "perm-cases", "lca-disclosure"]} />
    </div>
  );
}
