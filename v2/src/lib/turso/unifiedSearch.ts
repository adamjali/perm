import "server-only";

import { MS_PER_DAY } from "@/lib/time";

import type { LiveCaseRow } from "./cases";
import { keepLinkableSlugs } from "./entityLinks";
import type { FlagCaseRow, FlagDisclosedRow } from "./flagCases";
import {
  SLICE_CAP,
  firstSeenDecided,
  lookupUnifiedCase,
  readFlagLive,
  readFlagPublished,
  readFlagEmployerStage,
  readFlagStage,
  readPermEmployerStage,
  readPermLive,
  readPermStage,
  readPermPublished,
  type FlagProgramKey,
  type PermSearchRow,
  type SliceResult,
  type UnifiedNarrow,
} from "./caseSearchReads";
import { naicsTitle } from "@/lib/naicsTitles";
import { annualised } from "@/lib/wageFormat";

export { SLICE_CAP };
import {
  PERM_ONLY_FILTERS,
  LCA_ONLY_FILTERS,
  PUBLISHED_ONLY_FILTERS,
  type FilterKey,
  type Lead,
  type SearchOrder,
} from "@/lib/caseSearchPlan";

/**
 * One search across every DOL filing this site holds.
 *
 * WHY THIS EXISTS. The tables are separate on purpose and must stay that way:
 * the PERM tables feed the queue census, the review-stage pages, the RFI funnel
 * and the alert sweep, all written against a PERM status vocabulary, and ten
 * stray `P-`/`I-` rows that leaked into them had to be deleted by hand. But
 * STORAGE separation is not a reason for INTERFACE separation. Someone who
 * types an employer name has to already know whether they want the PERM page,
 * the wage-request page or the LCA page, and usually they do not.
 *
 * Six reads run in parallel, two per program, because each program has a
 * published half (decided, from DOL's quarterly files, carries the wage) and a
 * live half (from the daily check, the only record of anything pending). Each
 * is an indexed read with its own row cap, so the whole thing is bounded by
 * construction rather than by hope.
 *
 * ## Three things this layer decides, and why each is here rather than in SQL
 *
 * **Which sources can answer.** A filter on a wage, a firm, a worksite or an
 * occupation is a filter on a column the live tables do not have - DOL does not
 * publish any of those until the case reaches a quarterly file. So setting one
 * drops the live half of every program. That is reported in `skipped`, and the
 * page says it in words, because a source that silently contributes nothing is
 * indistinguishable from a source with nothing to contribute.
 *
 * **Which lead.** `chooseLead` in `@/lib/caseSearchPlan` picks it and the UI
 * uses the same function, so a control the page leaves enabled is a control the
 * route can serve. An employer lead reaches all six sources. A state or an
 * occupation lead reaches the three PUBLISHED halves - the live tables have no
 * worksite or occupation column at all, which is a fact about DOL's live
 * endpoint rather than a missing index. A firm lead reaches published PERM
 * alone, because PERM is the only program whose firm column has been ingested.
 *
 * **One row per case.** A case can be in both halves of its program at once.
 */

export type Program = "perm" | "pwd" | "lca" | "seasonal";
export const PROGRAMS: readonly Program[] = ["perm", "pwd", "lca", "seasonal"];
export function isProgram(v: string): v is Program {
  return (PROGRAMS as readonly string[]).includes(v);
}

