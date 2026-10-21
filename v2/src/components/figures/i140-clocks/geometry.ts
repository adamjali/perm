/**
 * Two of the three 180-day clocks drawn as lanes on a bench (the anatomy skill's kit,
 * src/components/iso): the I-140 approval's lane at the back, the I-485 receipt's at the front,
 * each 180 days long and ending at a lock. A gantry spanning both lanes marks the day the reader
 * leaves; each lane fills up to it, and a lock turns lime once its clock has run. Day counts come
 * from the model (the central rule); every static path is built once, at load.
 */
import * as k from "@/components/iso/iso-kit";
import type { Plan, Point3 } from "@/components/iso/iso-kit";
import { I485_DAY, LEAVE_MAX, LEAVE_MIN, PORTABLE_DAY, SAFE_DAY } from "./model";

export const WIDTH = 640;
export const HEIGHT = 330;

const U = 1; // world units per day
const X = (day: number) => day * U;
const START = LEAVE_MIN - 16;
const END = LEAVE_MAX + 12;

const PLATE: Plan = { x: X(START), y: -50, w: X(END - START), d: 100, r: 6 };
const PLATE_H = 9;
const FOOT_H = 4;
const RULER: Plan = { x: X(START + 6), y: 34, w: X(END - START - 12), d: 8, r: 1 };
const LANE_D = 14;
const LOCK_DAYS = 8;
const LOCK_H = 10;
const GANTRY_Y0 = -44;
const GANTRY_Y1 = 28;
const GANTRY_H = 26;

