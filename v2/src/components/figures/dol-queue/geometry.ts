/**
 * DOL's PERM line drawn as a roller conveyor (the anatomy skill's kit, src/components/iso): one
 * tray per filing month, stacked to scale with that month's cases in line, and DOL's reviewer at
 * a desk at the front. Built from the run's data, on the server and again in the browser, with
 * the same numbers both times. Only the trays' shift, the front stacks' heights, the desk pile
 * and the stamp change while it runs (QueueConveyorFigure).
 */
import * as k from "@/components/iso/iso-kit";
import type { Plan, Point3 } from "@/components/iso/iso-kit";
import { MONTH_ABBR } from "@convex/lib/months";
import type { QueueRun } from "./model";

export const WIDTH = 640;
export const HEIGHT = 360;
export const PITCH = 22; // world units from one tray to the next
const TRAY = { w: 17, d: 30 };
const BELT_Z = 30;
const RAIL_H = 4;
/** The tallest stack, in world units: the busiest month. */
const STACK_MAX = 44;

export interface Conveyor {
  /** Floor, legs, rails and rollers: drawn behind everything. */
  back: string;
  /** The desk and its out tray: drawn in front of the trays. */
  desk: string;
  /** The sign on the desk, naming the month on the front tray. */
  sign: (month: string) => string;
  /** The stamp's handle, moved up and down while the line runs. */
  stamp: string;
  /** One tray (base and stack) for a month at a stack height in cases. */
  tray: (i: number, cases: number, picked: boolean) => string;
  /** The pile on the desk: in-line cases older than the first tray. */
  pile: (cases: number) => string;
  /** The screen translation that moves every tray forward by `n` places. */
  shift: (n: number) => string;
  /** The screen translation that lowers the stamp by `dz` world units. */
  press: (dz: number) => string;
  /** One world unit along the line on screen: turns a drag into a distance. */
  along: [number, number];
  /** The line's length, in world units. */
  length: number;
}