/** One row of the merged result, whatever program or half it came from. */
export interface UnifiedCase {
  caseNumber: string;
  program: Program;
  /** "published" from DOL's quarterly files, "live" from the daily check. */
  half: "published" | "live";
  status: string;
  isFinal: boolean;
  /** Filing or received date, `YYYY-MM-DD`. */
  filedOn: string | null;
  decidedOn: string | null;
  employerName: string | null;
  employerSlug: string | null;
  jobTitle: string | null;
  /** Only the published half carries a wage. */
  wage: number | null;
  wageUnit: string | null;
  state: string | null;
  /** Published only: DOL names the firm at publication and never before. */
  firmName: string | null;
  /**
   * The day we FIRST SAW this case final. Never a determination date.
   *
   * Only ever set on a live row that is final and has no published date, which
   * means DOL has decided it and not yet published it. It is an upper bound:
   * the case was final by the time our sweep looked. Rendered in words, never
   * in the decided-date column.
   */
  seenDecidedOn?: string | null;
  firmSlug: string | null;
  /** Published only. */
  socCode: string | null;
  socTitle: string | null;
  /** Published only. Calendar days from filing to decision. */
  days: number | null;
  /**
   * Published PERM only, and set only where DOL's file carries them. `era` is
   * "history" for a case decided before FY2024 (from `perm_cases_history`).
   * The industry is the employer's NAICS code with Census's title; the
   * worker's five are on cases filed on DOL's old form only.
   */
  era?: "history";
  industryCode?: string | null;
  industryTitle?: string | null;
  city?: string | null;
  citizenship?: string | null;
  birthCountry?: string | null;
  visaClass?: string | null;
  education?: string | null;
  major?: string | null;
  institution?: string | null;
  jobEducation?: string | null;
}

// The order vocabulary lives in the pure plan module, because the page's sort
// control needs it in the browser and this module is server-only.
export { SEARCH_ORDERS, isSearchOrder, type SearchOrder } from "@/lib/caseSearchPlan";

export interface UnifiedSearchArgs {
  lead: Lead;
  narrow?: UnifiedNarrow;
  programs?: readonly Program[];
  limit?: number;
  order?: SearchOrder;
}

/**
 * Rows in one answer: 1,000, because the site's own database reads thousands
 * in milliseconds.
 * The page shows them 100 at a time and the CSV carries all of them.
 */
export const UNIFIED_MAX = 1000;
/** One-source searches (a stage) fill the whole answer, bounded by UNIFIED_MAX. */
function stageLimit(limit: number | undefined): number {
  return Math.min(Math.max(1, Math.floor(limit ?? UNIFIED_MAX)), UNIFIED_MAX);
}
/** Rows each program's live and published halves may contribute. */
export const PER_SOURCE = 500;

/**
 * Which source a set of filters can no longer be asked of.
 *
 * `live` means the filters name a column that does not exist until DOL
 * publishes the case; `published` means they name one a disclosure file cannot
 * carry, which is only ever "still open".
 */
export interface SkippedSources {
  live: boolean;
  published: boolean;
  /** The filters responsible, so the page can name them rather than gesture. */
  because: string[];
}

/**
 * The two PERM halves have DIFFERENT row shapes, which is why they get two
 * adapters rather than one with optional fields. The published row always
 * carries a decision, a wage and a state; the live row carries none of those
 * and is the only one that can be pending.
 */
const fromPermPublished = (r: PermSearchRow): UnifiedCase => ({
  caseNumber: r.caseNumber,
  program: "perm",
  half: "published",
  status: r.status,
  isFinal: true,
  filedOn: r.receivedDate || null,
  decidedOn: r.decisionDate || null,
  employerName: r.employerName || null,
  employerSlug: r.employerSlug || null,
  jobTitle: r.jobTitle || null,
  wage: r.wage,
  // The disclosure files store PERM wages already annualised, so there is no
  // unit column to carry. Saying "per year" here would be inventing it.
  wageUnit: null,
  state: r.state || null,
  firmName: r.attorneyName || null,
  firmSlug: r.attorneySlug || null,
  socCode: r.socCode || null,
  socTitle: r.socTitle || null,
  days: r.days || null,
  ...(r.table === "perm_cases_history" ? { era: "history" as const } : {}),
  industryCode: r.extras?.naics ?? null,
  industryTitle: naicsTitle(r.extras?.naics)?.title ?? null,
  city: r.extras?.worksiteCity ?? null,
  citizenship: r.extras?.citizenship ?? null,
  birthCountry: r.extras?.birthCountry ?? null,
  visaClass: r.extras?.visaClass ?? null,
  education: r.extras?.education ?? null,
  major: r.extras?.major ?? null,
  institution: r.extras?.institution ?? null,
  jobEducation: r.extras?.jobEducation ?? null,
});

