import type { Metadata } from "next";
import Link from "next/link";

import { BarRows } from "@/components/data/BarRows";
import { DataProvenance } from "@/components/data/DataProvenance";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { FinePrint } from "@/components/data/FinePrint";
import { PageSection } from "@/components/data/PageSection";
import { ROW_LINK } from "@/components/entities/caseRows";
import { SiteBreadcrumbs } from "@/components/layout/SiteBreadcrumbs";
import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { ScrollBox } from "@/components/ui/scroll-box";
import {
  CAP_EXEMPT_KINDS,
  KIND_WORDS,
  busiestQuarter,
  capExemptAsOf,
  monthShares,
  type CapExemptDoc,
  type CapExemptRow,
} from "@/lib/capExempt";
import { SITE_URL } from "@/lib/constants/site";
import { getCapExempt } from "@/lib/db/capExempt";
import { firstThatFits } from "@/lib/describe";
import { formatInt, formatShare, formatShareOf } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { pageDate } from "@/lib/pageDates";
import { withSocialCard } from "@/lib/socialCard";
import { getDatasetSchema } from "@/lib/structuredData";
import { US_STATE_NAMES } from "@/lib/usStateNames";
import { MONTH_ABBR, MONTH_NAMES } from "@convex/lib/months";

/**
 * The employers whose wage requests tell DOL that ACWIA covers them, the kinds
 * of employer the H-1B cap leaves out. Reads perm_docs['cap_exempt']
 * (scripts/build_cap_exempt.py, after each wage-request and LCA load), so a
 * weekly window, and POST /api/revalidate-disclosure expires it when a file lands.
 */

export const revalidate = 604800;

const PATH = "/h1b-cap-exempt-employers";
const SHOWN = 25;
const TITLE = "H-1B Cap-Exempt Employers";

const FAQS = [
  {
    q: "Does this list prove an employer is cap-exempt?",
    a: "No. It's the employer's own answer to DOL: on its wage requests it said the American Competitiveness and Workforce Improvement Act covers it, as a college or university, a nonprofit affiliated with one, or a research organization (20 CFR 656.40(e)). Those are the employers the H-1B cap leaves out (8 CFR 214.2(h)(8)(iii)(F)), but USCIS decides each petition.",
  },
  {
    q: "Why does cap-exempt matter?",
    a: "A cap-exempt employer can file an H-1B petition any time of year, with no lottery. If that job ends and the worker has never been counted against the cap, a move to an employer that is subject to it needs a lottery selection (8 CFR 214.2(h)(8)(iii)(F)(5)). Working for a cap-subject employer at the same time as the cap-exempt one doesn't count against the cap (paragraph (F)(6)).",
  },
  {
    q: "Why isn't a university I know listed?",
    a: "An employer is listed when most of its answered wage requests in DOL's files since October 2022 say ACWIA covers it. One that filed none, filed under a name this site can't tie to its page, or answered no isn't listed.",
  },
];

function monthWord(ym: string): string {
  return MONTH_NAMES[Number(ym.slice(5, 7)) - 1] ?? ym;
}

function abbr(ym: string): string {
  return MONTH_ABBR[Number(ym.slice(5, 7)) - 1] ?? ym;
}

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getCapExempt().catch(() => null);
  const lead = doc ? `${formatInt(doc.employers)} employers tell DOL that ACWIA covers them.` : "";
  const description = firstThatFits([
    `${lead} The colleges, affiliated nonprofits and research organizations that hire H-1B workers outside the lottery, from DOL's own files.`,
    `${lead} The employers that hire H-1B workers outside the lottery, from DOL's files.`,
    "The colleges, affiliated nonprofits and research organizations that hire H-1B workers outside the lottery, from DOL's own files.",
  ]);
  return withSocialCard(
    {
      title: TITLE,
      description,
      alternates: { canonical: PATH },
      openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description, url: PATH },
    },
    "h1b-cap-exempt-employers",
  );
}

function employerName(r: CapExemptRow, className = "link py-[10px] sm:py-0") {
  return r.linked ? (
    <Link href={`/perm-employers/${r.slug}`} className={className}>
      {r.name}
    </Link>
  ) : (
    r.name
  );
}

function subLine(r: CapExemptRow): string {
  const parts: string[] = [];
  if (r.kind) parts.push(KIND_WORDS[r.kind].one);
  if (r.state) parts.push(US_STATE_NAMES[r.state] ?? r.state);
  // USCIS's count shows only where its spelling reaches the employer's page; a zero would be a gap, not a fact.
  if (r.uscisAppr > 0) parts.push(`${formatInt(r.uscisAppr)} H-1B approvals from USCIS`);
  return parts.join(", ");
}

