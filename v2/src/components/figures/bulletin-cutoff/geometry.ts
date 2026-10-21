/**
 * A visa bulletin cutoff drawn as a gate on a rail of priority dates (the anatomy skill's kit,
 * src/components/iso). The rail runs from the oldest date drawn, at a door where visa numbers go
 * out, to the newest. The gate stands at the month's cutoff: the dates between the door and the
 * gate are current. Current lifts the gate away and opens the whole rail; Unavailable rolls the
 * door's shutter down and opens nothing. The lime block is the example priority date.
 *
 * Built from the run's own dates, on the server and again in the browser, with the same numbers
 * both times. Only the gate's place and lift, the open strip's length and the shutter change
 * while it runs (BulletinCutoffFigure).
 */
import * as k from "@/components/iso/iso-kit";
import type { Plan, Point3 } from "@/components/iso/iso-kit";
import { MS_PER_DAY } from "@/lib/time";
import type { BulletinRun } from "./model";
import { railAt } from "./model";

export const WIDTH = 640;
export const HEIGHT = 340;
/** The rail's length in world units, oldest date to newest. */
const RAIL = 210;
const X = (fraction: number) => fraction * RAIL;

const PLATE: Plan = { x: -44, y: -38, w: RAIL + 58, d: 82, r: 6 };
const PLATE_H = 8;
const FOOT_H = 4;
const RAILS = [-15, 9];
const RAIL_H = 2;
const STRIP_Y = -7;
const STRIP_D = 12;
const RULER: Plan = { x: -3, y: 27, w: RAIL + 6, d: 7, r: 1 };
/** The door at the rail's oldest end: two posts, a shutter and the box it rolls up into. */
const DOOR_X = -17;
const POSTS: Plan[] = [
  { x: DOOR_X - 1, y: -27, w: 6, d: 5, r: 0.8 },
  { x: DOOR_X - 1, y: 18, w: 6, d: 5, r: 0.8 },
];
const POST_H = 30;
const BOX: Plan = { x: DOOR_X - 2, y: -28, w: 8, d: 52, r: 1.2 };
const BOX_H = 7;
const SHUTTER: Plan = { x: DOOR_X + 1, y: -22, w: 2, d: 40, r: 0.4 };
const COUNTER: Plan = { x: -40, y: -24, w: 15, d: 44, r: 1.4 };
const COUNTER_H = 14;
/** The gate, built with its face on x = 0 and moved to the cutoff. */
const GATE: Plan = { x: -3.2, y: -25, w: 3.2, d: 44, r: 0.8 };
const GATE_H = 24;
const GATE_LIFT = 16;
/** The example priority date's block, centred on its date. */
const TOKEN_W = 6;
const TOKEN_H = 12;

export interface Rail {
  /** Plate, ruler, counter, rails and the door's back post: drawn behind everything. */
  back: string;
  /** The shutter at `shut` (0 open, 1 down). */
  shutter: (shut: number) => string;
  /** The door's front post and the shutter box: drawn in front of the shutter. */
  door: string;
  /** The open strip, `length` of the rail long from its oldest end. */
  strip: (length: number) => string;
  /** The gate, built at the rail's oldest end. */
  gate: string;
  /** The screen move that puts the gate at a rail position, lifted by `lift` (0 to 1). */
  gateAt: (at: number, lift: number) => string;
  /** The example date's block and its pointer to the ruler (lime). */
  token: string;
  /** The example date's rail position, 0 to 1. */
  tokenAt: number;
  /** One rail length on screen: turns a drag into a share of the run. */
  along: [number, number];
}

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY;

