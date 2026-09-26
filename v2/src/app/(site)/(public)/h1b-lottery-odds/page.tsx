/**
 * H-1B cap lottery odds, year by year, from USCIS's own registration table,
 * and DHS's estimate of the odds by wage level under the weighted selection
 * that began with FY2027. Every figure is from `lib/h1bLottery.ts`, which
 * carries its sources and the date it was read.
 */

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import {
  BENEFICIARY_CENTRIC_FROM,
  H1B_REGISTRATIONS,
  H1B_REGISTRATION_READ,
  H1B_REGISTRATION_REVISED,
  H1B_REGISTRATION_SOURCE,
  WEIGHTED_ESTIMATE,
  WEIGHTED_FROM,
  perRegistrationRate,
  registrationsPerBeneficiary,
} from "@/lib/h1bLottery";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

const TITLE = "H-1B Lottery Odds by Year";
const DESCRIPTION =
  "H-1B lottery odds for every cap year since FY2021, from USCIS's own registration counts, and DHS's estimate of the odds by wage level from FY2027.";
const PATH = "/h1b-lottery-odds";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "h1b-lottery-odds");

const FAQS = [
  {
    q: "What were the H-1B lottery odds for FY2026?",
    a: "USCIS selected 120,141 of 343,981 eligible registrations, about 35%. It counted roughly 339,000 unique beneficiaries, and almost all had a single registration (1.01 on average), so a beneficiary's chance was close to the registration rate.",
  },
  {
    q: "How does the weighted lottery work?",
    a: "From the FY2027 cap, a registration goes into the draw once for OEWS wage level I, twice for level II, three times for level III and four times for level IV. The level is the highest one the offered wage meets for the job's occupation and area. A beneficiary is still selected only once.",
  },
  {
    q: "What are my odds at my wage level?",
    a: "DHS estimated them in the final rule: about 15% at level I, 31% at level II, 46% at level III and 61% at level IV, against about 30% for everyone under the old random draw. That's DHS's estimate from past petitions, assuming employers keep their current wages, not a count of an actual lottery.",
  },
  {
    q: "Why did the odds jump in FY2025?",
    a: "The lottery changed from drawing registrations to drawing people. Before FY2025, one person with several registrations had several chances. From FY2025 each unique beneficiary is entered once, and registrations for the same person fell from 408,891 in FY2024 to 47,314 in FY2025.",
  },
];

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function H1bLotteryOddsPage() {
  const years = H1B_REGISTRATIONS;
  const newest = years[years.length - 1]!;
  const newestRate = perRegistrationRate(newest);
  const perBen = registrationsPerBeneficiary(newest);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question" as const,
      name: f.q,
      acceptedAnswer: { "@type": "Answer" as const, text: f.a },
    })),
  };
  const breadcrumb = generateBreadcrumbSchema([
    { name: "Data", href: "/tools" },
    { name: "H-1B lottery odds", href: PATH },
  ]);

  // The year chart: eligible registrations as the frame, selected filled in.
  const W = 720;
  const H = 240;
  const PAD = { l: 8, r: 8, t: 34, b: 34 };
  const max = Math.max(...years.map((y) => y.eligible));
  const slot = (W - PAD.l - PAD.r) / years.length;
  const bw = slot * 0.62;
  const plotH = H - PAD.t - PAD.b;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link href="/tools" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Data
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">H-1B lottery odds, year by year</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          How many H-1B cap registrations USCIS received and selected each year, from its own table, and how the odds
          change now that the draw is weighted by wage.
        </p>
      </header>

      <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8" aria-labelledby="latest">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">FY{newest.fy} cap</p>{" "}
        <h2 id="latest" className="mt-2 font-heading text-4xl font-black leading-tight tabular-nums sm:text-5xl">
          {pct(newestRate)}
        </h2>{" "}
        <p className="mt-1 font-heading text-xl font-bold">of eligible registrations selected</p>{" "}
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-foreground/80">
          {newest.selected.toLocaleString("en-US")} of {newest.eligible.toLocaleString("en-US")}.
          {newest.uniqueBeneficiaries && perBen
            ? ` USCIS counted about ${newest.uniqueBeneficiaries.toLocaleString("en-US")} unique beneficiaries, with ${perBen.toFixed(2)} registrations each on average, so one person's chance was close to this rate.`
            : ""}{" "}
          The FY{WEIGHTED_FROM} lottery was the first weighted by wage; USCIS hasn&apos;t added it to its table (last revised{" "}
          {H1B_REGISTRATION_REVISED}).
        </p>

        <div className="mt-6 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px] text-foreground" role="img" aria-labelledby="years-title">
            <title id="years-title">{`Eligible and selected H-1B registrations, FY${years[0]!.fy} to FY${newest.fy}`}</title>
            {years.map((y, i) => {
              const x = PAD.l + i * slot + (slot - bw) / 2;
              const he = (plotH * y.eligible) / max;
              const hs = (plotH * y.selected) / max;
              return (
                <g key={y.fy}>
                  <rect x={x} y={H - PAD.b - he} width={bw} height={he} className="fill-none stroke-foreground" strokeWidth={2}>
                    <title>{`FY${y.fy}: ${y.eligible.toLocaleString("en-US")} eligible registrations `}</title>
                  </rect>
                  <rect x={x} y={H - PAD.b - hs} width={bw} height={hs} className="fill-foreground/75">
                    <title>{`FY${y.fy}: ${y.selected.toLocaleString("en-US")} selected `}</title>
                  </rect>
                  <text x={x + bw / 2} y={H - PAD.b - he - 10} fontSize={16} textAnchor="middle" className="fill-foreground font-bold">
                    {`${pct(perRegistrationRate(y))} `}
                  </text>
                  <text x={x + bw / 2} y={H - 10} fontSize={16} textAnchor="middle" className="fill-foreground">
                    {`FY${y.fy} `}
                  </text>
                </g>
              );
            })}
            <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="stroke-foreground" strokeWidth={2} />
          </svg>
        </div>{" "}
        <p className="mt-3 text-base text-foreground/75">
          Outline: eligible registrations. Filled: selected. The share above each bar is selected over eligible. From FY
          {BENEFICIARY_CENTRIC_FROM} USCIS drew people rather than registrations, which is why the FY2024 pile of
          repeat registrations disappears.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="weighted">
        <h2 id="weighted" className="font-heading text-2xl font-black">
          From FY{WEIGHTED_FROM}, the odds depend on the wage
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
          A registration now enters the draw once at OEWS wage level I and up to four times at level IV. DHS estimated
          what that does to one beneficiary&apos;s chance, in the final rule, before the first weighted lottery ran:
        </p>{" "}
        <div className="mt-5 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <ul className="space-y-4">
            {WEIGHTED_ESTIMATE.levels.map((l) => (
              <Fragment key={l.level}>
                {" "}
                <li className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 [&>*]:min-w-0">
                  <span className="font-heading text-lg font-black">Level {l.level}</span>{" "}
                  <span className="relative block h-8 border-2 border-border bg-background" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${l.percent}%` }} />
                    <span
                      className="absolute inset-y-0 border-l-2 border-dashed border-primary"
                      style={{ left: `${WEIGHTED_ESTIMATE.randomPercent}%` }}
                    />
                  </span>{" "}
                  <span className="text-right font-bold tabular-nums">{l.percent.toFixed(1)}%</span>
                </li>
              </Fragment>
            ))}
          </ul>{" "}
          <p className="mt-4 text-base text-foreground/75">
            Dashed line: {WEIGHTED_ESTIMATE.randomPercent}%, DHS&apos;s figure for every beneficiary under the random draw.
            DHS&apos;s estimate, {WEIGHTED_ESTIMATE.citation}, assumes employers keep their current wages and pools the
            regular cap with the master&apos;s cap; DHS notes it may understate selections at higher levels.{" "}
            <Link href="/tools/wage-levels" className="font-semibold underline underline-offset-2 hover:text-primary">
              Find the OEWS wage level for a job
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="table">
        <h2 id="table" className="font-heading text-2xl font-black">
          USCIS&apos;s table
        </h2>{" "}
        <div className="mt-4 overflow-x-auto border-2 border-border">
          <table className="w-full min-w-[720px] text-left text-base">
            <thead className="border-b-2 border-border bg-muted/40">
              <tr>
                <th scope="col" className="px-3 py-3 font-bold">Cap year{" "}</th>
                <th scope="col" className="px-3 py-3 font-bold">Registrations{" "}</th>
                <th scope="col" className="px-3 py-3 font-bold">Eligible{" "}</th>
                <th scope="col" className="px-3 py-3 font-bold">One per person{" "}</th>
                <th scope="col" className="px-3 py-3 font-bold">Several per person{" "}</th>
                <th scope="col" className="px-3 py-3 font-bold">Selected{" "}</th>
                <th scope="col" className="px-3 py-3 font-bold">Selected share{" "}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...years].reverse().map((y) => (
                <tr key={y.fy} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-3 py-3 font-bold">FY{y.fy}{" "}</th>
                  <td className="px-3 py-3">{y.total.toLocaleString("en-US")}{" "}</td>
                  <td className="px-3 py-3">{y.eligible.toLocaleString("en-US")}{" "}</td>
                  <td className="px-3 py-3">{y.soleRegistrations.toLocaleString("en-US")}{" "}</td>
                  <td className="px-3 py-3">{y.multipleRegistrations.toLocaleString("en-US")}{" "}</td>
                  <td className="px-3 py-3">{y.selected.toLocaleString("en-US")}{" "}</td>
                  <td className="px-3 py-3 font-bold">{pct(perRegistrationRate(y))}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>{" "}
        <p className="mt-3 text-base text-foreground/75">
          From USCIS&apos;s{" "}
          <a href={H1B_REGISTRATION_SOURCE} className="font-semibold underline underline-offset-2 hover:text-primary" rel="noopener" target="_blank">
            H-1B electronic registration page
          </a>
          , last revised {H1B_REGISTRATION_REVISED}, read {H1B_REGISTRATION_READ}. Eligible leaves out duplicates,
          registrations deleted before the period closed, invalid passports and failed payments. The selected count is
          USCIS&apos;s total for the year.
        </p>
      </section>

      <details className="group mt-12 border-2 border-border p-6 sm:p-8">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-heading text-lg font-black marker:content-none">
          What this can&apos;t tell you
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground/80">
          <li>
            Your own odds. They depend on your wage level and on how many registrations came in at each level, which USCIS
            hasn&apos;t published for FY{WEIGHTED_FROM}. The percentages above are DHS&apos;s estimate, not a count.
          </li>{" "}
          <li>How the FY{WEIGHTED_FROM} lottery actually turned out. USCIS&apos;s table stops at FY{newest.fy}.</li>{" "}
          <li>
            How many of a year&apos;s selections came in a second round. The table gives the year&apos;s total and doesn&apos;t
            split it.
          </li>{" "}
          <li>
            Anything about cap-exempt jobs. Employers such as universities and their affiliated nonprofits and research
            organizations file outside the lottery under INA 214(g)(5).
          </li>{" "}
          <li>Whether a selected registration becomes an approved petition. Selection only lets the employer file.</li>
        </ul>
      </details>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>{" "}
        <FaqList items={FAQS} />
      </section>

      <ToolPageFooter
        currentHref={PATH}
        reading={[
          { href: "/tools/wage-levels", label: "Wage levels for a job", note: "the four OEWS levels the weighted lottery uses, from DOL" },
          { href: "/lca-wages", label: "H-1B wages by occupation", note: "what certified LCAs offered, from DOL's disclosure files" },
          { href: "/tools/h1b-six-year-limit", label: "H-1B six-year limit", note: "how long H-1B status can run, and what extends it" },
        ]}
      />
    </div>
  );
}
