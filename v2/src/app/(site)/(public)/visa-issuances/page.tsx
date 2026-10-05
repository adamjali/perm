/**
 * Immigrant visas the State Department issued abroad, month by month, from its
 * own monthly tables (scripts/ingest_visa_issuances.py, every file checked
 * against State's GRAND TOTAL). Employment categories lead; every category is
 * in the table at the end.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { BarRows, type BarRow } from "@/components/data/BarRows";
import { ChartHit } from "@/components/data/ChartHit";
import { ChartTips } from "@/components/data/ChartTips";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { formatInt } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import {
  ALL_CATEGORIES,
  EMPLOYMENT_CATEGORIES,
  employmentBy,
  issuanceSummary,
  monthName,
  monthsBefore,
  type IssuanceGroup,
} from "@/lib/turso/visaIssuances";

export const revalidate = 86400;

const TITLE = "Immigrant Visas Issued Abroad, by Month";
const DESCRIPTION =
  "Every immigrant visa State's consulates issued each month since March 2017, by employment and family category, by country and by consulate, from State's own tables.";
const PATH = "/visa-issuances";
const STATE_PAGE =
  "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-statistics/immigrant-visa-statistics/monthly-immigrant-visa-issuances.html";
const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: PATH },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
  },
  "visa-issuances",
);

const SPARK_MONTHS = 36;

/** One category's months as small bars, the newest in full ink. */
function Spark({ label, points, max }: { label: string; points: { month: string; n: number }[]; max: number }) {
  const W = 360;
  const H = 48;
  const bw = W / Math.max(points.length, 1);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-12 w-full max-w-[360px] text-foreground"
      role="img"
      aria-label={`${label}, ${points.map((p) => `${monthName(p.month)} ${formatInt(p.n)}`).join("; ")}`}
    >
      {points.map((p, i) => {
        const h = max > 0 ? (H * p.n) / max : 0;
        const last = i === points.length - 1;
        return (
          <ChartHit key={p.month} tip={`${label}\n${monthName(p.month)}\n${formatInt(p.n)} issued`} x={i * bw} width={bw} y={0} height={H}>
            <rect x={i * bw + 0.5} y={H - h} width={Math.max(bw - 1, 1)} height={h} className={last ? "fill-foreground" : "fill-foreground/40"} />
          </ChartHit>
        );
      })}
    </svg>
  );
}

function topRows(groups: IssuanceGroup[], category: string, n: number): BarRow[] {
  const mine = groups.filter((g) => g.category === category).sort((a, b) => b.n - a.n);
  const total = mine.reduce((a, g) => a + g.n, 0);
  const shown = mine.slice(0, n);
  const rest = total - shown.reduce((a, g) => a + g.n, 0);
  const rows: BarRow[] = shown.map((g) => ({ key: g.group, label: g.label, value: g.n, text: formatInt(g.n) }));
  if (rest > 0) rows.push({ key: "rest", label: `Everyone else (${formatInt(mine.length - shown.length)} more)`, value: rest, text: formatInt(rest), tone: "ink" });
  return rows;
}

