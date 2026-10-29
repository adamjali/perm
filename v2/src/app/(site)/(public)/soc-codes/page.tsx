/**
 * The job code finder: a job title in, the SOC codes employers filed it under out.
 *
 * Every PERM case, wage request and H-1B LCA carries a SOC code, and the code sets the
 * prevailing wage, yet a worker knows the job's title, not its number. The answer here is
 * what employers actually did in DOL's files (and O*NET's own list of titles), so "data
 * scientist" shows the split it really has. Below the box: the most filed titles, each
 * with its own page, and every code by group.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { PageSection } from "@/components/data/PageSection";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { SocFinder } from "@/components/soc/SocFinder";
import { SocSources } from "@/components/soc/SocSources";
import { FaqList } from "@/components/tools/FaqList";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { getSocCodes, getSocTitlePages } from "@/lib/db/socTitles";
import { openGraphBase } from "@/lib/openGraphBase";
import { formatShareOf } from "@/lib/format";
import { codeHref, majorGroups } from "@/lib/socFinder";
import { withSocialCard } from "@/lib/socialCard";

const TITLE = "SOC Code Lookup: Find a Job's Occupation Code";
const DESCRIPTION =
  "Type a job title and see the SOC codes employers filed it under in DOL's PERM, wage request and H-1B files, with how often, or look a code up.";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/soc-codes" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/soc-codes" },
  },
  "soc-codes",
);

// The table moves with the quarterly loads and O*NET's monthly check.
export const revalidate = 604800;

const FAQS = [
  {
    q: "What is a SOC code?",
    a: "The Standard Occupational Classification code is the government's number for a job, set by the Bureau of Labor Statistics: Software Developers are 15-1252, Registered Nurses 29-1141. Every PERM case, prevailing wage request and H-1B LCA names one, and the prevailing wage DOL sets comes from the code and the work area.",
  },
  {
    q: "Where do I find my SOC code?",
    a: "It's printed on your prevailing wage determination (ETA-9141), your LCA (ETA-9035) and your PERM application (ETA-9089). If you don't have those, type your job title above: it shows the codes employers filed that title under in DOL's files, and how often.",
  },
  {
    q: "Which SOC code is right for my job?",
    a: "The code follows the job's duties and requirements, not its title, and DOL's National Prevailing Wage Center decides it on the wage request. The split shown here is what employers chose for the same title; when it's split, the duties decide, and an immigration attorney should make the call.",
  },
  {
    q: "Why does my title show more than one code?",
    a: "Employers file the same title under different codes when the work differs: a data scientist doing statistics and one building software are filed differently. A small share under an unrelated code is usually a typing slip in a filing, and those under 1% aren't listed.",
  },
  {
    q: "What happened to 15-1132 and other older codes?",
    a: "BLS revised the SOC system in 2018. Software developers moved from 15-1132 and 15-1133 to 15-1252, and part of them to 15-1253. DOL's wage tables switched in July 2022. Type an older code above to see the codes it became.",
  },
];

export default async function SocCodesPage() {
  const [codes, pages] = await Promise.all([getSocCodes(), getSocTitlePages()]);
  const groups = codes ? majorGroups(codes.codes) : [];
  const allFilings = groups.reduce((n, g) => n + g.filings, 0);
  const busiest = Math.max(0, ...groups.map((g) => g.filings));
  // The showcase skips titles carrying an employer's own job code ("Manager JC50 ..."): they keep
  // their pages, but a reader browsing doesn't search for them.
  const top = (pages?.pages ?? []).filter((p) => !/\d/.test(p.slug)).slice(0, 24);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({ "@type": "Question" as const, name: f.q, acceptedAnswer: { "@type": "Answer" as const, text: f.a } })),
  };
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12">
      <JsonLdScript schema={faqSchema} />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Find a job&apos;s SOC code</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-soft">
          Type a job title and see the codes employers filed it under in DOL&apos;s files, and how often. Or type a code to
          see the job.
        </p>
      </header>{" "}
      <section className="mt-8 max-w-3xl" data-embed="soc-codes">
        <SearchParamsBoundary>
          <SocFinder examples={top.slice(0, 3).map(({ slug, title }) => ({ slug, title }))} />
        </SearchParamsBoundary>
      </section>{" "}
      {top.length ? (
        <PageSection id="titles" title="The most filed job titles" lede="Each with the code employers used most for it, and a page of its own.">
          <ul className="grid grid-cols-1 gap-[2px] border-2 border-border bg-border sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {top.map((p, i) => (
              <li key={p.slug} className={i >= 10 ? "hidden bg-card sm:block" : "bg-card"}>
                <Link href={`/soc-codes/${p.slug}`} className="flex min-h-[44px] flex-col gap-0.5 p-4 hover:bg-sage">
                  <span className="font-heading text-lg font-bold leading-snug">{p.title}</span>{" "}
                  <span className="text-sm text-soft">
                    {p.topSoc ? (
                      <>
                        <span className="whitespace-nowrap font-mono">{p.topSoc}</span> {codes?.codes.get(p.topSoc)?.title ?? ""},{" "}
                        {p.filings > 0 ? formatShareOf(p.topFilings, p.filings) : null}
                      </>
                    ) : null}
                  </span>
                </Link>{" "}
              </li>
            ))}
          </ul>
        </PageSection>
      ) : null}{" "}
      {groups.length ? (
        <PageSection
          id="groups"
          title="Every code, by group"
          lede={`The ${groups.length} groups BLS sorts jobs into, each with its share of the filings. Open one to see its codes.`}
        >
          <div className="border-2 border-border bg-card">
            {groups.map((g) => (
              <details key={g.major} className="group border-b-2 border-border last:border-b-0">
                <summary className="grid min-h-[44px] cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 hover:bg-sage sm:grid-cols-[minmax(12rem,22rem)_minmax(0,1fr)_11.5rem] sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 font-heading text-base font-bold">
                    <span className="font-mono text-sm text-soft">{g.major}-0000</span> {g.name}
                  </span>{" "}
                  {/* On a phone the bar takes its own full-width line under the name and share, so every track is one length. */}
                  <span className="order-last col-span-2 h-2.5 w-full bg-sage sm:order-none sm:col-span-1" aria-hidden="true">
                    <span className="block h-full bg-primary" style={{ width: `${busiest > 0 && g.filings > 0 ? Math.max(1, (g.filings / busiest) * 100) : 0}%` }} />
                  </span>{" "}
                  <span className="text-right font-mono text-sm tabular-nums">
                    {g.codes.length} {g.codes.length === 1 ? "code" : "codes"},{" "}
                    {g.filings > 0 && allFilings > 0 ? formatShareOf(g.filings, allFilings) : "no filings"}
                  </span>
                </summary>{" "}
                <ul className="grid grid-cols-1 gap-x-6 border-t-2 border-border/40 px-5 py-3 sm:grid-cols-2 sm:px-6">
                  {g.codes.map((c) => (
                    <li key={c.soc}>
                      <Link href={codeHref(c.soc, c.slug)} className="link inline-flex min-h-11 items-center">
                        <span>
                          <span className="whitespace-nowrap font-mono text-sm">{c.soc}</span> {c.title}
                        </span>
                      </Link>{" "}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </PageSection>
      ) : null}{" "}
      <section className="mt-14 max-w-3xl">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
        <FaqList items={FAQS} />
      </section>{" "}
      <SocSources codes={codes} />
      {groups.length === 0 ? (
        <Fragment>
          {" "}
          <p className="mt-6 text-base text-soft">The code list isn&apos;t loaded yet. The finder above still answers.</p>
        </Fragment>
      ) : null}
    </div>
  );
}
