/**
 * The ETA 9089 filing window drawn as a measuring bench (the anatomy skill's kit, src/components/iso).
 *
 * A fixed jaw marks the first recruitment step at day 0. A tie bar holds a hard stop CLOSE days
 * from it. A carriage marks the last recruitment step and carries a WAIT-day spacer, so the gap
 * between the spacer's end and the stop is the window in which the ETA 9089 can be filed. The
 * day counts are the central rule's own constants. Every path here is built once, at module
 * load; only the carriage's position and the window's length change, in FilingWindowFigure.
 */
import { FILING_WINDOW_CLOSE_DAYS, FILING_WINDOW_WAIT_DAYS } from "@/lib/perm";
import * as k from "@/components/iso/iso-kit";
import type { Plan, Point3 } from "@/components/iso/iso-kit";

export const WIDTH = 640;
export const HEIGHT = 330;
export const WAIT = FILING_WINDOW_WAIT_DAYS;
export const CLOSE = FILING_WINDOW_CLOSE_DAYS;
/** A job order runs 30 days, so the last step falls on day 30 at the earliest. */
export const LAST_MIN = 30;
/** On this day the window is one day long; any later and there is none. */
export const LAST_MAX = CLOSE - WAIT;

const U = 1.05; // world units per day
const X = (day: number) => day * U;

const PLATE: Plan = { x: X(-14), y: -46, w: X(CLOSE + 30), d: 92, r: 6 };
const PLATE_H = 9;
const FOOT_H = 4;
const RAILS = [-17, 9];
const RAIL_H = 3;
const BED = RAIL_H; // the carriage rides on the rails
const JAW: Plan = { x: X(-9), y: -24, w: X(9), d: 44, r: 1.5 }; // ends at day 0
const JAW_H = 22;
const STOP: Plan = { x: X(CLOSE), y: -24, w: X(9), d: 44, r: 1.5 }; // starts at day CLOSE
const STOP_H = 22;
const TIE: Plan = { x: X(-6), y: -38, w: X(CLOSE + 12), d: 6, r: 1.5 }; // the bar behind the rails
const TIE_Z = 12;
const CAR_W = X(6);
const CAR: Plan = { x: -CAR_W, y: -22, w: CAR_W, d: 40, r: 1.5 }; // built at day 0, moved to the last step
const CAR_H = 18;
const SPACER: Plan = { x: 0, y: -13, w: X(WAIT), d: 22, r: 1 };
const SPACER_H = 12;
const RULER: Plan = { x: X(-6), y: 30, w: X(CLOSE + 12), d: 8, r: 1 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [JAW.x, JAW.y, JAW_H + BED + 2], [STOP.x + STOP.w, STOP.y, STOP_H + BED + 2]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 62 },
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
  return out.join("");
}

