/**
 * Every estimate the site gives, and how its own check came out, as rows for the public scorecard and the guides
 * that explain the estimates (owner, Nov 4 2026: "update it as needed with all the stuff we track").
 *
 * Each row comes from a check the site runs on its own record: the nightly PERM backtest (cases in DOL's line,
 * cases the line has passed, cases at an RFI, the range near the front), the nightly wage-request backtest, the
 * weekly visa bulletin backtest and the weekly H-2A, H-2B and CW-1 backtest. A check with nothing to quote yet is
 * left out, never shown as a zero.
 *
 * WHAT'S NEVER HERE. The head-to-head with other trackers, and next month's bulletin cutoff guess (the site doesn't
 * predict cutoffs): both stay on the admin page.
 *
 * Plain module, pure functions: the readers live in src/lib/db, and every number is checked before it's used,
 * because these docs are written by Python and a renamed field must read as "no check", not as NaN.
 */

import { formatInt, formatShare } from "@/lib/format";
import { longDate } from "@convex/lib/months";

export interface CheckRow {
  key: "perm-line" | "perm-range" | "perm-passed" | "perm-rfi" | "pwd-day" | "bulletin" | "h2a" | "h2b" | "cw1";
  /** What's estimated, as a reader would ask it. */
  estimate: string;
  /** The result, short: "3 days", "87% within a week". */
  result: string;
  /** What it was checked on, with its days. */
  basis: string;
}

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const share = (x: unknown): number | null => {
  const n = num(x);
  return n !== null && n >= 0 && n <= 1 ? n : null;
};
const days = (n: number, unit = "day") => `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? unit : `${unit}s`}`;
const day = (iso: unknown) => (typeof iso === "string" ? (longDate(iso) ?? iso) : null);

/** A check's cell as the Python backtests write it; every field is checked before it's used. */
type Cell = { decided?: unknown; typicalMissDays?: unknown; within7Share?: unknown };

export interface ChecksInput {
  /** perm_docs['estimator_backtest'] as read (src/lib/db/predictions.ts). */
  perm?: {
    t0?: unknown;
    end?: unknown;
    current?: { decided?: unknown; typicalMissDays?: unknown; within7Share?: unknown } | null;
    passed?: { rate?: Cell | null; dolAverage?: Cell | null } | null;
    rfiClock?: { test?: (Cell & { insideShare?: unknown }) | null } | null;
  } | null;
  /** The printed range near the front (printedRangeCheck in src/lib/rangeCoverage.ts). */
  range?: { share: number; judged: number; kind: "out-of-sample" | "in-sample" | "pace-rule" } | null;
  /** The wage-request day's newest tested start day (src/lib/pwdDay.ts `tested`). */
  pwd?: { decided: number; typicalMissDays: number; within7Share: number | null; through: string } | null;
  /** The bulletin backtest a year past the cutoff (src/lib/bulletinCheck.ts, gap 365). */
  bulletin?: { readers: number; reached: number; typicalMissMonths: number; withinQuarterShare: number } | null;
  /** The seasonal backtest per visa (src/lib/seasonalTiming.ts `SeasonalCheck`). */
  seasonal?: Partial<Record<"H-2A" | "H-2B" | "CW-1", { share: number; cases: number }>> | null;
}

/** "from October 14 to November 3, 2026", with both years when the span crosses one. */
export function dayRange(from: string, to: string): string {
  const a = longDate(from) ?? from;
  const b = longDate(to) ?? to;
  return from.slice(0, 4) === to.slice(0, 4) ? `from ${a.replace(/, \d{4}$/, "")} to ${b}` : `from ${a} to ${b}`;
}

/** The PERM rows, for a guide about PERM dates alone. */
export const PERM_CHECKS: readonly CheckRow["key"][] = ["perm-line", "perm-range", "perm-passed", "perm-rfi"];

