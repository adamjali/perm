/**
 * The prevailing wage determination's validity drawn as a bench (the anatomy skill's kit,
 * src/components/iso), the filing-window bench's sibling. The ruler carries the validity period
 * as a lime band from the determination to its expiry. A carriage marks the first recruitment
 * step, and an arm runs forward from it to the last day to file. At the expiry a gate rises out
 * of the bed when the expiry still limits the filing, so the arm stops against it; when
 * recruitment began inside the validity the gate stays down and the arm runs its full 180 days.
 * Day counts come from the model (the central rules); every static path is built once, at load.
 */
import { FILING_WINDOW_CLOSE_DAYS } from "@/lib/perm";
import { monthDay } from "@convex/lib/months";
import * as k from "@/components/iso/iso-kit";
import type { Plan, Point3 } from "@/components/iso/iso-kit";
import { DETERMINED, EXPIRES, FIRST_MAX, FIRST_MIN, VALID_DAYS } from "./model";

export const WIDTH = 640;
export const HEIGHT = 330;
const CLOSE = FILING_WINDOW_CLOSE_DAYS;

const U = 0.6; // world units per day
const X = (day: number) => day * U;
const START = FIRST_MIN - 14;
const END = FIRST_MAX + CLOSE + 14;

const PLATE: Plan = { x: X(START), y: -46, w: X(END - START), d: 92, r: 6 };
const PLATE_H = 9;
const FOOT_H = 4;
const RAILS = [-17, 9];
const RAIL_H = 3;
const BED = RAIL_H;
const RULER: Plan = { x: X(START + 6), y: 30, w: X(END - START - 12), d: 8, r: 1 };
/** The carriage's length, in days: its front face sits on the first step. */
export const CAR_DAYS = 10;
const CAR: Plan = { x: -X(CAR_DAYS), y: -22, w: X(CAR_DAYS), d: 40, r: 1.5 };
const CAR_H = 18;
const ARM_Z = BED + 9;
const ARM_Y = -7;
const ARM_D = 8;
/** The gate's thickness, in days along the bench. */
export const GATE_DAYS = 9;
const GATE: Plan = { x: X(VALID_DAYS), y: -26, w: X(GATE_DAYS), d: 48, r: 1.5 };
/** The gate's full height above the bed, in world units. */
export const GATE_H = 22;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [GATE.x, GATE.y, BED + GATE_H + 2], [X(START), CAR.y, BED + CAR_H + 2]],
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
  // the gate's slot in the bed
  out.push(L(k.planOutline(k.insetPlan(GATE, -0.8), 0, P, 3), { tone: "mid" }));
  return out.join("");
}

