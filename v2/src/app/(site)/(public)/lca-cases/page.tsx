import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";

import { PageBasics } from "@/components/data/PageBasics";
import { IndexHeader, IndexLookup } from "@/components/data/IndexHeader";
import { FilingMonthBars } from "@/components/data/FilingMonthBars";
import { formatInt } from "@/lib/format";
import { FinePrint } from "@/components/data/FinePrint";
import { FlagCaseBrowser, LCA_PROGRAM } from "@/components/tools/FlagCaseBrowser";
import { openGraphBase } from "@/lib/openGraphBase";
import { getLcaSummary, getLcaDisclosureSummary } from "@/lib/turso/lcaCases";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";

/**
 * Labor condition applications, findable by employer as DOL confirms them.
 *
 * Same source and same machinery as the wage-request search. An LCA is the
 * H-1B (and H-1B1, E-3) wage attestation the employer files with DOL before
 * the USCIS petition; DOL certifies most within seven business days. The
 * number is on the certified LCA the employer must give the worker, but
 * plenty never see it, and nothing public lists them.
 */

const TITLE = "LCA Case Search";
const DESCRIPTION =
  "Find an H-1B labor condition application (ETA-9035) by employer, job title and filing month, with its current status, read daily from DOL's case status.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/lca-cases" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/lca-cases",
  },
}, "lca-cases");

export const revalidate = 86400;

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function LcaCasesPage() {
  const [summary, disclosure] = await Promise.all([getLcaSummary(), getLcaDisclosureSummary()]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <IndexHeader
        title="Find an H-1B LCA"
        lede="The employer files it with DOL before the H-1B petition. Search the employer to get the number, the job title, the filing date and the status."
        figures={[
          {
            label: "Waiting at DOL now",
            value: summary ? formatInt(summary.pending) : "—",
            note: "DOL has seven working days to decide one",
          },
          {
            label: "Decided, with the wage offered",
            value: disclosure ? formatInt(disclosure.rows) : "—",
            ...(longDate(disclosure?.latestDecision ?? null)
              ? { note: `Published through ${longDate(disclosure?.latestDecision ?? null)}` }
              : {}),
          },
          {
            label: "In DOL's case-status service",
            value: summary ? formatInt(summary.total) : "—",
            note: "Every LCA this site has confirmed there",
          },
        ]}
        aside={
          <IndexLookup
            title="Have the number?"
            placeholder="I-200-26188-123456"
            note="DOL is asked live, and the case page can email you when it moves."
            source="lca-cases"
          />
        }
      />{" "}

      <div className="mt-10">
        <SearchParamsBoundary>
          <FlagCaseBrowser
            summary={summary}
            disclosure={disclosure}
            program={LCA_PROGRAM}
            between={
              summary ? (
                <section >
                  <h2 className="font-heading text-xl font-bold">LCAs by the month they were filed</h2>{" "}
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    DOL has seven working days to certify an LCA (20 CFR 655.740), so only the newest
                    filings are still waiting.
                  </p>{" "}
                  <FilingMonthBars
                    className="mt-5"
                    months={summary.byMonth}
                    nouns="LCAs"
                    label="LCAs by filing month, decided and still waiting"
                  />
                </section>
              ) : null
            }
          />
        </SearchParamsBoundary>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-bold">How this works</h2>{" "}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-soft">
          <FinePrint summary="Where the rows come from">
            <p>DOL numbers every filing from one running counter. This site walks it two or three times a day for new filings, then re-checks each LCA until DOL decides. {" "}</p>
          </FinePrint>{" "}
          <p>
            <b className="font-bold">Why one might be missing.</b> The live record
            is walking backwards through earlier filings, so an old one may not be
            in it yet. A filing from today appears after the next check, which runs
            at least twice a day.
          </p>
        </div>
      </section>
      <PageBasics page="lca-cases" />{" "}
    </div>
  );
}