interface Lane {
  name: string;
  y: number;
  from: number;
  to: number;
}
export const LANES: Lane[] = [
  { name: "I-140", y: -30, from: 0, to: SAFE_DAY },
  { name: "I-485", y: 2, from: I485_DAY, to: PORTABLE_DAY },
];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [X(START), GANTRY_Y0, GANTRY_H + 3], [X(END), GANTRY_Y1, GANTRY_H + 3]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 62 },
);
const at = (p: Point3) => k.iso(p, P);
const S = k.solidSvg;
const L = k.lineSvg;
const D = k.dotsSvg;
const byDepth = (pts: [number, number][]) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function plate(): string {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 18))) {
    out.push(S(k.cylinder(x, y, 6.5, -PLATE_H - FOOT_H, 1.4, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4.5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // the gantry's two guide rails along the back and front edges
  for (const y of [GANTRY_Y0 - 3, GANTRY_Y1 - 3]) out.push(S(k.slabOf({ x: X(START + 4), y, w: X(END - START - 8), d: 6, r: 1 }, 0, 2.4, P, 3, 0.4), { tone: "mid" }));
  return out.join("");
}

function ruler(): string {
  const out = [S(k.slabOf(RULER, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const t = k.topTicks(X(LEAVE_MIN), X(LEAVE_MAX), X(10), 3, RULER.y + 0.6, 0.6, [2.2, 4.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  return out.join("");
}

function lane(l: Lane): string {
  const trough: Plan = { x: X(l.from) - 10, y: l.y, w: X(l.to - l.from) + 10, d: LANE_D, r: 1 };
  const head: Plan = { x: X(l.from) - 10, y: l.y - 2, w: 10, d: LANE_D + 4, r: 1 };
  return [
    S(k.slabOf(trough, 0, 2, P, 3, 0.4), { tone: "lo", crease: "none" }),
    L(k.planOutline(k.insetPlan({ ...trough, x: X(l.from), w: X(l.to - l.from) }, 2), 2, P, 3), { tone: "faint" }),
    // engraved marks every 30 days along the lane's front edge
    L(k.topTicks(X(l.from), X(l.to), X(30), 1, l.y + LANE_D - 0.4, 2, [0, 2.4], P).major, { tone: "faint" }),
    S(k.slabOf(head, 0, 9, P, 3, 0.6), { tone: "mid" }),
    k.faceTextSvg(k.topMatrix([head.x + head.w / 2, head.y + head.d / 2 + 1.2], 9, P, "x"), l.name, { size: 3.4, tone: "hi", anchor: "middle" }),
  ].join("");
}

/** The bed, the ruler and both lanes with their head blocks. */
export const BACK = [plate(), ruler(), ...LANES.map(lane)].join("");

/** A lane's fill from its start up to the leaving day. */
export function fillAt(i: number, day: number): string {
  const l = LANES[i]!;
  const to = Math.min(day, l.to);
  if (to <= l.from + 0.5) return "";
  // a raised bar, so its shaded side shows how far the clock has run
  const bar: Plan = { x: X(l.from), y: l.y + 3, w: X(to - l.from), d: LANE_D - 6, r: 0.6 };
  return [
    S(k.slabOf(bar, 2, 5, P, 2, 0.4), { tone: "hi", crease: "lo" }),
    L(k.lineOnTop([bar.x + 1.5, bar.y + bar.d / 2], [bar.x + bar.w - 1.5, bar.y + bar.d / 2], 7, P), { tone: "mid", free: true }),
  ].join("");
}

/** A lane's lock at its end: lime once its 180 days have run. */
export function lockAt(i: number, done: boolean): string {
  const l = LANES[i]!;
  const plan: Plan = { x: X(l.to), y: l.y - 3, w: X(LOCK_DAYS), d: LANE_D + 6, r: 1.2 };
  return [
    S(k.slabOf(plan, 0, LOCK_H, P, 3, 0.6), { tone: done ? "hi" : "mid", lit: done, className: done ? "iso-accent" : undefined }),
    L(k.planOutline(k.insetPlan(plan, 2), LOCK_H, P, 3), { tone: done ? "lit" : "faint" }),
  ].join("");
}

/** The gantry spanning both lanes, built at day 0, with a pointer to the ruler. */
function gantry(): string {
  const out: string[] = [];
  for (const y of [GANTRY_Y0, GANTRY_Y1 - 6]) {
    out.push(S(k.slabOf({ x: -4, y: y - 2, w: 8, d: 10, r: 1 }, 2.4, 3, P, 3, 0.4), { tone: "lo" }));
    out.push(S(k.slabOf({ x: -2.5, y, w: 5, d: 6, r: 0.8 }, 5.4, GANTRY_H - 5.4, P, 3, 0.4), { tone: "mid" }));
  }
  const beam: Plan = { x: -3, y: GANTRY_Y0, w: 6, d: GANTRY_Y1 - GANTRY_Y0, r: 1 };
  out.push(S(k.slabOf(beam, GANTRY_H, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(beam, 1.4), GANTRY_H + 4, P, 3), { tone: "faint" }));
  out.push(D([at([0, GANTRY_Y0 + 3, GANTRY_H + 4]), at([0, GANTRY_Y1 - 3, GANTRY_H + 4])], { size: 0.5 }));
  // a plumb line from the beam down each lane, and the pointer down to the ruler
  for (const l of LANES) out.push(L(k.rise([0, l.y + LANE_D / 2], 4, GANTRY_H, P), { tone: "hi" }));
  const armTo = RULER.y + 2.2;
  out.push(S(k.slabOf({ x: -1.2, y: GANTRY_Y1, w: 2.4, d: armTo - GANTRY_Y1, r: 0.5 }, 5, 1.6, P, 2), { tone: "mid", crease: "none" }));
  out.push(L(k.rise([0, armTo - 0.4], 0.6, 5, P), { tone: "hi" }));
  return out.join("");
}
export const GANTRY = gantry();

/** Where each lock sits along the bench, in days: the painter's order sorts by it. */
export const LOCK_DAY = LANES.map((l) => l.to);

/** One day along the bench, in the drawing's own units on screen: turns a drag into days. */
export const DAY_ON_SCREEN = k.axisVector(P, [U, 0, 0]);

/** The screen translation that puts the gantry on the leaving day. */
export const gantryAt = (day: number) => k.translateAlong(P, [X(day), 0, 0]);
