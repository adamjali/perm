/**
 * One job title's SOC code: the codes employers filed it under in DOL's files, each with its
 * share, BLS's national pay for each and its O*NET Job Zone, so a title filed two ways shows
 * what the choice means. A page for every title with 50+ filings (scripts/build_soc_titles.py).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { BarRows, type BarRow } from "@/components/data/BarRows";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { SocCodeText } from "@/components/data/SocCodeText";
import { PageSection } from "@/components/data/PageSection";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { SocSources } from "@/components/soc/SocSources";
import { CaseNextStep } from "@/components/tools/CaseNextStep";
import { FaqList } from "@/components/tools/FaqList";
import { breadcrumbSchema } from "@/lib/breadcrumbs";
import { firstThatFits } from "@/lib/describe";
import { marketPayNational } from "@/lib/db/reference";
import { getSocCodes, getSocTitle } from "@/lib/db/socTitles";
import { formatDollars, formatInt, formatShareOf } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { codeHref, type TitleAnswer, type TitleCode } from "@/lib/socFinder";
import { keyOfSlug } from "@/lib/socTitleKey";
import { finderHref, DEFAULT_FILTERS } from "@/lib/sponsorFinder";
import { withSocialCard } from "@/lib/socialCard";

// The titles move with the quarterly loads.
export const revalidate = 604800;

/** Built on first request: 3,600 titles, each read once a week. */
export async function generateStaticParams() {
  return [];
}

async function answerFor(slug: string): Promise<TitleAnswer | null> {
  const key = keyOfSlug(slug);
  if (!key) return null;
  const a = await getSocTitle(key);
  // Only a title with its own page answers here; the rest are found through the finder.
  return a?.slug === slug ? a : null;
}

const filedCodes = (a: TitleAnswer) => a.codes.filter((c) => c.filings > 0);

function describe(a: TitleAnswer): string {
  const [top, ...rest] = filedCodes(a);
  if (!top) return `The SOC codes O*NET lists for ${a.title}.`;
  const others = rest.length ? `, and under ${rest.length} other ${rest.length === 1 ? "code" : "codes"}` : "";
  return `Employers filed ${a.title} under ${top.soc} ${top.codeTitle} in ${formatShareOf(top.filings, a.total)} of ${formatInt(a.total)} filings in DOL's files${others}.`;
}

export async function generateMetadata({ params }: { params: Promise<{ title: string }> }): Promise<Metadata> {
  const slug = (await params).title;
  const a = await answerFor(slug);
  if (!a) notFound();
  const path = `/soc-codes/${slug}`;
  const title = `SOC Code for ${a.title}`;
  const top = filedCodes(a)[0];
  const description = firstThatFits([
    describe(a),
    top ? `${a.title} is filed under ${top.soc} ${top.codeTitle} in ${formatShareOf(top.filings, a.total)} of DOL's filings. Every code employers used, with its share.` : "",
    top ? `${a.title}: SOC code ${top.soc} in ${formatShareOf(top.filings, a.total)} of DOL's filings.` : describe(a),
  ].filter(Boolean));
  return withSocialCard(
    {
      // The title is the searched phrase: past 60 characters with the brand, the brand gives way.
      title: title.length + " | PERM Tracker".length > 60 ? { absolute: title } : title,
      description,
      alternates: { canonical: path },
      openGraph: { ...openGraphBase, title: `${title} | PERM Tracker`, description, url: path },
    },
    "soc-codes",
  );
}

function codeRow(c: TitleCode, total: number, pay: number | null): BarRow {
  const programs = [
    c.perm ? `${formatInt(c.perm)} PERM` : null,
    c.pwd ? `${formatInt(c.pwd)} wage requests` : null,
    c.lca ? `${formatInt(c.lca)} H-1B LCAs` : null,
  ].filter(Boolean);
  const notes = [
    pay ? `BLS median ${formatDollars(pay)} a year` : null,
    c.zone ? `Job Zone ${c.zone}` : null,
    c.becameCodes.length ? `a 2010 code, now ${c.becameCodes.join(" or ")}` : null,
  ].filter(Boolean);
  return {
    key: c.soc,
    label: (
      <Link href={codeHref(c.soc, c.slug)} className="link">
        <span className="whitespace-nowrap font-mono">{c.soc}</span> {c.codeTitle}
      </Link>
    ),
    sub: [programs.join(", "), notes.join(". ")].filter(Boolean).join(". "),
    value: c.filings,
    text: formatShareOf(c.filings, total),
    tone: "primary",
  };
}

