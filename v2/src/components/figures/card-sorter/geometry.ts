/**
 * The nightly sweep drawn as a punched-card sorter (the anatomy skill's kit, src/components/iso):
 * case cards leave a hopper on the right, pass under a reader (DOL's case-status search) and run
 * left along the track to their pocket, where they drop in. Six pockets along the front, one per
 * place a waiting case can be. Built once from the run on the server and again in the browser;
 * only the flying cards and the stacks' heights change while it runs (CardSorterFigure).
 *
 * World units: x along the machine (the hopper at the high end), y from the back to the front,
 * z up. Painter's order is the order the strings are listed in `layers`.
 */
import * as k from "@/components/iso/iso-kit";
import type { Plan, Point3 } from "@/components/iso/iso-kit";

export const WIDTH = 960;
export const HEIGHT = 560;

/** The six pockets, left to right. */
export const POCKETS = 6;
const POCKET_W = 26;
const POCKET_X0 = 8;
/** A pocket's centre on the machine. */
export const pocketX = (i: number) => POCKET_X0 + i * POCKET_W + POCKET_W / 2;

const BODY: Plan = { x: 0, y: 0, w: 200, d: 46, r: 2 };
const BODY_Z = 6;
export const DECK_Z = 45;
/** Cards ride on the rails' tops. */
export const CARD_Z = 46.6;
export const TRACK_Y = 24;
/** Where the reader sits along the track, and where a card leaves the hopper. */
export const READ_X = 160;
export const HOPPER_EXIT_X = 168;
/** Where a card leaves the deck for its pocket, and where it lands. */
export const CHUTE_Y = 40;
export const LAND_Y = 54.5;
const POCKET_FLOOR_Z = 24;
const POCKET_WALL_Z = 38;
/** The tallest stack a pocket shows, in world units above its floor. */
const STACK_MAX = 13;
const STACK_MIN = 1.2;

export interface Sorter {
  /** Everything behind the flying cards on the deck. */
  back: string;
  /** The reader's arm and head and the hopper's near walls: in front of the deck's cards. */
  over: string;
  /** Per pocket, left to right: what sits behind a card dropping into it. */
  pocketBack: string[];
  /** Per pocket: what sits in front of it (the front lip and its counter window). */
  pocketFront: string[];
  /** The last divider, at the right end of the pockets. */
  end: string;
  /** One pocket's stack, holding `cards` of `most` (the fullest pocket's count). */
  stack: (i: number, cards: number, most: number) => string;
  /** The top of a pocket's stack, where a landing card comes to rest. */
  stackTop: (cards: number, most: number) => number;
  /** One card, drawn at the origin: moved with `place`. */
  card: string;
  /** The screen translation that puts the card at a point. */
  place: (p: Point3) => string;
  /** One world unit along the track on screen: turns a drag into a distance. */
  along: [number, number];
}

const stackHeight = (cards: number, most: number) => STACK_MIN + (most > 0 ? (Math.min(cards, most) / most) * (STACK_MAX - STACK_MIN) : 0);