const fromPermLive = (r: LiveCaseRow): UnifiedCase => ({
  caseNumber: r.caseNumber,
  program: "perm",
  half: "live",
  status: r.status ?? "",
  isFinal: r.isFinal,
  filedOn: r.filingDate,
  decidedOn: null,
  employerName: r.employerName,
  // Carried now: `perm_live_recent` holds the slug and this mapper dropped it,
  // so a live PERM row rendered with no link to its employer while a live wage
  // request or LCA, from tables that also hold it, rendered with one.
  employerSlug: r.employerSlug,
  jobTitle: r.jobTitle,
  wage: null,
  wageUnit: null,
  state: null,
  firmName: null,
  firmSlug: null,
  socCode: null,
  socTitle: null,
  days: null,
});

const fromFlagLive = (r: FlagCaseRow, program: Program): UnifiedCase => ({
  caseNumber: r.caseNumber,
  program,
  half: "live",
  status: r.status,
  isFinal: r.isFinal,
  filedOn: r.filingDate,
  decidedOn: null,
  employerName: r.employerName,
  employerSlug: r.employerSlug,
  jobTitle: r.jobTitle,
  wage: null,
  wageUnit: null,
  state: null,
  firmName: null,
  firmSlug: null,
  socCode: null,
  socTitle: null,
  days: null,
});

/**
 * Calendar days from filing to decision, when both ends are known.
 *
 * `perm_cases` stores this as a column; `pwd_cases` and `lca_cases` do not,
 * and it is the same arithmetic on the same two dates. Null when either end is
 * missing rather than 0, because "we do not know" and "decided the same day"
 * are different facts and a 0 would read as the second.
 */
function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

const fromFlagDisclosed = (r: FlagDisclosedRow, program: Program): UnifiedCase => ({
  caseNumber: r.caseNumber,
  program,
  half: "published",
  status: r.status,
  isFinal: true,
  filedOn: r.receivedDate,
  decidedOn: r.decisionDate,
  employerName: r.employerName,
  employerSlug: r.employerSlug,
  jobTitle: r.jobTitle,
  wage: r.wage,
  wageUnit: r.wageUnit,
  state: r.worksiteState,
  // THE FIRM. These rows carry it; dropped here, a firm search would return
  // the right rows with an empty law-firm column.
  firmName: r.attorneyName,
  firmSlug: r.attorneySlug,
  socCode: r.socCode,
  socTitle: r.socTitle,
  // DERIVED, because these tables carry no `days` column while `perm_cases`
  // does. Both dates are right here, so leaving it null showed a filing date
  // and a decision date beside an empty "days" on every wage request and LCA.
  days: daysBetween(r.receivedDate, r.decisionDate),
});

/**
 * Exported for its own test. A test that only drives `unifiedSearch` cannot
 * choose which half it meets first, so it passes on the order the spread
 * happens to use rather than on this rule - measured: breaking the rule left
 * that test green. Calling it directly with the live row first is the only way
 * to check the rule itself.
 *
 * A case can appear in BOTH halves of its program: the live table holds it
 * because the daily check saw it, and the quarterly file holds it because DOL
 * has since decided it. Showing it twice is the obvious bug, so the published
 * row wins (it carries the wage and the decision date) and the live one is
 * dropped. Keyed on case number, which is unique across every program.
 */
export function dedupeToOnePerCase(rows: UnifiedCase[]): UnifiedCase[] {
  const byNumber = new Map<string, UnifiedCase>();
  for (const r of rows) {
    const existing = byNumber.get(r.caseNumber);
    if (!existing || (existing.half === "live" && r.half === "published")) {
      byNumber.set(r.caseNumber, r);
    }
  }
  return [...byNumber.values()];
}

