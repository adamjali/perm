import "server-only";

import { shownApprovalRate, shownMedian } from "@/lib/entityPayload";
import { ANY, finderSql, type FinderFilters } from "../sponsorFinder";
import { one, rows } from "./client";
import { occupationChoices, type OccupationChoice } from "./nameSuggest";

/**
 * The sponsor finder's reads: the job a reader typed, then a count and one
 * page over `sponsor_jobs` joined to `sponsor_index`. Null when the tables
 * aren't built yet, so the page says so instead of showing an empty list.
 */

/** Other jobs offered beside the one picked, for "not this one?". */
const JOB_CHOICES = 4;

export type JobPick =
  | { kind: "any" }
  | { kind: "job"; slug: string; title: string; soc: string; others: OccupationChoice[] }
  | { kind: "unknown"; text: string };

/**
 * The occupation a job box names, and the next closest offered beside it:
 * the site's one occupation resolver (`occupationChoices`), which the case
 * search's occupation box reads too.
 */
export async function resolveJob(text: string): Promise<JobPick> {
  if (!text) return { kind: "any" };
  const [top, ...others] = await occupationChoices(text, JOB_CHOICES + 1);
  if (!top) return { kind: "unknown", text };
  return { kind: "job", slug: top.slug, title: top.name, soc: top.soc, others };
}

export interface FinderRow {
  slug: string;
  name: string;
  /** The state these figures are for, or the employer's own when every state is. */
  state: string | null;
  sector: string | null;
  capExempt: boolean;
  debarred: boolean;
  /** Every case still with DOL: no published record yet. */
  liveOnly: boolean;
  recent: number;
  waiting: number;
  latestFiled: string | null;
  lca24m: number;
  transferShare: number | null;
  filed: number;
  decided: number;
  /** Null under the employer page's own floors. */
  rate: number | null;
  medianWage: number | null;
  medianDays: number | null;
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

export async function findSponsors(f: FinderFilters, soc: string): Promise<{ total: number; rows: FinderRow[] } | null> {
  const q = finderSql(f, soc);
  try {
    const [count, page] = await Promise.all([
      one<{ n: number | string }>(q.count, q.args),
      rows<Record<string, unknown>>(q.page, q.pageArgs),
    ]);
    return {
      total: Number(count?.n ?? 0),
      rows: page.map((r) => {
        const tally = { certified: Number(r.certified ?? 0), denied: Number(r.denied ?? 0) };
        return {
          slug: String(r.slug),
          name: String(r.name),
          state: str(r.state === ANY ? r.home_state : r.state),
          sector: str(r.sector_label),
          capExempt: Number(r.cap_exempt) === 1,
          debarred: Number(r.debarred) === 1,
          liveOnly: Number(r.live_only) === 1,
          recent: Number(r.perm_recent ?? 0),
          waiting: Number(r.pending_now ?? 0),
          latestFiled: str(r.latest_filed),
          lca24m: Number(r.lca_24m ?? 0),
          transferShare: num(r.transfer_share),
          filed: Number(r.filed ?? 0),
          decided: tally.certified + tally.denied,
          rate: shownApprovalRate(tally),
          medianWage: shownMedian(num(r.median_wage), tally),
          medianDays: shownMedian(num(r.median_days), tally),
        };
      }),
    };
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
}