export function buildSorter(): Sorter {
  const FLOOR: Plan = { x: -7, y: -7, w: 216, d: 77, r: 5 };
  const P = k.fitProjection(
    [...k.boxCorners(FLOOR, -4, 0), ...k.boxCorners(BODY, 0, DECK_Z), [172, 12, 68], [196, 36, 68], [160, 4, 62]],
    WIDTH,
    HEIGHT,
    { pad: 18, azimuth: 66, elevation: 33 },
  );
  const at = (p: Point3) => k.iso(p, P);
  const S = k.solidSvg;
  const L = k.lineSvg;
  const D = k.dotsSvg;
  const seg = (a: Point3, b: Point3) => k.segment(a, b, P);
  const byDepth = (pts: [number, number][]) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

  // --- floor, feet, body -------------------------------------------------------------------
  const back: string[] = [`<path class="iso-halo" d="${k.haloOf(FLOOR, -4, 4, P)}"/>`];
  back.push(S(k.slabOf(FLOOR, -4, 4, P, 8, 1), { tone: "lo" }));
  back.push(L(k.planOutline(k.insetPlan(FLOOR, 4), 0, P), { tone: "faint" }));
  for (const [x, y] of byDepth(k.corners(BODY, 7))) {
    back.push(S(k.cylinder(x, y, 4.2, 0, 1.4, P, 20), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 2.8, 1.4, BODY_Z - 1.4, P, 20), { tone: "mid" }));
  }
  const body = k.slabOf(BODY, BODY_Z, DECK_Z - BODY_Z - 1, P, 8, 0.8);
  // A kick plate along the front and an access panel on the end, screwed at its corners.
  const panel = [
    seg([4, 46, 12], [196, 46, 12]),
    seg([200, 6, 12], [200, 40, 12]),
    seg([200, 6, 12], [200, 6, 40]),
    seg([200, 40, 12], [200, 40, 40]),
    seg([200, 6, 40], [200, 40, 40]),
  ].join("");
  back.push(S(body, { tone: "mid", inner: L(panel, { tone: "faint" }) }));
  back.push(D([at([200, 8.5, 14.5]), at([200, 37.5, 14.5]), at([200, 8.5, 37.5]), at([200, 37.5, 37.5])], { size: 0.55, tone: "hi" }));
  // a vent on the end panel
  const vent: [number, number, number][] = [];
  for (let y = 12; y <= 34; y += 2.4) for (let z = 18; z <= 24; z += 2.4) vent.push([...at([200, y, z]), 1]);
  back.push(D(vent, { size: 0.45, tone: "mid" }));
  // the switch on the end, below the vent
  back.push(S(k.slabOf({ x: 200, y: 26, w: 1.4, d: 5, r: 0.4 }, 28, 4, P, 2, 0.2), { tone: "mid", crease: "none" }));
  back.push(S(k.slabOf({ x: 201.2, y: 27.6, w: 0.8, d: 1.8, r: 0.3 }, 29.2, 1.6, P, 2), { tone: "hi", crease: "none" }));

  // --- the deck: plate, rails, ruler, chute slots ------------------------------------------
  const DECK: Plan = { x: 2, y: 2, w: 196, d: 42, r: 1.5 };
  const rails = [16.5, 29.5].map((y) => S(k.slabOf({ x: 6, y, w: 166, d: 2, r: 0.5 }, DECK_Z, 1.4, P, 2, 0.2), { tone: "mid", crease: "none" }));
  const ruler = k.topTicks(8, 168, 4, 5, 33, DECK_Z, [1.2, 2.6], P);
  const slots: string[] = [];
  for (let i = 0; i < POCKETS; i++) {
    const cx = pocketX(i);
    slots.push(k.planOutline({ x: cx - 8, y: 36.5, w: 16, d: 6, r: 0.6 }, DECK_Z, P, 4));
  }
  back.push(
    S(k.slabOf(DECK, DECK_Z - 1, 1, P, 6, 0.4), {
      tone: "mid",
      inner: [L(slots.join(""), { tone: "lo" }), L(ruler.minor, { tone: "faint" }), L(ruler.major, { tone: "lo" })].join(""),
    }),
  );
  back.push(D(k.corners(DECK, 3.5).map((p) => at([p[0], p[1], DECK_Z])), { size: 0.5, tone: "hi" }));
  back.push(...rails);

  // --- the reader: a post behind the track, an arm over it, a head that reads each card ------
  const POST: Plan = { x: 157, y: 3, w: 6, d: 6, r: 0.8 };
  back.push(S(k.slabOf({ x: 155, y: 1, w: 10, d: 10, r: 1 }, DECK_Z, 1.2, P, 3, 0.3), { tone: "lo" }));
  back.push(S(k.slabOf(POST, DECK_Z + 1.2, 12.8, P, 3, 0.3), { tone: "mid" }));

  const over: string[] = [];
  over.push(S(k.slabOf({ x: 157.5, y: 4, w: 5, d: 23, r: 0.6 }, 56, 3, P, 3, 0.3), { tone: "mid" }));
  over.push(S(k.cylinder(READ_X, TRACK_Y, 3.4, 50.6, 5.4, P, 28, 0.3), { tone: "mid", inner: L(k.sideArc(READ_X, TRACK_Y, 3.4, 52.4, P), { tone: "faint" }) }));
  over.push(S(k.cylinder(READ_X, TRACK_Y, 2, 49.4, 1.2, P, 20), { tone: "lo", crease: "none" }));
  // the knob that sets the reader's height
  over.push(S(k.cylinder(160, 6, 2.6, 59, 2.6, P, 24), { tone: "mid", inner: L(k.knurl(160, 6, 2.6, 59, 61.6, 22, P), { tone: "lo" }) }));
  // a cable from the head back down the post
  over.push(k.wireSvg(at([158, 9, 55]), at([158, 9, 47]), { tone: "lo", via: [at([156.4, 10.5, 51])], size: 0.6 }));

  // --- the hopper: back walls, the night's cards, the weight, the near walls ---------------
  const H: Plan = { x: 172, y: 12, w: 24, d: 24, r: 1 };
  back.push(S(k.slabOf(H, DECK_Z, 1, P, 4, 0.3), { tone: "lo" }));
  back.push(S(k.slabOf({ x: 172, y: 12, w: 24, d: 1.4, r: 0.3 }, DECK_Z + 1, 20, P, 2, 0.2), { tone: "mid" }));
  back.push(S(k.slabOf({ x: 172, y: 12, w: 1.4, d: 24, r: 0.3 }, DECK_Z + 5, 16, P, 2, 0.2), { tone: "mid" }));
  const pile: Plan = { x: 174.5, y: 14.5, w: 19, d: 19, r: 0.6 };
  const pileSeams: string[] = [];
  for (let z = DECK_Z + 2.2; z < 59; z += 1.2) pileSeams.push(k.sideSeam(pile, z, P, 3));
  back.push(S(k.slabOf(pile, DECK_Z + 1, 13, P, 3, 0.2), { tone: "hi", crease: "lo", inner: L(pileSeams.join(""), { tone: "faint" }) }));
  const weight: Plan = { x: 176, y: 16, w: 16, d: 16, r: 1.2 };
  back.push(S(k.slabOf(weight, 59, 4, P, 4, 0.5), { tone: "mid" }));
  back.push(S(k.cylinder(184, 24, 2.2, 63, 3, P, 24), { tone: "mid", inner: L(k.knurl(184, 24, 2.2, 63, 66, 20, P), { tone: "lo" }) }));
  over.push(S(k.slabOf({ x: 194.6, y: 12, w: 1.4, d: 24, r: 0.3 }, DECK_Z + 1, 20, P, 2, 0.2), { tone: "mid" }));
  over.push(S(k.slabOf({ x: 172, y: 34.6, w: 24, d: 1.4, r: 0.3 }, DECK_Z + 1, 9, P, 2, 0.2), { tone: "mid" }));
  over.push(D([at([195.3, 13.5, DECK_Z + 18]), at([195.3, 34.5, DECK_Z + 18]), at([180, 36, DECK_Z + 7.5]), at([190, 36, DECK_Z + 7.5])], { size: 0.45, tone: "hi" }));

  // --- the pockets --------------------------------------------------------------------------
  const divider = (x: number) =>
    S(k.slabOf({ x: x - 0.6, y: 46, w: 1.2, d: 18, r: 0.3 }, POCKET_FLOOR_Z, POCKET_WALL_Z - POCKET_FLOOR_Z, P, 2, 0.2), { tone: "mid" });
  const pocketBack: string[] = [];
  const pocketFront: string[] = [];
  for (let i = 0; i < POCKETS; i++) {
    const x0 = POCKET_X0 + i * POCKET_W;
    const cx = pocketX(i);
    pocketBack.push(
      [
        divider(x0),
        // the bracket that holds the pocket to the machine
        S(k.slabOf({ x: x0 + 4, y: 46, w: POCKET_W - 8, d: 5, r: 0.4 }, 18, POCKET_FLOOR_Z - 18 - 2, P, 2, 0.2), { tone: "lo" }),
        S(k.slabOf({ x: x0 + 0.6, y: 46, w: POCKET_W - 1.2, d: 18, r: 0.5 }, POCKET_FLOOR_Z - 2, 2, P, 3, 0.3), { tone: "lo" }),
      ].join(""),
    );
    const lip: Plan = { x: x0 + 0.6, y: 62.4, w: POCKET_W - 1.2, d: 1.6, r: 0.3 };
    const window: Plan = { x: cx - 5, y: 64, w: 10, d: 0.5, r: 0.2 };
    pocketFront.push(
      [
        S(k.slabOf(lip, POCKET_FLOOR_Z, 5, P, 2, 0.2), { tone: "mid" }),
        S(k.slabOf(window, POCKET_FLOOR_Z + 1.2, 2.8, P, 2), { tone: "lo", crease: "none" }),
        D([at([cx - 9, 64, POCKET_FLOOR_Z + 2.6]), at([cx + 9, 64, POCKET_FLOOR_Z + 2.6])], { size: 0.45, tone: "hi" }),
      ].join(""),
    );
  }

  const stackTop = (cards: number, most: number) => POCKET_FLOOR_Z + stackHeight(cards, most);
  const stack = (i: number, cards: number, most: number) => {
    const cx = pocketX(i);
    const plan: Plan = { x: cx - 8, y: LAND_Y - 5.5, w: 16, d: 11, r: 0.5 };
    const h = stackHeight(cards, most);
    const seams: string[] = [];
    for (let z = POCKET_FLOOR_Z + 1.2; z < POCKET_FLOOR_Z + h - 0.4; z += 1.2) seams.push(k.sideSeam(plan, z, P, 3));
    return S(k.slabOf(plan, POCKET_FLOOR_Z, h, P, 3, 0.2), { tone: "hi", crease: "lo", inner: L(seams.join(""), { tone: "faint" }) });
  };

  const card = S(k.slabOf({ x: -7, y: -4.5, w: 14, d: 9, r: 0.6 }, 0, 0.8, P, 3), { tone: "hi", lit: true, crease: "none", className: "iso-accent" });
  const origin = at([0, 0, 0]);
  const place = ([x, y, z]: Point3) => {
    const [sx, sy] = at([x, y, z]);
    return `translate(${(sx - origin[0]).toFixed(2)} ${(sy - origin[1]).toFixed(2)})`;
  };

  return {
    back: back.join(""),
    over: over.join(""),
    pocketBack,
    pocketFront,
    end: divider(POCKET_X0 + POCKETS * POCKET_W),
    stack,
    stackTop,
    card,
    place,
    along: k.axisVector(P, [1, 0, 0]),
  };
}
