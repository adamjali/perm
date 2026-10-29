import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { BarRows, StackedBar, type BarRow } from "@/components/data/BarRows";
import { DataProvenance } from "@/components/data/DataProvenance";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { FinePrint } from "@/components/data/FinePrint";
import { PageSection } from "@/components/data/PageSection";
import { SiteBreadcrumbs } from "@/components/layout/SiteBreadcrumbs";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { buttonVariants } from "@/components/ui/button";
import { choiceVariants } from "@/components/ui/choice";
import { ScrollBox } from "@/components/ui/scroll-box";
import { breadcrumbSchema } from "@/lib/breadcrumbs";
import { SITE_URL } from "@/lib/constants/site";
import { getFirmRanks, getFirmRanksSummary } from "@/lib/db/firmRanks";
import { firstThatFits } from "@/lib/describe";
import {
  BARS_SHOWN,
  NATION,
  certifiedShare,
  filingSplit,
  firmRanksAsOf,
  lastYearWords,
  ordinal,
  rankedStates,
  shownYear,
  type FirmPlaceTotals,
  type FirmProgram,
  type FirmRankRow,
  type FirmRanksSummary,
} from "@/lib/firmRanks";
import { formatInt, formatShareOf } from "@/lib/format";
import { placeName, stateSlug } from "@/lib/h1bRanks";
import { openGraphBase } from "@/lib/openGraphBase";
import { pageDate } from "@/lib/pageDates";
import { getDatasetSchema } from "@/lib/structuredData";
import { US_STATE_NAMES } from "@/lib/usStateNames";

/**
 * /law-firm-rankings and /law-firm-rankings/<state>: the busiest immigration law
 * firms in DOL's files, PERM decisions and certified H-1B LCAs, each for its
 * newest finished fiscal year. Reads `firm_ranks` and
 * perm_docs['firm_ranks_summary'] (scripts/build_firm_ranks.py, after each PERM
 * and LCA load). Firms only, never a person; volume, outcomes and pace, never a grade.
 */

export const FIRM_RANKS_PATH = "/law-firm-rankings";

const PROGRAM = {
  perm: {
    title: "PERM labor certifications",
    noun: "PERM decisions",
    unit: "decisions",
    countedAt: "where the job is",
  },
  lca: {
    title: "H-1B labor condition applications",
    noun: "certified H-1B LCAs",
    unit: "LCAs",
    countedAt: "where the job is",
  },
} as const;

const FAQS = [
  {
    q: "How are the firms ranked?",
    a: "By how many cases DOL decided with the firm named on them, in one fiscal year (October to September). PERM counts every decision, certified, denied or withdrawn; H-1B counts certified LCAs for the H-1B class. Each firm's spellings in DOL's files count as one firm.",
  },
  {
    q: "Is a busier firm a better firm?",
    a: "No. The rankings show how much each firm filed, how its PERM cases ended and how long they took. They say nothing about service, price or fit, and a smaller firm may suit a case better. Nothing here is a rating.",
  },
  {
    q: "Why does a state's ranking differ from the country's?",
    a: "A state's ranking counts only the cases for jobs in that state, so a national firm ranks by the work it files there. A firm's own page shows all of its filings.",
  },
  {
    q: "Why are individual attorneys not listed?",
    a: "DOL's files name the law firm, and this site names firms only. Each firm's page lists its filings, employers and outcomes.",
  },
];

function title(state: string) {
  return state === NATION ? "Top Immigration Law Firms by Year and State" : `Top Immigration Law Firms in ${placeName(state)}`;
}

function pathOf(state: string) {
  return state === NATION ? FIRM_RANKS_PATH : `${FIRM_RANKS_PATH}/${stateSlug(state)}`;
}