export function buildRail(run: BulletinRun): Rail {
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOX.x, BOX.y, POST_H + BOX_H], [X(1), GATE.y, GATE_H + GATE_LIFT]],
    WIDTH,
    HEIGHT,
    { pad: 24, azimuth: 60 },
  );
  const at = (p: Point3) => k.iso(p, P);
  const S = k.solidSvg;
  const L = k.lineSvg;
  const D = k.dotsSvg;
  const byDepth = (pts: [number, number][]) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

  // --- the plate, the ruler and its years ---------------------------------------------------
  const back: string[] = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 16))) {
    back.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H, 1.4, P, 28), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 4.6, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid" }));
  }
  back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  back.push(L(k.planOutline(k.insetPlan(PLATE, 4.5), 0, P), { tone: "faint" }));
  back.push(D(k.corners(PLATE, 8).map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  back.push(S(k.slabOf(RULER, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const from = dayNumber(run.railFrom);
  const to = dayNumber(run.railTo);
  const firstYear = Number(run.railFrom.slice(0, 4));
  const lastYear = Number(run.railTo.slice(0, 4));
  const minor: string[] = [];
  const major: string[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const iso = `${year}-${String(month).padStart(2, "0")}-01`;
      const day = dayNumber(iso);
      if (day < from || day > to) continue;
      const x = X((day - from) / (to - from));
      (month === 1 ? major : minor).push(k.lineOnTop([x, RULER.y + 0.6], [x, RULER.y + (month === 1 ? 5 : 2.6)], 0.6, P));
    }
    if (year < lastYear) {
      const mid = X((dayNumber(`${year}-07-02`) - from) / (to - from));
      back.push(k.faceTextSvg(k.topMatrix([mid, RULER.y + RULER.d + 5.2], 0, P, "x"), String(year), { size: 4.6, tone: "hi", anchor: "middle" }));
    }
  }
  back.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "hi" }));
  back.push(k.faceTextSvg(k.topMatrix([PLATE.x + 6, RULER.y + RULER.d + 5.2], 0, P, "x"), run.label, { size: 4.6, tone: "hi", anchor: "start" }));

  // --- the counter behind the door, where visa numbers go out ---------------------------------
  back.push(S(k.slabOf(COUNTER, 0, COUNTER_H, P, 3, 0.6), { tone: "mid" }));
  back.push(L(k.planOutline(k.insetPlan(COUNTER, 2.2), COUNTER_H, P, 3), { tone: "faint" }));
  const tray: Plan = { x: COUNTER.x + 3, y: COUNTER.y + 6, w: 9, d: 14, r: 0.8 };
  back.push(S(k.slabOf(tray, COUNTER_H, 1.6, P, 3), { tone: "lo", crease: "none" }));
  for (let i = 0; i < 4; i += 1) {
    back.push(S(k.slabOf(k.insetPlan(tray, 1.4), COUNTER_H + 1.6 + i * 0.9, 0.9, P, 2), { tone: "hi", crease: "none" }));
  }
  back.push(D([at([COUNTER.x + 3, COUNTER.y + COUNTER.d - 4, COUNTER_H]), at([COUNTER.x + COUNTER.w - 3, COUNTER.y + COUNTER.d - 4, COUNTER_H])], { size: 0.45 }));

  // --- the rails --------------------------------------------------------------------------------
  for (const y of RAILS) {
    back.push(S(k.slabOf({ x: DOOR_X + 6, y, w: X(1) - DOOR_X - 2, d: 6, r: 1 }, 0, RAIL_H, P, 3, 0.4), { tone: "mid" }));
    back.push(D([0.15, 0.5, 0.85].map((f) => at([X(f), y + 3, RAIL_H])), { size: 0.4, tone: "lo" }));
  }

  // --- the door ------------------------------------------------------------------------------------
  back.push(S(k.slabOf(POSTS[0]!, 0, POST_H, P, 3, 0.5), { tone: "mid" }));
  const door = [
    S(k.slabOf(POSTS[1]!, 0, POST_H, P, 3, 0.5), { tone: "mid" }),
    S(k.slabOf(BOX, POST_H, BOX_H, P, 3, 0.6), { tone: "mid" }),
    L(k.planOutline(k.insetPlan(BOX, 1.8), POST_H + BOX_H, P, 3), { tone: "faint" }),
    D(([[BOX.x + BOX.w / 2, BOX.y + 3], [BOX.x + BOX.w / 2, BOX.y + BOX.d - 3]] as const).map(([x, y]) => at([x, y, POST_H + BOX_H])), { size: 0.45 }),
  ].join("");

  /** The shutter hangs from the box and comes down to the plate when the line is Unavailable. */
  const shutter = (shut: number) => {
    const h = 1.2 + Math.min(1, Math.max(0, shut)) * (POST_H - 1.2);
    const z = POST_H - h;
    const slats: string[] = [];
    for (let s = POST_H - 3; s > z + 0.8; s -= 3) slats.push(k.segment([SHUTTER.x + SHUTTER.w, SHUTTER.y + 1, s], [SHUTTER.x + SHUTTER.w, SHUTTER.y + SHUTTER.d - 1, s], P));
    return S(k.slabOf(SHUTTER, z, h, P, 2, 0.2), { tone: "hi", crease: "lo", inner: L(slats.join(""), { tone: "lo" }) });
  };

  /** The open strip: the dates current under this bulletin, from the rail's oldest end. */
  const strip = (length: number) => {
    const w = X(Math.min(1, Math.max(0, length)));
    if (w < 0.3) return "";
    return S(k.slabOf({ x: 0, y: STRIP_Y, w, d: STRIP_D, r: 0.6 }, 0, 1.2, P, 2), { tone: "hi", crease: "none", lit: true });
  };

  const gateParts: string[] = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(GATE, 0.6), RAIL_H, 0.1, P)}" style="filter:blur(3px)"/>`];
  for (const y of RAILS) gateParts.push(S(k.slabOf({ x: GATE.x - 1.6, y: y - 1.5, w: GATE.w + 3.2, d: 9, r: 1 }, RAIL_H, 3, P, 3), { tone: "lo" }));
  gateParts.push(S(k.slabOf(GATE, RAIL_H + 3, GATE_H - 3, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  gateParts.push(S(k.slabOf({ x: GATE.x - 0.8, y: GATE.y - 1, w: GATE.w + 1.6, d: GATE.d + 2, r: 0.8 }, RAIL_H + GATE_H, 2.2, P, 3, 0.4), { tone: "mid" }));
  gateParts.push(D(([[GATE.x + GATE.w / 2, GATE.y + 3], [GATE.x + GATE.w / 2, GATE.y + GATE.d - 3]] as const).map(([x, y]) => at([x, y, RAIL_H + GATE_H + 2.2])), { size: 0.5 }));
  // the arm from the gate's foot to the ruler: the cutoff date itself
  const armZ = RAIL_H + 5;
  gateParts.push(S(k.slabOf({ x: -2.2, y: GATE.y + GATE.d - 0.5, w: 2.2, d: RULER.y + 2 - GATE.y - GATE.d + 0.5, r: 0.5 }, armZ, 1.4, P, 2), { tone: "mid", crease: "none" }));
  gateParts.push(L(k.rise([0, RULER.y + 1.6], 0.6, armZ, P), { tone: "hi" }));

  const tokenAt = railAt(run, run.example);
  const tx = X(tokenAt);
  const tokenPlan: Plan = { x: tx - TOKEN_W / 2, y: STRIP_Y + 1.5, w: TOKEN_W, d: STRIP_D - 3, r: 0.8 };
  const token = k.groupSvg(
    [
      S(k.slabOf(tokenPlan, 1.2, TOKEN_H, P, 3, 0.5), { tone: "hi", lit: true }),
      L(k.planOutline(k.insetPlan(tokenPlan, 1.2), 1.2 + TOKEN_H, P, 3), { tone: "lit" }),
      L(k.lineOnTop([tx, tokenPlan.y + tokenPlan.d], [tx, RULER.y + 1.6], 0.2, P), { tone: "lit", free: true }),
      D([at([tx, RULER.y + 1.6, 0.6])], { size: 0.7, tone: "hi" }),
    ],
    { class: "iso-accent" },
  );

  return {
    back: back.join(""),
    shutter,
    door,
    strip,
    gate: gateParts.join(""),
    gateAt: (position: number, lift: number) => k.translateAlong(P, [X(position), 0, lift * GATE_LIFT]),
    token,
    tokenAt,
    along: k.axisVector(P, [X(1), 0, 0]),
  };
}
