/**
 * What the Justice Department and the Labor Department have done to work-visa sponsors since June 2025: the
 * settlements of DOJ's "Protecting U.S. Workers" push, its lawsuit against Cloudera, and DOL's suspension of
 * Cloudera's PERM processing.
 *
 * Every figure here was read in the primary text on Nov 1 2026: each settlement agreement (the PDFs linked from
 * IER's list, https://www.justice.gov/crt/settlements-and-lawsuits), DOJ's releases through its press-release
 * API, and DOL's May 12 2026 release through the Internet Archive's copy (www.dol.gov refuses scripts). A
 * company is linked to a page here only when its legal name is the page's, by this site's own identity rules,
 * and its state agrees: a wrong link names the wrong company.
 *
 * Why a hand-kept list. DOL's debarment list (src/lib/db/debarments.ts) holds only formal notices under
 * 20 CFR 656.31(f), and Cloudera's two years off PERM are a promise in its settlement, so the list doesn't show
 * them. New actions reach the policy feed by themselves (scripts/ingest_doj_enforcement.py) and the evening
 * check emails the owner; each is added here after its agreement is read.
 */

export type EnforcementKind = "settlement" | "suspension" | "lawsuit";
export type EnforcementProgram = "PERM" | "H-1B" | "H-2A" | "temporary visas";

export interface EnforcementSource {
  label: string;
  url: string;
}

export interface EnforcementAction {
  id: string;
  /** The company as the agreement or release prints it. */
  company: string;
  /** Where the release says the company is, when it says. */
  place?: string;
  kind: EnforcementKind;
  /** The visa program the conduct was about. "temporary visas" when DOJ names none. */
  program: EnforcementProgram;
  /** What it did (or, for the lawsuit, what DOJ alleged), in one plain sentence. */
  conduct: string;
  /** A settlement's effective date (its last signature), else the day it was announced. */
  date: string;
  /** The day DOJ or DOL announced it, when it did. Six settlements have no release. */
  announced?: string;
  releaseNumber?: string;
  civilPenalty?: number;
  /** Back pay for the workers kept out. Instacart's is a fund for back pay and other damages. */
  backPay?: number;
  backPayIsFund?: boolean;
  termYears?: number;
  /** Its place among the initiative's settlements, when DOJ's own release numbers it. */
  position?: number;
  /** How the place was worked out when DOJ doesn't say it. */
  positionNote?: string;
  /** A bar on filing, in its own words. */
  bar: { words: string; months?: number; days?: number } | null;
  sources: EnforcementSource[];
  /** This site's employer pages for the company, checked by hand. */
  pages?: string[];
}

/** The day the list was last checked against IER's list and DOJ's releases. */
export const ENFORCEMENT_CHECKED = "2026-11-01";

