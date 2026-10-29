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
    "Decided PERM cases only. A case still waiting isn't in here, so counts and durations describe finished cases.",
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
  "nvc-timeframes":
    "The National Visa Center's own weekly figures: how far behind it creates cases and reviews documents. Not a wait for any one case, and nothing about the consulate's interview.",
  "perm-pwd-links":
    "Decided PERM cases joined to the wage request each names, for wage requests determined long enough ago that their PERMs have been decided. A PERM still pending isn't counted.",

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
  "visa-wait-times":
    "The wait for a NONIMMIGRANT visa interview at each U.S. embassy and consulate, as State's Global Visa Wait Times table prints it each month: the next appointment for visitors, students, petition-based workers (H, L, O, P, Q) and crew, and visitors' average wait. Interview waivers aren't in it, and neither is the immigrant visa (green card) interview.",
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
    "Federal Register rules, proposed rules, notices and presidential documents that touch these programs, with the Register's own dates. Not guidance or internal memos.",
  "policy-notices-oflc":
    "Every announcement OFLC posts on its own page, H-2A, H-2B and CW-1 included, which is where program changes appear before the Federal Register.",
  "policy-notices-dol":
    "DOL's news releases on foreign labor and work visas (H-1B, PERM, H-2A, H-2B, Project Firewall), from its newsroom. The rest of DOL's news is left out.",
  "policy-notices-pi":
    "Today's Federal Register public inspection list, kept by the policy feed's rules on the title: documents the Register files the business day before it publishes them, followed until published or withdrawn. No abstract until publication.",
  "policy-notices-wh":
    "The White House's presidential actions on an immigration subject, the day they're posted, from its own feed. Replaced by the Federal Register's document once published; nothing on other subjects.",
  "policy-notices-uscis":
    "USCIS's news releases and alerts on work-based immigration, from its newsroom feed. Fraud cases, naturalization and humanitarian-only items are left out.",
  "policy-comments":
    "How many comments regulations.gov has posted on each proposed rule still open for comment. Posted, not received: an agency posts a comment after screening it, so the count trails what was sent.",
  "policy-notices-congress":
    "Bills and joint resolutions in the current Congress whose titles name a work-visa or employment-based green card subject, with each bill's latest action. Resolutions and bills on other subjects are left out.",
  "policy-notices-courts":
    "Federal court opinions that turn on PERM labor certification, H-1B, H-2A, H-2B, I-140 or employment-based green cards, from CourtListener's archive, with a person named in a caption shown by initials. State courts, criminal cases and petitions for review of removal orders are left out.",
  "policy-notices-balca":
    "BALCA's decisions as OALJ lists them: every en banc PERM decision, and prevailing wage, H-2A and H-2B appeals decided since October 2024, with a sole proprietor shown by initials. OALJ keeps no list of ordinary PERM panel decisions, and its lists run weeks to months behind.",
  "policy-notices-state":
    "The State Department's visa news on work and immigrant visas, from its own newsroom. Visitor-only, diversity-lottery, passport and adoption items are left out.",
  "policy-notices-uscis-pm":
    "Every Policy Manual alert and technical update on the work-based parts of the manual since 2013, with the sections each one changed.",
  "rule-pipeline-agenda":
    "Each agency's Unified Agenda listing for USCIS rules and immigration rules from DOL, State and DHS: the stage, the agency's own timetable for its next step as printed, and the abstract, from reginfo.gov's file for the newest edition. The timetable is the agency's plan, not a date this site predicts.",
  "rule-pipeline":
    "Rules from USCIS, and immigration rules from DOL, State and DHS, from White House review (OIRA's own lists) through public inspection to the Federal Register. A rule OIRA doesn't review appears once it's on public inspection.",
  "warn-notices":
    "State WARN layoff notices from 47 states and DC, each from the record its state publishes. Arkansas, New Hampshire and Wyoming publish no list.",
  "warn-notices-ca":
    "California WARN notices, from the state's own spreadsheet. Layoffs the employer announced, not layoffs that happened.",
  "warn-notices-ny":
    "New York WARN notices, taken from the state's dashboard export rather than its older HTML list.",
  "warn-notices-tx":
    "Texas WARN notices from the agency's spreadsheet, read from the Internet Archive's copy because the agency's site challenges scripts, and from the state open data portal back to 2019.",
  "warn-notices-wa":
    "Washington WARN notices, read a page at a time from the state's own searchable database.",
  "warn-notices-al": "Alabama WARN notices from the Department of Workforce's list, since 2019.",
  "warn-notices-ak": "Alaska WARN notices from the Department of Labor's list, since 2019.",
  "warn-notices-az":
    "Arizona WARN notices from the state's job-center search, since 2019. Counts come from each notice's own page, newest first: a run reads the new ones, and the state's weekly read fills the rest, so an older notice can wait up to a week for its count.",
  "warn-notices-co":
    "Colorado WARN notices from the state's yearly sheets, since 2019, counting the workers in Colorado where the sheet says so.",
  "warn-notices-ct": "Connecticut WARN notices from the Department of Labor's document library, since 2019.",
  "warn-notices-dc": "District of Columbia WARN notices from the yearly pages DOES posts, since 2021.",
  "warn-notices-de":
    "Delaware WARN notices from the state's job-center search, since 2019. Counts come from each notice's own page, newest first: a run reads the new ones, and the state's weekly read fills the rest, so an older notice can wait up to a week for its count.",
  "warn-notices-fl": "Florida WARN notices from FloridaCommerce's list for each year, since 2019.",
  "warn-notices-ga": "Georgia WARN notices from WorkSource Georgia's list, since 2023, dated by the day each was submitted.",
  "warn-notices-hi":
    "Hawaii WARN notices since 2020. Notices from August 2026 carry their counts; earlier ones are letters, so they carry the company and date only.",
  "warn-notices-ia": "Iowa WARN notices from the state's WARN log, since October 2021. An amendment is its own row.",
  "warn-notices-id":
    "Idaho WARN notices from the state's list, since 2019, counting Idaho's share where a notice covers several states.",
  "warn-notices-il":
    "Illinois WARN notices from the state's layoff database, since 2019. Layoffs the database marks as not WARN notices are left out.",
  "warn-notices-in": "Indiana WARN notices from the Department of Workforce Development's list, since 2019.",
  "warn-notices-ks":
    "Kansas WARN notices from the state's job-center search, since 2019. Kansas posts few, so months can pass with none. Counts come from each notice's own page, newest first: a run reads the new ones, and the state's weekly read fills the rest, so an older notice can wait up to a week for its count.",
  "warn-notices-ky": "Kentucky WARN notices from this year's report and the prior-year workbook, since 2019.",
  "warn-notices-ma":
    "Massachusetts WARN notices from the State Library's copy of the weekly report, since July 2020. Earlier years are in a format the loader can't read.",
  "warn-notices-md": "Maryland WARN notices from the Department of Labor's page for each year, since 2019.",
  "warn-notices-me": "Maine WARN notices from the state's job-center search, since 2019. Counts come from each notice's own page, newest first: a run reads the new ones, and the state's weekly read fills the rest, so an older notice can wait up to a week for its count.",
  "warn-notices-mi": "Michigan WARN notices from the state's list, since November 2024, dated by the day the state posted each.",
  "warn-notices-ms":
    "Mississippi WARN notices from the quarterly reports, since July 2020. Notices the state marks as not required by the WARN Act are left out.",
  "warn-notices-mt": "Montana WARN notices from the Department of Labor and Industry's workbook, since 2019.",
  "warn-notices-nc":
    "North Carolina WARN notices since 2019: this year from the state's dashboard, earlier years from its yearly reports, dated by the day the state received each.",
  "warn-notices-nd": "North Dakota WARN notices from Job Service's list, since 2019. The state updates it a few times a year.",
  "warn-notices-ne": "Nebraska WARN notices from the Department of Labor's list, since March 2023.",
  "warn-notices-nj":
    "New Jersey WARN notices from the state's archive, since 2019. It prints the month a notice was posted, not the day, so the month is shown.",
  "warn-notices-oh": "Ohio WARN notices from this year's list on the state's page. Earlier years aren't read.",
  "warn-notices-ok": "Oklahoma WARN notices, since 2019. Oklahoma prints no worker count, so none is shown.",
  "warn-notices-or": "Oregon WARN notices from the state's Rapid Response list, since late 2020.",
  "warn-notices-pa":
    "Pennsylvania WARN notices, since 2023. The state lists each by the month it was posted, not the day, and a notice for several sites is a row per site.",
  "warn-notices-sc": "South Carolina WARN notices from the yearly reports, since 2022. Earlier reports print no notice date.",
  "warn-notices-sd": "South Dakota WARN notices, since 2019, dated by the day the state received each. No layoff date is printed.",
  "warn-notices-tn": "Tennessee WARN notices from the state's current page, dated by the day the state posted each.",
  "warn-notices-ut": "Utah WARN notices from the state's yearly tables, since 2019. No layoff date is printed.",
  "warn-notices-va": "Virginia WARN notices from Virginia Works's list, since 2019.",
  "warn-notices-vt": "Vermont WARN notices from the state's job-center search, since 2019. Counts come from each notice's own page, newest first: a run reads the new ones, and the state's weekly read fills the rest, so an older notice can wait up to a week for its count.",
  "warn-notices-wi": "Wisconsin WARN notices, since 2020. Original notices only: the state's updates to a notice aren't read.",
  "warn-notices-mn":
    "Minnesota WARN notices since 2023 from DEED's list, by the date DEED prints. The list gives no count, so none is shown. When DEED's page turns a script away, the Internet Archive's copy of it is read.",
  "warn-notices-ri":
    "Rhode Island WARN notices from DLT's workbook, since 2019. Where a notice covers several states, Rhode Island's share is kept.",
  "warn-notices-la":
    "Louisiana WARN notices from the Workforce Commission's yearly files, since 2019, read from the Internet Archive's copies because the state asks automated readers to stay off its files.",
  "warn-notices-nm":
    "New Mexico WARN notices from Workforce Solutions' yearly files, since 2024, read from the Internet Archive's copies because the state asks automated readers to stay off its files. The Archive captures them a few times a year.",
  "warn-notices-mo":
    "Missouri WARN notices from the Office of Workforce Development's yearly pages, since 2019, read from the Internet Archive's copies because each page sits behind a browser check.",
  "warn-notices-nv":
    "Nevada WARN notices from DETR's yearly lists, since 2022, read from the Internet Archive's copies because the state's site refuses scripts. Notices DETR marks as not required by the WARN Act are left out.",
  "warn-notices-wv":
    "West Virginia WARN notices since 2021: January 2022 to January 2025 from the state's compiled list, and the rest from each notice's letter, which gives the company and the day or month but no count.",

  // --- USCIS quarterly performance workbooks --------------------------------
  "uscis-form-quarters":
    "Every USCIS form's receipts, approvals, denials, pending count and MEDIAN months to a decision, per quarter, as USCIS publishes them. The median is not the 80th-percentile figure on USCIS's processing-times page.",
  "uscis-i485-offices":
    "I-485 applications received, approved, denied and pending at each USCIS field office and service center in the quarter, by category. Cells USCIS withholds as too small are left blank, never zero.",
  "uscis-eb-awaiting-visa":
    "Approved I-140, I-360 and I-526 petitions whose beneficiary is still waiting for a visa number, by preference and country of birth, as of the month USCIS states. Primary beneficiaries only, dependents excluded.",
  "uscis-i140-class-country":
    "I-140 petitions by the fiscal year USCIS received them and their current status, all countries and the top five, with approvals by class. Counted by filing year, so a recent year is mostly still pending.",
  "uscis-rfe":
    "I-129 petitions USCIS decided each month, by visa, and how many of them had a request for evidence, from FY2015. Initial decisions only, a petition with several RFEs counted once, and no figures for the I-140, the I-485 or any employer.",
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
  "perm-pwd-links": "Wage request to PERM",
  "nvc-timeframes": "NVC timeframes",
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
  "visa-wait-times": "State visa wait times",
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
  "policy-notices-dol": "DOL news releases",
  "policy-notices-pi": "Federal Register public inspection",
  "policy-notices-wh": "White House presidential actions",
  "policy-notices-uscis": "USCIS news and alerts",
  "policy-notices-uscis-pm": "USCIS Policy Manual updates",
  "policy-notices-state": "State Department visa news",
  "policy-comments": "Comment counts from regulations.gov",
  "policy-notices-congress": "Bills in Congress",
  "policy-notices-courts": "Federal court opinions",
  "policy-notices-balca": "BALCA decisions",
  "rule-pipeline": "Rules in review and on public inspection",
  "rule-pipeline-agenda": "The Unified Agenda",
  "warn-notices": "WARN notices",
  "warn-notices-ca": "California WARN notices",
  "warn-notices-ny": "New York WARN notices",
  "warn-notices-tx": "Texas WARN notices",
  "warn-notices-wa": "Washington WARN notices",
  "warn-notices-al": "Alabama WARN notices",
  "warn-notices-ak": "Alaska WARN notices",
  "warn-notices-az": "Arizona WARN notices",
  "warn-notices-co": "Colorado WARN notices",
  "warn-notices-ct": "Connecticut WARN notices",
  "warn-notices-dc": "District of Columbia WARN notices",
  "warn-notices-de": "Delaware WARN notices",
  "warn-notices-fl": "Florida WARN notices",
  "warn-notices-ga": "Georgia WARN notices",
  "warn-notices-hi": "Hawaii WARN notices",
  "warn-notices-ia": "Iowa WARN notices",
  "warn-notices-id": "Idaho WARN notices",
  "warn-notices-il": "Illinois WARN notices",
  "warn-notices-in": "Indiana WARN notices",
  "warn-notices-ks": "Kansas WARN notices",
  "warn-notices-ky": "Kentucky WARN notices",
  "warn-notices-ma": "Massachusetts WARN notices",
  "warn-notices-md": "Maryland WARN notices",
  "warn-notices-me": "Maine WARN notices",
  "warn-notices-mi": "Michigan WARN notices",
  "warn-notices-ms": "Mississippi WARN notices",
  "warn-notices-mt": "Montana WARN notices",
  "warn-notices-nc": "North Carolina WARN notices",
  "warn-notices-nd": "North Dakota WARN notices",
  "warn-notices-ne": "Nebraska WARN notices",
  "warn-notices-nj": "New Jersey WARN notices",
  "warn-notices-oh": "Ohio WARN notices",
  "warn-notices-ok": "Oklahoma WARN notices",
  "warn-notices-or": "Oregon WARN notices",
  "warn-notices-pa": "Pennsylvania WARN notices",
  "warn-notices-sc": "South Carolina WARN notices",
  "warn-notices-sd": "South Dakota WARN notices",
  "warn-notices-tn": "Tennessee WARN notices",
  "warn-notices-ut": "Utah WARN notices",
  "warn-notices-va": "Virginia WARN notices",
  "warn-notices-vt": "Vermont WARN notices",
  "warn-notices-wi": "Wisconsin WARN notices",
  "warn-notices-mn": "Minnesota WARN notices",
  "warn-notices-ri": "Rhode Island WARN notices",
  "warn-notices-la": "Louisiana WARN notices",
  "warn-notices-nm": "New Mexico WARN notices",
  "warn-notices-mo": "Missouri WARN notices",
  "warn-notices-nv": "Nevada WARN notices",
  "warn-notices-wv": "West Virginia WARN notices",
  "uscis-form-quarters": "USCIS quarterly form data",
  "uscis-i485-offices": "I-485 by field office",
  "uscis-eb-awaiting-visa": "Petitions awaiting a visa",
  "uscis-i140-class-country": "I-140 by class and country",
  "uscis-rfe": "USCIS I-129 requests for evidence",
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
