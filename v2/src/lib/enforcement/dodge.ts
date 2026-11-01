/**
 * Squares on one time line that would touch, pulled apart up and down. Two settlements six days apart
 * (Cloudera's and Instacart's) or on the same day (Nitya's and Intellicept's, Jan 5 2026) drew on top of
 * each other: one read as an odd nested shape, the other hid a settlement. Pure, so the chart and its test
 * share it.
 *
 * A run of squares closer than their half widths plus a gap, at the narrowest the track is drawn, is one
 * cluster. Two in a cluster sit above and below the line; three or more step down from the top.
 */

export interface DodgeMark {
  id: string;
  /** Left edge to right edge of the track, 0 to 100. */
  x: number;
  /** The square's side in pixels. */
  size: number;
}

/** The narrowest the track is drawn (the chart's 680px minimum less its label column and margins). */
export const TRACK_MIN_PX = 480;
const GAP = 4;

/** Each mark's vertical offset from the line's middle, in pixels (negative is up). */
export function dodge(marks: readonly DodgeMark[], trackPx = TRACK_MIN_PX): Map<string, number> {
  const sorted = [...marks].sort((a, b) => a.x - b.x);
  const out = new Map<string, number>();
  let cluster: DodgeMark[] = [];
  const close = () => {
    const big = Math.max(...cluster.map((m) => m.size));
    if (cluster.length === 1) out.set(cluster[0]!.id, 0);
    else if (cluster.length === 2) {
      out.set(cluster[0]!.id, -(big / 2 + GAP));
      out.set(cluster[1]!.id, big / 2 + GAP);
    } else {
      const step = big + GAP;
      cluster.forEach((m, i) => out.set(m.id, (i - (cluster.length - 1) / 2) * step));
    }
    cluster = [];
  };
  for (const m of sorted) {
    const prev = cluster[cluster.length - 1];
    if (prev && ((m.x - prev.x) / 100) * trackPx >= (prev.size + m.size) / 2 + GAP) close();
    cluster.push(m);
  }
  if (cluster.length) close();
  return out;
}

/** How far a lane's squares reach from its middle, in pixels: half the lane's height before labels. */
export function reach(marks: readonly DodgeMark[], offsets: ReadonlyMap<string, number>): number {
  return Math.max(0, ...marks.map((m) => Math.abs(offsets.get(m.id) ?? 0) + m.size / 2));
}
