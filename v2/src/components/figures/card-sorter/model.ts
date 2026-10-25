/**
 * The card sorter's numbers: which pocket each waiting case goes in, and the order a run of cards
 * falls into them. Pure, so the figure and its tests share one source.
 *
 * Every night our sweep asks DOL's case-status search about each case still waiting, 50 numbers a
 * request, and files each one by the status DOL gives back. The drawing runs one batch of cards
 * through a sorter at the shares tonight's record holds, so a pocket that holds 3% of the line gets
 * about 3 cards in 100. Its stacks show the batch, not the totals: the totals are printed beside it.
 */

export type PocketKey = "analyst" | "hold" | "rfi" | "other" | "appeal" | "decided";

export interface SorterPocket {
  key: PocketKey;
  /** Sentence case, as the legend prints it. */
  label: string;
  /** What lands here, in one clause. */
  gloss: string;
  count: number;
}

export interface SorterRun {
  /** Left to right on the machine: the cards travel right to left, the ordinary line farthest. */
  pockets: SorterPocket[];
  /** The pocket each card in the batch falls into, in the order the cards come off the hopper. */
  sequence: number[];
  /** How many cards the batch holds. */
  batch: number;
  /** How many cases the night's pass asked about: every pocket's total. */
  asked: number;
  /** The day the decided pocket counts, ISO. */
  decidedOn: string | null;
}

/** One batch of cards per loop. */
export const BATCH = 100;

const APPEALS = new Set(["RECONSIDERATION APPEALS", "BALCA APPEALS", "REQUEST FOR REVIEW", "DENIED - BALCA DISMISSED"]);

/** Which pocket a pending DOL status belongs in. */
export function pocketOf(status: string): Exclude<PocketKey, "decided"> {
  const s = status.trim().toUpperCase();
  if (s === "ANALYST REVIEW") return "analyst";
  if (s === "APPLICATION ON HOLD") return "hold";
  if (s === "RFI ISSUED") return "rfi";
  if (APPEALS.has(s)) return "appeal";
  return "other";
}

/**
 * Split `total` cards across counts by the largest remainder, so the batch adds up exactly and a
 * pocket's cards are its share rounded the fairest way. A pocket with no cases gets no card.
 */
export function apportion(counts: readonly number[], total: number): number[] {
  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return counts.map(() => 0);
  const exact = counts.map((c) => (c / sum) * total);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, r: e - Math.floor(e) }))
    .filter(({ i }) => counts[i]! > 0)
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]! += 1;
    left -= 1;
  }
  return out;
}

/**
 * The order the cards come off the hopper: each pocket's cards spread as evenly as the batch
 * allows (smooth weighted round robin), so a rare pocket's card turns up mid-run, not in a burst.
 */
export function interleave(cards: readonly number[]): number[] {
  const total = cards.reduce((a, b) => a + b, 0);
  const current = cards.map(() => 0);
  const out: number[] = [];
  for (let n = 0; n < total; n++) {
    let best = -1;
    for (let i = 0; i < cards.length; i++) {
      if (cards[i]! <= 0) continue;
      current[i]! += cards[i]!;
      if (best < 0 || current[i]! > current[best]!) best = i;
    }
    current[best]! -= total;
    out.push(best);
  }
  return out;
}

const META: Record<PocketKey, { label: string; gloss: string }> = {
  analyst: { label: "Analyst review", gloss: "the ordinary line, worked in filing order" },
  hold: { label: "On hold", gloss: "set aside by DOL, often an employer at a time" },
  rfi: { label: "RFI", gloss: "DOL asked the employer for more" },
  other: { label: "Other review", gloss: "a notice of intent to deny, an audit or supervised recruitment" },
  appeal: { label: "Appeal", gloss: "after a denial, at reconsideration or the Board" },
  decided: { label: "Decided", gloss: "certified, denied or withdrawn on DOL's last working day" },
};

const ORDER: PocketKey[] = ["analyst", "hold", "rfi", "other", "appeal", "decided"];

/**
 * The run from the census's pending statuses and the newest working day's decisions. Null when
 * there's nothing waiting: no line, no drawing.
 */
export function buildSorterRun(input: {
  statuses: readonly { status: string; count: number; isFinal: boolean }[];
  decided: number | null;
  decidedOn: string | null;
}): SorterRun | null {
  const counts: Record<PocketKey, number> = { analyst: 0, hold: 0, rfi: 0, other: 0, appeal: 0, decided: Math.max(0, input.decided ?? 0) };
  for (const s of input.statuses) {
    if (s.isFinal || s.count <= 0) continue;
    counts[pocketOf(s.status)] += s.count;
  }
  const waiting = ORDER.filter((k) => k !== "decided").reduce((a, k) => a + counts[k], 0);
  if (waiting <= 0) return null;
  const pockets = ORDER.map((key) => ({ key, ...META[key], count: counts[key] }));
  const cards = apportion(pockets.map((p) => p.count), BATCH);
  return {
    pockets,
    sequence: interleave(cards),
    batch: BATCH,
    asked: pockets.reduce((a, p) => a + p.count, 0),
    decidedOn: input.decided ? input.decidedOn : null,
  };
}
