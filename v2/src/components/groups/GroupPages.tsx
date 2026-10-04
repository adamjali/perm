import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DataProvenance } from "@/components/data/DataProvenance";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { breadcrumbSchema } from "@/lib/breadcrumbs";
import { firstThatFits } from "@/lib/describe";
import { naicsSectorTitle } from "@/lib/naicsSectors";
import { openGraphBase } from "@/lib/openGraphBase";
import { countryYears, getGroup, GROUP_PATH, listGroups, type GroupKind } from "@/lib/turso/groups";
import { formatInt } from "@/lib/format";
import { lcaCityByKey, lcaCityBySlug, type LcaCity } from "@/lib/turso/lcaCities";

import { CityH1b } from "./CityH1b";
import { GroupIndexTable, type GroupIndexRow } from "./GroupIndexTable";
import { GroupView } from "./GroupView";

/**
 * The shared body of the six browse routes (an index and a detail page per
 * kind). Route files stay thin because Next wants their segment config
 * (revalidate, dynamicParams) written as literals in each file.
 */

interface KindCopy {
  indexTitle: string;
  indexH1: string;
  indexLede: string;
  indexDescription: string;
  noun: string;
  facetLabel: string | null;
  detailTitle: (label: string) => string;
  detailH1: (label: string) => string;
  coverage: string;
}

const COPY: Record<GroupKind, KindCopy> = {
  city: {
    indexTitle: "PERM Jobs by City",
    indexH1: "PERM sponsorship by city",
    indexLede:
      "Every worksite city with 20 or more PERM decisions since FY2016: how many, how many were approved, what they paid and who filed them.",
    indexDescription:
      "PERM decisions by worksite city since FY2016: approval rates, median certified wages and the employers and jobs behind them, from DOL's files.",
    noun: "cities",
    facetLabel: "State",
    detailTitle: (l) => `PERM Jobs in ${l}`,
    detailH1: (l) => `PERM jobs in ${l}`,
    coverage:
      "The worksite city on each application, from DOL's decided cases since FY2016. Spellings of one city are pooled; a city counts as one place per state.",
  },
  industry: {
    indexTitle: "PERM by Industry",
    indexH1: "PERM sponsorship by industry",
    indexLede:
      "Every industry, by the NAICS code the employer put on the form, with 20 or more PERM decisions since FY2016. The titles are the Census Bureau's.",
    indexDescription:
      "PERM decisions by industry (the employer's NAICS code) since FY2016: approval rates, median certified wages, top sponsors and jobs, from DOL's files.",
    noun: "industries",
    facetLabel: "Sector",
    detailTitle: (l) => `PERM in ${l}`.slice(0, 60),
    detailH1: (l) => `PERM in ${l}`,
    coverage:
      "The industry is the NAICS code the employer entered on the form. DOL publishes the code alone; the title is the Census Bureau's, and a code Census never defined takes its parent group's title.",
  },
  country: {
    indexTitle: "PERM by Country of Citizenship",
    indexH1: "PERM by the worker's country of citizenship",
    indexLede:
      "Every country with 20 or more PERM decisions on DOL's old form, FY2016 to FY2024, with each country's yearly record back to FY2008.",
    indexDescription:
      "PERM decisions by the worker's country of citizenship, FY2008 to FY2023, with approval rates, wages, sponsors and jobs, from DOL's old-form files.",
    noun: "countries",
    facetLabel: null,
    detailTitle: (l) => `PERM Cases for Citizens of ${l}`.slice(0, 60),
    detailH1: (l) => `PERM cases for citizens of ${l}`,
    coverage:
      "DOL printed the worker's citizenship, education and visa on its old form, and the last cases filed on it were decided in FY2024; the form in use since mid-2023 doesn't carry them. So these pages describe FY2008 to FY2023 (years) and FY2016 to FY2024 (everything else).",
  },
};

export function groupIndexMetadata(kind: GroupKind): Metadata {
  const c = COPY[kind];
  const path = GROUP_PATH[kind];
  // The route wraps this in withSocialCard with its own card slug.
  return {
    title: c.indexTitle,
    description: c.indexDescription,
    alternates: { canonical: path },
    openGraph: { ...openGraphBase, title: `${c.indexTitle} | PERM Tracker`, description: c.indexDescription, url: path },
  };
}

export async function GroupIndexPage({ kind }: { kind: GroupKind }) {
  const c = COPY[kind];
  const path = GROUP_PATH[kind];
  const groups = await listGroups(kind);
  const rows: GroupIndexRow[] = groups.map((g) => ({
    slug: g.slug,
    label: g.label,
    total: g.total,
    certified: g.certified,
    denied: g.denied,
    withdrawn: g.withdrawn,
    medianWage: g.medianWage,
    fyFrom: g.fyFrom,
    fyTo: g.fyTo,
    facet: kind === "city" ? g.key.split("|")[1] ?? null : kind === "industry" ? naicsSectorTitle(g.key) : null,
  }));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">{c.indexH1}</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">{c.indexLede}</p>
      </header>
      {rows.length === 0 ? (
        <p className="mt-10 max-w-2xl text-base text-foreground/80">
          This breakdown hasn&apos;t been built yet. DOL&apos;s case files are on the{" "}
          <Link href="/case-search" className="font-bold underline decoration-primary decoration-2 underline-offset-2">
            case search
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8">
          <GroupIndexTable
            rows={rows}
            basePath={path}
            noun={c.noun}
            facetLabel={c.facetLabel}
            caption={`${formatInt(rows.length)} ${c.noun}, busiest first`}
          />
        </div>
      )}
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-foreground/70">{c.coverage}</p>
      <DataProvenance datasets={["perm-cases"]} />
    </div>
  );
}

