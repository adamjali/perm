/**
 * The wage request to PERM match: after DOL issues a PERM job's prevailing
 * wage, the PERM application that follows it comes from the same employer for
 * the same job, filed after the wage was issued. DOL's live record of a
 * pending PERM names neither the worker nor which wage request it uses (DOL's
 * published file names the wage request only once the case is decided), so a
 * match is a possibility, and every email that reports one says so.
 *
 * Measured on Oct 16 2026 over 10,547 PERM-job wage requests DOL issued from
 * Aug 26 to Sep 25 2026: 566 had exactly one PERM from the same employer with
 * the same job title filed since, 118 had two, 67 three, and 188 more than
 * three (big employers filing one title many times). More than three can't
 * point at anyone, so `pickCandidates` sends nothing there.
 *
 * Titles are compared after `normaliseTitle`: case, punctuation, the common
 * abbreviations, plural endings and word order don't count; a bracketed or
 * parenthesised code counts only when both titles carry one. DOL's files show
 * why: "Senior Software Engineer [*AID060]" and "[*AID010]" are two
 * requisitions, while "IT Manager (DBA)" and "IT Manager" are one job written
 * twice.
 *
 * @module convex/lib/pipelineMatch
 */

/** Possible PERMs told per wage request, newest first, ever. */
export const MATCH_CAP = 3;
/** More title matches than this since the wage was issued: no signal, send nothing. */
export const MATCH_AMBIGUOUS_OVER = 3;

const ABBREVIATIONS: Record<string, string> = {
  sr: "senior",
  snr: "senior",
  jr: "junior",
  mgr: "manager",
  eng: "engineer",
  engr: "engineer",
  dev: "developer",
  assoc: "associate",
  asst: "assistant",
  dir: "director",
  admin: "administrator",
  spec: "specialist",
  tech: "technical",
  vp: "vice president",
  svp: "senior vice president",
  avp: "assistant vice president",
};

export interface NormalisedTitle {
  /** The words, normalised and sorted, joined by spaces. Empty when nothing is left. */
  base: string;
  /** The bracketed or parenthesised codes, normalised. */
  tags: string[];
}

function words(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/&/g, " and ").toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw) continue;
    for (const w of (ABBREVIATIONS[raw] ?? raw).split(" ")) {
      // "Analysts" and "Analyst" are one job; a short word ("sales", "ios") is left alone.
      out.push(w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
    }
  }
  return out;
}

export function normaliseTitle(title: string | null | undefined): NormalisedTitle {
  if (!title) return { base: "", tags: [] };
  const tags: string[] = [];
  const stripped = title.replace(/\[([^\]]*)\]|\(([^)]*)\)/g, (_m, sq: string | undefined, pa: string | undefined) => {
    const tag = words(sq ?? pa ?? "").join(" ");
    if (tag) tags.push(tag);
    return " ";
  });
  return { base: [...words(stripped)].sort().join(" "), tags };
}

/** Same job title, for this purpose. See the module note for the rules. */
export function titlesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normaliseTitle(a);
  const y = normaliseTitle(b);
  if (!x.base || x.base !== y.base) return false;
  if (x.tags.length > 0 && y.tags.length > 0) return x.tags.some((t) => y.tags.includes(t));
  return true;
}

export interface PermCandidate {
  caseNumber: string;
  /** "YYYY-MM-DD", DOL's filing day. */
  filingDate: string;
  employerName: string | null;
  jobTitle: string | null;
}

export interface MatchPick {
  /** What to tell now, newest first. */
  send: PermCandidate[];
  /** Every PERM matching the title since the wage, told or not. */
  matched: number;
  /** Too many matches to point at anyone. */
  ambiguous: boolean;
}

/**
 * Which PERM applications to tell a wage request's subscriber about.
 *
 * `rows` are the employer's PERM filings on or after `since` (the day DOL
 * issued the wage), in any order. `told` holds the PERMs this address has
 * already been told about; `watched` the cases it already watches, which it
 * has evidently found.
 */
export function pickCandidates(opts: {
  pwdTitle: string | null | undefined;
  since: string;
  rows: readonly PermCandidate[];
  told: ReadonlySet<string>;
  watched: ReadonlySet<string>;
  toldCount: number;
}): MatchPick {
  const matches = opts.rows
    .filter((r) => r.filingDate >= opts.since && titlesMatch(opts.pwdTitle, r.jobTitle))
    .filter((r, i, all) => all.findIndex((o) => o.caseNumber === r.caseNumber) === i)
    .sort((a, b) => (a.filingDate === b.filingDate ? b.caseNumber.localeCompare(a.caseNumber) : b.filingDate.localeCompare(a.filingDate)));
  const ambiguous = matches.length > MATCH_AMBIGUOUS_OVER;
  const room = Math.max(0, MATCH_CAP - opts.toldCount);
  const send = ambiguous
    ? []
    : matches.filter((r) => !opts.told.has(r.caseNumber) && !opts.watched.has(r.caseNumber)).slice(0, room);
  return { send, matched: matches.length, ambiguous };
}
