/**
 * Where each review stage leads, from the moves our own sweep saw, and how the
 * RFIs it watched DOL issue stand now.
 *
 * A plain module (no `server-only`) so the unit project tests it; the page reads
 * the doc through `src/lib/db/stageStats.ts`. Every figure is a count of status
 * changes our sweep recorded since its event log opened in late August 2026, of
 * every PERM case, not a watch list. Destinations only: a stage's exits are
 * counted whether or not we saw the case arrive, which is right for "where it
 * goes" and says nothing about how long it stays (that's `stageDurationFor`).
 */

import { prettyStatus } from "@/lib/statusTone";

export interface Move {
  from: string;
  to: string;
  n: number;
}

/** What a destination means for the case, as a chart colour's meaning. */
export type MoveTone = "good" | "line" | "bad" | "withdrawn" | "aside" | "other";

const TONE: Record<string, MoveTone> = {
  CERTIFIED: "good",
  "ANALYST REVIEW": "line",
  "IN PROCESS": "line",
  DENIED: "bad",
  "NORD ISSUED": "bad",
  "DENIED - BALCA DISMISSED": "bad",
  "DENIED - BALCA AFFIRMED": "bad",
  WITHDRAWN: "withdrawn",
  "RECONSIDERATION APPEALS": "aside",
  "BALCA APPEALS": "aside",
  "REQUEST FOR REVIEW": "aside",
  "APPLICATION ON HOLD": "aside",
  "RFI ISSUED": "aside",
  "PENDING AUDIT RESPONSE": "aside",
};

/** The chart fill for each tone (the soft chart tokens in globals.css). */
export const MOVE_FILL: Record<MoveTone, string> = {
  good: "bg-chart-green",
  line: "bg-chart-yellow",
  bad: "bg-chart-red",
  withdrawn: "bg-chart-orange",
  aside: "bg-chart-blue",
  other: "bg-chart-sage",
};

const LABEL: Record<string, string> = {
  "ANALYST REVIEW": "Back to analyst review",
  "IN PROCESS": "Back in process",
  CERTIFIED: "Certified",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
  "NORD ISSUED": "NORD issued",
  "RECONSIDERATION APPEALS": "Reconsideration requested",
  "BALCA APPEALS": "Appealed to BALCA",
  "REQUEST FOR REVIEW": "Request for review",
  "APPLICATION ON HOLD": "Put on hold",
  "RFI ISSUED": "RFI issued",
  "PENDING AUDIT RESPONSE": "Audit",
  "DENIED - BALCA DISMISSED": "Denied, BALCA dismissed",
  "DENIED - BALCA AFFIRMED": "Denied, BALCA affirmed",
  "CERTIFIED - EXPIRED": "Certification expired",
};

export function moveLabel(status: string): string {
  return LABEL[status.trim().toUpperCase()] ?? prettyStatus(status);
}

export function moveTone(status: string): MoveTone {
  return TONE[status.trim().toUpperCase()] ?? "other";
}

export interface MoveRow {
  to: string;
  label: string;
  n: number;
  share: number;
  tone: MoveTone;
}

/** Fewer moves than this out of a stage and its shares are an anecdote. */
export const MIN_MOVES = 20;
/** A destination under this share folds into "Somewhere else". */
const MINOR_SHARE = 0.02;

/** Where cases leaving `from` went, largest first, or null with too few moves. */
export function movesFrom(exits: readonly Move[], from: string): { total: number; rows: MoveRow[] } | null {
  const key = from.trim().toUpperCase();
  const out = exits.filter((m) => m.from.trim().toUpperCase() === key && m.to.trim().toUpperCase() !== key && m.n > 0);
  const total = out.reduce((n, m) => n + m.n, 0);
  if (total < MIN_MOVES) return null;
  const rows: MoveRow[] = [];
  let other = 0;
  for (const m of [...out].sort((a, b) => b.n - a.n)) {
    const share = m.n / total;
    if (share < MINOR_SHARE && out.length > 3) {
      other += m.n;
      continue;
    }
    rows.push({ to: m.to, label: moveLabel(m.to), n: m.n, share, tone: moveTone(m.to) });
  }
  if (other > 0) rows.push({ to: "OTHER", label: "Somewhere else", n: other, share: other / total, tone: "other" });
  return { total, rows };
}

/**
 * Motions to reconsider, decided: granted (certified outright, or sent back
 * into review or on hold) against refused (a NORD or a denial). A move to BALCA
 * or a request for review is neither and is left out of both.
 */
export function reconsiderationOutcome(
  exits: readonly Move[],
): { decided: number; granted: number; refused: number; grantedShare: number } | null {
  const GRANTED = new Set(["CERTIFIED", "ANALYST REVIEW", "IN PROCESS", "APPLICATION ON HOLD"]);
  let granted = 0;
  let refused = 0;
  for (const m of exits) {
    if (m.from.trim().toUpperCase() !== "RECONSIDERATION APPEALS") continue;
    const to = m.to.trim().toUpperCase();
    if (GRANTED.has(to)) granted += m.n;
    else if (to === "NORD ISSUED" || to.startsWith("DENIED")) refused += m.n;
  }
  const decided = granted + refused;
  if (decided < MIN_MOVES) return null;
  return { decided, granted, refused, grantedShare: granted / decided };
}

export interface OutcomeCounts {
  certified: number;
  denied: number;
  withdrawn: number;
  other: number;
}

/** The RFIs our sweep watched DOL issue (`stage_stats.rfiPath`). */
export interface RfiPath {
  /** The first day counted, `YYYY-MM-DD`: an RFI already open before it has no known start. */
  since: string | null;
  entered: number;
  inRfi: number;
  repliedWaiting: number;
  decided: OutcomeCounts;
  /** Decided after the case left RFI for review (the reply was in). */
  afterReply: OutcomeCounts;
}

const count = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null);

function outcomes(x: unknown): OutcomeCounts | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const c = count(o.certified);
  const d = count(o.denied);
  const w = count(o.withdrawn);
  const r = count(o.other) ?? 0;
  return c === null || d === null || w === null ? null : { certified: c, denied: d, withdrawn: w, other: r };
}

export function sumOutcomes(o: OutcomeCounts): number {
  return o.certified + o.denied + o.withdrawn + o.other;
}

/** The doc's RFI path, or null when it's missing or doesn't add up. */
export function parseRfiPath(x: unknown): RfiPath | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const entered = count(o.entered);
  const inRfi = count(o.inRfi);
  const repliedWaiting = count(o.repliedWaiting);
  const decided = outcomes(o.decided);
  const afterReply = outcomes(o.afterReply);
  if (entered === null || inRfi === null || repliedWaiting === null || !decided || !afterReply) return null;
  // Every RFI sits in exactly one place; a doc that doesn't add up isn't shown.
  if (inRfi + repliedWaiting + sumOutcomes(decided) !== entered) return null;
  if (sumOutcomes(afterReply) > sumOutcomes(decided)) return null;
  return {
    since: typeof o.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.since) ? o.since : null,
    entered,
    inRfi,
    repliedWaiting,
    decided,
    afterReply,
  };
}