export async function firmRanksMetadata(state: string): Promise<Metadata> {
  const summary = await getFirmRanksSummary();
  const t = title(state);
  const path = pathOf(state);
  const name = state === NATION ? "the country" : placeName(state);
  let lead = "";
  const fy = summary ? shownYear(summary, "perm") : null;
  if (summary && fy !== null) {
    const top = (await getFirmRanks("perm", fy, state).catch(() => []))[0];
    if (top) lead = `${top.name} led ${name} in FY${fy} with ${formatInt(top.filings)} PERM decisions.`;
  }
  const description = firstThatFits([
    `${lead} The 100 busiest immigration law firms in ${name} each year, by PERM decisions and H-1B LCAs, from DOL's files.`,
    `${lead} The busiest immigration law firms in ${name}, by PERM and H-1B, from DOL.`,
    `The busiest immigration law firms in ${name} each fiscal year, by PERM decisions and certified H-1B LCAs, from DOL's own files.`,
  ]);
  const titleField = `${t} | PERM Tracker`.length > 60 ? { absolute: t } : t;
  return {
    title: titleField,
    description,
    alternates: { canonical: path },
    openGraph: { ...openGraphBase, title: `${t} | PERM Tracker`, description, url: path },
  };
}

function firmName(r: FirmRankRow) {
  return r.linked ? (
    <Link href={`/perm-attorneys/${r.slug}`} className="link">
      {r.name}
    </Link>
  ) : (
    r.name
  );
}

function subLine(program: FirmProgram, r: FirmRankRow): string {
  const parts: string[] = [];
  const clients = `${formatInt(r.employers)} employer${r.employers === 1 ? "" : "s"}`;
  if (program === "perm") {
    parts.push(clients);
    if (certifiedShare(r) !== null) parts.push(`${formatShareOf(r.certified, r.certified + r.denied)} certified`);
  } else {
    parts.push(`${formatInt(r.positions)} positions for ${clients}`);
  }
  parts.push(lastYearWords(r.prevRank));
  return parts.join(", ");
}

