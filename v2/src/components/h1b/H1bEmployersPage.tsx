import type { Metadata } from "next";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { H1bEmployerRanks } from "@/components/h1b/H1bEmployerRanks";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { breadcrumbSchema } from "@/lib/breadcrumbs";
import { SITE_URL } from "@/lib/constants/site";
import { firstThatFits } from "@/lib/describe";
import { formatInt } from "@/lib/format";
import {
  defaultYear,
  hasBasis,
  NATION,
  placeName,
  rankedRows,
  rankedStates,
  stateSlug,
  type H1bBasis,
  type H1bSummary,
} from "@/lib/h1bRanks";
import { openGraphBase } from "@/lib/openGraphBase";
import { getDatasetSchema } from "@/lib/structuredData";
import { getH1bSummary, getH1bView } from "@/lib/turso/h1bRanks";
import { US_STATE_NAMES } from "@/lib/usStateNames";

/**
 * /h1b-employers and /h1b-employers/<state>: the busiest H-1B employers by
 * fiscal year, from DOL's certified LCAs (FY2020 on) and USCIS's approvals
 * (FY2009 on). Reads `h1b_employer_ranks` and perm_docs['h1b_ranks_summary']
 * (scripts/build_h1b_ranks.py, after each LCA and Data Hub load).
 */

export const H1B_PATH = "/h1b-employers";

const FAQS = [
  {
    q: "What's the difference between an LCA and a USCIS approval?",
    a: "An LCA is the Labor Condition Application DOL certifies before an employer can file an H-1B petition: it fixes the wage and the job's conditions. One LCA can cover several positions, and many are never used for a petition. A USCIS approval is the petition itself, approved. DOL's count shows how much H-1B hiring an employer prepared for; USCIS's shows how many workers it was approved to employ.",
  },
  {
    q: "Why does a state show different employers on each ranking?",
    a: "Because the two sources mean different things by state. DOL's LCA files give the worksite, so a state's LCA ranking is the jobs located there. USCIS's Employer Data Hub gives the petitioner's address, usually headquarters, so a company with offices in Texas but headquarters in Washington counts its approvals in Washington.",
  },
  {
    q: "Does a high rank mean the employer will sponsor me?",
    a: "No. It shows how much H-1B work an employer filed, not who it will hire or sponsor next. Each employer's page shows its green card record, cases waiting with DOL, and any layoff notices or debarment.",
  },
  {
    q: "What do the marks on a row mean?",
    a: "\"H-1B dependent\" means most of the employer's LCAs that year declared it H-1B dependent under 20 CFR 655.736. The PERM hold, layoff and debarment marks describe the employer today, whichever year you're looking at: cases DOL has on hold now, WARN layoff notices in the last two years, and an active debarment.",
  },
];

function title(state: string) {
  return state === NATION ? "Top H-1B Employers by Year and State" : `Top H-1B Employers in ${placeName(state)}`;
}

export async function h1bMetadata(state: string): Promise<Metadata> {
  const summary = await getH1bSummary();
  const path = state === NATION ? H1B_PATH : `${H1B_PATH}/${stateSlug(state)}`;
  const t = title(state);
  let description =
    "The 100 busiest H-1B employers each fiscal year, nationally and by state, from DOL's certified LCAs and USCIS's approvals, with median pay.";
  if (summary && state !== NATION) {
    const y = defaultYear(summary, state);
    const by: H1bBasis = hasBasis(y, "lca", state) ? "lca" : "uscis";
    const view = await getH1bView(y.fy, state, by, summary).catch(() => null);
    const top = view ? rankedRows(view.rows, by)[0] : undefined;
    const name = placeName(state);
    const lead = top
      ? `${top.name} led ${name} in FY${y.fy} with ${formatInt(by === "lca" ? top.lcas : top.uscisAppr)} ${by === "lca" ? "certified H-1B LCAs" : "H-1B approvals"}.`
      : "";
    description = firstThatFits([
      `${lead} The 100 busiest H-1B employers in ${name} each year, from DOL's LCAs and USCIS's approvals.`,
      `${lead} The busiest H-1B employers in ${name}, from DOL and USCIS.`,
      `The busiest H-1B employers in ${name} each fiscal year, from DOL's certified LCAs and USCIS's approvals.`,
    ]);
  }
  // A long state name keeps the searched phrase whole and drops the brand suffix.
  const titleField = `${t} | PERM Tracker`.length > 60 ? { absolute: t } : t;
  // The route wraps this in withSocialCard (the card gate reads the page file).
  return {
    title: titleField,
    description,
    alternates: { canonical: path },
    openGraph: { ...openGraphBase, title: `${t} | PERM Tracker`, description, url: path },
  };
}