/**
 * A city with 20 or more H-1B LCAs and too few PERM cases for a PERM page
 * (lca_cities, Oct 4 2026). Null for every other kind and slug.
 */
async function h1bOnlyCity(kind: GroupKind, slug: string): Promise<LcaCity | null> {
  if (kind !== "city") return null;
  const c = await lcaCityBySlug(slug);
  return c && !c.hasPermPage ? c : null;
}

export async function groupDetailMetadata(kind: GroupKind, slug: string): Promise<Metadata> {
  const g = await getGroup(kind, slug);
  if (!g) {
    const city = await h1bOnlyCity(kind, slug);
    // notFound() here, at the earliest point, so a junk slug answers 404 and
    // not a 200 streamed before the page could decide (the soft-404 rule).
    if (!city) notFound();
    const path = `${GROUP_PATH.city}/${slug}`;
    const title = `H-1B Jobs in ${city.label}`;
    const lcas = `${formatInt(city.total)} H-1B LCAs`;
    const description = firstThatFits([
      `${title}: ${lcas}, with the employers and jobs behind them, from DOL's own LCA files.`,
      `${title}: ${lcas}, from DOL's own files.`,
      `${title}: ${lcas}.`,
    ]);
    return {
      title: { absolute: title.length > 44 ? title : `${title} | PERM Tracker` },
      description,
      alternates: { canonical: path },
      openGraph: { ...openGraphBase, title, description, url: path },
    };
  }
  const c = COPY[kind];
  const path = `${GROUP_PATH[kind]}/${slug}`;
  const title = c.detailTitle(g.label);
  // The page's own name leads: without it, two places with the same count
  // would share one description word for word.
  const fy = g.fyFrom && g.fyTo ? `, FY${g.fyFrom} to FY${g.fyTo}` : "";
  const decisions = `${formatInt(g.total)} PERM decision${g.total === 1 ? "" : "s"}${fy}`;
  const description = firstThatFits([
    `${title}: ${decisions}, with the approval rate, wages, top sponsors and jobs, from DOL's own files.`,
    `${title}: ${decisions}: approval rate, wages, sponsors and jobs.`,
    `${title}: ${decisions}.`,
  ]);
  return {
    title: { absolute: title.length > 44 ? title : `${title} | PERM Tracker` },
    description,
    alternates: { canonical: path },
    openGraph: { ...openGraphBase, title, description, url: path },
  };
}

export async function GroupDetailPage({ kind, slug }: { kind: GroupKind; slug: string }) {
  const g = await getGroup(kind, slug);
  if (!g) {
    const city = await h1bOnlyCity(kind, slug);
    if (!city) notFound();
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="pt-10 sm:pt-12" />
        <JsonLdScript schema={breadcrumbSchema(`${GROUP_PATH.city}/${slug}`, city.label)} />
        <header>
          <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">H-1B jobs in {city.label}</h1>{" "}
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
            Fewer than 20 PERM green card cases name {city.label} as the worksite, so this city has no PERM page; its
            H-1B record is below.
          </p>
        </header>
        <CityH1b city={city} />
        <DataProvenance datasets={["lca-disclosure"]} />
      </div>
    );
  }
  const c = COPY[kind];
  const years = kind === "country" ? await countryYears(g.key) : undefined;
  const h1b = kind === "city" ? await lcaCityByKey(g.key).catch(() => null) : null;
  const breadcrumb = breadcrumbSchema(`${GROUP_PATH[kind]}/${slug}`, g.label);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={breadcrumb} />
      <header>
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">{c.detailH1(g.label)}</h1>{" "}
        {kind === "industry" ? (
          <p className="mt-3 font-mono text-sm tabular-nums text-foreground/70">NAICS {g.key}</p>
        ) : null}
      </header>
      <GroupView kind={kind} group={g} yearsOverride={years} />
      <CityH1b city={h1b} />
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-foreground/70">{c.coverage}</p>
      <DataProvenance datasets={h1b ? ["perm-cases", "lca-disclosure"] : ["perm-cases"]} />
    </div>
  );
}

/** The busiest groups, prerendered at build; the rest render on first visit. */
export async function groupStaticParams(kind: GroupKind, n = 25): Promise<{ slug: string }[]> {
  const groups = await listGroups(kind).catch(() => []);
  return groups.slice(0, n).map((g) => ({ slug: g.slug }));
}
