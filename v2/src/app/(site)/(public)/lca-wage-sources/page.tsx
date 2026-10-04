import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { ChartTips } from "@/components/data/ChartTips";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { formatInt, formatShare } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getWageSources } from "@/lib/turso/wageSources";
import { splitYears } from "@/lib/wageSourceYears";

/**
 * Where an H-1B's prevailing wage comes from. Under 20 CFR 655.731(a)(2) a
 * union contract's rate applies where one covers the occupation; otherwise the
 * employer picks the source, and DOL's LCA file says which one each
 * application used: OES, a private survey (with its publisher and name), or
 * a union contract. Read from perm_docs['lca_wage_sources'], rebuilt nightly.
 */

const TITLE = "H-1B Prevailing Wage Sources";
const DESCRIPTION =
  "Where H-1B prevailing wages come from: OES, private salary surveys or union contracts, plus the survey firms and the employers that use them most.";
const PATH = "/lca-wage-sources";

// No social card yet (a card is a capture of the rendered page).
export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "lca-wage-sources");

export const revalidate = 86400;

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";
const KIND_LABEL: Record<string, string> = {
  OES: "OES (DOL's wage data)",
  Survey: "A private salary survey",
  CBA: "A union contract",
  SCA: "A Service Contract Act wage",
  DBA: "A Davis-Bacon Act wage",
  Other: "Not stated",
};
const KINDS = ["OES", "Survey", "CBA", "SCA", "DBA", "Other"] as const;
const COLOR: Record<string, string> = {
  OES: "bg-foreground/20",
  Survey: "bg-primary",
  CBA: "bg-data-warn",
  SCA: "bg-data-bad",
  DBA: "bg-data-info",
  Other: "bg-card",
};