export function estimateChecks(input: ChecksInput): CheckRow[] {
  const out: CheckRow[] = [];
  const p = input.perm ?? null;
  const t0 = day(p?.t0);
  const end = day(p?.end);

  const cur = p?.current ?? null;
  const curMiss = num(cur?.typicalMissDays);
  const curDecided = num(cur?.decided);
  if (curMiss !== null && curDecided !== null && curDecided > 0 && t0 && end) {
    const w = share(cur?.within7Share);
    out.push({
      key: "perm-line",
      estimate: "When DOL decides a PERM case waiting in its line",
      result: `${days(curMiss)} typically${w !== null ? `, ${formatShare(w)} within a week` : ""}`,
      basis: `${formatInt(curDecided)} cases DOL decided ${dayRange(String(p?.t0), String(p?.end))}, each dated as the line stood on the first day`,
    });
  }

  const r = input.range ?? null;
  if (r && share(r.share) !== null && r.judged > 0) {
    out.push({
      key: "perm-range",
      estimate: "The range given with that date, near the front of the line",
      result: `${formatShare(r.share)} decided inside it`,
      basis:
        r.kind === "out-of-sample"
          ? `${formatInt(r.judged)} cases, tested on start days the range wasn't drawn from`
          : r.kind === "in-sample"
            ? `${formatInt(r.judged)} recent cases, the ones the range was measured on`
            : `${formatInt(r.judged)} cases dated a week or more before the check's last day`,
    });
  }

  const rate = p?.passed?.rate ?? null;
  const dol = p?.passed?.dolAverage ?? null;
  const rateMiss = num(rate?.typicalMissDays);
  const rateDecided = num(rate?.decided);
  if (rateMiss !== null && rateDecided !== null && rateDecided > 0) {
    const dolMiss = num(dol?.typicalMissDays);
    out.push({
      key: "perm-passed",
      estimate: "When DOL decides a PERM case its line has already passed",
      result: `${days(rateMiss)} typically${dolMiss !== null ? `, where DOL's own average was ${days(dolMiss)} off` : ""}`,
      basis: `${formatInt(rateDecided)} such cases DOL decided${t0 && end ? ` ${dayRange(String(p?.t0), String(p?.end))}` : ""}`,
    });
  }

  const rfi = p?.rfiClock?.test ?? null;
  const rfiMiss = num(rfi?.typicalMissDays);
  const rfiDecided = num(rfi?.decided);
  if (rfiMiss !== null && rfiDecided !== null && rfiDecided > 0) {
    const inside = share(rfi?.insideShare);
    out.push({
      key: "perm-rfi",
      estimate: "When DOL decides a PERM case after an RFI",
      result: `${days(rfiMiss)} typically${inside !== null ? `, ${formatShare(inside)} inside the range` : ""}`,
      basis: `${formatInt(rfiDecided)} RFI cases DOL decided, dated from their own RFI day`,
    });
  }

  const pwd = input.pwd ?? null;
  if (pwd && pwd.decided > 0) {
    out.push({
      key: "pwd-day",
      estimate: "When DOL issues a prevailing wage determination",
      result: `${days(pwd.typicalMissDays)} typically${pwd.within7Share !== null ? `, ${formatShare(pwd.within7Share)} within a week` : ""}`,
      basis: `${formatInt(pwd.decided)} requests DOL decided through ${day(pwd.through)}`,
    });
  }

  const b = input.bulletin ?? null;
  if (b && b.readers > 0) {
    out.push({
      key: "bulletin",
      estimate: "When a priority date a year past the cutoff becomes current",
      result: `${days(b.typicalMissMonths, "month")} typically, ${formatShare(b.withinQuarterShare)} within a quarter`,
      basis: `${formatInt(b.readers)} dates replayed on every visa bulletin since October 2016`,
    });
  }

  const s = input.seasonal ?? null;
  for (const [visa, key] of [["H-2A", "h2a"], ["H-2B", "h2b"], ["CW-1", "cw1"]] as const) {
    const c = s?.[visa];
    if (c && share(c.share) !== null && c.cases > 0) {
      out.push({
        key,
        estimate: `When DOL decides ${visa === "CW-1" ? "a" : "an"} ${visa} application`,
        result: `${formatShare(c.share)} inside the window's middle half`,
        basis: `${formatInt(c.cases)} certifications, each dated from DOL's earlier ones`,
      });
    }
  }
  return out;
}