export interface UnifiedSearchResult {
  rows: UnifiedCase[];
  /**
   * How many of the RETURNED rows came from each program, so the chips above
   * the table describe the table. Counting the collected set instead would
   * print a number the reader cannot find on screen.
   */
  counts: Record<Program, number>;
  /** More matched than are returned. */
  truncated: boolean;
  /**
   * A source hit its own row cap, so the merged set is the newest slice of a
   * larger one rather than everything this employer has filed. Distinct from
   * `truncated`: that one is about the final slice, this one about the reads
   * underneath it, and only this one means "narrowing will show you rows you
   * cannot reach by paging".
   */
  capped: boolean;
  /**
   * A source applied its narrowing filters inside a window of this employer's
   * newest filings rather than over the whole of their record.
   *
   * An employer prefix is a RANGE, so no index can hand the rows back in date
   * order and the read has to sort the slice. Doing that over table rows is
   * what cost 137 seconds on Amazon's 20,230 LCAs and got the whole source
   * dropped by the read deadline. The two-pass read fixes the cost and buys
   * it with this: with a filter on, the answer is drawn from the newest
   * `SLICE_CAP` filings per program. That has to be said out loud, because a
   * narrowed answer from a window looks exactly like a narrowed answer from
   * everything.
   */
  windowed: boolean;
  /** Which halves the filters made unanswerable, and which filters did it. */
  skipped: SkippedSources;
  /**
   * The filters only published PERM can answer, when any is set: the wage
   * request and LCA records were not read, and the page names these as why.
   */
  permOnly: string[];
  /** The LCA-only filters set (a prevailing wage source), in words: the answer is LCAs alone. */
  lcaOnly: string[];
  /** The order the rows are in, and whether it covers everything that matched. */
  order: SearchOrder;
  /**
   * "complete" when no source hit its row cap and nothing was cut, so the
   * order is over every match; "fetched" when it is over the rows fetched.
   */
  orderScope: "complete" | "fetched";
  /** The lead the server actually used, echoed so the page can name it. */
  lead: Lead;
}

/** The words the page uses for each filter when it explains a source it skipped. */
const FILTER_WORDS: Partial<Record<FilterKey, string>> = {
  firm: "law firm",
  state: "worksite state",
  occupation: "occupation",
  fiscalYear: "fiscal year",
  wage: "wage",
  industry: "industry",
  city: "worksite city",
  citizenship: "citizenship",
  birthCountry: "country of birth",
  visaClass: "visa at filing",
  education: "worker's education",
  jobEducation: "education the job requires",
  wageSource: "prevailing wage source",
};

/** Which filter keys this narrow sets, by the plan module's names. */
function filtersSet(narrow: UnifiedNarrow): Partial<Record<FilterKey, boolean>> {
  return {
    firm: narrow.firmSlug !== undefined,
    state: narrow.state !== undefined,
    occupation: narrow.socCode !== undefined,
    fiscalYear: narrow.fiscalYear !== undefined,
    wage: narrow.wageMin !== undefined || narrow.wageMax !== undefined,
    industry: narrow.naics !== undefined,
    city: narrow.city !== undefined,
    citizenship: narrow.citizenship !== undefined,
    birthCountry: narrow.birthCountry !== undefined,
    visaClass: narrow.visaClass !== undefined,
    education: narrow.education !== undefined,
    jobEducation: narrow.jobEducation !== undefined,
    wageSource: narrow.wageSource !== undefined,
  };
}

/**
 * The LCA-only filters a narrow sets, in words. Non-empty means only DOL's
 * published LCA file can answer: no other record names a prevailing wage
 * source.
 */
export function lcaOnlyFilters(narrow: UnifiedNarrow): string[] {
  const set = filtersSet(narrow);
  return LCA_ONLY_FILTERS.filter((k) => set[k]).map((k) => FILTER_WORDS[k] ?? k);
}

/**
 * The PERM-only filters a narrow sets, in words. Non-empty means the wage
 * request and LCA records cannot answer this search: their tables here carry
 * none of these columns, so reading them would return rows the filter never
 * touched.
 */
export function permOnlyFilters(narrow: UnifiedNarrow): string[] {
  const set = filtersSet(narrow);
  return PERM_ONLY_FILTERS.filter((k) => set[k]).map((k) => FILTER_WORDS[k] ?? k);
}

/**
 * Which halves a set of filters can still be asked of.
 *
 * Exported and pure so the test can drive it directly: the defect worth
 * pinning is a filter QUIETLY dropping a source, and a result-set assertion
 * cannot tell that apart from a source with no matches.
 */