function ruler(): string {
  const out = [S(k.slabOf(RULER, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const t = k.topTicks(X(START + 10), X(END - 10), X(10), 3, RULER.y + 0.6, 0.6, [2.2, 4.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // the validity period: the determination to its expiry, both days included
  out.push(S(k.slabOf({ x: X(0), y: RULER.y + 0.8, w: X(VALID_DAYS + 1), d: RULER.d - 1.6, r: 0.6 }, 0.6, 1.2, P, 2), { tone: "hi", lit: true, crease: "none", className: "iso-accent" }));
  out.push(k.faceTextSvg(k.topMatrix([X(0), RULER.y + RULER.d + 4.2], 0, P, "x"), monthDay(DETERMINED) ?? "", { size: 3.6, tone: "hi", anchor: "start" }));
  out.push(k.faceTextSvg(k.topMatrix([X(VALID_DAYS + 1), RULER.y + RULER.d + 4.2], 0, P, "x"), monthDay(EXPIRES) ?? "", { size: 3.6, tone: "hi", anchor: "end" }));
  return out.join("");
}

function rails(): string {
  const out: string[] = [];
  for (const y of RAILS) {
    out.push(S(k.slabOf({ x: X(START + 4), y, w: X(END - START - 8), d: 6, r: 1 }, 0, RAIL_H, P, 3, 0.4), { tone: "mid" }));
    out.push(D([X(START + 30), X(VALID_DAYS + 60), X(END - 30)].map((x) => at([x, y + 3, RAIL_H])), { size: 0.4, tone: "lo" }));
  }
  return out.join("");
}

function carriage(): string {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CAR, 2), BED, 0.1, P)}" style="filter:blur(3px)"/>`];
  for (const y of RAILS) out.push(S(k.slabOf({ x: CAR.x + 1, y: y - 1.5, w: CAR.w - 2, d: 9, r: 1 }, BED, 3, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf(CAR, BED + 3, CAR_H - 3, P, 3, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(CAR, 2.2), BED + CAR_H, P, 3), { tone: "faint" }));
  out.push(
    D(
      ([[CAR.x + 2.2, CAR.y + 3.4], [CAR.x + 2.2, CAR.y + CAR.d - 3.4], [CAR.x + CAR.w - 2.2, CAR.y + 3.4], [CAR.x + CAR.w - 2.2, CAR.y + CAR.d - 3.4]] as const).map(([x, y]) =>
        at([x, y, BED + CAR_H]),
      ),
      { size: 0.45 },
    ),
  );
  // the pointer down to the ruler: the first step's day
  const armTo = RULER.y + 2.2;
  out.push(S(k.slabOf({ x: -2.4, y: CAR.y + CAR.d - 0.5, w: 2.4, d: armTo - CAR.y - CAR.d + 0.5, r: 0.5 }, BED + 6, 1.6, P, 2), { tone: "mid", crease: "none" }));
  out.push(L(k.rise([0, armTo - 0.4], 0.6, BED + 6, P), { tone: "hi" }));
  // a knurled handle on its front
  out.push(S(k.cylinder(CAR.x + CAR.w / 2, CAR.y + CAR.d + 4, 3.4, BED + 8.4, 6.4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(CAR.x + CAR.w / 2, CAR.y + CAR.d + 4, 3.4, BED + 8.4, BED + 14.8, 20, P), { tone: "lo" }));
  return out.join("");
}

/** The bed, the rails and the ruler with its lime validity band. */
export const BACK = [plate(), ruler(), rails()].join("");
/** The carriage, built with its front face at day 0. */
export const CARRIAGE = carriage();

/**
 * The arm from the first step to the close, and the stop at its end with a pointer down to the
 * ruler: the last day to file. Nothing when the determination can't be used.
 */
export function armAt(firstDay: number, closeDay: number | null): string {
  if (closeDay === null) return "";
  const from = X(firstDay) + 0.6;
  const to = X(closeDay);
  if (to - from < 2) return "";
  const stop: Plan = { x: to - X(4), y: ARM_Y - 6, w: X(4), d: ARM_D + 12, r: 1 };
  const armTo = RULER.y + 2.2;
  return [
    S(k.slabOf({ x: from, y: ARM_Y, w: to - from, d: ARM_D, r: 0.8 }, ARM_Z, 3.4, P, 2, 0.4), { tone: "hi", crease: "lo" }),
    k.faceTextSvg(k.topMatrix([(from + to - X(4)) / 2, ARM_Y + ARM_D / 2 + 1.2], ARM_Z + 3.4, P, "x"), `${Math.round(closeDay - firstDay)} days`, { size: 3.4, tone: "mid", anchor: "middle" }),
    S(k.slabOf(stop, BED + 3, ARM_Z - BED + 6, P, 3, 0.5), { tone: "mid" }),
    L(k.planOutline(k.insetPlan(stop, 1.2), ARM_Z + 9, P, 3), { tone: "faint" }),
    S(k.slabOf({ x: to - 2.4, y: stop.y + stop.d - 0.5, w: 2.4, d: armTo - stop.y - stop.d + 0.5, r: 0.5 }, BED + 6, 1.6, P, 2), { tone: "mid", crease: "none" }),
    L(k.rise([to, armTo - 0.4], 0.6, BED + 6, P), { tone: "lit" }),
  ].join("");
}

/** The gate at the expiry, risen `h` world units out of its slot (0 to GATE_H). */
export function gateAt(h: number): string {
  if (h < 0.4) return "";
  return [
    S(k.slabOf(GATE, 0, h, P, 3, 0.6), { tone: "mid" }),
    L(k.planOutline(k.insetPlan(GATE, 2.2), h, P, 3), { tone: "faint" }),
    D(([[GATE.x + 2.6, GATE.y + 4], [GATE.x + 2.6, GATE.y + GATE.d - 4]] as const).map(([x, y]) => at([x, y, h])), { size: 0.5 }),
  ].join("");
}

/** One day along the bench, in the drawing's own units on screen: turns a drag into days. */
export const DAY_ON_SCREEN = k.axisVector(P, [U, 0, 0]);

/** The screen translation that puts the carriage's front face on the first-step day. */
export const carriageAt = (firstDay: number) => k.translateAlong(P, [X(firstDay), 0, 0]);