export const ENFORCEMENT_ACTIONS: readonly EnforcementAction[] = [
  {
    id: "2025-06-10-epik",
    company: "Epik Solutions d/b/a Epikso",
    place: "California",
    kind: "settlement",
    program: "H-1B",
    conduct: "Its job advertisements limited some positions to applicants holding H-1B visas.",
    date: "2025-06-10",
    announced: "2025-06-10",
    releaseNumber: "25-601",
    civilPenalty: 71916,
    termYears: 3,
    position: 1,
    bar: null,
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/justice-department-fighting-discrimination-against-us-workers"}, {"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1403171/dl?inline"}],
    pages: ["epik-solutions"],
  },
  {
    id: "2025-07-15-h2a-complete-ii",
    company: "H2A Complete II, Inc.",
    place: "Mississippi",
    kind: "settlement",
    program: "H-2A",
    conduct: "It put experience requirements in H-2A job orders that its farm clients did not need, so that U.S. workers would not qualify.",
    date: "2025-07-15",
    announced: "2025-07-15",
    releaseNumber: "25-742",
    civilPenalty: 25000,
    termYears: 2,
    position: 2,
    bar: null,
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/justice-department-reaches-new-settlement-protect-us-workers"}, {"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1407966/dl?inline"}],
    pages: ["h2a-complete-ii-inc"],
  },
  {
    id: "2025-09-29-tekishub",
    company: "TekisHub Consulting Services, LLC",
    place: "Delaware",
    kind: "settlement",
    program: "H-1B",
    conduct: "It limited recruitment for some positions to people holding H-1B visas, in postings and directly to the person who filed the charge.",
    date: "2025-09-29",
    announced: "2025-09-29",
    releaseNumber: "25-1006",
    civilPenalty: 200000,
    termYears: 3,
    position: 3,
    bar: null,
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/civil-rights-division-fines-tech-company-200000-discriminating-against-us-workers-part"}, {"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1419726/dl?inline"}],
    pages: ["tekishub-consulting-services-llc"],
  },
  {
    id: "2025-12-18-tekshapers",
    company: "Tekshapers Inc.",
    place: "Michigan",
    kind: "settlement",
    program: "temporary visas",
    conduct: "Its job advertisements favored holders of temporary employment-based visas over U.S. workers.",
    date: "2025-12-18",
    announced: "2025-12-18",
    releaseNumber: "25-1216",
    civilPenalty: 47000,
    backPay: 18000,
    termYears: 2,
    position: 4,
    bar: null,
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/civil-rights-division-obtains-settlement-michigan-it-company-discriminating-against-us"}, {"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1427891/dl?inline"}],
    pages: ["tekshapers-inc"],
  },
  {
    id: "2026-01-05-intellicept",
    company: "Intellicept Inc.",
    place: "New Jersey",
    kind: "settlement",
    program: "H-1B",
    conduct: "It posted a job advertisement seeking only applicants with H-1B visas.",
    date: "2026-01-05",
    civilPenalty: 4610,
    termYears: 3,
    positionNote: "5, 6 or 7",
    bar: null,
    sources: [{"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1425406/dl?inline"}, {"label": "IER's list of settlements", "url": "https://www.justice.gov/crt/settlements-and-lawsuits"}],
    pages: ["intellicept-corporation"],
  },
  {
    id: "2026-01-05-nitya",
    company: "Nitya Software Solutions, Inc.",
    kind: "settlement",
    program: "H-1B",
    conduct: "A recruiter acting for it posted job advertisements limiting some positions to applicants with H-1B visas.",
    date: "2026-01-05",
    civilPenalty: 40000,
    termYears: 3,
    positionNote: "5, 6 or 7",
    bar: null,
    sources: [{"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1425416/dl?inline"}, {"label": "IER's list of settlements", "url": "https://www.justice.gov/crt/settlements-and-lawsuits"}],
    pages: ["nitya-software-solutions-inc"],
  },
  {
    id: "2026-01-06-natsoft",
    company: "Natsoft Corporation",
    place: "New Jersey",
    kind: "settlement",
    program: "temporary visas",
    conduct: "It posted job advertisements restricting hiring to a certain citizenship status.",
    date: "2026-01-06",
    civilPenalty: 18440,
    termYears: 3,
    positionNote: "5, 6 or 7",
    bar: null,
    sources: [{"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1425411/dl?inline"}, {"label": "IER's list of settlements", "url": "https://www.justice.gov/crt/settlements-and-lawsuits"}],
    pages: ["natsoft-corporation"],
  },
  {
    id: "2026-02-23-elegant",
    company: "Elegant Enterprise-Wide Solutions, Inc.",
    place: "Virginia",
    kind: "settlement",
    program: "temporary visas",
    conduct: "It posted job advertisements, written by an AI tool, limiting consideration to applicants with H-1B, OPT or H-4 visas.",
    date: "2026-02-23",
    announced: "2026-02-25",
    releaseNumber: "26-190",
    civilPenalty: 9460,
    termYears: 3,
    position: 8,
    bar: null,
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/civil-rights-division-obtains-settlement-company-used-ai-generated-advertisements-excluded"}, {"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1432361/dl?inline"}],
    pages: ["elegant-enterprise-wide-solutions-inc"],
  },
  {
    id: "2026-04-06-compunnel",
    company: "Compunnel Software Group Inc.",
    place: "New Jersey",
    kind: "settlement",
    program: "temporary visas",
    conduct: "Its recruiters told a U.S. citizen it wanted only certain temporary employment-based visa holders and did not consider him for the job.",
    date: "2026-04-06",
    announced: "2026-04-07",
    releaseNumber: "26-321",
    civilPenalty: 255420,
    backPay: 58000,
    termYears: 2,
    position: 9,
    bar: null,
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/civil-rights-division-obtains-settlement-company-discouraged-us-workers-applying-jobs"}, {"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1435411/dl?inline"}],
    pages: ["compunnel-software-group-inc"],
  },
  {
    id: "2026-04-07-lancesoft",
    company: "LanceSoft, Inc.",
    place: "Virginia",
    kind: "settlement",
    program: "H-1B",
    conduct: "A recruiter it employed posted two job advertisements seeking only applicants with H-1B visas.",
    date: "2026-04-07",
    civilPenalty: 9460,
    termYears: 2,
    positionNote: "10 (by date; 10 or 11)",
    bar: null,
    sources: [{"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1435421/dl?inline"}, {"label": "IER's list of settlements", "url": "https://www.justice.gov/crt/settlements-and-lawsuits"}],
    pages: ["lancesoft-inc"],
  },
  {
    id: "2026-04-28-cloudera-lawsuit",
    company: "Cloudera, Inc.",
    place: "Santa Clara, California",
    kind: "lawsuit",
    program: "PERM",
    conduct: "DOJ alleged that from March 31, 2024, to January 28, 2025, Cloudera recruited for at least seven PERM-related jobs through an email address that rejected outside mail and hired no U.S. worker for them.",
    date: "2026-04-28",
    announced: "2026-04-28",
    releaseNumber: "26-409",
    bar: null,
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/civil-rights-division-sues-cloudera-excluding-us-workers-applying-high-paying-technology"}, {"label": "The complaint", "url": "https://www.justice.gov/crt/media/1438366/dl?inline"}],
    pages: ["cloudera-inc"],
  },
  {
    id: "2026-04-28-galent",
    company: "Diamondpick, Inc., dba Galent",
    place: "Delaware, New Jersey and Texas",
    kind: "settlement",
    program: "temporary visas",
    conduct: "It posted at least thirty job advertisements restricting positions to applicants with certain citizenship statuses.",
    date: "2026-04-28",
    civilPenalty: 141900,
    termYears: 2,
    positionNote: "11 (by date; 10 or 11)",
    bar: null,
    sources: [{"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1439011/dl?inline"}, {"label": "IER's list of settlements", "url": "https://www.justice.gov/crt/settlements-and-lawsuits"}],
    pages: ["diamondpick-inc"],
  },
  {
    id: "2026-05-12-cloudera-dol-suspension",
    company: "Cloudera Inc.",
    place: "Santa Clara, California",
    kind: "suspension",
    program: "PERM",
    conduct: "DOL's Office of Foreign Labor Certification stopped processing every PERM application filed by or for Cloudera for 180 days.",
    date: "2026-05-12",
    announced: "2026-05-12",
    releaseNumber: "26-734-NAT",
    bar: {"words": "As part of the enforcement action, the department’s Employment and Training Administration’s Office of Foreign Labor Certification has suspended processing of all permanent labor certification applications filed by, or on behalf of, Cloudera for 180 days.", "days": 180},
    sources: [{"label": "DOL's news release", "url": "https://www.dol.gov/newsroom/releases/eta/eta20260512"}],
    pages: ["cloudera-inc"],
  },
  {
    id: "2026-07-07-creative-team",
    company: "Creative Team, LLC",
    place: "Texas",
    kind: "settlement",
    program: "H-1B",
    conduct: "It posted a job advertisement restricting positions to H-1B visa holders.",
    date: "2026-07-07",
    civilPenalty: 4730,
    termYears: 3,
    positionNote: "12",
    bar: null,
    sources: [{"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1451891/dl?inline"}, {"label": "IER's list of settlements", "url": "https://www.justice.gov/crt/settlements-and-lawsuits"}],
    pages: ["creative-team-llc"],
  },
  {
    id: "2026-08-03-openai",
    company: "OpenAI OpCo, LLC and Statsig, Inc.",
    place: "San Francisco, California",
    kind: "settlement",
    program: "PERM",
    conduct: "For PERM-related jobs it did not post the openings on its external job website and required applicants to mail paper applications.",
    date: "2026-08-03",
    announced: "2026-08-04",
    releaseNumber: "26-884",
    civilPenalty: 1200000,
    backPay: 2000000,
    termYears: 3,
    position: 13,
    bar: null,
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/civil-rights-division-secures-settlement-openai-discriminating-against-us-workers"}, {"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1455621/dl?inline"}],
    pages: ["openai-opco-llc", "statsig-inc"],
  },
  {
    id: "2026-10-13-cloudera",
    company: "Cloudera, Inc.",
    place: "Santa Clara, California",
    kind: "settlement",
    program: "PERM",
    conduct: "For at least seven PERM-related jobs it left the openings off its careers website and told applicants to apply to an email address that could not receive outside mail.",
    date: "2026-10-13",
    announced: "2026-10-16",
    releaseNumber: "26-1166",
    civilPenalty: 600000,
    backPay: 1400000,
    termYears: 3,
    position: 14,
    bar: {"words": "Furthermore, Cloudera shall self debar from PERM for 24 months by not filing any ETA Forms 9089 during that period and not posting any advertisements related to PERM recruitment. The debarment period will begin from the date of its most recent PERM application withdrawal.", "months": 24},
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/us-departments-justice-and-labor-secure-settlement-cloudera-enforce-two-year-perm-debarment"}, {"label": "The settlement agreement", "url": "https://www.justice.gov/crt/media/1465571/dl?inline"}],
    pages: ["cloudera-inc"],
  },
  {
    id: "2026-10-19-instacart",
    company: "Maplebear, Inc. d/b/a Instacart",
    place: "San Francisco, California",
    kind: "settlement",
    program: "PERM",
    conduct: "For PERM-related jobs it required U.S. workers to mail their applications, and in some cases did not consider them in time.",
    date: "2026-10-19",
    announced: "2026-10-20",
    releaseNumber: "26-1230",
    civilPenalty: 1000000,
    backPay: 4000000,
    backPayIsFund: true,
    termYears: 3,
    position: 15,
    bar: null,
    sources: [{"label": "DOJ's news release", "url": "https://www.justice.gov/opa/pr/civil-rights-division-and-equal-employment-opportunity-commission-secure-5000000-joint"}],
    pages: ["maplebear-inc", "maplebear-dba-instacart"],
  },];