export default async function SocTitlePage({ params }: { params: Promise<{ title: string }> }) {
  const slug = (await params).title;
  const [a, codes] = await Promise.all([answerFor(slug), getSocCodes()]);
  if (!a) notFound();
  const path = `/soc-codes/${slug}`;
  const filed = filedCodes(a);
  const onetOnly = a.codes.filter((c) => c.filings === 0);
  const top = filed[0] ?? null;
  const pays = await Promise.all(filed.slice(0, 8).map((c) => marketPayNational(c.soc).catch(() => null)));
  const payOf = new Map(filed.slice(0, 8).map((c, i) => [c.soc, pays[i]?.median ?? null]));
  const spellings = top?.spellings ?? [];
  const faqs = [
    { q: `What is the SOC code for ${a.title}?`, a: describe(a) + (top ? ` ${top.soc} is ${top.codeTitle}.` : "") },
    {
      q: `Which code should a ${a.title} job use?`,
      a: "The code follows the job's duties and requirements, not its title. DOL's National Prevailing Wage Center decides it on the wage request. When employers split a title between codes, the work decides which one fits.",
    },
  ];
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: faqs.map((f) => ({ "@type": "Question" as const, name: f.q, acceptedAnswer: { "@type": "Answer" as const, text: f.a } })),
  };
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12">
      <JsonLdScript schema={breadcrumbSchema(path, a.title)} />{" "}
      <JsonLdScript schema={faqSchema} />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">SOC code for {a.title}</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-soft">
          <SocCodeText text={describe(a)} />
        </p>
      </header>{" "}
      {top ? (
        <FigureRow className="mt-8">
          <Figure tone="lime" label="Filed most under" value={top.soc} note={top.codeTitle} />{" "}
          <Figure label="Of its filings" value={formatShareOf(top.filings, a.total)} note={`${formatInt(a.total)} in all`} />{" "}
          {payOf.get(top.soc) ? (
            <Figure label="BLS median pay for the code" value={formatDollars(payOf.get(top.soc)!)} note="a year, nationally" />
          ) : null}{" "}
          {top.zone ? <Figure label="O*NET Job Zone" value={String(top.zone)} note="of 5: how much preparation it takes" /> : null}
        </FigureRow>
      ) : null}{" "}
      {filed.length ? (
        <PageSection
          id="codes"
          title="Every code employers used"
          lede="Each code's share of the title's filings in DOL's PERM, wage request and H-1B files. Codes under 1% aren't listed."
        >
          <BarRows rows={filed.map((c) => codeRow(c, a.total, payOf.get(c.soc) ?? null))} inline label={`Codes ${a.title} was filed under`} />
        </PageSection>
      ) : null}{" "}
      {onetOnly.length ? (
        <p className="mt-6 max-w-3xl text-base text-soft">
          O*NET also lists {a.title} under{" "}
          {onetOnly.slice(0, 6).map((c, i, all) => (
            <Fragment key={c.soc}>
              <Link href={codeHref(c.soc, c.slug)} className="link">
                {c.soc} {c.codeTitle}
              </Link>
              {i < all.length - 1 ? ", " : "."}{" "}
            </Fragment>
          ))}
        </p>
      ) : null}{" "}
      {spellings.length > 1 && top ? (
        <PageSection id="spellings" title="How employers wrote it" lede={`The commonest spellings filed under ${top.soc}.`}>
          <ul className="flex flex-wrap gap-2">
            {spellings.map(([s, n]) => (
              <li key={s} className="border-2 border-border bg-card px-3 py-1.5 text-base">
                {s} <span className="font-mono text-sm text-soft tabular-nums">{formatInt(n)}</span>{" "}
              </li>
            ))}
          </ul>
        </PageSection>
      ) : null}{" "}
      {top ? (
        <PageSection id="next" title="With the code">
          <ul className="space-y-1 text-base">
            <li>
              <Link href={`/tools/wage-levels?soc=${top.soc}`} className="link inline-flex min-h-11 items-center">
                DOL&apos;s four wage levels for {top.soc} in your area
              </Link>{" "}
            </li>{" "}
            {top.slug ? (
              <li>
                <Link href={finderHref({ ...DEFAULT_FILTERS, job: top.slug })} className="link inline-flex min-h-11 items-center">
                  Every employer that sponsors it, with approval rates and wages
                </Link>{" "}
              </li>
            ) : null}{" "}
            <li>
              <Link href={`/soc-codes?q=${encodeURIComponent(a.title)}`} className="link inline-flex min-h-11 items-center">
                Similar titles in the finder
              </Link>{" "}
            </li>
          </ul>
        </PageSection>
      ) : null}{" "}
      <CaseNextStep question={`Waiting on a case for a ${a.title} job?`} source="soc-title" numberKind="DOL" className="mt-12" />{" "}
      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
        <FaqList items={faqs} />
      </section>{" "}
      <SocSources codes={codes} />
    </div>
  );
}
