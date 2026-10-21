/**
 * A PERM RFI drawn as a model railway (the anatomy skill's kit, src/components/iso). The main
 * line is analyst review, in filing order. At the RFI a switch sends the case onto a siding,
 * where it waits out DOL's response window, marked by the bar behind it; a second switch brings
 * it back to the main line, and it runs on to the decision gate. Under the gate's line, a strip
 * marks the case page's range. Distance along the track is days, from the run's own numbers;
 * only the cart moves (RfiPathFigure).
 */
import * as k from "@/components/iso/iso-kit";
import type { Plan, Plane, Point3 } from "@/components/iso/iso-kit";
import { LEAD_DAYS, type RfiRun } from "./model";

export const WIDTH = 640;
export const HEIGHT = 340;

const U = 3; // world units per day
const X = (day: number) => day * U;
const GAUGE = 4.5; // rail centre to track centre
const RAIL_W = 1.6;
const RAIL_H = 1.6;
const SIDE = 30; // the siding's centre, behind the main line
const PLATE_H = 6;
const FOOT_H = 3;

export interface RfiTrack {
  /** Plate, window bar, siding, main line and the gate's back post: drawn behind the cart. */
  back: string;
  /** The cart, built at day 0 on the main line. */
  cart: string;
  /** The gate's front post and bar, the range strip and the ruler: drawn in front of the cart. */
  front: string;
  /** The screen translation that puts the cart at `t` days after the RFI. */
  cartAt: (t: number) => string;
  /** One day along the track on screen: turns a drag into days. */
  along: [number, number];
}

/** Where the cart's centre sits across the track `t` days after the RFI: 0 on the main line, -SIDE on the siding. */
export function crossAt(run: RfiRun, t: number): number {
  const ramp = Math.min(5, run.leaveDay / 3);
  const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  if (t <= 0 || t >= run.leaveDay) return 0;
  if (t < ramp) return -SIDE * ease(t / ramp);
  if (t > run.leaveDay - ramp) return -SIDE * ease((run.leaveDay - t) / ramp);
  return -SIDE;
}