export async function H1bEmployersPage({ state }: { state: string }) {
  const summary = await getH1bSummary();
  const name = placeName(state);
  const heading = state === NATION ? "Top H-1B employers" : `Top H-1B employers in ${name}`;
  const path = state === NATION ? H1B_PATH : `${H1B_PATH}/${stateSlug(state)}`;

  const year = summary ? defaultYear(summary, state) : null;
  const by: H1bBasis = year && hasBasis(year, "lca", state) ? "lca" : "uscis";
  const view = summary && year ? await getH1bView(year.fy, state, by, summary) : null;
  const states = summary ? rankedStates(summary) : [];
  // The browser needs every year but only this page's place: the full doc is
  // about 140 KB, all of it in every page's payload otherwise.
  const forClient: H1bSummary | null = summary
    ? {
        top: summary.top,
        years: summary.years.map((y) => ({
          ...y,
          places: y.places[state] ? { [state]: y.places[state] } : {},
        })),
      }
    : null;
  const listed = view ? rankedRows(view.rows, view.by).slice(0, 25) : [];

  const schemas: object[] = [
    getDatasetSchema(SITE_URL, {
      name: state === NATION ? "Top H-1B employers by fiscal year and state" : `Top H-1B employers in ${name}`,
      description:
        "Employers ranked by certified H-1B Labor Condition Applications (DOL, FY2020 on) and by H-1B approvals (USCIS's Employer Data Hub, FY2009 on), with positions, median yearly wage and approvals.",
      url: `${SITE_URL}${path}`,
      isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
      temporalCoverage: summary ? `${summary.years[summary.years.length - 1]!.fy - 1}-10-01/..` : undefined,
      variableMeasured: ["Certified H-1B LCAs", "Positions", "Median yearly wage", "USCIS H-1B approvals"],
    }),
  ];
  if (listed.length > 0 && year) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${heading}, FY${year.fy}`,
      itemListElement: listed
        .filter((r) => r.linked)
        .map((r, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/perm-employers/${r.slug}`, name: r.name })),
    });
  }
  if (state !== NATION) schemas.push(breadcrumbSchema(path, name));
  schemas.push({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      {schemas.map((s, i) => (
        <JsonLdScript key={i} schema={s} />
      ))}
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">{heading}</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          Who files the most H-1B work each fiscal year
          {state === NATION ? ", nationally and by state" : ""}, from DOL&apos;s certified LCAs and USCIS&apos;s
          approvals. Each employer links to its full record.
        </p>
      </header>{" "}
      <section className="mt-8">
        {forClient && view ? (
          <SearchParamsBoundary>
            <H1bEmployerRanks summary={forClient} initial={view} states={states} />
          </SearchParamsBoundary>
        ) : (
          <p className="border-2 border-border bg-card p-5 text-base">
            The rankings aren&apos;t built yet. They&apos;re made from DOL&apos;s LCA files and USCIS&apos;s Employer
            Data Hub after each load; the <Link href="/lca-cases" className="font-bold underline decoration-primary decoration-2 underline-offset-2">LCA case search</Link> answers one employer at a time meanwhile.
          </p>
        )}
      </section>{" "}
      {states.length > 0 ? (
        <section aria-labelledby="h1b-by-state" className="mt-12">
          <h2 id="h1b-by-state" className="font-heading text-2xl font-black">
            By state
          </h2>{" "}
          <ul className="mt-4 flex flex-wrap gap-2">
            {state !== NATION ? (
              <li>
                <Link href={H1B_PATH} className="inline-flex min-h-[44px] items-center border-2 border-border bg-card px-3 text-base font-semibold hover:bg-muted">
                  Whole country
                </Link>{" "}
              </li>
            ) : null}
            {[...states]
              .sort((a, b) => (US_STATE_NAMES[a] ?? a).localeCompare(US_STATE_NAMES[b] ?? b))
              .map((code) => (
                <li key={code}>
                  {code === state ? (
                    <span aria-current="page" className="inline-flex min-h-[44px] items-center border-2 border-border bg-foreground px-3 text-base font-semibold text-background">
                      {US_STATE_NAMES[code]}
                    </span>
                  ) : (
                    <Link href={`${H1B_PATH}/${stateSlug(code)}`} className="inline-flex min-h-[44px] items-center border-2 border-border bg-card px-3 text-base font-semibold hover:bg-muted">
                      {US_STATE_NAMES[code]}
                    </Link>
                  )}{" "}
                </li>
              ))}
          </ul>
        </section>
      ) : null}{" "}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} openFirst={false} />
      </section>{" "}
      <FinePrint summary="How these are counted" className="mt-8">
        <p>
          DOL&apos;s figures count certified LCAs for the H-1B class only (H-1B1 and E-3 left out), in the fiscal year of
          DOL&apos;s decision, at the worksite&apos;s state. Positions are the workers each LCA covers. Median pay is the
          middle yearly wage over the employer&apos;s certified LCAs, annualised from the unit DOL printed; an amount that
          can&apos;t be pay for its unit is left out, and a median of fewer than five filings isn&apos;t shown.
          &quot;Senior roles&quot; is the share at wage level III or IV, over 20 or more leveled LCAs.
        </p>{" "}
        <p>
          USCIS&apos;s figures are the workers it approved and denied on its first decision, all six kinds of petition
          together, at the petitioner&apos;s state; &quot;new jobs&quot; is new employment alone. Every spelling of an
          employer&apos;s name counts on one page. The newest year runs to the last quarter DOL and USCIS have published.
        </p>{" "}
        <p>
          The marks on a row: <Link href="/glossary#h1b-dependent">H-1B dependent</Link> when most of the year&apos;s
          LCAs declared it; PERM cases <Link href="/perm-employers/under-review">DOL has on hold</Link> today; WARN{" "}
          <Link href="/layoffs">layoff notices</Link> in the last two years; an active{" "}
          <Link href="/debarments">debarment</Link>; and a willful violation only when most of the year&apos;s LCAs
          declared one.
        </p>
      </FinePrint>{" "}
      <nav aria-label="Related" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-base">
        <Link href="/lca-wages" className="font-bold underline decoration-primary decoration-2 underline-offset-2">
          H-1B salaries
        </Link>{" "}
        <Link href="/sponsor-finder" className="font-bold underline decoration-primary decoration-2 underline-offset-2">
          Find a green card sponsor
        </Link>{" "}
        <Link href="/h1b-lottery-odds" className="font-bold underline decoration-primary decoration-2 underline-offset-2">
          H-1B lottery odds
        </Link>{" "}
        <Link href="/lca-cases" className="font-bold underline decoration-primary decoration-2 underline-offset-2">
          Search H-1B LCAs
        </Link>
      </nav>{" "}
      <DataProvenance datasets={["lca-disclosure", "uscis-h1b-hub"]} />
    </div>
  );
}