function MonthColumns({ doc }: { doc: CapExemptDoc }) {
  const shares = monthShares(doc);
  // Tenths of a percent, so the columns carry whole numbers and one scale serves both charts.
  const tenths = (v: number) => Math.round(v * 1000);
  const scale = Math.max(...shares.flatMap((s) => [tenths(s.exempt), tenths(s.others)]));
  const columns = (pick: "exempt" | "others"): Column[] =>
    shares.map((s) => ({
      key: s.month,
      value: tenths(s[pick]),
      label: `${monthWord(s.month)} ${s.month.slice(0, 4)}`,
      tip: `${monthWord(s.month)} ${s.month.slice(0, 4)}\n${formatShare(s[pick])} of the year's LCAs`,
      top: abbr(s.month)[0],
    }));
  const fy = doc.asOf.lcaFy!;
  const first = `Oct ${fy - 1}`;
  const last = `Sep ${fy}`;
  const ex = busiestQuarter(shares.map((s) => s.exempt));
  const ot = busiestQuarter(shares.map((s) => s.others));
  const span = (q: { start: number }) => `${monthWord(shares[q.start]!.month)} to ${monthWord(shares[q.start + 2]!.month)}`;
  return (
    <>
      <p className="max-w-2xl text-base leading-relaxed">
        Everyone else&apos;s busiest three months, {span(ot)}, held {formatShare(ot.share)} of their year: the lottery&apos;s
        winners file their petitions then. The cap-exempt employers&apos; busiest three held {formatShare(ex.share)}.
      </p>{" "}
      <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-2 [&>*]:min-w-0">
        <div>
          <h3 className="font-heading text-lg font-bold">Cap-exempt employers</h3>{" "}
          <ColumnChart
            columns={columns("exempt")}
            label={`Cap-exempt employers' certified H-1B LCAs by month, FY${fy}, as a share of their year`}
            first={first}
            last={last}
            unit="tenths of a percent of the year"
            showMax={false}
            scaleMax={scale}
            className="mt-4"
          />
        </div>{" "}
        <div>
          <h3 className="font-heading text-lg font-bold">Every other employer</h3>{" "}
          <ColumnChart
            columns={columns("others")}
            label={`Every other employer's certified H-1B LCAs by month, FY${fy}, as a share of their year`}
            first={first}
            last={last}
            unit="tenths of a percent of the year"
            showMax={false}
            scaleMax={scale}
            className="mt-4"
          />
        </div>
      </div>
    </>
  );
}