export default async function VisaIssuancesPage() {
  const summary = await issuanceSummary();
  const newest = summary?.newest ?? null;
  if (!summary || !newest) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="pt-10 sm:pt-12" />
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Immigrant visas issued abroad</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          State&apos;s monthly tables aren&apos;t loaded yet. They&apos;re on{" "}
          <a href={STATE_PAGE} className={LINK} rel="noopener">
            the State Department&apos;s page
          </a>
          .
        </p>
      </div>
    );
  }
  const yearFrom = monthsBefore(newest, 11);
  const [byCountry, byPost] = await Promise.all([employmentBy("fsc", yearFrom, newest), employmentBy("post", yearFrom, newest)]);
  const sparkMonths = summary.months.slice(-SPARK_MONTHS);
  const latest = summary.byMonth[newest] ?? {};
  const monthTotal = Object.values(latest).reduce((a, n) => a + n, 0);
  const ebLatest = EMPLOYMENT_CATEGORIES.reduce((a, c) => a + (latest[c] ?? 0), 0);
  const yearOf = (cat: string) => summary.months.filter((m) => m >= yearFrom).reduce((a, m) => a + (summary.byMonth[m]?.[cat] ?? 0), 0);
  const series = EMPLOYMENT_CATEGORIES.map((c) => ({ c, points: sparkMonths.map((m) => ({ month: m, n: summary.byMonth[m]?.[c] ?? 0 })) }));
  const sparkMax = Math.max(...series.flatMap((s) => s.points.map((p) => p.n)), 1);
  const ebByPost = new Map<string, { label: string; n: number }>();
  for (const g of byPost) {
    const e = ebByPost.get(g.group) ?? { label: g.label, n: 0 };
    e.n += g.n;
    ebByPost.set(g.group, e);
  }
  const postRows: BarRow[] = [...ebByPost.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 12)
    .map(([k, v]) => ({ key: k, label: v.label, value: v.n, text: formatInt(v.n) }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Immigrant visas issued abroad</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          State&apos;s consulates issued{" "}
          <span className="font-heading font-black tabular-nums text-foreground">{formatInt(monthTotal)}</span> immigrant
          visas in {monthName(newest)}, {formatInt(ebLatest)} of them employment-based. Green cards granted inside the
          United States aren&apos;t counted here, and for employment categories that&apos;s most of them.
        </p>
      </header>

      <FigurePlate
        n="01"
        title="Employment visas issued abroad, month by month"
        subject={`${monthName(sparkMonths[0] ?? newest)} to ${monthName(newest)}`}
        caption="Each bar is one month's issuances in the category; the newest is the dark one. A category can fall to almost nothing late in a fiscal year (it ends in September) once its yearly numbers are used up, and picks up again in October."
        source="U.S. Department of State, monthly immigrant visa issuances"
        className="mt-10"
      >
        <ChartTips label="Employment visas issued abroad by month">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-base">
              <caption className="sr-only">Employment immigrant visas issued abroad by month</caption>
              <thead>
                <tr className="border-b-2 border-border font-mono text-sm uppercase tracking-wider text-foreground/70">
                  <th className="py-2 pr-4 font-bold">Category</th>
                  <th className="py-2 pr-4 font-bold">Each month</th>
                  <th className="py-2 pr-4 text-right font-bold">{`${monthName(newest).split(" ")[0]}`}{" "}</th>
                  <th className="py-2 text-right font-bold">Last 12 months</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.c} className="border-b border-border/60">
                    <th scope="row" className="py-2 pr-4 font-bold">{s.c}{" "}</th>
                    <td className="py-2 pr-4">
                      <Spark label={s.c} points={s.points} max={sparkMax} />{" "}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatInt(latest[s.c] ?? 0)}{" "}</td>
                    <td className="py-2 text-right font-bold tabular-nums">{formatInt(yearOf(s.c))}{" "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartTips>
      </FigurePlate>

      <section className="mt-12" aria-labelledby="iv-countries">
        <h2 id="iv-countries" className="font-heading text-2xl font-black">
          Who got them, the last 12 months
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base text-foreground/70">
          By foreign state of chargeability (usually the country of birth), {monthName(yearFrom)} to {monthName(newest)},
          spouses and children included.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2 [&>*]:min-w-0">
          {(["EB-2", "EB-3", "EB-1", "EB-5", "EB-3 other workers"] as const).map((c) => {
            const rows = topRows(byCountry, c, 7);
            return rows.length ? (
              <div key={c} className="border-2 border-border bg-card p-5 shadow-hard-sm">
                <h3 className="font-heading text-lg font-black">{c}{" "}</h3>
                <BarRows className="mt-3" label={`${c} visas issued abroad by country`} rows={rows} />
              </div>
            ) : null;
          })}
        </div>
      </section>

      {postRows.length ? (
        <section className="mt-12" aria-labelledby="iv-posts">
          <h2 id="iv-posts" className="font-heading text-2xl font-black">
            Where they were issued
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base text-foreground/70">
            The consulates that issued the most employment visas, the last 12 months.
          </p>
          <BarRows className="mt-5" label="Employment visas by consulate" rows={postRows} />
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="iv-all">
        <h2 id="iv-all" className="font-heading text-2xl font-black">
          Every category
        </h2>{" "}
        <div className="mt-4 overflow-x-auto border-2 border-border bg-card shadow-hard">
          <table className="w-full min-w-[32rem] text-left text-base">
            <caption className="sr-only">Immigrant visas issued abroad by category</caption>
            <thead className="border-b-2 border-border bg-muted/40">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Category{" "}</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">{monthName(newest)}{" "}</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">Last 12 months{" "}</th>
              </tr>
            </thead>
            <tbody>
              {ALL_CATEGORIES.filter((c) => yearOf(c) > 0).map((c) => (
                <tr key={c} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-bold">{c}{" "}</th>
                  <td className="px-4 py-3 text-right tabular-nums">{formatInt(latest[c] ?? 0)}{" "}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatInt(yearOf(c))}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FinePrint summary="How State's symbols map to these categories" className="mt-3">
          <p>
            Each row of State&apos;s tables carries a visa symbol. The categories follow State&apos;s own legend,{" "}
            <a
              href="https://travel.state.gov/content/dam/visas/Statistics/Immigrant-Statistics/MonthlyIVIssuances/Immigrant%20Visa%20Symbols_2024.pdf"
              className={LINK}
              rel="noopener"
            >
              Immigrant Visa Symbols
            </a>
            : E1 is EB-1, E2 EB-2, E3 EB-3 skilled workers and professionals, EW EB-3 other workers, C5, T5, R5, I5 and
            the regional-center symbols added in 2022 EB-5, and so on. State&apos;s earlier tables print each symbol with
            its sub-class (E21, E22) and its later ones as one group (E2); the categories add both the same way.
          </p>
        </FinePrint>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Abroad, not in the US</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            These are visas consulates issued to people outside the country. Someone in the US on an H-1B gets the
            green card from USCIS instead, which counts it in its own{" "}
            <Link href="/uscis-processing-times" className={LINK}>
              quarterly figures
            </Link>
            .
          </p>
        </div>{" "}
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">The cutoff behind them</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            A consulate can issue a visa only to someone whose priority date is current in that month&apos;s{" "}
            <Link href="/visa-bulletin" className={LINK}>
              visa bulletin
            </Link>
            , so the bars move with the cutoffs.
          </p>
        </div>
      </section>

      <p className="mt-8 text-sm text-foreground/70">
        Source:{" "}
        <a href={STATE_PAGE} className={LINK} rel="noopener">
          U.S. Department of State, Monthly Immigrant Visa Issuance Statistics
        </a>
        , {monthName(summary.months[0] ?? newest)} to {monthName(newest)}. Every month&apos;s rows are checked against
        State&apos;s own grand total before they&apos;re shown.
      </p>
      <ToolPageFooter
        currentHref={PATH}
        reading={[
          { href: "/visa-bulletin", label: "Visa bulletin", note: "this month's cutoffs and their history" },
          { href: "/nvc-waiting-list", label: "NVC waiting list", note: "how many are waiting at the consular stage" },
          { href: "/i140-awaiting-visa", label: "Approved I-140s awaiting a visa", note: "the employment queue USCIS counts" },
        ]}
      />
      <DataProvenance datasets={["visa-issuances"]} />
    </div>
  );
}