export function skippedSources(narrow: UnifiedNarrow, lead: Lead): SkippedSources {
  const because: string[] = [];
  const labels = FILTER_WORDS;
  const set = filtersSet(narrow);
  for (const key of PUBLISHED_ONLY_FILTERS) {
    if (set[key]) because.push(labels[key] ?? key);
  }
  // An equality lead reads DOL's published files only, so the live half is out
  // for the lead itself rather than for anything the reader typed: there is no
  // worksite, occupation or firm column on a live row, whichever program it
  // belongs to.
  const leadIsPublishedOnly =
    lead.kind === "firm" || lead.kind === "state" || lead.kind === "occupation";
  // AND IT HAS TO SAY SO. `because` used to stay empty when the LEAD was what
  // ruled the live half out, so the page dropped every pending case and gave no
  // reason: a reader searched a law firm, got only decided cases back, and had
  // to ask why. The label names the lead, because that is the thing to change.
  if (leadIsPublishedOnly && because.length === 0) {
    because.push(labels[lead.kind as FilterKey] ?? lead.kind);
  }
  // A review stage is a live-record fact: no published row carries one, so
  // the published half has nothing to say the moment a stage is asked for.
  const stageAsked = lead.kind === "stage" || narrow.stage !== undefined;
  return {
    live: because.length > 0 || leadIsPublishedOnly,
    published: narrow.outcome === "open" || stageAsked,
    because,
  };
}

const none = <T,>(): Promise<SliceResult<T>> => Promise.resolve({ rows: [], windowed: false });

/**
 * Newest filing first, then case number, so the order is total and a page of
 * results cannot shuffle between identical requests.
 */
function byNewestFiling(a: UnifiedCase, b: UnifiedCase): number {
  const x = a.filedOn ?? "";
  const y = b.filedOn ?? "";
  if (x !== y) return x < y ? 1 : -1;
  return a.caseNumber < b.caseNumber ? 1 : -1;
}

/**
 * Attach "we first saw this final on" to the rows that have nothing better.
 *
 * AFTER the deduper and AFTER the slice, deliberately. A case that also exists
 * in a quarterly file is deduped to the published row and already carries DOL's
 * own determination date, so asking about it would be a read for an answer that
 * is thrown away; and asking about rows past the limit is a read for rows
 * nobody sees. On a hundred-row page this is at most a hundred primary-key
 * seeks, and usually a handful: only a live row that is FINAL and UNDATED
 * qualifies.
 */
async function addSeenDecided(rows: UnifiedCase[]): Promise<void> {
  const byProgram = new Map<Program, string[]>();
  for (const r of rows) {
    if (r.half !== "live" || !r.isFinal || r.decidedOn) continue;
    const list = byProgram.get(r.program) ?? [];
    list.push(r.caseNumber);
    byProgram.set(r.program, list);
  }
  if (byProgram.size === 0) return;
  const found = await Promise.all(
    [...byProgram].map(async ([program, numbers]) =>
      [program, await firstSeenDecided(program, numbers)] as const,
    ),
  );
  const seen = new Map(found);
  for (const r of rows) {
    const day = seen.get(r.program)?.get(r.caseNumber);
    if (day) r.seenDecidedOn = day;
  }
}

/**
 * The yearly figure a wage sort compares. PERM's file is already yearly; the
 * others are multiplied out from their unit, and a wage that looks like a
 * yearly salary under the wrong unit has no figure, so it sorts last.
 */
function yearlyWage(r: UnifiedCase): number | null {
  if (r.wage === null) return null;
  return r.wageUnit ? annualised(r.wage, r.wageUnit) : r.wage;
}

/**
 * An order over the merged rows. A row without the sort key goes last in both
 * directions: "no wage published" is not a low wage, and ranking it first in an
 * ascending sort would read as one.
 */
export function compareBy(order: SearchOrder): (a: UnifiedCase, b: UnifiedCase) => number {
  if (order === "filed-desc") return byNewestFiling;
  const [key, dir] = order.split("-") as ["filed" | "decided" | "wage" | "days", "asc" | "desc"];
  const get = (r: UnifiedCase): string | number | null =>
    key === "filed" ? r.filedOn : key === "decided" ? r.decidedOn : key === "wage" ? yearlyWage(r) : r.days;
  const sign = dir === "asc" ? 1 : -1;
  return (a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return a.caseNumber < b.caseNumber ? 1 : -1;
    if (x === null) return 1;
    if (y === null) return -1;
    if (x !== y) return (x < y ? -1 : 1) * sign;
    return a.caseNumber < b.caseNumber ? 1 : -1;
  };
}

