import { CHECKED_ON, type Tracker } from "./trackers";

/**
 * The other PERM trackers, read on their own pages and answers on Tuesday,
 * October 27, 2026 (`~/.claude/explanations/20261027_perm_vs_landscape/`,
 * saved captures under raw/). Every quote is verbatim from a saved capture.
 * A "no" rests on what was checked, said in its note; nothing is guessed.
 *
 * The trackers people search for by name (Ahrefs and Search Console, Oct 27
 * 2026), the ones a Reddit comparison thread names, and H1BPerm, the newest
 * (registered Oct 5 2026; owner's call to include it). eb3.work was checked
 * and left out: it's a paid job-placement agency, not a case tracker.
 *
 * h1bperm.com's robots.txt closes the site to AI crawlers, so its pages were
 * read with an honestly named request under its rules for every other client,
 * and in a person's own browser; its /api/ was never called by a script.
 */

const PU = "https://permupdate.com";
const PU_API = "https://perm-backend-production.up.railway.app";
const PT = "https://perm-timeline.com";
const PK = "https://permtrack.app";
const IL = "https://immilane.com";
const PQ = "https://permqueue.com";
const HP = "https://h1bperm.com";

export const RIVALS: readonly Tracker[] = [
  {
    slug: "permupdate",
    name: "PERM Update",
    url: PU,
    operator: null,
    price: "Free, with ads",
    checkedOn: CHECKED_ON,
    newestData: {
      day: "2026-10-26",
      note: "Its data through October 26",
      evidence: { url: `${PU_API}/api/data/processing-times`, quote: '"as_of_date":"2026-10-26T23:33:16.979127"' },
    },
    cells: {
      lookup: { mark: "partial", note: "A case number gives a date estimate, not DOL's status for the case", evidence: { url: PU, quote: "Enter your PERM case number for an estimated completion date" } },
      pending: { mark: "partial", note: "Counts of cases waiting per filing month, not each case", evidence: { url: `${PU_API}/api/data/dashboard`, quote: '"month":"January 2026","backlog":7763' } },
      source: { mark: "partial", note: "DOL's performance page, plus data it gathers by hand from other websites", evidence: { url: `${PU}/faq`, quote: "we manually gather daily updates from other publicly accessible websites" } },
      wage: { mark: "no", note: "Not found on its 10 pages or 21 API paths", evidence: { url: `${PU_API}/openapi.json` } },
      lca: { mark: "no", note: "Not found on its 10 pages or 21 API paths", evidence: { url: `${PU_API}/openapi.json` } },
      seasonal: { mark: "no", note: "Not found on its 10 pages or 21 API paths", evidence: { url: `${PU_API}/openapi.json` } },
      alerts: { mark: "no", note: "No sign-up, subscribe or alert option on any page", evidence: { url: `${PU}/sitemap.xml` } },
      employers: { mark: "partial", note: "A search by company name over March 2024 to March 2026 filings, no page per employer", evidence: { url: `${PU}/case-search`, quote: "Data includes March 2024 - March 2026 submissions" } },
      bulletin: { mark: "yes", note: "The November 2026 cutoffs, matching State's", evidence: { url: `${PU}/bulletin.json`, quote: '"date":"November 2026"' } },
      attorney: { mark: "no", note: "No case or deadline tool on any page", evidence: { url: `${PU}/sitemap.xml` } },
      noAccount: { mark: "yes", note: "No sign-in anywhere on the site", evidence: { url: `${PU}/sitemap.xml` } },
      free: { mark: "yes", note: "No price or paid tier on any page", evidence: { url: `${PU}/sitemap.xml` } },
      noAds: { mark: "no", note: "Google AdSense on its home, case search and updated-cases pages", evidence: { url: PU, quote: "adsbygoogle.js" } },
      openData: { mark: "no", note: "No download offered", evidence: { url: `${PU}/sitemap.xml` } },
    },
    strengths: ["Everything on one free dashboard, with no sign-in at all", "A date estimate from a case number"],
  },
  {
    slug: "perm-timeline",
    name: "PERM Timeline",
    url: PT,
    operator: null,
    price: "Free",
    checkedOn: CHECKED_ON,
    newestData: {
      day: "2026-06-30",
      note: "Decided cases only, from DOL's file through June 30",
      evidence: { url: PT, quote: "Data through June 30, 2026" },
    },
    cells: {
      lookup: { mark: "no", note: "Its watchlist keeps a case number but shows no DOL status for it", evidence: { url: `${PT}/watchlist/`, quote: "The official status of a case can only be checked by the employer or its attorney in the DOL FLAG system." } },
      pending: { mark: "no", note: "Its charts count decided cases from DOL's quarterly file", evidence: { url: PT, quote: "Counted from every case in DOL's PERM disclosure file for FY2026 Q3" } },
      source: { mark: "partial", note: "DOL's processing-times page and its quarterly files; no case-status reads", evidence: { url: PT, quote: "DOL queue figures update automatically from FLAG" } },
      wage: { mark: "partial", note: "DOL's wage-request month only; no request lookup", evidence: { url: PT, quote: "Prevailing wage (PWD) Requests received in June 2026" } },
      lca: { mark: "no", note: "Only a glossary entry (11 pages checked)", evidence: { url: PT } },
      seasonal: { mark: "no", note: "No H-2A or H-2B data (11 pages checked)", evidence: { url: PT } },
      alerts: { mark: "no", note: "No sign-up or alert option on 11 pages", evidence: { url: `${PT}/privacy-policy/` } },
      employers: { mark: "partial", note: "One search page; the site has 10 pages in all", evidence: { url: `${PT}/employer-lookup/`, quote: "Search approval rates from 280,000+ DOL cases" } },
      bulletin: { mark: "partial", note: "A table labelled October 2026 whose cutoffs don't match State's October 2026 bulletin", evidence: { url: "https://web-production-91337.up.railway.app/api/visa-bulletin", quote: '"EB-2":{"india":"01JAN12"' } },
      attorney: { mark: "no", note: "It calls itself an information site", evidence: { url: `${PT}/contact-us/`, quote: "PERM Timeline is an information site, not a law firm." } },
      noAccount: { mark: "yes", note: "No sign-in anywhere", evidence: { url: `${PT}/watchlist/` } },
      free: { mark: "yes", evidence: { url: PT, quote: "Free PERM processing times" } },
      noAds: { mark: "no", note: "Its privacy policy says it uses Google AdSense", evidence: { url: `${PT}/privacy-policy/`, quote: "We use Google AdSense to serve ads on our site." } },
      openData: { mark: "no", note: "No download on 11 pages", evidence: { url: `${PT}/law-firms-attorneys/` } },
    },
    strengths: [
      "DOL's four queue figures in one dated block on the homepage, matching DOL's own",
      "One long page that walks the whole PERM and green card timeline",
    ],
  },
  {
    slug: "permtrack",
    name: "PermTrack",
    url: PK,
    operator: "Permtrack LLC (California)",
    price: "Free to browse; alerts $9.99 a month",
    checkedOn: CHECKED_ON,
    newestData: {
      day: "2026-10-27",
      note: "DOL checked the same day",
      evidence: { url: `${PK}/api/stats/data-freshness`, quote: '"flag_checked":"2026-10-27T16:29:58.949Z"' },
    },
    cells: {
      lookup: { mark: "yes", note: "PERM case numbers", evidence: { url: PK, quote: "Enter a PERM case number to see its status and details" } },
      pending: { mark: "yes", evidence: { url: `${PK}/api/watchlist/months`, quote: '"month":"2026-01","total":11490,"pending":8765' } },
      source: { mark: "yes", note: "DOL's case-status system and its quarterly files", evidence: { url: `${PK}/privacy`, quote: "the U.S. Department of Labor's public FLAG system for PERM cases and wage requests" } },
      wage: { mark: "no", note: "Built, but open to its admin only", evidence: { url: `${PK}/api/pwd/overview`, quote: '{"error":"Missing token"}' } },
      lca: { mark: "no", note: "Not found in its app code, sitemap or homepage", evidence: { url: `${PK}/sitemap.xml` } },
      seasonal: { mark: "no", note: "No H-2A, H-2B or CW-1 case data in its app code", evidence: { url: `${PK}/sitemap.xml` } },
      alerts: { mark: "partial", note: "On the paid plan only", evidence: { url: `${PK}/terms`, quote: "Our subscription plan costs $9.99 per month, plus any applicable tax." } },
      employers: { mark: "partial", note: "50 employer pages", evidence: { url: `${PK}/employers/microsoft-corporation`, quote: "Microsoft Corporation PERM Report" } },
      bulletin: { mark: "yes", note: "The October 2026 bulletin, matching State's", evidence: { url: `${PK}/api/stats/timeline-data`, quote: '"month": "October 2026"' } },
      attorney: { mark: "no", note: "No deadline or filing-window tool in its app code", evidence: { url: PK } },
      noAccount: { mark: "yes", note: "No account for public pages; alerts need one and a card", evidence: { url: `${PK}/privacy` } },
      free: { mark: "partial", note: "Public pages free; alerts paid", evidence: { url: `${PK}/terms`, quote: "Our subscription plan costs $9.99 per month, plus any applicable tax." } },
      noAds: { mark: "yes", note: "No ad network in its code; a donation link", evidence: { url: PK } },
      openData: { mark: "partial", note: "Its JSON answers anyone, undocumented; no download", evidence: { url: `${PK}/api/stats/summary` } },
    },
    strengths: [
      "A plain gaining-or-losing-ground counter for DOL's queue on its homepage",
      "A path to request a recheck after an appeal",
    ],
  },
  {
    slug: "immilane",
    name: "ImmiLane",
    url: IL,
    operator: null,
    price: "Free, with ads; paid case emails planned",
    checkedOn: CHECKED_ON,
    newestData: {
      day: "2026-10-27",
      note: "Updated the same day",
      evidence: { url: `${IL}/data/dashboard_data.json`, quote: '"updatedAt": "2026-10-27T12:12:04-04:00"' },
    },
    cells: {
      lookup: { mark: "yes", note: "PERM case numbers only", evidence: { url: `${IL}/estimate`, quote: "Look up by case number for the most accurate result" } },
      pending: { mark: "yes", note: "Cases filed since November 2024", evidence: { url: `${IL}/employers/microsoft-corporation`, quote: "re-scans DOL's public PERM records several times a day for cases filed since November 2024" } },
      source: { mark: "yes", evidence: { url: `${IL}/about-us`, quote: "comes from the Department of Labor's disclosure data and the FLAG (Foreign Labor Application Gateway) system" } },
      wage: { mark: "no", note: "Its lookup takes G- numbers only", evidence: { url: `${IL}/estimate`, quote: "Invalid case number format. Expected: G-100-XXXXX-XXXXXX" } },
      lca: { mark: "partial", note: "H-1B counts and salaries on employer pages; no LCA lookup", evidence: { url: `${IL}/employers/microsoft-corporation`, quote: "certified H-1B Labor Condition Application (LCA) positions" } },
      seasonal: { mark: "no", note: "It describes itself as PERM only", evidence: { url: `${IL}/terms`, quote: "tracks PERM labor certification processing data from the U.S. Department of Labor" } },
      alerts: { mark: "partial", note: "Case emails in a free beta, paid at launch", evidence: { url: `${IL}/subscribe`, quote: "Free beta — payments aren't live yet, so registration is free while we test." } },
      employers: { mark: "partial", note: "300 sponsor pages and a search across every employer", evidence: { url: `${IL}/employers`, quote: "Search all 98,088 employers" } },
      bulletin: { mark: "yes", note: "The November 2026 bulletin, matching State's", evidence: { url: `${IL}/visa-bulletin`, quote: "Employment-Based Priority Dates — November 2026" } },
      attorney: { mark: "no", note: "No case or deadline management", evidence: { url: `${IL}/terms` } },
      noAccount: { mark: "yes", evidence: { url: `${IL}/terms`, quote: "is free to use and requires no account" } },
      free: { mark: "partial", note: "The site is free; case emails will cost $2.99 to $8.99 a month", evidence: { url: `${IL}/refund`, quote: "Daily digest ($8.99/month), Weekly digest ($4.99/month), and Alerts only ($2.99/month)" } },
      noAds: { mark: "no", note: "Display ads, with a wall for ad blockers", evidence: { url: `${IL}/privacy`, quote: "This Site is affiliated with Monumetric" } },
      openData: { mark: "no", note: "Its terms forbid extracting the data", evidence: { url: `${IL}/terms`, quote: "Systematically scrape, harvest, or extract data from the site using automated tools without prior written" } },
    },
    strengths: [
      "Employer pages back to FY2008, with filing-to-decision days by year",
      "A clear refund and cancellation policy for its paid emails",
    ],
  },
  {
    slug: "permqueue",
    name: "PermQueue",
    url: PQ,
    operator: null,
    price: "Free, with ads",
    checkedOn: CHECKED_ON,
    newestData: {
      day: "2026-10-27",
      note: "Measured to the same day",
      evidence: { url: `${PQ}/llms.txt`, quote: "measured on cases decided in the 30 days up to 2026-10-27" },
    },
    cells: {
      lookup: { mark: "yes", note: "A case number in its calculator reads DOL's outcome", evidence: { url: `${PQ}/perm-tracker`, quote: "paste the case number into the calculator above. It reads the outcome from the DOL system directly" } },
      pending: { mark: "yes", evidence: { url: `${PQ}/perm-tracker`, quote: "Cases still waiting 84,487" } },
      source: { mark: "yes", note: "DOL's quarterly files and its own checks of DOL's system", evidence: { url: `${PQ}/perm-tracker`, quote: "The DOL's quarterly OFLC disclosure files are authoritative but published with a lag of months; our own hourly" } },
      wage: { mark: "no", note: "Only an article on prevailing wage", evidence: { url: `${PQ}/llms.txt` } },
      lca: { mark: "no", note: "Not in its 2,151-URL sitemap or 17 pages fetched", evidence: { url: `${PQ}/sitemap.xml` } },
      seasonal: { mark: "no", note: "Not in its 2,151-URL sitemap or 17 pages fetched", evidence: { url: `${PQ}/sitemap.xml` } },
      alerts: { mark: "partial", note: "With a Google account; its homepage calls them a paid add-on, its terms say free", evidence: { url: `${PQ}/my-case`, quote: "Track your PERM case across devices and get alerts. Continue with Google" } },
      employers: { mark: "partial", note: "1,001 sponsor pages", evidence: { url: `${PQ}/sponsors/amazoncom-services`, quote: "Official DOL disclosure data runs through 2026-06-30" } },
      bulletin: { mark: "yes", note: "November 2026, matching State's", evidence: { url: `${PQ}/visa-bulletin`, quote: "Current Visa Bulletin · November 2026 Final Action Dates" } },
      attorney: { mark: "no", note: "No deadline tool on 17 pages fetched", evidence: { url: `${PQ}/sitemap.xml` } },
      noAccount: { mark: "yes", evidence: { url: `${PQ}/privacy`, quote: "An account is optional — every tool on the site works without one." } },
      free: { mark: "yes", evidence: { url: `${PQ}/terms`, quote: "PermQueue is free to use. There is no paid plan, no subscription and no charge of any kind" } },
      noAds: { mark: "no", evidence: { url: `${PQ}/privacy`, quote: "Advertising on the site is served by Google AdSense" } },
      openData: { mark: "partial", note: "An embeddable calculator; no download", evidence: { url: `${PQ}/embed/calculator` } },
    },
    strengths: [
      "The site and its articles in English, Portuguese, Spanish and Mandarin",
      "A wait calculator for EB-3 Other Workers",
    ],
  },
  {
    slug: "h1bperm",
    name: "H1BPerm",
    url: HP,
    operator: null,
    price: "Free",
    checkedOn: CHECKED_ON,
    newestData: {
      day: "2026-10-27",
      note: "Updated the same day",
      evidence: { url: HP, quote: "Updated Oct 27, 2026, 11:09 AM PT." },
    },
    cells: {
      lookup: { mark: "yes", note: "PERM and wage request numbers, each with its own page", evidence: { url: `${HP}/privacy`, quote: "What you type into search (an employer name, a job title or a case number) is sent to our server to look it up." } },
      pending: { mark: "yes", evidence: { url: `${HP}/methodology`, quote: "We check every open case in the public DOL FLAG case status search daily and record status changes." } },
      source: { mark: "yes", evidence: { url: HP, quote: "Data: U.S. Department of Labor FLAG system (PWD, PERM)" } },
      wage: { mark: "yes", note: "A live wage-request board and lookups", evidence: { url: `${HP}/pwd`, quote: "DOL is issuing prevailing wage determinations for requests filed Jul 21, 2026" } },
      lca: { mark: "partial", note: "H-1B LCAs in its search and on employer pages, from DOL's files; no LCA status", evidence: { url: `${HP}/search`, quote: "PERM, prevailing wage (PWD) and H-1B LCA cases from the Department of Labor's public disclosure data" } },
      seasonal: { mark: "no", note: "No H-2A or H-2B data on 12 pages checked", evidence: { url: `${HP}/search` } },
      alerts: { mark: "no", note: "No sign-up of any kind", evidence: { url: `${HP}/privacy`, quote: "It has no accounts and no sign-up forms, and it does not ask for your name, email or case details." } },
      employers: { mark: "partial", note: "500 employer pages, plus 832 law firms and 200 jobs, in six languages", evidence: { url: `${HP}/sitemap.xml` } },
      bulletin: { mark: "yes", evidence: { url: HP, quote: "EB-2 Final Action (rest of world) is Jan 1, 2025." } },
      attorney: { mark: "no", note: "No accounts; law-firm pages are statistics only", evidence: { url: `${HP}/privacy`, quote: "It has no accounts and no sign-up forms" } },
      noAccount: { mark: "yes", evidence: { url: `${HP}/privacy`, quote: "It has no accounts and no sign-up forms" } },
      free: { mark: "yes", evidence: { url: `${HP}/privacy`, quote: "is a free, independent information site" } },
      noAds: { mark: "yes", evidence: { url: `${HP}/privacy`, quote: "We do not show ads at the moment." } },
      openData: { mark: "no", note: "No download; its robots.txt closes /api/ to every client", evidence: { url: `${HP}/robots.txt`, quote: "Disallow: /api/" } },
    },
    strengths: [
      "The exact filing day DOL is on, worked out from case statuses, for PERM and wage requests",
      "Each wage request linked to its PERM case, with the median days between them",
      "Every page in six languages",
    ],
  },
];