function bars(program: FirmProgram, list: readonly FirmRankRow[]): BarRow[] {
  return list.slice(0, BARS_SHOWN).map((r) => ({
    key: r.slug,
    label: (
      <>
        <span className="mr-1.5 font-mono tabular-nums text-muted-foreground">{r.rank}</span> {firmName(r)}
      </>
    ),
    sub: subLine(program, r),
    value: r.filings,
    text: formatInt(r.filings),
    tone: r.rank === 1 ? "primary" : "blue",
    tip: [
      `${ordinal(r.rank)}: ${r.name}`,
      `${formatInt(r.filings)} ${PROGRAM[program].noun}`,
      subLine(program, r),
      r.medianDays !== null ? `A median ${formatInt(Math.round(r.medianDays))} days from filing to certification` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  }));
}

function Split({ program, totals, fy, place }: { program: FirmProgram; totals: FirmPlaceTotals; fy: number; place: string }) {
  const s = filingSplit(totals);
  return (
    <StackedBar
      label={`Who filed the ${PROGRAM[program].noun} in ${place}, FY${fy}`}
      className="mt-6"
      segments={[
        { key: "top10", label: "The ten busiest firms", value: s.top10 },
        { key: "others", label: "Every other firm", value: s.others },
        { key: "unnamed", label: "No law firm named", value: s.unnamed },
      ]}
    />
  );
}

/**
 * The busiest firms' median waits, said once: they sit within weeks of each
 * other, which no row-by-row figure shows as plainly.
 */
function WaitSpread({ list }: { list: readonly FirmRankRow[] }) {
  const days = list.map((r) => r.medianDays).filter((d): d is number => d !== null).map(Math.round);
  if (days.length < 2) return null;
  const lo = Math.min(...days);
  const hi = Math.max(...days);
  return (
    <p className="mt-6 max-w-2xl border-l-4 border-chart-blue bg-sage p-4 text-base leading-relaxed">
      The {days.length} busiest firms&apos; cases waited about the same: a median of {formatInt(lo)} to {formatInt(hi)} days
      from filing to certification. Tap or hover over a firm for its own.
    </p>
  );
}

async function Ranking({ program, state, summary }: { program: FirmProgram; state: string; summary: FirmRanksSummary }) {
  const fy = shownYear(summary, program);
  if (fy === null) return null;
  const totals = summary.programs[program]?.years?.[String(fy)]?.places?.[state];
  const list = await getFirmRanks(program, fy, state);
  const place = state === NATION ? "the country" : placeName(state);
  const p = PROGRAM[program];
  if (!totals || list.length === 0) {
    return (
      <PageSection id={program} title={`${p.title}, FY${fy}`}>
        <p className="max-w-2xl text-base text-soft">
          No law firm filed {p.noun} for jobs in {place} in FY{fy}.
        </p>
      </PageSection>
    );
  }
  const rest = list.slice(BARS_SHOWN);
  const top = list[0]!;
  return (
    <PageSection
      id={program}
      title={
        <>
          {p.title}
          <span data-fy>, FY{fy}</span>
        </>
      }
      lede={`October ${fy - 1} to September ${fy}, counted ${p.countedAt}.`}
    >
      <FigureRow>
        <Figure tone="lime" label={`The busiest firm`} value={formatInt(top.filings)} note={top.name} />{" "}
        <Figure label={`${p.noun[0]!.toUpperCase()}${p.noun.slice(1)} naming a firm`} value={formatInt(totals.filings)} />{" "}
        <Figure label="Law firms that filed them" value={formatInt(totals.firms)} />{" "}
        <Figure label="Naming no law firm" value={formatInt(totals.unnamed)} note="The employer filed it itself" />
      </FigureRow>{" "}
      <Split program={program} totals={totals} fy={fy} place={place} />{" "}
      <BarRows label={`The busiest law firms by ${p.noun}, FY${fy}, ${place}`} rows={bars(program, list)} className="mt-8" />{" "}
      {program === "perm" ? <WaitSpread list={list.slice(0, BARS_SHOWN)} /> : null}{" "}
      {rest.length > 0 ? (
        <FinePrint summary={`Ranks ${BARS_SHOWN + 1} to ${list.length}`} className="mt-6">
          <ScrollBox label={`Law firms ranked ${BARS_SHOWN + 1} to ${list.length}`} className="border-2 border-border">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Law firms ranked {BARS_SHOWN + 1} to {list.length} by {p.noun}, FY{fy}, {place}{" "}
              </caption>
              <thead>
                <tr className="border-b-2 border-border">
                  <th scope="col" className="p-2.5 text-right font-semibold">
                    Rank{" "}
                  </th>
                  <th scope="col" className="p-2.5 font-semibold">
                    Law firm{" "}
                  </th>
                  <th scope="col" className="p-2.5 text-right font-semibold">
                    {program === "perm" ? "Decisions" : "LCAs"}{" "}
                  </th>
                  <th scope="col" className="p-2.5 text-right font-semibold">
                    Employers{" "}
                  </th>
                  {program === "perm" ? (
                    <th scope="col" className="p-2.5 text-right font-semibold">
                      Median days{" "}
                    </th>
                  ) : null}
                  <th scope="col" className="p-2.5 text-right font-semibold">
                    The year before{" "}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rest.map((r) => (
                  <tr key={r.slug} className="border-b border-border/40 last:border-b-0">
                    <td className="p-2.5 text-right font-mono tabular-nums">{r.rank}{" "}</td>
                    <th scope="row" className="p-2.5 font-semibold">
                      {firmName(r)}{" "}
                    </th>
                    <td className="p-2.5 text-right font-mono tabular-nums">{formatInt(r.filings)}{" "}</td>
                    <td className="p-2.5 text-right font-mono tabular-nums">{formatInt(r.employers)}{" "}</td>
                    {program === "perm" ? (
                      <td className="p-2.5 text-right font-mono tabular-nums">
                        {r.medianDays === null ? "Too few" : formatInt(Math.round(r.medianDays))}{" "}
                      </td>
                    ) : null}
                    <td className="p-2.5 text-right tabular-nums">{r.prevRank === null ? "No filings" : ordinal(r.prevRank)}{" "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBox>
        </FinePrint>
      ) : null}
    </PageSection>
  );
}

export async function FirmRankingsPage({ state }: { state: string }) {
  const summary = await getFirmRanksSummary();
  const path = pathOf(state);
  const name = placeName(state);
  const heading = state === NATION ? "The busiest immigration law firms" : `The busiest immigration law firms in ${name}`;
  const states = summary ? rankedStates(summary) : [];
  const updated = pageDate(state === NATION ? FIRM_RANKS_PATH : `${FIRM_RANKS_PATH}/[state]`, { firms: firmRanksAsOf(summary) });

  const schemas: object[] = [
    getDatasetSchema(SITE_URL, {
      name: state === NATION ? "Top immigration law firms by fiscal year and state" : `Top immigration law firms in ${name}`,
      description:
        "Law firms ranked by PERM decisions (DOL, FY2016 on) and by certified H-1B Labor Condition Applications (DOL, FY2020 on), with outcomes, employers and median days to certify.",
      url: `${SITE_URL}${path}`,
      isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
      temporalCoverage: "2015-10-01/..",
      variableMeasured: ["PERM decisions", "Certified share", "Median days to certify", "Certified H-1B LCAs", "Positions"],
    }),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  if (state !== NATION) schemas.push(breadcrumbSchema(path, name));

  return (
    <>
      <SiteBreadcrumbs date={updated} />
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="pt-10 sm:pt-12" />
        {schemas.map((s, i) => (
          <JsonLdScript key={i} schema={s} />
        ))}
        <header className="max-w-3xl">
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">{heading}</h1>{" "}
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Ranked by the PERM and H-1B cases DOL decided with each firm named, from DOL&apos;s own files. Each firm links to
            its full record.
          </p>
        </header>{" "}
        {summary ? (
          <>
            <Ranking program="perm" state={state} summary={summary} />{" "}
            <Ranking program="lca" state={state} summary={summary} />
          </>
        ) : (
          <p className="mt-8 border-2 border-border bg-sage p-5 text-base">
            The rankings aren&apos;t built yet. They&apos;re made from DOL&apos;s PERM and LCA files after each load; the{" "}
            <Link href="/perm-attorneys" className="link">
              law firm list
            </Link>{" "}
            ranks every firm by its PERM filings meanwhile.
          </p>
        )}{" "}
        {states.length > 0 ? (
          <section aria-labelledby="firms-by-state" className="mt-14">
            <h2 id="firms-by-state" className="font-heading text-2xl font-bold">
              By state
            </h2>{" "}
            <ul className="mt-4 flex flex-wrap gap-2">
              {state !== NATION ? (
                <li>
                  <Link href={FIRM_RANKS_PATH} className={buttonVariants({ variant: "outline", size: "default" })}>
                    Whole country
                  </Link>{" "}
                </li>
              ) : null}
              {[...states]
                .sort((a, b) => (US_STATE_NAMES[a] ?? a).localeCompare(US_STATE_NAMES[b] ?? b))
                .map((code) => (
                  <Fragment key={code}>
                    <li>
                      {code === state ? (
                        <span aria-current="page" className={choiceVariants({ on: true })}>
                          {US_STATE_NAMES[code]}
                        </span>
                      ) : (
                        <Link href={`${FIRM_RANKS_PATH}/${stateSlug(code)}`} className={choiceVariants()}>
                          {US_STATE_NAMES[code]}
                        </Link>
                      )}{" "}
                    </li>
                  </Fragment>
                ))}
            </ul>
          </section>
        ) : null}{" "}
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-bold">FAQs</h2>
          <FaqList items={FAQS} openFirst={false} />
        </section>{" "}
        <FinePrint summary="How these are counted" className="mt-8">
          <p>
            PERM counts every case DOL decided in the fiscal year with the firm named on it: certified, denied or withdrawn.
            The certified share leaves withdrawals out, because a withdrawal isn&apos;t a decision on the case. Days to
            certify run from filing to certification, shown when a firm has ten or more certifications. A case counts in
            the state of its job; where DOL&apos;s older files print no worksite, the employer&apos;s state.
          </p>{" "}
          <p>
            H-1B counts certified LCAs for the H-1B class only (H-1B1 and E-3 left out), in the state of the job. Positions
            are the workers each LCA covers. An LCA comes before the petition, and not every LCA becomes one.
          </p>{" "}
          <p>
            &quot;The year before&quot; is the firm&apos;s rank among every firm with filings there that year. Cases that
            name no law firm were filed by the employer itself: they&apos;re in the split above and ranked nowhere.
          </p>
        </FinePrint>{" "}
        <nav aria-label="Related" className="mt-8 flex flex-wrap gap-x-6 text-base">
          <Link href="/perm-attorneys" className="link inline-flex min-h-11 items-center">
            Every PERM law firm
          </Link>{" "}
          <Link href="/h1b-employers" className="link inline-flex min-h-11 items-center">
            Top H-1B employers
          </Link>{" "}
          <Link href="/sponsor-finder" className="link inline-flex min-h-11 items-center">
            Find a green card sponsor
          </Link>{" "}
          <Link href="/case-search" className="link inline-flex min-h-11 items-center">
            Search a firm&apos;s filings
          </Link>
        </nav>{" "}
        <DataProvenance datasets={["perm-cases", "lca-disclosure"]} />
      </div>
    </>
  );
}
