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
  "h2a-disclosure":
    "Decided H-2A applications only, with the wage offered, the workers requested and certified, and the work period. Pending applications are absent.",
  "h2b-disclosure":
    "Decided H-2B applications only, with the wage offered, the workers requested and certified, and the work period. Pending applications are absent.",
  "cw1-disclosure":
    "Decided CW-1 applications in the Northern Mariana Islands only, with the wage offered and the workers requested and certified. Pending applications are absent.",
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
  "seasonal-postings":
    "H-2A and H-2B applications and H-2A job orders DOL accepted, with the wage, workers, work period and worksite, from SeasonalJobs.dol.gov, accepted since February 6, 2024. Not the decision: that is the live status and, later, the quarterly file.",
  "seasonal-status":
    "Live status of H-2A, H-2B and CW-1 applications, H-2A job orders, and H-2B and CW-1 prevailing wage requests, pending included. No wage or worksite: those come from the quarterly files and SeasonalJobs.",
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
  // --- what a job is, pays and costs where it is (added Oct 5 2026) -----------
  onet:
    "What O*NET says each occupation is and takes: its description, tasks, Job Zone and the education workers report. A description of the job everywhere, not of any one employer's opening.",
  "bls-oews":
    "What employers report paying everyone in each job, nationally, by state and by metro, from BLS's yearly survey (May of the year named). Citizens and immigrants alike; not PERM offers.",
  "bls-projections":
    "BLS's ten-year projection of each job's employment and yearly openings, and the entry education it calls typical. A projection, not a count.",
  "oflc-wage-levels":
    "The four prevailing wage levels DOL publishes for every job in every area, each wage year from 2021-22, as DOL's own tables print them. The floors an offer is held to, not what anyone was paid.",
  "census-geo":
    "Where each worksite city sits: its county, metro area and DOL wage area, matched to Census's place and county files. A city Census lists in no single place is left unmatched rather than guessed.",
  "bea-rpp":
    "BEA's regional price parities: what the same basket costs in a state or metro area against the national level of 100.",
  "visa-issuances":
    "Immigrant visas State's consulates issued abroad each month, by visa class and by country or consulate. A green card granted inside the United States (adjustment of status at USCIS) is not in it, and for employment categories that is most of them.",
  // --- USCIS H-1B Employer Data Hub -------------------------------------------
  "uscis-h1b-hub":
    "H-1B workers USCIS approved and denied per petitioner, by the fiscal year of its FIRST decision, from FY2009. Appeals, revocations and pending petitions are excluded, and the address is the petitioner's mailing address, not where the work is.",
  // --- Firm page claims ----------------------------------------------------------
  "firm-email-domains":
    "The email DOMAINS DOL's newest PERM, wage-request and LCA files print beside each law firm, used only to check a claim on the firm's page. Never an address; personal mail and domains shared by many firms left out.",
};

/** The coverage sentence for a dataset, or null when nobody has written one. */
export function coverageFor(dataset: string): string | null {
  return DATASET_COVERAGE[dataset] ?? null;
}

/**
 * The short name each dataset goes by on a page's source lines. Every dataset
 * in DATASET_COVERAGE needs one (dataset-coverage.test.ts): without it the
 * line printed the registry id, "h2a-disclosure:", to readers.
 */
export const DATASET_LABELS: Readonly<Record<string, string>> = {
  "perm-cases": "Case data",
  "pw-disclosure": "Wage determinations",
  "lca-disclosure": "LCA disclosures",
  "h2a-disclosure": "H-2A disclosures",
  "h2b-disclosure": "H-2B disclosures",
  "cw1-disclosure": "CW-1 disclosures",
  "daily-decisions": "Daily decisions",
  entities: "Employers and firms",
  "stage-cohorts": "Cases by stage",
  "perm-case-status": "Per-case statuses",
  "perm-case-status-full": "Per-case statuses, full sweep",
  "pwd-status": "Wage request statuses",
  "lca-status": "LCA statuses",
  "seasonal-postings": "SeasonalJobs.dol.gov postings",
  "seasonal-status": "H-2A, H-2B and CW-1 statuses",
  "live-recent": "Live PERM filings",
  "decisions-observed": "Decisions we observed",
  "review-stages": "Review stages",
  "rfi-funnel": "RFI and audit outcomes",
  "processing-times": "Processing times",
  "visa-bulletin": "Visa bulletin",
  "nvc-waiting-list": "NVC waiting list",
  "visa-annual-limits": "Annual visa limits",
  "uscis-case-status": "USCIS case statuses",
  "i485-inventory": "I-485 pending inventory",
  "uscis-i140-counts": "I-140 counts",
  "uscis-i140-times": "I-140 times",
  "i140-trends": "I-140 filings by category",
  debarments: "DOL debarment lists",
  "policy-notices": "Federal Register notices",
  "policy-notices-oflc": "OFLC announcements",
  "warn-notices": "WARN notices",
  "warn-notices-ca": "California WARN notices",
  "warn-notices-ny": "New York WARN notices",
  "warn-notices-tx": "Texas WARN notices",
  "warn-notices-wa": "Washington WARN notices",
  "uscis-form-quarters": "USCIS quarterly form data",
  "uscis-i485-offices": "I-485 by field office",
  "uscis-eb-awaiting-visa": "Petitions awaiting a visa",
  "uscis-i140-class-country": "I-140 by class and country",
  "sevp-top-employers": "ICE top OPT and CPT employers",
  "uscis-h1b-hub": "USCIS H-1B Employer Data Hub",
  onet: "O*NET occupation data",
  "bls-oews": "BLS market pay",
  "bls-projections": "BLS employment projections",
  "oflc-wage-levels": "DOL wage tables",
  "census-geo": "Census places and metros",
  "bea-rpp": "BEA price parities",
  "visa-issuances": "State visa issuances",
  "firm-email-domains": "Law firms' email domains",
  // Retired names still stamped on older rows.
  "perm-month-stats": "Pending case counts",
};

/** A dataset's short name, or the id itself when none is written (a test keeps that from shipping). */
export function datasetLabel(dataset: string): string {
  return DATASET_LABELS[dataset] ?? dataset;
}
