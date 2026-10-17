import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";

import { PageBasics } from "@/components/data/PageBasics";
import { IndexHeader, IndexLookup } from "@/components/data/IndexHeader";
import { FilingMonthBars } from "@/components/data/FilingMonthBars";
import { formatInt } from "@/lib/format";
import { FlagCaseBrowser, LCA_PROGRAM } from "@/components/tools/FlagCaseBrowser";
import { openGraphBase } from "@/lib/openGraphBase";
import { getLcaSummary, getLcaDisclosureSummary } from "@/lib/db/lcaCases";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { longDate } from "@convex/lib/months";

/**
 * Labor condition applications, findable by employer as DOL confirms them.
 *
 * Same source and same machinery as the wage-request search. An LCA is the
 * H-1B (and H-1B1, E-3) wage attestation the employer files with DOL before
 * the USCIS petition; DOL certifies most within seven business days. The
 * number is on the certified LCA the employer must give the worker, but
 * plenty never see it, and nothing public lists them.
 */

const TITLE = "LCA Case Search and Status Tracking";
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

      <PageBasics page="lca-cases" />{" "}
    </div>
  );
}
