/**
 * Why visas are refused: State's yearly table of visa ineligibilities by ground, from the Report of
 * the Visa Office (scripts/ingest_visa_refusals.py, every year reconciled against State's own total
 * line). Public charge leads, then the year's grounds, every ground of every year, and 221(g) and
 * 214(b) across the years. Worldwide and yearly: State publishes no figure by consulate or month.
 *
 * Expired by /api/revalidate-consular when a year's table is stored.
 */

import type { Metadata } from "next";

import { ConsularPauseNote } from "@/components/consular/ConsularPauseNote";
import { BarRows, type BarRow } from "@/components/data/BarRows";
import { DataProvenance } from "@/components/data/DataProvenance";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { FinePrint } from "@/components/data/FinePrint";
import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { RefusalYearTable } from "@/components/refusals/RefusalYearTable";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { refusalSummary, refusalsByCode, refusalsYear } from "@/lib/db/visaRefusals";
import { formatInt } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import {
  INTENT_TO_RETURN,
  MISSING_DOCUMENTS,
  PUBLIC_CHARGE,
  TRACKED_CODES,
  TRACKED_WORDS,
  extremes,
  fyLabel,
  series,
  topGrounds,
  type RefusalField,
  type RefusalRow,
} from "@/lib/visaRefusals";

export const revalidate = 86400;

const TITLE = "Why Visas Are Refused: Refusals by Ground";
const DESCRIPTION =
  "Why consular officers refuse visas, from State's own yearly tables: public charge, 221(g), 214(b) and every other ground, found and overcome.";
const PATH = "/visa-refusals";
const STATE_REPORTS = "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-statistics/annual-reports.html";

// The page's social card is still to be drawn (scripts/page-cards.json has its entry); until its JPEG
// exists the site's own card stands in, and withSocialCard(..., "visa-refusals") wires it once it does.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
};

/** One column a year of one field; the newest year in lime. A year without the ground is a gap. */
function yearColumns(points: readonly RefusalRow[], years: readonly number[], field: RefusalField, what: string): Column[] {
  const byYear = new Map(points.map((p) => [p.fy, p]));
  const newest = years.at(-1);
  return years.map((fy) => {
    const p = byYear.get(fy);
    const v = p?.[field] ?? null;
    if (v === null) return { key: String(fy), value: 0, gap: true, label: fyLabel(fy), tip: `${fyLabel(fy)}\nNot in State's table` };
    return {
      key: String(fy),
      value: v,
      now: fy === newest,
      label: fyLabel(fy),
      tip: `${fyLabel(fy)}\n${formatInt(v)} ${what}${p && field === "ivFound" && p.ivOvercome !== null ? `\n${formatInt(p.ivOvercome)} overcome` : ""}${
        p && field === "nivFound" && p.nivOvercome !== null ? `\n${formatInt(p.nivOvercome)} overcome` : ""
      }`,
    };
  });
}

function groundRows(rows: readonly RefusalRow[], found: RefusalField, overcome: RefusalField, tone: BarRow["tone"]): BarRow[] {
  return topGrounds(rows, found, 10).map((r) => ({
    key: String(r.line),
    label: (
      <>
        <span className="font-mono text-sm font-bold">{r.code}</span> {r.ground}
      </>
    ),
    sub: r[overcome] === null ? undefined : `${formatInt(r[overcome]!)} overcome`,
    value: r[found],
    text: formatInt(r[found]!),
    tone,
  }));
}

/** A ground's highest and lowest years and its newest, stated as State counted them. */
function trendWords(points: readonly RefusalRow[], field: RefusalField): string | null {
  const e = extremes(points, field);
  if (!e || points.length < 3) return null;
  return `Most findings: ${formatInt(e.high[field]!)} in ${fyLabel(e.high.fy)}. Fewest: ${formatInt(e.low[field]!)} in ${fyLabel(e.low.fy)}. ${fyLabel(e.newest.fy)}: ${formatInt(e.newest[field]!)}.`;
}

