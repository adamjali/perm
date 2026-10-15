import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";

import { DataProvenance } from "@/components/data/DataProvenance";
import { ChartTips } from "@/components/data/ChartTips";
import { IndexHeader, IndexSearch } from "@/components/data/IndexHeader";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { breadcrumbSchema } from "@/lib/breadcrumbs";
import { firstThatFits } from "@/lib/describe";
import { naicsSectorTitle } from "@/lib/naicsSectors";
import { openGraphBase } from "@/lib/openGraphBase";
import { countryYears, getGroup, GROUP_PATH, listGroups, type GroupKind } from "@/lib/db/groups";
import { formatInt } from "@/lib/format";
import { lcaCityByKey, lcaCityBySlug, type LcaCity } from "@/lib/db/lcaCities";

import { CityReference } from "@/components/reference/CityReference";

import { CityH1b } from "./CityH1b";
import { GroupIndexTable, type GroupIndexRow } from "./GroupIndexTable";
import { GroupView } from "./GroupView";
import { industryName, industryTitle } from "@/lib/industryTitle";

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
  /** The search title. Never cut by us: a cut word read "(except Physi" in titles and descriptions until Oct 6 2026. */
  detailTitle: (label: string, key: string) => string;
  /** What the description is about, when it differs from the title. */
  detailSubject?: (label: string, key: string) => string;
  detailH1: (label: string) => string;
  coverage: string;
}