export function buildConveyor(run: QueueRun): Conveyor {
  const n = run.months.length;
  // Month i (0 = the oldest, at the front) sits at x; the front is the high-x end, by the desk.
  const trayX = (i: number) => (n - 1 - i) * PITCH;
  const most = Math.max(1, ...run.months.map((m) => m.inLine));
  const height = (cases: number) => (cases <= 0 ? 0 : Math.max(0.6, (cases / most) * STACK_MAX));
  const FRAME: Plan = { x: -10, y: -20, w: (n - 1) * PITCH + TRAY.w + 20, d: 40, r: 1.5 };
  const DESK: Plan = { x: FRAME.x + FRAME.w + 8, y: -28, w: 40, d: 56, r: 2 };
  const DESK_Z = 34;
  const FLOOR: Plan = { x: FRAME.x - 12, y: -40, w: DESK.x + DESK.w + 12 - (FRAME.x - 12), d: 80, r: 6 };
  const P = k.fitProjection(
    [...k.boxCorners(FLOOR, -8, 0), [FRAME.x, FRAME.y, BELT_Z + STACK_MAX + 6], [DESK.x + DESK.w, DESK.y, DESK_Z + 20]],
    WIDTH,
    HEIGHT,
    { pad: 22, azimuth: 58 },
  );
  const at = (p: Point3) => k.iso(p, P);
  const S = k.solidSvg;
  const L = k.lineSvg;
  const D = k.dotsSvg;
  const byDepth = (pts: [number, number][]) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

  const back: string[] = [`<path class="iso-halo" d="${k.haloOf(FLOOR, -8, 8, P)}"/>`];
  back.push(S(k.slabOf(FLOOR, -8, 8, P, 8, 1.2), { tone: "lo" }));
  back.push(L(k.planOutline(k.insetPlan(FLOOR, 4), 0, P), { tone: "faint" }));
  const legs: [number, number][] = [];
  for (const x of [FRAME.x + 3, FRAME.x + FRAME.w / 2, FRAME.x + FRAME.w - 3]) for (const y of [FRAME.y + 3, FRAME.y + FRAME.d - 3]) legs.push([x, y]);
  for (const [x, y] of byDepth(legs)) {
    back.push(S(k.slabOf({ x: x - 2, y: y - 2, w: 4, d: 4, r: 0.8 }, 0, BELT_Z - RAIL_H, P, 2, 0.3), { tone: "mid" }));
    back.push(S(k.cylinder(x, y, 3, 0, 1.2, P, 16), { tone: "lo" }));
  }
  for (const y of [FRAME.y, FRAME.y + FRAME.d - 3]) {
    back.push(S(k.slabOf({ x: FRAME.x, y, w: FRAME.w, d: 3, r: 0.8 }, BELT_Z - RAIL_H, RAIL_H, P, 2, 0.4), { tone: "mid" }));
    back.push(D(Array.from({ length: 8 }, (_, i) => at([FRAME.x + 6 + (i * (FRAME.w - 12)) / 7, y + 1.5, BELT_Z])), { size: 0.4 }));
  }
  for (let x = FRAME.x + 3; x < FRAME.x + FRAME.w - 3; x += 6) {
    back.push(S(k.slabOf({ x, y: FRAME.y + 3, w: 2.4, d: FRAME.d - 6, r: 1.1 }, BELT_Z - 2.4, 2.4, P, 3), { tone: "lo", crease: "none" }));
  }

  const tray = (i: number, cases: number, picked: boolean) => {
    const plan: Plan = { x: trayX(i), y: -TRAY.d / 2, w: TRAY.w, d: TRAY.d, r: 1 };
    const cls = picked ? "dq-pick" : undefined;
    const out = [S(k.slabOf(plan, BELT_Z, 3, P, 3, 0.4), { tone: picked ? "hi" : "mid", lit: picked, className: cls })];
    const h = height(cases);
    if (h > 0) {
      const stack = k.insetPlan(plan, 1.6);
      const seams: string[] = [];
      for (let z = BELT_Z + 3 + 2.2; z < BELT_Z + 3 + h - 0.8; z += 2.2) seams.push(k.sideSeam(stack, z, P, 3));
      out.push(S(k.slabOf(stack, BELT_Z + 3, h, P, 3, 0.4), { tone: "hi", crease: "lo", lit: picked, className: cls, inner: L(seams.join(""), { tone: picked ? "lit" : "faint" }) }));
    }
    return out.join("");
  };

  const desk: string[] = [];
  for (const [x, y] of byDepth(k.corners(DESK, 3))) desk.push(S(k.slabOf({ x: x - 2, y: y - 2, w: 4, d: 4, r: 0.8 }, 0, DESK_Z, P, 2, 0.3), { tone: "mid" }));
  desk.push(S(k.slabOf(DESK, DESK_Z, 4, P, 4, 0.8), { tone: "mid" }));
  desk.push(L(k.planOutline(k.insetPlan(DESK, 2.4), DESK_Z + 4, P, 4), { tone: "faint" }));
  // the out tray: cases decided
  const outTray: Plan = { x: DESK.x + 6, y: DESK.y + 30, w: 16, d: 20, r: 1 };
  desk.push(S(k.slabOf(outTray, DESK_Z + 4, 2.4, P, 3, 0.3), { tone: "mid" }));
  desk.push(S(k.slabOf(k.insetPlan(outTray, 1.5), DESK_Z + 6.4, 3, P, 3, 0.3), { tone: "hi", crease: "lo" }));
  // the stamp's base pad
  const sx = DESK.x + 30;
  const sy = DESK.y + 14;
  desk.push(S(k.slabOf({ x: sx - 4, y: sy - 3, w: 8, d: 6, r: 0.8 }, DESK_Z + 4, 1.2, P, 2, 0.3), { tone: "lo", crease: "none" }));
  // the sign, standing on the desk's line edge: the month on the front tray
  const signPlan: Plan = { x: DESK.x + 2, y: DESK.y + 6, w: 3, d: 26, r: 0.6 };
  const sign = (month: string) => {
    const [yy, mm] = month.split("-");
    return [
      S(k.slabOf(signPlan, DESK_Z + 4, 14, P, 2, 0.4), { tone: "mid" }),
      k.faceTextSvg(k.sideMatrix([signPlan.x + signPlan.w, signPlan.y + signPlan.d - 3], DESK_Z + 4 + 9, P, "right"), `${MONTH_ABBR[Number(mm) - 1]} ${yy}`, { size: 4.2, tone: "hi", anchor: "start" }),
    ].join("");
  };

  const stamp = [
    S(k.slabOf({ x: sx - 3.4, y: sy - 2.4, w: 6.8, d: 4.8, r: 0.6 }, DESK_Z + 5.2, 2.2, P, 2, 0.3), { tone: "mid" }),
    S(k.cylinder(sx, sy, 1.4, DESK_Z + 7.4, 6, P, 16), { tone: "mid" }),
    S(k.cylinder(sx, sy, 2.6, DESK_Z + 13.4, 3.6, P, 20), { tone: "mid" }),
  ].join("");

  // the in tray beside the stamp: the few older cases still in line, decided first
  const inTray: Plan = { x: DESK.x + 26, y: DESK.y + 30, w: 12, d: 18, r: 1 };
  const pile = (cases: number) => {
    const out = [S(k.slabOf(inTray, DESK_Z + 4, 2.4, P, 3, 0.3), { tone: "mid" })];
    const h = cases <= 0 ? 0 : Math.max(0.6, Math.min(6, (cases / most) * STACK_MAX));
    if (h > 0) out.push(S(k.slabOf(k.insetPlan(inTray, 1.5), DESK_Z + 6.4, h, P, 3, 0.3), { tone: "hi", crease: "lo" }));
    return out.join("");
  };

  return {
    back: back.join(""),
    desk: desk.join(""),
    sign,
    stamp,
    tray,
    pile,
    shift: (places: number) => k.translateAlong(P, [places * PITCH, 0, 0]),
    press: (dz: number) => k.translateAlong(P, [0, 0, -dz]),
    along: k.axisVector(P, [1, 0, 0]),
    length: FRAME.w,
  };
}