async function finish(
  collected: UnifiedCase[],
  args: UnifiedSearchArgs,
  capped: boolean,
  windowed: boolean,
  skipped: SkippedSources,
  permOnly: string[] = [],
  lcaOnly: string[] = [],
): Promise<UnifiedSearchResult> {
  const all = dedupeToOnePerCase(collected);
  const order = args.order ?? "filed-desc";
  all.sort(compareBy(order));
  const take = Math.min(Math.max(1, Math.floor(args.limit ?? UNIFIED_MAX)), UNIFIED_MAX);
  // Older filings carry employer and law-firm slugs no page answers (a FY2016
  // firm, a wage request's employer): keep only the ones that link somewhere.
  const rows = await keepLinkableSlugs(
    all.slice(0, take),
    (r) => r.firmSlug,
    (r) => ({ ...r, firmSlug: null }),
  );
  await addSeenDecided(rows);
  const counts: Record<Program, number> = { perm: 0, pwd: 0, lca: 0, seasonal: 0 };
  for (const r of rows) counts[r.program] += 1;
  return {
    rows,
    counts,
    truncated: all.length > take,
    capped,
    windowed,
    skipped,
    permOnly,
    lcaOnly,
    order,
    orderScope: capped || all.length > take ? "fetched" : "complete",
    lead: args.lead,
  };
}

/**
 * A case number is answered by two primary-key point reads, not by six.
 *
 * DOL draws every foreign-labor case number from one serial counter and tells
 * the programs apart by the letter, so the prefix already says which pair of
 * tables holds it. The program chips are deliberately ignored: the number IS
 * the query, and the page turns those chips off with that reason showing
 * rather than letting a stale chip hide the case somebody just pasted.
 */
async function searchOneCase(args: UnifiedSearchArgs): Promise<UnifiedSearchResult> {
  const found = await lookupUnifiedCase(args.lead.value);
  const collected: UnifiedCase[] = [];
  if (found.permPublished) collected.push(fromPermPublished(found.permPublished));
  if (found.permLive) collected.push(fromPermLive(found.permLive));
  if (found.flagPublished) collected.push(fromFlagDisclosed(found.flagPublished, found.program));
  if (found.flagLive) collected.push(fromFlagLive(found.flagLive, found.program));
  return await finish(collected, args, false, false, { live: false, published: false, because: [] });
}