/** What a reader types into each list's search box. */
const SEARCH_TITLE: Record<GroupKind, string> = { city: "Filter cities", industry: "Filter industries", country: "Filter countries" };
const SEARCH_HINT: Record<GroupKind, string> = {
  city: "Seattle, Austin",
  industry: "Software, poultry, hospitals",
  country: "India, Brazil",
};

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
    // People search these pages by code ("naics code 238340"), so the code is in
    // the title. Census titles run to 126 characters; when the plain form doesn't
    // fit Google's 60, the code leads and Google shortens the end.
    detailTitle: industryTitle,
    detailSubject: (l, k) => `PERM in ${industryName(l)} (NAICS ${k})`,
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
    detailTitle: (l) => `PERM Cases for Citizens of ${l}`,
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
  const all = rows.reduce((n, r) => n + r.total, 0);
  const top = rows.slice(0, 12);
  const topMax = Math.max(1, ...top.map((r) => r.total));
  const leader = rows[0] ?? null;
  const tenShare = all > 0 ? Math.round((rows.slice(0, 10).reduce((n, r) => n + r.total, 0) / all) * 100) : null;
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <IndexHeader
        title={c.indexH1}
        lede={c.indexLede}
        figures={
          rows.length > 0
            ? [
                { label: `${c.noun[0]!.toUpperCase()}${c.noun.slice(1)} with a page`, value: formatInt(rows.length) },
                ...(leader
                  ? [{ label: "The busiest", value: leader.label, href: `${path}/${leader.slug}`, note: `${formatInt(leader.total)} decisions` }]
                  : []),
                ...(tenShare !== null ? [{ label: "The ten busiest hold", value: `${tenShare}%`, note: `of ${formatInt(all)} decisions` }] : []),
              ]
            : []
        }
        aside={
          rows.length > 0 ? (
            <IndexSearch title={SEARCH_TITLE[kind]} action={`${path}#all`} placeholder={SEARCH_HINT[kind]} />
          ) : undefined
        }
      />{" "}
      {rows.length === 0 ? (
        <p className="mt-10 max-w-2xl text-base text-soft">
          This breakdown hasn&apos;t been built yet. DOL&apos;s case files are on the{" "}
          <Link href="/case-search" className="link">
            case search
          </Link>
          .
        </p>
      ) : (
        <>
          <section className="mt-10">
            <div >
              <h2 className="font-heading text-xl font-bold">{`The ${top.length} busiest, by decisions`}</h2>{" "}
              <ChartTips label={`The ${top.length} busiest ${c.noun}, by PERM decisions`} className="mt-5">
                <ol className="space-y-2.5">
                  {top.map((r) => {
                    const decided = r.certified + r.denied;
                    return (
                      <Fragment key={r.slug}>
                      {" "}
                      <li
                        data-tip={[
                          r.label,
                          `${formatInt(r.total)} decisions`,
                          decided > 0 ? `${((r.certified / decided) * 100).toFixed(1)}% approved` : null,
                          r.medianWage ? `Median wage $${formatInt(r.medianWage)}` : null,
                        ]
                          .filter(Boolean)
                          .join("\n")}
                        // On a phone the name sits above its bar; side by side, a
                        // long name took the whole row and the bar vanished.
                        className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_5rem] [&>*]:min-w-0"
                      >
                        <Link
                          href={`${path}/${r.slug}`}
                          className="link col-span-2 truncate text-sm sm:col-span-1"
                        >
                          {r.label}
                        </Link>{" "}
                        <span aria-hidden="true" className="block h-5">
                          <span
                            className="block h-full border border-input bg-primary"
                            style={{ width: `${Math.max(3, (r.total / topMax) * 100)}%` }}
                          />
                        </span>{" "}
                        <span className="text-right text-sm font-bold tabular-nums">{formatInt(r.total)}</span>
                      </li>
                      </Fragment>
                    );
                  })}
                </ol>
              </ChartTips>
            </div>
          </section>{" "}
          <section id="all" className="mt-16 border-t-2 border-foreground pt-4">
            <h2 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">{`All ${formatInt(rows.length)} ${c.noun}`}</h2>{" "}
            <div className="mt-6">
              <GroupIndexTable
                rows={rows}
                basePath={path}
                noun={c.noun}
                facetLabel={c.facetLabel}
                caption={`${formatInt(rows.length)} ${c.noun}, busiest first`}
              />
            </div>
          </section>
        </>
      )}
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">{c.coverage}</p>
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
  const title = c.detailTitle(g.label, g.key);
  const subject = c.detailSubject ? c.detailSubject(g.label, g.key) : title;
  // The page's own name leads: without it, two places with the same count
  // would share one description word for word.
  const fy = g.fyFrom && g.fyTo ? `, FY${g.fyFrom} to FY${g.fyTo}` : "";
  const decisions = `${formatInt(g.total)} PERM decision${g.total === 1 ? "" : "s"}${fy}`;
  const description = firstThatFits([
    `${subject}: ${decisions}, with the approval rate, wages, top sponsors and jobs, from DOL's own files.`,
    `${subject}: ${decisions}: approval rate, wages, sponsors and jobs.`,
    `${subject}: ${decisions}.`,
    // A Census title can run to 126 characters, so nothing above fits; lead
    // with the figures rather than cutting the name mid-phrase.
    kind === "industry"
      ? `${decisions} under NAICS ${g.key}: approval rate, wages, sponsors and jobs.`
      : `${decisions}: approval rate, wages, sponsors and jobs.`,
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
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">H-1B jobs in {city.label}</h1>{" "}
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Fewer than 20 PERM green card cases name {city.label} as the worksite, so this city has no PERM page; its
            H-1B record is below.
          </p>
        </header>
        <CityH1b city={city} />
        <CityReference
          cityKey={city.key}
          label={city.label}
          jobs={city.occupations.map((o) => ({ code: o.code, title: o.title, slug: o.slug, n: o.n }))}
          jobsNoun="certified LCAs"
        />
        <DataProvenance datasets={["lca-disclosure", "census-geo", "bls-oews", "oflc-wage-levels"]} />
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
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">{c.detailH1(g.label)}</h1>{" "}
        {kind === "industry" ? (
          <p className="mt-3 font-mono text-sm tabular-nums text-muted-foreground">NAICS {g.key}</p>
        ) : null}
      </header>
      <GroupView kind={kind} group={g} yearsOverride={years} />
      <CityH1b city={h1b} />
      {kind === "city" ? (
        <CityReference
          cityKey={g.key}
          label={g.label}
          jobs={g.detail.occupations.map((o) => ({ code: o.code, title: o.title, slug: o.slug, n: o.n }))}
          jobsNoun="PERM decisions"
        />
      ) : null}
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">{c.coverage}</p>
      <DataProvenance
        datasets={[
          "perm-cases",
          ...(h1b ? ["lca-disclosure"] : []),
          ...(kind === "city" ? ["census-geo", "bls-oews", "oflc-wage-levels"] : []),
        ]}
      />
    </div>
  );
}

/** The busiest groups, prerendered at build; the rest render on first visit. */
export async function groupStaticParams(kind: GroupKind, n = 25): Promise<{ slug: string }[]> {
  const groups = await listGroups(kind).catch(() => []);
  return groups.slice(0, n).map((g) => ({ slug: g.slug }));
}