export default async function LcaWageSourcesPage() {
  const doc = await getWageSources();
  const { shown: years, pending } = splitYears(doc?.years ?? []);
  const latest = years[years.length - 1];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Where H-1B prevailing wages come from</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {latest
            ? `In FY${latest.fy}, ${formatShare(latest.OES / latest.total)} of LCAs set their prevailing wage from DOL's OES data and ${formatShare(latest.Survey / latest.total)} from a private salary survey. A union contract's rate applies where one covers the job; otherwise the employer picks the source, and DOL's file says which.`
            : "Each H-1B labor condition application names where its prevailing wage came from: DOL's OES data, a private survey or a union contract."}
        </p>
      </header>

      {!doc ? (
        <p className="mt-8 border-2 border-border bg-card p-5 text-base">These figures are being built. Try again tomorrow.</p>
      ) : (
        <>
          <section className="mt-10" aria-labelledby="by-year">
            <h2 id="by-year" className="font-heading text-2xl font-black">By fiscal year</h2>{" "}
            <ChartTips label="Prevailing wage sources by fiscal year">
              <ul className="mt-4 grid grid-cols-1 gap-3">
                {years.map((y) => (
                  <Fragment key={y.fy}>
                    {" "}
                    <li className="grid grid-cols-[4.5rem_1fr_7.5rem] items-center gap-3 text-sm">
                      <span className="font-bold tabular-nums">FY{y.fy}</span>{" "}
                      <span className="flex h-5 overflow-hidden border-2 border-border" aria-hidden="true">
                        {KINDS.map((k) =>
                          y[k] > 0 ? (
                            <span
                              key={k}
                              data-tip={`FY${y.fy}: ${KIND_LABEL[k]}\n${formatInt(y[k])} of ${formatInt(y.total)} LCAs (${formatShare(y[k] / y.total)})`}
                              className={COLOR[k]}
                              style={{ width: `${(y[k] / y.total) * 100}%` }}
                            />
                          ) : null,
                        )}
                      </span>{" "}
                      <span className="text-right tabular-nums text-foreground/70">{`${formatInt(y.total)} LCAs`}</span>
                    </li>
                  </Fragment>
                ))}
              </ul>
            </ChartTips>{" "}
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Key">
              {KINDS.map((k) => (
                <Fragment key={k}>
                  {" "}
                  <li className="flex items-center gap-2">
                    <span className={`inline-block size-3 border border-border ${COLOR[k]}`} aria-hidden="true" />
                    {KIND_LABEL[k]}
                  </li>
                </Fragment>
              ))}
            </ul>{" "}
            {pending.length > 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                {pending.length === 1 ? `FY${pending[0]} appears` : `FY${pending[0]} to FY${pending[pending.length - 1]} appear`}{" "}
                once this site has read the wage source on most of {pending.length === 1 ? "its" : "their"} LCAs.
              </p>
            ) : null}{" "}
            {/* sr-only on a <table> can't shrink it below its content; a div can. */}
            <div className="sr-only">
              <table>
                <caption>Prevailing wage sources by fiscal year </caption>
                <thead>
                  <tr>
                    <th scope="col">Fiscal year </th>
                    {KINDS.map((k) => (
                      <th key={k} scope="col">{`${KIND_LABEL[k]} `}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.fy}>
                      <th scope="row">{`FY${y.fy} `}</th>
                      {KINDS.map((k) => (
                        <td key={k}>{`${formatInt(y[k])} `}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2 [&>*]:min-w-0" aria-label="Surveys">
            <div>
              <h2 className="font-heading text-2xl font-black">Survey publishers</h2>{" "}
              <ol className="mt-3 divide-y divide-border/60">
                {doc.publishers.map((p) => (
                  <Fragment key={p.name}>
                    {" "}
                    <li className="flex items-baseline gap-3 py-2 text-base">
                      <span className="min-w-0">
                        <span className="font-bold">{p.name}</span>{" "}
                        {p.spellings.length > 1 ? (
                          <span className="block text-sm text-foreground/70">{`as ${p.spellings.join("; ")}`}</span>
                        ) : null}
                      </span>{" "}
                      <span className="ml-auto font-mono text-sm tabular-nums">{formatInt(p.n)}</span>
                    </li>
                  </Fragment>
                ))}
              </ol>
            </div>{" "}
            <div>
              <h2 className="font-heading text-2xl font-black">Surveys named</h2>{" "}
              <ol className="mt-3 divide-y divide-border/60">
                {doc.surveys.slice(0, 15).map((s) => (
                  <Fragment key={s.name}>
                    {" "}
                    <li className="flex items-baseline gap-3 py-2 text-base">
                      <span className="min-w-0">{s.name}</span>{" "}
                      <span className="ml-auto font-mono text-sm tabular-nums">{formatInt(s.n)}</span>
                    </li>
                  </Fragment>
                ))}
              </ol>
            </div>
          </section>

          <section className="mt-12" aria-labelledby="employers">
            <h2 id="employers" className="font-heading text-2xl font-black">Employers that use private surveys most</h2>{" "}
            <p className="mt-2 max-w-3xl text-base text-foreground/70">
              LCAs whose prevailing wage came from a private survey, and that count&apos;s share of the employer&apos;s
              LCAs with a wage source on file.
            </p>
            <ol className="mt-3 max-w-3xl divide-y divide-border/60">
              {doc.employers.map((e) => (
                <Fragment key={e.slug ?? e.name}>
                  {" "}
                  <li className="flex items-baseline gap-3 py-2 text-base">
                    {e.slug ? (
                      <Link href={`/perm-employers/${e.slug}`} className={`min-w-0 truncate ${LINK}`}>
                        {e.name}
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate">{e.name}</span>
                    )}{" "}
                    <span className="ml-auto font-mono text-sm tabular-nums">
                      {`${formatInt(e.survey)} (${formatShare(e.survey / e.lcas)})`}
                    </span>
                  </li>
                </Fragment>
              ))}
            </ol>
          </section>

          <FinePrint summary="What this counts" className="mt-10">
            <p>
              Where a union contract covers the occupation, its rate is the prevailing wage. Otherwise, under 20 CFR
              655.731(a)(2), an employer &quot;is not required to use any specific methodology to determine
              the prevailing wage and may utilize a wage obtained from an OFLC NPC (OES), an independent authoritative
              source, or other legitimate sources of wage data.&quot; DOL&apos;s LCA file records the choice: the OES year,
              or the other source with the survey&apos;s publisher and name as the employer typed them. Spellings of one
              publisher are grouped (Radford, an Aon company, keeps its own line). These count {formatInt(doc.rows)} LCAs
              whose wage source this site has read so far, decided through {doc.asOf}; the count grows as older quarters
              are read.
            </p>
          </FinePrint>
        </>
      )}

      <DataProvenance datasets={["lca-disclosure"]} />
    </div>
  );
}