export function buildRfiTrack(run: RfiRun): RfiTrack {
  const D0 = -LEAD_DAYS - 5;
  const D1 = Math.max(run.latestDay, run.decideDay) + 7;
  const ramp = Math.min(5, run.leaveDay / 3);
  const PLATE: Plan = { x: X(D0), y: -SIDE - 22, w: X(D1 - D0), d: SIDE + 22 + 34, r: 6 };
  const BAR: Plan = { x: X(0), y: -SIDE - 15, w: X(run.dueDays), d: 4, r: 1 };
  const BAR_Z = 9;
  const RANGE: Plan = { x: X(run.earliestDay), y: 13, w: X(run.latestDay - run.earliestDay), d: 4, r: 0.8 };
  const RULER: Plan = { x: X(D0 + 3), y: 22, w: X(D1 - D0 - 6), d: 7, r: 1 };
  const GATE_Z = 26;
  const gx = X(run.decideDay);

  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [gx, -10, GATE_Z + 3], [BAR.x, BAR.y, BAR_Z + 3]],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 60 },
  );
  const at = (p: Point3) => k.iso(p, P);
  const S = k.solidSvg;
  const L = k.lineSvg;
  const D = k.dotsSvg;
  const byDepth = (pts: Plane[]) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

  // a rail or a sleeper along any direction: a thin bar from one plane point to another
  const bar = (from: Plane, to: Plane, width: number, z: number, h: number, tone: k.Tone = "mid") => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (width / 2);
    const ny = (dx / len) * (width / 2);
    const ring: Plane[] = [
      [from[0] + nx, from[1] + ny],
      [to[0] + nx, to[1] + ny],
      [to[0] - nx, to[1] - ny],
      [from[0] - nx, from[1] - ny],
    ];
    return S(k.extrude(ring, z, h, P), { tone, crease: "none" });
  };

  // a run of track between two centre-line points: sleepers every two days, then both rails
  const track = (from: Plane, to: Plane) => {
    const out: string[] = [];
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let s = 0; s <= len; s += X(2)) {
      const cx = from[0] + (dx / len) * s;
      const cy = from[1] + (dy / len) * s;
      out.push(bar([cx - nx * 7, cy - ny * 7], [cx + nx * 7, cy + ny * 7], 2, 0, 0.8, "lo"));
    }
    for (const side of [-GAUGE, GAUGE]) {
      out.push(bar([from[0] + nx * side, from[1] + ny * side], [to[0] + nx * side, to[1] + ny * side], RAIL_W, 0.8, RAIL_H));
    }
    return out.join("");
  };

  const back: string[] = [];
  // the plate, on four feet
  back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
  for (const [x, y] of byDepth(k.corners(PLATE, 14))) {
    back.push(S(k.cylinder(x, y, 5, -PLATE_H - FOOT_H, FOOT_H, P, 24), { tone: "lo" }));
  }
  back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.2), { tone: "mid" }));
  back.push(L(k.planOutline(k.insetPlan(PLATE, 4), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 8);
  back.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 16)).join(""), { tone: "lo" }));

  // the response window: a bar on two brackets behind the siding, from the RFI to DOL's last day
  for (const x of [BAR.x + 2, BAR.x + BAR.w - 2]) {
    back.push(S(k.slabOf({ x: x - 2, y: BAR.y - 1, w: 4, d: BAR.d + 2, r: 0.8 }, 0, BAR_Z, P, 3, 0.3), { tone: "mid" }));
  }
  back.push(S(k.slabOf(BAR, BAR_Z, 3, P, 3, 0.4), { tone: "mid" }));
  const barTicks = k.topTicks(X(0), X(run.dueDays), X(5), 2, BAR.y + BAR.d - 0.2, BAR_Z + 3, [1.2, 2.4], P);
  back.push(L(barTicks.minor, { tone: "faint" }), L(barTicks.major, { tone: "lo" }));

  // the siding: out at day 0, along, and back in by the day half had left RFI
  back.push(track([0, 0], [X(ramp), -SIDE]));
  back.push(track([X(ramp), -SIDE], [X(run.leaveDay - ramp), -SIDE]));
  back.push(track([X(run.leaveDay - ramp), -SIDE], [X(run.leaveDay), 0]));
  // buffer blocks at the siding's two ends make it read as a siding, not a second line
  for (const x of [X(ramp) + 2, X(run.leaveDay - ramp) - 2]) {
    back.push(S(k.slabOf({ x: x - 1.5, y: -SIDE - 9, w: 3, d: 3, r: 0.6 }, 0, 3.2, P, 2, 0.3), { tone: "lo" }));
  }

  // the main line, analyst review, the whole length
  back.push(track([X(D0 + 2), 0], [X(D1 - 2), 0]));

  // switch stands at the two junctions, on the line's front side
  for (const x of [X(0), X(run.leaveDay)]) {
    back.push(S(k.slabOf({ x: x - 2.4, y: 8, w: 4.8, d: 4, r: 0.6 }, 0, 2.4, P, 2, 0.3), { tone: "mid" }));
    back.push(S(k.cylinder(x, 10, 0.7, 2.4, 6, P, 12), { tone: "mid" }));
    back.push(D([at([x, 10, 8.4])], { size: 0.6 }));
  }

  // the decision gate's back post
  back.push(S(k.slabOf({ x: gx - 1.8, y: -11, w: 3.6, d: 3.6, r: 0.6 }, 0, GATE_Z, P, 2, 0.3), { tone: "mid" }));

  // the cart: a case file on a flat wagon
  const cart: string[] = [];
  const BODY: Plan = { x: -7, y: -6, w: 14, d: 12, r: 1.2 };
  cart.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(BODY, 1), 0.8, 0.1, P)}" style="filter:blur(3px)"/>`);
  for (const x of [-4.5, 4.5]) {
    cart.push(S(k.slabOf({ x: x - 2, y: -GAUGE - 1.5, w: 4, d: GAUGE * 2 + 3, r: 0.8 }, RAIL_H + 0.8, 2, P, 2, 0.3), { tone: "lo" }));
  }
  cart.push(S(k.slabOf({ x: -8, y: -6.5, w: 16, d: 13, r: 1 }, RAIL_H + 2.8, 1.6, P, 3, 0.3), { tone: "mid" }));
  cart.push(
    S(k.slabOf(BODY, RAIL_H + 4.4, 8, P, 3, 0.5), {
      tone: "hi",
      lit: true,
      crease: "none",
      className: "iso-accent",
      inner: L([k.sideSeam(BODY, RAIL_H + 9.4, P, 3)].join(""), { tone: "lit" }),
    }),
  );
  // the file's tab
  cart.push(S(k.slabOf({ x: -5, y: -1.2, w: 5, d: 2.4, r: 0.5 }, RAIL_H + 12.4, 1.8, P, 2, 0.2), { tone: "hi", lit: true, crease: "none", className: "iso-accent" }));

  const front: string[] = [];
  // the gate's front post and bar
  front.push(S(k.slabOf({ x: gx - 1.8, y: 7.4, w: 3.6, d: 3.6, r: 0.6 }, 0, GATE_Z, P, 2, 0.3), { tone: "mid" }));
  front.push(S(k.slabOf({ x: gx - 2.4, y: -11.6, w: 4.8, d: 23.2, r: 0.8 }, GATE_Z, 3, P, 3, 0.4), { tone: "mid" }));
  front.push(D([at([gx, -9.2, GATE_Z + 3]), at([gx, 9.2, GATE_Z + 3])], { size: 0.5 }));
  // the case page's range: a strip in front of the line, a pin on its date
  front.push(S(k.slabOf(RANGE, 0, 1, P, 2, 0.2), { tone: "hi", crease: "none" }));
  front.push(S(k.cylinder(gx, RANGE.y + RANGE.d / 2, 1, 1, 3, P, 14), { tone: "hi" }));
  // the ruler: a tick a day, a long one every ten from the RFI
  front.push(S(k.slabOf(RULER, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const first = Math.ceil(D0 + 3);
  const last = Math.floor(D1 - 3);
  // topTicks counts from zero, so the long ticks fall on the RFI's day and every ten after it
  const ticks = k.topTicks(X(first), X(last), X(1), 10, RULER.y + 0.6, 0.6, [1.6, 3.6], P);
  front.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));

  return {
    back: back.join(""),
    cart: cart.join(""),
    front: front.join(""),
    cartAt: (t: number) => k.translateAlong(P, [X(t), crossAt(run, t), 0]),
    along: k.axisVector(P, [U, 0, 0]),
  };
}
