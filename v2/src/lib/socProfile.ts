/**
 * One SOC code as the signed-in app and the public pages show it: O*NET's description of the job, the tasks
 * that make it up, its Job Zone, how employers title it in DOL's files, and its PERM figures. Read by
 * `socProfile` (`src/lib/db/socProfile.ts`), served at `/api/soc/<code>`.
 *
 * Plain module: the browser needs the type and the text builder, the server the read.
 */

export interface SocProfileTitle {
  title: string;
  /** Filings DOL's files hold under this title and this code. */
  filings: number;
  /** Its share of the code's filings. */
  share: number;
  /** The title's own page, /soc-codes/<slug>, when it has one. */
  href: string | null;
}

export interface SocProfileFigures {
  /** PERM cases DOL has published for the job. */
  filings: number;
  /** Certified and denied together: the count the rate and the median rest on. */
  decided: number;
  /** Of those, certified: with `decided`, what `formatShareOf` prints as the rate. */
  certified: number;
  /** Certified over decided, or null under the site's floor (MIN_DECIDED_FOR_RATE). */
  approvalRate: number | null;
  /** The median yearly wage offered, or null under MIN_DECIDED_FOR_MEDIAN. */
  medianWage: number | null;
}

export interface SocProfile {
  /** `15-1252`. */
  soc: string;
  title: string;
  /** O*NET's description of the job; null when O*NET doesn't describe the code. */
  description: string | null;
  /** O*NET's core tasks, most important first. */
  tasks: string[];
  jobZone: number | null;
  /** "4", or "1-2" (O*NET merges the first two zones). */
  zoneLabel: string | null;
  /** "Considerable preparation needed". */
  zoneName: string | null;
  /** The O*NET release the text comes from, for the credit line. */
  onetVersion: string | null;
  /** The code's page on this site: its occupation page, or the wage-level tool when it has none. */
  href: string;
  /** Null when the job has no occupation page (no PERM case DOL has published under it). */
  figures: SocProfileFigures | null;
  /** Filings under the code in DOL's PERM, wage request and LCA files together: what each title's share is of. */
  codeFilings: number;
  /** The titles employers filed most under the code, busiest first. */
  titles: SocProfileTitle[];
}

/** How many filed titles the profile carries. */
export const PROFILE_TITLES = 5;

/** How many of O*NET's tasks show before the rest fold away, on a code's page and in the suggested description. */
export const SHOWN_TASKS = 6;

/**
 * A starting job description from the code's profile: O*NET's description, a blank line, then one task a line
 * starting "- ", in the order chosen. Pure. Nothing about the job's requirements is written: an employer's
 * minimum requirements are its own, and O*NET's Job Zone is shown beside the text, never put in it.
 */
export function buildSocDescription(description: string | null, tasks: readonly string[]): string {
  const lead = (description ?? "").trim();
  const lines = tasks.map((t) => t.trim()).filter(Boolean).map((t) => `- ${t}`);
  return [lead, lines.join("\n")].filter(Boolean).join("\n\n");
}

/** Where a suggestion goes when the case already has words: after them, or in their place. */
export type PlaceHow = "append" | "replace";

/** The job description after a suggestion is placed. An empty description is always filled. Pure. */
export function placeDescription(current: string, suggestion: string, how: PlaceHow): string {
  const kept = current.trim();
  if (!kept || how === "replace") return suggestion;
  return `${kept}\n\n${suggestion}`;
}