export default async function VisaRefusalsPage() {
  const summary = await refusalSummary();
  const newest = summary?.newest ?? null;
  if (!summary || newest === null) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="pt-10 sm:pt-12" />
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Why visas are refused</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          State&apos;s yearly refusal tables aren&apos;t loaded yet. They&apos;re in{" "}
          <a href={STATE_REPORTS} className="link" target="_blank" rel="noopener noreferrer">
            the Report of the Visa Office
          </a>
          .
        </p>
      </div>
    );
  }
  const [year, tracked] = await Promise.all([refusalsYear(newest), refusalsByCode(TRACKED_CODES)]);
  const years = summary.years;
  const pc = series(tracked, PUBLIC_CHARGE);
  const g221 = series(tracked, MISSING_DOCUMENTS);
  const b214 = series(tracked, INTENT_TO_RETURN);
  const pcNow = pc.find((p) => p.fy === newest);
  const b214Now = b214.find((p) => p.fy === newest);
  const g221Now = g221.find((p) => p.fy === newest);
  const totals = summary.totals[String(newest)] ?? null;
  const source = summary.sources[String(newest)] ?? STATE_REPORTS;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Why visas are refused</h1>{" "}
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          The State Department&apos;s own yearly count of visa applications found ineligible, by the ground in the law, and
          how many were later overcome. Worldwide, {fyLabel(years[0]!)} to {fyLabel(newest)}.
        </p>
      </header>

      <FigureRow className="mt-8">
        <Figure
          label={`Public charge, immigrant visas, ${fyLabel(newest)}`}
          value={pcNow?.ivFound === null || !pcNow ? "N/A" : formatInt(pcNow.ivFound)}
          note={pcNow?.ivOvercome !== null && pcNow ? `found ineligible; ${formatInt(pcNow.ivOvercome)} findings overcome` : "found ineligible"}
        />{" "}
        <Figure
          label={`Public charge, nonimmigrant visas, ${fyLabel(newest)}`}
          value={pcNow?.nivFound === null || !pcNow ? "N/A" : formatInt(pcNow.nivFound)}
          note={pcNow?.nivOvercome !== null && pcNow ? `found ineligible; ${formatInt(pcNow.nivOvercome)} overcome` : "found ineligible"}
        />{" "}
        <Figure
          label={`214(b), ${fyLabel(newest)}`}
          value={b214Now?.nivFound === null || !b214Now ? "N/A" : formatInt(b214Now.nivFound)}
          note="nonimmigrant findings, the most common ground of all"
        />
      </FigureRow>

      <ConsularPauseNote className="mt-6 max-w-4xl" />

      <section className="mt-12" aria-labelledby="public-charge">
        <h2 id="public-charge" className="font-heading text-2xl font-bold">
          Public charge, year by year
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Section 212(a)(4): {TRACKED_WORDS[PUBLIC_CHARGE].what}. {trendWords(pc, "ivFound") ?? ""}
        </p>
        {pc.length ? (
          <FigurePlate
            title="Immigrant visa applications found ineligible as a likely public charge"
            subject={`${fyLabel(years[0]!)} to ${fyLabel(newest)}, worldwide`}
            caption="Each column is one fiscal year (October to September). The newest is lime. A finding can be overcome in a later year, so a year's overcome count can pass its findings."
            source="U.S. Department of State, Report of the Visa Office, ineligibilities by ground"
            className="mt-6"
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 [&>*]:min-w-0">
              <div>
                <p className="font-heading text-lg font-bold">Found ineligible</p>{" "}
                <ColumnChart
                  columns={yearColumns(pc, years, "ivFound", "found ineligible")}
                  label="Public charge findings on immigrant visa applications, by fiscal year"
                  first={fyLabel(years[0]!)}
                  last={fyLabel(newest)}
                  unit="findings"
                  className="mt-3"
                  gapKey="Not in State's table"
                />
              </div>{" "}
              <div>
                <p className="font-heading text-lg font-bold">Overcome</p>{" "}
                <ColumnChart
                  columns={yearColumns(pc, years, "ivOvercome", "overcome")}
                  label="Public charge findings on immigrant visa applications overcome, by fiscal year"
                  first={fyLabel(years[0]!)}
                  last={fyLabel(newest)}
                  unit="overcome"
                  className="mt-3"
                  gapKey="Not in State's table"
                />
              </div>
            </div>
          </FigurePlate>
        ) : null}
      </section>

      <section className="mt-12" aria-labelledby="the-grounds">
        <h2 id="the-grounds" className="font-heading text-2xl font-bold">
          The grounds in {fyLabel(newest)}
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">
          The ten grounds with the most findings, for immigrant visas (green cards issued abroad) and for nonimmigrant visas
          apart.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <h3 className="font-heading text-lg font-bold">Immigrant visas</h3>{" "}
            <BarRows className="mt-3" label={`Immigrant visa findings by ground, ${fyLabel(newest)}`} rows={groundRows(year, "ivFound", "ivOvercome", "primary")} />
          </div>{" "}
          <div>
            <h3 className="font-heading text-lg font-bold">Nonimmigrant visas</h3>{" "}
            <BarRows className="mt-3" label={`Nonimmigrant visa findings by ground, ${fyLabel(newest)}`} rows={groundRows(year, "nivFound", "nivOvercome", "blue")} />
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="every-ground">
        <h2 id="every-ground" className="font-heading text-2xl font-bold">
          Every ground, every year
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">
          Pick a fiscal year. Sort by any column. N/A is State&apos;s dash: the ground can&apos;t apply to that kind of visa.
        </p>
        <div className="mt-5">
          <RefusalYearTable
            years={years}
            initial={{ fy: newest, grounds: year, totals, knownGaps: summary.knownGaps[String(newest)] ?? [] }}
          />
        </div>
      </section>

      <section className="mt-12" aria-labelledby="g221-b214">
        <h2 id="g221-b214" className="font-heading text-2xl font-bold">
          221(g) and 214(b), year by year
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
          221(g): {TRACKED_WORDS[MISSING_DOCUMENTS].what}. 214(b): {TRACKED_WORDS[INTENT_TO_RETURN].what}.
          {g221Now && g221Now.ivFound !== null ? ` In ${fyLabel(newest)}, 221(g) also held up ${formatInt(g221Now.ivFound)} immigrant visa applications.` : ""}
        </p>
        <FigurePlate
          title="Nonimmigrant visa applications found ineligible under 214(b) and 221(g)"
          subject={`${fyLabel(years[0]!)} to ${fyLabel(newest)}, worldwide`}
          caption="Each column is one fiscal year; the newest is lime. Fiscal 2020 and 2021 fall in the months State's own note on those tables describes, when posts had suspended routine visa services for COVID-19."
          source="U.S. Department of State, Report of the Visa Office, ineligibilities by ground"
          className="mt-6"
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <p className="font-heading text-lg font-bold">214(b)</p>{" "}
              <ColumnChart
                columns={yearColumns(b214, years, "nivFound", "found ineligible under 214(b)")}
                label="214(b) findings on nonimmigrant visa applications, by fiscal year"
                first={fyLabel(years[0]!)}
                last={fyLabel(newest)}
                unit="findings"
                className="mt-3"
                gapKey="Not in State's table"
              />
            </div>{" "}
            <div>
              <p className="font-heading text-lg font-bold">221(g)</p>{" "}
              <ColumnChart
                columns={yearColumns(g221, years, "nivFound", "found ineligible under 221(g)")}
                label="221(g) findings on nonimmigrant visa applications, by fiscal year"
                first={fyLabel(years[0]!)}
                last={fyLabel(newest)}
                unit="findings"
                className="mt-3"
                gapKey="Not in State's table"
              />
            </div>
          </div>
        </FigurePlate>
      </section>

      <FinePrint summary="How to read State's table" className="mt-10">
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-base leading-relaxed">
          <li>Worldwide and by fiscal year only. State publishes these counts for no consulate and no month.</li>{" "}
          <li>
            A finding counts applications found ineligible on a ground. One application can be refused on more than one
            ground, so the grounds add up to more than the applications refused (State&apos;s footnote 1).
          </li>{" "}
          <li>
            A refusal can be overcome in a later fiscal year, by evidence the ground doesn&apos;t apply, a waiver or other
            relief, and each action counts in the year it happened. So a year&apos;s overcome figure can pass its findings
            (State&apos;s footnote 2).
          </li>{" "}
          <li>N/A is State&apos;s dash: that ground can&apos;t apply to that kind of visa. It isn&apos;t a zero.</li>{" "}
          <li>
            Every year&apos;s grounds are checked against State&apos;s own total line before they&apos;re shown.
            {Object.values(summary.knownGaps).flat().map((g) => ` ${g.why}`).join("")}
          </li>{" "}
          <li>
            The table moved from Table XX (to fiscal 2019) to Table XIX (from fiscal 2020) in State&apos;s report; it&apos;s
            the same table, read by its title.
          </li>
        </ul>
      </FinePrint>

      <p className="mt-6 text-sm text-muted-foreground">
        Source:{" "}
        <a href={source} className="link" target="_blank" rel="noopener noreferrer">
          U.S. Department of State, Report of the Visa Office, {fyLabel(newest)}: Immigrant and Nonimmigrant Visa
          Ineligibilities by Grounds for Refusal
        </a>
        , and the same table for each year back to {fyLabel(years[0]!)}.
      </p>
      <ToolPageFooter
        currentHref={PATH}
        reading={[
          { href: "/consular-posts", label: "Every consulate", note: "where each post stands, and the visas it issued" },
          { href: "/guides/immigrant-visa-interview-pause", label: "The interview pause, explained", note: "the public charge training behind it" },
          { href: "/visa-wait-times", label: "Visa interview waits", note: "the next appointment at each consulate" },
        ]}
      />
      <DataProvenance datasets={["visa-refusals"]} />
    </div>
  );
}
