import "server-only";

import {
  searchCases,
  searchLiveCases,
  type LiveCaseRow,
  type PermCaseRow,
} from "./cases";
import { searchPwdCases, searchPwdDeterminations } from "./pwdCases";
import { searchLcaCases, searchLcaDisclosed } from "./lcaCases";
import type { FlagCaseRow, FlagDisclosedRow } from "./flagCases";

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
 * The lookup already unifies: one box takes `G-`, `A-`, `P-` or `I-` and works
 * the program out from the prefix. This is the same idea for search.
 *
 * Six reads run in parallel, two per program, because each program has a
 * published half (decided, from DOL's quarterly files, carries the wage) and a
 * live half (from the daily check, the only record of anything pending).
 * Each is an indexed employer-slug range with its own row cap, so the whole
 * thing is bounded by construction rather than by hope.
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
}

export interface UnifiedSearchArgs {
  text: string;
  title?: string;
  from?: string;
  to?: string;
  programs?: readonly Program[];
  limit?: number;
}

export const UNIFIED_MAX = 300;
const PER_SOURCE = 100;

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
}

export async function unifiedSearch(args: UnifiedSearchArgs): Promise<UnifiedSearchResult> {
  const want = new Set<Program>(args.programs?.length ? args.programs : PROGRAMS);
  const narrow = {
    ...(args.title ? { title: args.title } : {}),
    ...(args.from ? { from: args.from } : {}),
    ...(args.to ? { to: args.to } : {}),
  };
  const none = <T,>(): Promise<T[]> => Promise.resolve([]);

  // Every read is caught individually: one program's table being unavailable
  // should narrow the answer, never blank the page.
  const [permPub, permLive, pwdLive, pwdPub, lcaLive, lcaPub] = await Promise.all([
    want.has("perm")
      ? searchCases({ field: "employer", text: args.text, limit: PER_SOURCE, ...narrow }).catch(none<PermCaseRow>)
      : none<PermCaseRow>(),
    want.has("perm")
      ? searchLiveCases(args.text, { limit: PER_SOURCE, ...narrow }).catch(none<LiveCaseRow>)
      : none<LiveCaseRow>(),
    want.has("pwd")
      ? searchPwdCases({ text: args.text, limit: PER_SOURCE, ...narrow }).catch(none<FlagCaseRow>)
      : none<FlagCaseRow>(),
    want.has("pwd")
      ? searchPwdDeterminations({ text: args.text, limit: PER_SOURCE, ...narrow }).catch(none<FlagDisclosedRow>)
      : none<FlagDisclosedRow>(),
    want.has("lca")
      ? searchLcaCases({ text: args.text, limit: PER_SOURCE, ...narrow }).catch(none<FlagCaseRow>)
      : none<FlagCaseRow>(),
    want.has("lca")
      ? searchLcaDisclosed({ text: args.text, limit: PER_SOURCE, ...narrow }).catch(none<FlagDisclosedRow>)
      : none<FlagDisclosedRow>(),
  ]);

  const all = dedupeToOnePerCase([
    ...permPub.map(fromPermPublished),
    ...permLive.map(fromPermLive),
    ...pwdPub.map((r) => fromFlagDisclosed(r, "pwd")),
    ...pwdLive.map((r) => fromFlagLive(r, "pwd")),
    ...lcaPub.map((r) => fromFlagDisclosed(r, "lca")),
    ...lcaLive.map((r) => fromFlagLive(r, "lca")),
  ]);

  // Newest filing first, then case number, so the order is total and a page of
  // results cannot shuffle between identical requests.
  all.sort((a, b) => {
    const x = a.filedOn ?? "";
    const y = b.filedOn ?? "";
    if (x !== y) return x < y ? 1 : -1;
    return a.caseNumber < b.caseNumber ? 1 : -1;
  });

  const take = Math.min(Math.max(1, Math.floor(args.limit ?? UNIFIED_MAX)), UNIFIED_MAX);
  const rows = all.slice(0, take);

  const counts: Record<Program, number> = { perm: 0, pwd: 0, lca: 0 };
  for (const r of rows) counts[r.program] += 1;

  const capped = [permPub, permLive, pwdPub, pwdLive, lcaPub, lcaLive].some(
    (half) => half.length >= PER_SOURCE,
  );

  return { rows, counts, truncated: all.length > take, capped };
}