export default async function Page() {
  const doc = await getCapExempt();
  const updated = pageDate(PATH, { capExempt: capExemptAsOf(doc) });
  const fy = doc?.asOf.lcaFy ?? null;
  const schemas: object[] = [
    getDatasetSchema(SITE_URL, {
      name: "H-1B cap-exempt employers",
      description:
        "Employers whose wage requests to DOL say ACWIA covers them (colleges and universities, affiliated nonprofits and research organizations), with certified H-1B LCAs by month and USCIS's H-1B approvals.",
      url: `${SITE_URL}${PATH}`,
      isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
      temporalCoverage: "2022-10-01/..",
      variableMeasured: ["Employers covered by ACWIA", "Certified H-1B LCAs", "H-1B approvals"],
    }),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  const list = doc?.top ?? [];
  const rest = list.slice(SHOWN);
  return (
    <>
      <SiteBreadcrumbs date={updated} />
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="pt-10 sm:pt-12" />
        {schemas.map((s, i) => (
          <JsonLdScript key={i} schema={s} />
        ))}
        <header className="max-w-3xl">
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">H-1B cap-exempt employers</h1>{" "}
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Colleges and universities, the nonprofits tied to them, and research organizations hire H-1B workers outside the
            lottery. These are the employers whose wage requests tell DOL they&apos;re one of those.
          </p>
        </header>{" "}
        {doc ? (
          <>
            <section className="mt-10" aria-label="The employers in figures">
              <FigureRow>
                <Figure tone="lime" label="Employers" value={formatInt(doc.employers)} note="Most of their wage requests say ACWIA covers them" />{" "}
                {CAP_EXEMPT_KINDS.map((k) => (
                  <Figure key={k} label={KIND_WORDS[k].many} value={formatInt(doc.kinds[k].employers)} />
                ))}
              </FigureRow>{" "}
            </section>{" "}
            {fy !== null && doc.months.length === 12 ? (
              <PageSection
                id="months"
                title={
                  <>
                    When they file<span data-fy>, FY{fy}</span>
                  </>
                }
                lede={`These employers held ${formatShareOf(doc.lcas, doc.allLcas)} of the year's certified H-1B LCAs. Each month's share of each group's year, October ${fy - 1} to September ${fy}, by the month DOL certified them.`}
              >
                <MonthColumns doc={doc} />
              </PageSection>
            ) : null}{" "}
            <PageSection
              id="employers"
              title="The busiest"
              lede={fy !== null ? `By certified H-1B LCAs in FY${fy}. ${formatInt(doc.withLcas)} of the ${formatInt(doc.employers)} filed at least one.` : undefined}
            >
              <BarRows
                label={`Cap-exempt employers by certified H-1B LCAs, FY${fy ?? ""}`}
                rows={list.slice(0, SHOWN).map((r, i) => ({
                  key: r.slug,
                  label: (
                    <>
                      <span className="mr-1.5 font-mono tabular-nums text-muted-foreground">{i + 1}</span> {employerName(r)}
                    </>
                  ),
                  sub: subLine(r),
                  value: r.lcas,
                  text: formatInt(r.lcas),
                  tone: i === 0 ? "primary" : "blue",
                  tip: [r.name, `${formatInt(r.lcas)} certified H-1B LCAs`, subLine(r), `${formatInt(r.requests)} wage requests saying ACWIA covers it`]
                    .filter(Boolean)
                    .join("\n"),
                }))}
              />{" "}
              {rest.length > 0 ? (
                <FinePrint summary={`The next ${rest.length}`} className="mt-6">
                  <ScrollBox label={`Cap-exempt employers ${SHOWN + 1} to ${list.length}`} className="border-2 border-border">
                    <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                      <caption className="sr-only">
                        Cap-exempt employers ranked {SHOWN + 1} to {list.length} by certified H-1B LCAs{" "}
                      </caption>
                      <thead>
                        <tr className="border-b-2 border-border">
                          <th scope="col" className="p-2.5 font-semibold">
                            Employer{" "}
                          </th>
                          <th scope="col" className="p-2.5 font-semibold">
                            Kind{" "}
                          </th>
                          <th scope="col" className="p-2.5 font-semibold">
                            State{" "}
                          </th>
                          <th scope="col" className="p-2.5 text-right font-semibold">
                            LCAs{" "}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rest.map((r) => (
                          <tr key={r.slug} className="border-b border-border/40 last:border-b-0">
                            <th scope="row" className="p-2.5 font-semibold">
                              {employerName(r, ROW_LINK)}{" "}
                            </th>
                            <td className="p-2.5">{r.kind ? KIND_WORDS[r.kind].one : "Not said"}{" "}</td>
                            <td className="p-2.5">{r.state ?? "Not said"}{" "}</td>
                            <td className="p-2.5 text-right font-mono tabular-nums">{formatInt(r.lcas)}{" "}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollBox>
                </FinePrint>
              ) : null}
            </PageSection>{" "}
            {doc.states.length > 0 ? (
              <PageSection
                id="states"
                title="By state"
                lede={`The ${doc.states.length} states with the most of these employers' LCAs, of ${doc.statesTotal} with any.`}
              >
                <BarRows
                  label="Cap-exempt employers' certified H-1B LCAs by state"
                  inline
                  rows={doc.states.map((s, i) => ({
                    key: s.state,
                    label: US_STATE_NAMES[s.state] ?? s.state,
                    sub: `${formatInt(s.employers)} employer${s.employers === 1 ? "" : "s"}`,
                    value: s.lcas,
                    text: formatInt(s.lcas),
                    tone: i === 0 ? "primary" : "blue",
                  }))}
                />
              </PageSection>
            ) : null}
          </>
        ) : (
          <p className="mt-8 border-2 border-border bg-sage p-5 text-base">
            The list isn&apos;t built yet. It&apos;s made from DOL&apos;s wage-request and LCA files after each load.
          </p>
        )}{" "}
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-bold">FAQs</h2>
          <FaqList items={FAQS} openFirst={false} />
        </section>{" "}
        <FinePrint summary="How the list is made" className="mt-8">
          <p>
            Every wage request (Form ETA-9141) asks whether ACWIA covers the employer and as which kind. An employer is listed
            when most of its answered requests in DOL&apos;s files say yes, with the kind it named most and the state most of
            those jobs were in. Each spelling of an employer&apos;s name counts on one page.
          </p>{" "}
          {doc ? (
            <p>
              LCAs are certified H-1B LCAs (H-1B1 and E-3 left out) in fiscal year {doc.asOf.lcaFy}, the newest finished one.
              USCIS&apos;s approvals are its Employer Data Hub for fiscal year {doc.asOf.uscisFy}, shown only where USCIS&apos;s
              spelling of the employer reaches its page. These employers held{" "}
              {formatShareOf(doc.lcas, doc.allLcas)} of all certified H-1B LCAs that year.
            </p>
          ) : null}
        </FinePrint>{" "}
        <nav aria-label="Related" className="mt-8 flex flex-wrap gap-x-6 text-base">
          <Link href="/h1b-lottery-odds" className="link inline-flex min-h-11 items-center">
            H-1B lottery odds
          </Link>{" "}
          <Link href="/h1b-employers" className="link inline-flex min-h-11 items-center">
            Top H-1B employers
          </Link>{" "}
          <Link href="/lca-cases" className="link inline-flex min-h-11 items-center">
            Search H-1B LCAs
          </Link>{" "}
          <Link href="/law-firm-rankings" className="link inline-flex min-h-11 items-center">
            Law firm rankings
          </Link>
        </nav>{" "}
        <DataProvenance datasets={["pw-disclosure", "lca-disclosure", "uscis-h1b-hub"]} />
      </div>
    </>
  );
}
