/**
 * What each dataset CONTAINS, as distinct from how often it arrives.
 *
 * The provenance line under every data page already states a source, an as-of
 * date and a cadence. Cadence is not coverage, and the gap between them is the
 * single most confusing thing about this site's numbers:
 *
 *   - "Quarterly" does not tell a reader that DOL's disclosure files hold
 *     ONLY DECIDED cases, so nothing computed from them can describe a case
 *     still waiting, and a completion fraction taken from them alone is
 *     always exactly 1.0.
 *   - "Daily" does not tell a reader that our own sweep INCLUDES PENDING
 *     cases but carries no wage, no law firm and no worksite, because DOL
 *     only reveals those at publication.
 *
 * Read one for the other and you get the two errors this project keeps
 * meeting: a duration averaged over the fastest 2% of a recent month, or a
 * "nothing found" for a case that is simply not decided yet.
 *
 * Adam, 2026-09-10: "there's also confusion everywhere about the DOL quarterly
 * vs live pending from our scraping, and it should be clarified everywhere
 * what is which."
 *
 * One sentence per dataset, in the reader's terms, never the schema's. A
 * dataset with no entry is a dataset whose coverage nobody has stated, which
 * is why `dataset-coverage.test.ts` fails on one.
 */
export const DATASET_COVERAGE: Readonly<Record<string, string>> = {
  // --- DOL quarterly disclosure files: decided only -----------------------
  "perm-cases":
    "Decided PERM cases only. A case still waiting is not in here, so counts and durations describe finished cases, not the queue.",
  "pw-disclosure":
    "Decided prevailing wage requests only, with the wage DOL determined. Pending requests are absent.",
  "lca-disclosure":
    "Certified and denied H-1B labor condition applications only, with the wage offered.",
  "daily-decisions":
    "Derived from decided cases, so it counts determinations DOL issued, never cases waiting.",
  entities:
    "Employers, law firms and occupations ranked from decided cases only.",
  "stage-cohorts":
    "Filing-month durations over decided cases. How much of each month is still pending comes from the live sweep, not from here.",

  // --- our own live sweep of DOL: pending included ------------------------
  "perm-case-status":
    "Every PERM case DOL indexes, pending included. No wage, law firm or worksite: DOL reveals those only when a case is published.",
  "perm-case-status-full":
    "The same live record, re-checked in full rather than only the pending half.",
  "pwd-status":
    "Live status of prevailing wage requests, pending included. The wage itself is not here; it arrives with the quarterly file.",
  "lca-status":
    "Live status of H-1B labor condition applications, pending included.",
  "live-recent":
    "The cases our sweep knows that DOL has not published yet, so they can be found by employer before any file lists them.",
  "decisions-observed":
    "Status changes our sweep watched happen, from 26 August 2026 onward. Nothing earlier: DOL publishes a case's current status, never when it changed.",
  "review-stages":
    "How many pending cases sit at each review stage right now, counted live.",
  "rfi-funnel":
    "RFI outcomes, blended from a frozen third-party window and our own observations, pooled as counts.",

  // --- DOL's own published position ---------------------------------------
  "processing-times":
    "DOL's published queue position and average determination time. DOL's own figure, not ours.",

  // --- other federal sources ----------------------------------------------
  "visa-bulletin":
    "Cutoff dates as the State Department published them each month. Nothing here is forecast.",
  "visa-annual-limits":
    "The State Department's annual numerical limits and the prior year's usage.",
  "i485-inventory":
    "USCIS's count of pending I-485s by priority date and country. Employment-based only: USCIS does not publish a family-based equivalent.",
  "uscis-i140-counts":
    "USCIS I-140 receipts, approvals and denials by quarter. A denial here is not a PERM denial: different agency, different stage.",
  "uscis-i140-times":
    "USCIS's published I-140 processing times, which are their own service-centre figures rather than anything measured here.",
  "i140-trends":
    "I-140 volumes by fiscal quarter and classification, as USCIS publishes them. Counts of filings, not of people waiting.",
  debarments:
    "Employers and agents DOL has barred, for the period DOL states. Includes bars that have not started yet.",
  "policy-notices":
    "Federal Register documents that touch these programs. Proposed and final rules, not guidance or internal memos.",
  "policy-notices-oflc":
    "Announcements OFLC posts on its own page, which is where program changes appear before the Federal Register.",
  "warn-notices":
    "State WARN layoff notices, from the four states that publish them in a readable form.",
  "warn-notices-ca":
    "California WARN notices, from the state's own spreadsheet. Layoffs the employer announced, not layoffs that happened.",
  "warn-notices-ny":
    "New York WARN notices, taken from the state's dashboard export rather than its older HTML list.",
  "warn-notices-tx":
    "Texas WARN notices from the state open data portal, which reaches further back than the agency spreadsheet does.",
  "warn-notices-wa":
    "Washington WARN notices, read a page at a time from the state's own searchable database.",
};

/** The coverage sentence for a dataset, or null when nobody has written one. */
export function coverageFor(dataset: string): string | null {
  return DATASET_COVERAGE[dataset] ?? null;
}