export async function unifiedSearch(args: UnifiedSearchArgs): Promise<UnifiedSearchResult> {
  if (args.lead.kind === "case") return searchOneCase(args);

  // OLDEST-DECIDED FIRST IS THE ONE ORDER THE READS THEMSELVES CHANGE FOR: the
  // published PERM index serves it in either direction, so the sources start
  // from the oldest decision rather than handing back the newest and sorting
  // those. Every other order rearranges what the sources returned.
  const narrow: UnifiedNarrow =
    args.order === "decided-asc" ? { ...args.narrow, decidedOrder: "asc" } : (args.narrow ?? {});
  const skipped = skippedSources(narrow, args.lead);
  const want = new Set<Program>(args.programs?.length ? args.programs : PROGRAMS);
  const employer = args.lead.kind === "employer" ? args.lead.value : null;
  const stage: { status: string; program: Program } | null =
    args.lead.kind === "stage"
      ? { status: args.lead.value, program: args.lead.program }
      : (narrow.stage ?? null);

  // THE PROGRAM CHIPS APPLY TO EVERY LEAD. DOL publishes
  // `LAWFIRM_NAME_BUSINESS_NAME` for all three programs and the wage-request
  // and LCA tables carry it (about nine in ten wage-request rows and three in
  // four LCA rows name a firm), so the chips choose between three real
  // sources for a firm exactly as they do for a state.
  // A stage is a PERM status, so a stage search reads PERM whatever the program chips say.
  // A FILTER ONLY PUBLISHED PERM CARRIES rules the other programs out: their
  // tables here have no industry, city or worker column, so reading them would
  // return rows the filter never touched. The answer names the filters.
  const permOnly = permOnlyFilters(narrow);
  // And the other way: a prevailing wage source exists only in the LCA file.
  const lcaOnly = lcaOnlyFilters(narrow);
  const wanted = (p: Program) =>
    want.has(p) &&
    (stage === null || p === stage.program) &&
    (permOnly.length === 0 || p === "perm") &&
    (lcaOnly.length === 0 || p === "lca");
  const askPublished = (p: Program) => wanted(p) && !skipped.published;
  const askLive = (p: Program) => wanted(p) && !skipped.live && (employer !== null || stage !== null);


  const flagLive = (p: FlagProgramKey) =>
    askLive(p) && stage !== null && employer === null
      ? readFlagStage(p, stage.status, narrow, stageLimit(args.limit)).catch(none<FlagCaseRow>)
      : askLive(p) && stage !== null && employer !== null
        ? readFlagEmployerStage(p, employer, stage.status, narrow, stageLimit(args.limit)).catch(none<FlagCaseRow>)
        : askLive(p) && employer
          ? readFlagLive(p, employer, narrow, PER_SOURCE).catch(none<FlagCaseRow>)
          : none<FlagCaseRow>();
  // EVERY LEAD THAT REACHES HERE REACHES THE FLAG TABLES: the types rule out
  // a case-number lead arriving at all, so no guard is needed.
  const flagPublished = (p: FlagProgramKey) =>
    askPublished(p)
      ? readFlagPublished(p, args.lead, narrow, PER_SOURCE).catch(none<FlagDisclosedRow>)
      : none<FlagDisclosedRow>();

  // Every read is caught individually: one program's table being unavailable
  // should narrow the answer, never blank the page.
  const [permPub, permLive, pwdLive, pwdPub, lcaLive, lcaPub, seasonalLive, seasonalPub] = await Promise.all([
    askPublished("perm")
      ? readPermPublished({ lead: args.lead, narrow, limit: PER_SOURCE }).catch(none<PermSearchRow>)
      : none<PermSearchRow>(),
    // Three shapes of the live PERM read: a stage on its own, an employer
    // narrowed to a stage, or the employer's whole live slice.
    // A stage search has one source, so it may fill the whole answer rather
    // than one source's share of it.
    askLive("perm") && stage !== null && employer === null
      ? readPermStage(stage.status, narrow, stageLimit(args.limit)).catch(none<LiveCaseRow>)
      : askLive("perm") && stage !== null && employer !== null
        ? readPermEmployerStage(employer, stage.status, narrow, stageLimit(args.limit)).catch(none<LiveCaseRow>)
        : askLive("perm") && employer
          ? readPermLive(employer, narrow, PER_SOURCE).catch(none<LiveCaseRow>)
          : none<LiveCaseRow>(),
    flagLive("pwd"),
    flagPublished("pwd"),
    flagLive("lca"),
    flagPublished("lca"),
    // H-2A, H-2B and CW-1: the live record and DOL's quarterly files, which
    // share one table (`seasonal_cases`), so a state, occupation or firm lead
    // reaches them like any program's published half.
    flagLive("seasonal"),
    flagPublished("seasonal"),
  ]);

  const collected = [
    ...permPub.rows.map(fromPermPublished),
    ...permLive.rows.map(fromPermLive),
    ...pwdPub.rows.map((r) => fromFlagDisclosed(r, "pwd")),
    ...pwdLive.rows.map((r) => fromFlagLive(r, "pwd")),
    ...lcaPub.rows.map((r) => fromFlagDisclosed(r, "lca")),
    ...lcaLive.rows.map((r) => fromFlagLive(r, "lca")),
    ...seasonalLive.rows.map((r) => fromFlagLive(r, "seasonal")),
    ...seasonalPub.rows.map((r) => fromFlagDisclosed(r, "seasonal")),
  ];

  const halves = [permPub, permLive, pwdPub, pwdLive, lcaPub, lcaLive, seasonalLive, seasonalPub];
  const capped = halves.some((half) => half.rows.length >= PER_SOURCE);
  // At least one source applied its filters inside a window of this
  // employer's newest filings rather than over everything they have filed.
  // Different claim from `capped`, and a much more important one to print.
  const windowed = halves.some((half) => half.windowed);

  return await finish(collected, args, capped, windowed, skipped, permOnly, lcaOnly);
}