function ruler(): string {
  const out = [S(k.slabOf(RULER, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  // a tick every 5 days and a major one every 30, rooted on the strip's back edge
  const t = k.topTicks(X(0), X(CLOSE), X(5), 6, RULER.y + 0.6, 0.6, [2.2, 4.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(D([at([RULER.x + 2.4, RULER.y + RULER.d / 2, 0.6]), at([RULER.x + RULER.w - 2.4, RULER.y + RULER.d / 2, 0.6])], { size: 0.45 }));
  // a label plate at the front left, its rule lines standing for printed text
  const label: Plan = { x: X(-12), y: 22, w: 26, d: 6, r: 0.8 };
  out.push(S(k.slabOf(label, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1), 0.7, P, 3), { tone: "faint" }));
  out.push(L(k.lineOnTop([label.x + 3, label.y + 2.4], [label.x + 17, label.y + 2.4], 0.7, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 3, label.y + 3.8], [label.x + 13, label.y + 3.8], 0.7, P), { tone: "lo", free: true }));
  return out.join("");
}

function tieBar(): string {
  const out: string[] = [];
  // two brackets carry the bar that fixes the stop CLOSE days from the jaw
  for (const x of [X(-5), X(CLOSE + 4)]) {
    out.push(S(k.slabOf({ x: x - 3, y: TIE.y - 1, w: 6, d: TIE.d + 2, r: 1 }, 0, TIE_Z, P, 3, 0.4), { tone: "mid" }));
  }
  out.push(S(k.slabOf(TIE, TIE_Z, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(D([X(-5), X(CLOSE + 4)].map((x) => at([x, TIE.y + TIE.d / 2, TIE_Z + 4])), { size: 0.45 }));
  // an engraved mark every 30 days, rooted on the bar's front edge
  const t = k.topTicks(X(0), X(CLOSE), X(30), 1, TIE.y + TIE.d - 0.2, TIE_Z + 4, [0, 2.6], P);
  out.push(L(t.major, { tone: "faint" }));
  return out.join("");
}

function rails(): string {
  const out: string[] = [];
  for (const y of RAILS) {
    out.push(S(k.slabOf({ x: X(-6), y, w: X(CLOSE + 12), d: 6, r: 1 }, 0, RAIL_H, P, 3, 0.4), { tone: "mid" }));
    out.push(D([X(20), X(90), X(160)].map((x) => at([x, y + 3, RAIL_H])), { size: 0.4, tone: "lo" }));
  }
  return out.join("");
}

function jaw(): string {
  return [
    S(k.slabOf(JAW, BED, JAW_H, P, 3, 0.6), { tone: "mid" }),
    L(k.planOutline(k.insetPlan(JAW, 2.4), BED + JAW_H, P, 3), { tone: "faint" }),
    D(([[JAW.x + 3.4, JAW.y + 4], [JAW.x + 3.4, JAW.y + JAW.d - 4]] as const).map(([x, y]) => at([x, y, BED + JAW_H])), { size: 0.5 }),
  ].join("");
}

/** A fixed pointer arm from a block's front face to the ruler, its tip on the day it marks. */
function pointer(day: number, plan: Plan, z: number, tone: "mid" | "hi" = "mid"): string {
  const armTo = RULER.y + 2.2;
  const x = X(day);
  return [
    S(k.slabOf({ x: x - (day === 0 ? 2.4 : 0), y: plan.y + plan.d - 0.5, w: 2.4, d: armTo - plan.y - plan.d + 0.5, r: 0.5 }, z, 1.6, P, 2), { tone: "mid", crease: "none" }),
    D([at([x + (day === 0 ? -1.2 : 1.2), plan.y + plan.d + 2, z + 1.6])], { size: 0.4 }),
    L(k.rise([x, armTo - 0.4], 0.6, z, P), { tone }),
  ].join("");
}

function stop(): string {
  return [
    S(k.slabOf(STOP, BED, STOP_H, P, 3, 0.6), { tone: "mid" }),
    L(k.planOutline(k.insetPlan(STOP, 2.4), BED + STOP_H, P, 3), { tone: "faint" }),
    D(([[STOP.x + STOP.w - 3.4, STOP.y + 4], [STOP.x + STOP.w - 3.4, STOP.y + STOP.d - 4]] as const).map(([x, y]) => at([x, y, BED + STOP_H])), { size: 0.5 }),
  ].join("");
}

function carriage(): string {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CAR, 2), BED, 0.1, P)}" style="filter:blur(3px)"/>`];
  for (const y of RAILS) out.push(S(k.slabOf({ x: CAR.x + 1, y: y - 1.5, w: CAR.w - 2, d: 9, r: 1 }, BED, 3, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf(CAR, BED + 3, CAR_H - 3, P, 3, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(CAR, 2.2), BED + CAR_H, P, 3), { tone: "faint" }));
  out.push(
    D(
      ([[CAR.x + 2.6, CAR.y + 3.4], [CAR.x + 2.6, CAR.y + CAR.d - 3.4], [CAR.x + CAR.w - 2.6, CAR.y + 3.4], [CAR.x + CAR.w - 2.6, CAR.y + CAR.d - 3.4]] as const).map(([x, y]) =>
        at([x, y, BED + CAR_H]),
      ),
      { size: 0.45 },
    ),
  );
  // the spacer, bolted to the carriage's face: the wait after the last step
  out.push(S(k.slabOf(SPACER, BED + 4, SPACER_H, P, 3, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(SPACER, 1.8), BED + 4 + SPACER_H, P, 3), { tone: "faint" }));
  out.push(D(([[X(3), SPACER.y + SPACER.d / 2], [X(WAIT) - X(3), SPACER.y + SPACER.d / 2]] as const).map(([x, y]) => at([x, y, BED + 4 + SPACER_H])), { size: 0.45 }));
  out.push(k.faceTextSvg(k.topMatrix([X(WAIT / 2), SPACER.y + SPACER.d / 2 + 1.2], BED + 4 + SPACER_H, P, "x"), `${WAIT} days`, { size: 3.4, tone: "mid", anchor: "middle" }));
  // the arm on the spacer's end, down to the ruler: the day the window opens
  const armZ = BED + 6;
  const armTo = RULER.y + 2.2;
  out.push(S(k.slabOf({ x: X(WAIT) - 2.4, y: SPACER.y + SPACER.d - 0.5, w: 2.4, d: armTo - SPACER.y - SPACER.d + 0.5, r: 0.5 }, armZ, 1.6, P, 2), { tone: "mid", crease: "none" }));
  out.push(D([at([X(WAIT) - 1.2, SPACER.y + SPACER.d + 2, armZ + 1.6])], { size: 0.4 }));
  out.push(L(k.rise([X(WAIT), armTo - 0.4], 0.6, armZ, P), { tone: "lit" }));
  // a knurled handle on the carriage's front
  out.push(S(k.slabOf({ x: CAR.x + CAR.w / 2 - 1.6, y: CAR.y + CAR.d - 0.5, w: 3.2, d: 3, r: 0.8 }, BED + 8, 3.2, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(CAR.x + CAR.w / 2, CAR.y + CAR.d + 4, 3.4, BED + 6.4, 6.4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(CAR.x + CAR.w / 2, CAR.y + CAR.d + 4, 3.4, BED + 6.4, BED + 12.8, 20, P), { tone: "lo" }));
  return out.join("");
}

/** What sits behind the window strip and the carriage. */
export const BACK = [plate(), ruler(), tieBar(), rails(), jaw()].join("");
/** The carriage and its spacer, built at day 0. */
export const CARRIAGE = carriage();
/** What sits in front of the carriage. */
export const FRONT = [pointer(0, JAW, BED + 14), stop(), pointer(CLOSE, STOP, BED + 14, "hi")].join("");

/** One day along the bench, in the drawing's own units on screen: turns a drag into days. */
export const DAY_ON_SCREEN = k.axisVector(P, [U, 0, 0]);

/** The screen translation that puts the carriage's front face on the last-step day. */
export const carriageAt = (lastDay: number) => k.translateAlong(P, [X(lastDay), 0, 0]);

/**
 * The window: a strip on the bed from the spacer's end to the stop. A window that opens and
 * closes on the same day is still a day, drawn one day wide against the stop.
 */
export function windowAt(lastDay: number): string {
  const open = lastDay + WAIT;
  const w = Math.max(X(1), X(CLOSE) - X(open));
  return S(k.slabOf({ x: X(CLOSE) - w, y: -6, w, d: 8, r: 0.6 }, 0, 1.2, P, 2), { tone: "hi", lit: true, crease: "none", className: "fw-window" });
}
