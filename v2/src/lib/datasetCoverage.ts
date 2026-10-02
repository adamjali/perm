/**
 * What each dataset CONTAINS, as distinct from how often it arrives.
 *
 * A source line states a cadence, and cadence is not coverage:
 *
 *   - "Quarterly" doesn't say that DOL's disclosure files hold ONLY DECIDED
 *     cases, so nothing computed from them describes a case still waiting.
 *   - "Daily" doesn't say that the live sweep INCLUDES PENDING cases but
 *     carries no wage, law firm or worksite, which DOL reveals only when it
 *     publishes a case.
 *
 * Reading one for the other gives a duration averaged over the fastest few
 * percent of a recent month, or "nothing found" for a case that simply isn't
 * decided yet. DataProvenance shows these sentences under every data page.
 *
 * One sentence per dataset, in the reader's terms. `dataset-coverage.test.ts`
 * fails on a dataset without one.
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
  "seasonal-status":
    "Live status of H-2A and H-2B applications and H-2B prevailing wage requests filed since October 2025, pending included. No wage or worksite.",
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
  "nvc-waiting-list":
    "State's yearly count of applicants waiting for an immigrant visa at the National Visa Center, each November 1 since 2016, by category, spouses and children included; consular cases only, not adjustments at USCIS.",
  "visa-annual-limits":
    "The State Department's annual numerical limits and the prior year's usage.",
  "uscis-case-status":
    "USCIS's own case status text and dated history for a receipt number, read from its Case Status API at lookup time and kept twelve months after the last lookup. Nothing is estimated.",
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
    "Federal Register rules, proposed rules and notices that touch these programs, with the Register's own dates. Not guidance or internal memos.",
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

  // --- USCIS quarterly performance workbooks --------------------------------
  "uscis-form-quarters":
    "Every USCIS form's receipts, approvals, denials, pending count and MEDIAN months to a decision, per quarter, as USCIS publishes them. The median is not the 80th-percentile figure on USCIS's processing-times page.",
  "uscis-i485-offices":
    "I-485 applications received, approved, denied and pending at each USCIS field office and service center in the quarter, by category. Cells USCIS withholds as too small are left blank, never zero.",
  "uscis-eb-awaiting-visa":
    "Approved I-140, I-360 and I-526 petitions whose beneficiary is still waiting for a visa number, by preference and country of birth, as of the month USCIS states. Primary beneficiaries only, dependents excluded.",
  "uscis-i140-class-country":
    "I-140 petitions by the fiscal year USCIS received them and their current status, all countries and the top five, with approvals by class. Counted by filing year, so a recent year is mostly still pending.",
  // --- ICE SEVIS by the Numbers -------------------------------------------------
  "sevp-top-employers":
    "The 200 employers with the most F-1 students on OPT or STEM OPT, and on CPT, for each year ICE published a list, under ICE's own employer names. Top 200 only; a student in two programs at one employer is counted in each.",
  // --- USCIS H-1B Employer Data Hub -------------------------------------------
  "uscis-h1b-hub":
    "H-1B workers USCIS approved and denied per petitioner, by the fiscal year of its FIRST decision, from FY2009. Appeals, revocations and pending petitions are excluded, and the address is the petitioner's mailing address, not where the work is.",
};

/** The coverage sentence for a dataset, or null when nobody has written one. */
export function coverageFor(dataset: string): string | null {
  return DATASET_COVERAGE[dataset] ?? null;
}
