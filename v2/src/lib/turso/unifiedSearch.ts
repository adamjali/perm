import "server-only";

import type { LiveCaseRow, PermCaseRow } from "./cases";
import type { FlagCaseRow, FlagDisclosedRow } from "./flagCases";
import {
  SLICE_CAP,
  lookupUnifiedCase,
  readFlagLive,
  readFlagPublished,
  readPermLive,
  readPermPublished,
  type FlagProgramKey,
  type SliceResult,
  type UnifiedNarrow,
} from "./caseSearchReads";

export { SLICE_CAP };
import { PUBLISHED_ONLY_FILTERS, type Lead } from "@/lib/caseSearchPlan";

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
 * route can serve. Only an employer lead reaches all six sources; a firm, state
 * or occupation lead reads DOL's published PERM file alone, because that is the
 * only table carrying an index on those columns.
 *
 * **One row per case.** A case can be in both halves of its program at once.
 */

export type Program = "perm" | "pwd" | "lca";
export const PROGRAMS: readonly Program[] = ["perm", "pwd", "lca"];
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
  firmSlug: string | null;
  /** Published only. */
  socCode: string | null;
  socTitle: string | null;
  /** Published only. Calendar days from filing to decision. */
  days: number | null;
}

export interface UnifiedSearchArgs {
  lead: Lead;
  narrow?: UnifiedNarrow;
  programs?: readonly Program[];
  limit?: number;
}

export const UNIFIED_MAX = 300;
export const PER_SOURCE = 100;

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
const fromPermPublished = (r: PermCaseRow): UnifiedCase => ({
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
  employerSlug: null,
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
  // DOL's wage-request and LCA disclosure files carry no attorney column at
  // all, so this is null by absence, not by omission.
  firmName: null,
  firmSlug: null,
  socCode: r.socCode,
  socTitle: r.socTitle,
  days: null,
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
  /** The lead the server actually used, echoed so the page can name it. */
  lead: Lead;
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
  const labels: Record<string, string> = {
    firm: "law firm",
    state: "worksite state",
    occupation: "occupation",
    fiscalYear: "fiscal year",
    wage: "wage",
  };
  const set: Record<string, boolean> = {
    firm: narrow.firmSlug !== undefined,
    state: narrow.state !== undefined,
    occupation: narrow.socCode !== undefined,
    fiscalYear: narrow.fiscalYear !== undefined,
    wage: narrow.wageMin !== undefined || narrow.wageMax !== undefined,
  };
  for (const key of PUBLISHED_ONLY_FILTERS) {
    if (set[key]) because.push(labels[key] ?? key);
  }
  // An equality lead already reads the published PERM file alone, so the live
  // half is out for the lead itself rather than for anything the reader typed.
  const leadIsPublishedOnly =
    lead.kind === "firm" || lead.kind === "state" || lead.kind === "occupation";
  return {
    live: because.length > 0 || leadIsPublishedOnly,
    published: narrow.outcome === "open",
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

function finish(
  collected: UnifiedCase[],
  args: UnifiedSearchArgs,
  capped: boolean,
  windowed: boolean,
  skipped: SkippedSources,
): UnifiedSearchResult {
  const all = dedupeToOnePerCase(collected);
  all.sort(byNewestFiling);
  const take = Math.min(Math.max(1, Math.floor(args.limit ?? UNIFIED_MAX)), UNIFIED_MAX);
  const rows = all.slice(0, take);
  const counts: Record<Program, number> = { perm: 0, pwd: 0, lca: 0 };
  for (const r of rows) counts[r.program] += 1;
  return {
    rows,
    counts,
    truncated: all.length > take,
    capped,
    windowed,
    skipped,
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
  return finish(collected, args, false, false, { live: false, published: false, because: [] });
}

export async function unifiedSearch(args: UnifiedSearchArgs): Promise<UnifiedSearchResult> {
  if (args.lead.kind === "case") return searchOneCase(args);

  const narrow = args.narrow ?? {};
  const skipped = skippedSources(narrow, args.lead);
  const want = new Set<Program>(args.programs?.length ? args.programs : PROGRAMS);
  const employer = args.lead.kind === "employer" ? args.lead.value : null;

  // THE PROGRAM CHIPS ONLY MEAN SOMETHING UNDER AN EMPLOYER LEAD. A firm,
  // state or occupation lead reads DOL's published PERM file and nothing else,
  // so honouring a chip set of ["pwd"] there would return an empty answer to a
  // search the page had already told the reader was PERM-only. The page turns
  // the chips off for those leads; this makes that structural.
  const wantPerm = args.lead.kind === "employer" ? want.has("perm") : true;
  const askPublished = (p: Program) => want.has(p) && !skipped.published;
  const askLive = (p: Program) => want.has(p) && !skipped.live && employer !== null;

  const flagLive = (p: FlagProgramKey) =>
    askLive(p) && employer
      ? readFlagLive(p, employer, narrow, PER_SOURCE).catch(none<FlagCaseRow>)
      : none<FlagCaseRow>();
  const flagPublished = (p: FlagProgramKey) =>
    askPublished(p) && employer
      ? readFlagPublished(p, employer, narrow, PER_SOURCE).catch(none<FlagDisclosedRow>)
      : none<FlagDisclosedRow>();

  // Every read is caught individually: one program's table being unavailable
  // should narrow the answer, never blank the page.
  const [permPub, permLive, pwdLive, pwdPub, lcaLive, lcaPub] = await Promise.all([
    wantPerm && !skipped.published
      ? readPermPublished({ lead: args.lead, narrow, limit: PER_SOURCE }).catch(none<PermCaseRow>)
      : none<PermCaseRow>(),
    askLive("perm") && employer
      ? readPermLive(employer, narrow, PER_SOURCE).catch(none<LiveCaseRow>)
      : none<LiveCaseRow>(),
    flagLive("pwd"),
    flagPublished("pwd"),
    flagLive("lca"),
    flagPublished("lca"),
  ]);

  const collected = [
    ...permPub.rows.map(fromPermPublished),
    ...permLive.rows.map(fromPermLive),
    ...pwdPub.rows.map((r) => fromFlagDisclosed(r, "pwd")),
    ...pwdLive.rows.map((r) => fromFlagLive(r, "pwd")),
    ...lcaPub.rows.map((r) => fromFlagDisclosed(r, "lca")),
    ...lcaLive.rows.map((r) => fromFlagLive(r, "lca")),
  ];

  const halves = [permPub, permLive, pwdPub, pwdLive, lcaPub, lcaLive];
  const capped = halves.some((half) => half.rows.length >= PER_SOURCE);
  // At least one source applied its filters inside a window of this
  // employer's newest filings rather than over everything they have filed.
  // Different claim from `capped`, and a much more important one to print.
  const windowed = halves.some((half) => half.windowed);

  return finish(collected, args, capped, windowed, skipped);
}