/** The settlements alone (the lawsuit and the suspension left out), oldest first. */
export const SETTLEMENTS = ENFORCEMENT_ACTIONS.filter((a) => a.kind === "settlement");

/** Everything done to a company with a page here, newest first. */
export function actionsFor(slug: string): EnforcementAction[] {
  return ENFORCEMENT_ACTIONS.filter((a) => a.pages?.includes(slug)).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** "Maplebear, Inc. d/b/a Instacart" to "Instacart", "OpenAI OpCo, LLC and Statsig, Inc." to "OpenAI". */
export function shortName(company: string): string {
  const dba = /\bd\/?b\/?a\/?\s+(.+)$/i.exec(company);
  const name = dba ? dba[1]! : company;
  return name.split(/,| and | OpCo\b/)[0]!.replace(/\s+(Inc|LLC|Corp|Corporation)\.?$/i, "").trim();
}

/** Money a settlement moved: its civil penalty plus its back pay or fund. */
export function settlementMoney(a: EnforcementAction): number {
  return (a.civilPenalty ?? 0) + (a.backPay ?? 0);
}

export interface EnforcementTotals {
  settlements: number;
  perm: number;
  penalties: number;
  backPay: number;
  first: string;
  newest: string;
}

export function enforcementTotals(list: readonly EnforcementAction[] = SETTLEMENTS): EnforcementTotals {
  const s = list.filter((a) => a.kind === "settlement");
  return {
    settlements: s.length,
    perm: s.filter((a) => a.program === "PERM").length,
    penalties: s.reduce((t, a) => t + (a.civilPenalty ?? 0), 0),
    backPay: s.reduce((t, a) => t + (a.backPay ?? 0), 0),
    first: s[0]?.date ?? "",
    newest: s[s.length - 1]?.date ?? "",
  };
}

/**
 * When a bar counted from a past day runs out: the day plus its months. Pure.
 * Cloudera's runs from "its most recent PERM application withdrawal"; DOL's record dates that Jul 11 2025.
 */
export function barEnds(from: string, months: number): string {
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  const end = new Date(Date.UTC(y, m - 1 + months, d));
  return end.toISOString().slice(0, 10);
}
