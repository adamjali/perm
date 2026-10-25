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
/** Cards ride on the rails' tops: a card (9 deep, centred on the track) spans both rails. */
export const CARD_Z = DECK_Z + 1.4;
export const TRACK_Y = 24;
/** The two rails' near edges along y. A card leaves the rails once its back edge clears the front rail. */
const RAILS_Y = [TRACK_Y - 5, TRACK_Y + 3];
const RAIL_D = 2;
export const RAIL_FRONT_Y = RAILS_Y[1]! + RAIL_D;
/** Half a card's depth along y. Off the rails a card slides on the deck's top (DECK_Z) to its front edge. */
export const CARD_HALF_D = 4.5;
export const DECK_EDGE_Y = 44;
/** Where the reader sits along the track, and where a card leaves the hopper. */
export const READ_X = 160;
export const HOPPER_EXIT_X = 168;
/** Where a card lands in its pocket. */
export const LAND_Y = 54.5;
const POCKET_FLOOR_Z = 24;
const POCKET_WALL_Z = 38;
/** The tallest stack a pocket shows, in world units above its floor, and one card's own thickness. */
const STACK_MAX = 13;
const ONE_CARD = 0.4;

export interface Sorter {
  /** Everything behind the flying cards on the deck. */
  back: string;
  /** The reader's arm and head and the hopper's near walls: in front of the deck's cards. */
  over: string;
  /** Per pocket, left to right: what sits behind a card dropping into it. */
  pocketBack: string[];
  /** Per pocket: what sits in front of it (the front lip and its label holder). */
  pocketFront: string[];
  /** The last divider, at the right end of the pockets. */
  end: string;
  /** One pocket's stack, holding `cards` of `most` (the fullest pocket's count). */
  stack: (i: number, cards: number, most: number) => string;
  /** The top of a pocket's stack, where a landing card comes to rest. */
  stackTop: (cards: number, most: number) => number;
  /** One card, drawn at the origin: moved with `place`. */
  card: string;
  /** Pocket i's kicker rod and pad, reaching `reach` along y from its housing: drawn behind the cards on the deck. */
  kicker: (i: number, reach: number) => string;
  /** The screen translation that puts the card at a point. */
  place: (p: Point3) => string;
  /** One world unit along the track on screen: turns a drag into a distance. */
  along: [number, number];
}

/**
 * A pocket's stack height for `cards` of the batch: none for none, one card's thickness for one, and each card after
 * adding the same step, so the fullest pocket reaches STACK_MAX. An empty pocket shows its bare floor.
 */
export const stackHeight = (cards: number, most: number) => {
  if (cards <= 0) return 0;
  const step = most > 1 ? (STACK_MAX - ONE_CARD) / (most - 1) : 0;
  return ONE_CARD + (Math.min(cards, most) - 1) * step;
};

/** The kicker behind the track at each pocket: its rod's reach at rest and at full stroke, along y. */
const KICK_ROD_Y = 16;
const KICK_PAD_D = 1.2;
export const KICK_REST = 1;
export const KICK_MAX = RAIL_FRONT_Y - KICK_PAD_D - KICK_ROD_Y;
/** How far the kicker's rod reaches when its pad touches the back of a card centred at `cardY`. */
export const kickReach = (cardY: number) => Math.min(KICK_MAX, Math.max(KICK_REST, cardY - CARD_HALF_D - KICK_PAD_D - KICK_ROD_Y));

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
  // the base's corner screws, inside the groove (the body hides the back left one)
  back.push(D(k.corners(FLOOR, 6.5).map((p) => at([p[0], p[1], 0])), { size: 0.55, tone: "hi" }));
  for (const [x, y] of byDepth(k.corners(BODY, 7))) {
    back.push(S(k.cylinder(x, y, 4.2, 0, 1.4, P, 20), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 2.8, 1.4, BODY_Z - 1.4, P, 20), { tone: "mid" }));
  }
  const body = k.slabOf(BODY, BODY_Z, DECK_Z - BODY_Z - 1, P, 8, 0.8);
  // A kick plate along the front and an access panel on the end, screwed at its corners.
  // The kick plate's top edge runs round every face that shows and ends on the outline; the panel stands on it.
  const panel = [
    k.sideSeam(BODY, 12, P, 8),
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
  // the power switch on the end, above the vent
  back.push(S(k.slabOf({ x: 200, y: 31, w: 1.4, d: 5, r: 0.4 }, 31, 4, P, 2, 0.2), { tone: "mid", crease: "none" }));
  back.push(S(k.slabOf({ x: 201.2, y: 32.6, w: 0.8, d: 1.8, r: 0.3 }, 32.2, 1.6, P, 2), { tone: "hi", crease: "none" }));

  // --- the deck: plate, rails, ruler, wear plates ------------------------------------------
  const DECK: Plan = { x: 2, y: 2, w: 196, d: 42, r: 1.5 };
  const rails = RAILS_Y.map((y) => S(k.slabOf({ x: 6, y, w: 166, d: RAIL_D, r: 0.5 }, DECK_Z, 1.4, P, 2, 0.2), { tone: "mid", crease: "none" }));
  // the scale in front of the rails: a base line, and ticks standing on it
  const RULER_Y = 33;
  const ruler = k.topTicks(8, 168, 4, 5, RULER_Y, DECK_Z, [1.2, 2.6], P);
  const rulerBase = seg([8, RULER_Y, DECK_Z], [168, RULER_Y, DECK_Z]);
  // a flush wear plate at each pocket, where a kicked card slides to the deck's front edge, screwed at its back corners
  const plates: string[] = [];
  const plateScrews: Point3[] = [];
  for (let i = 0; i < POCKETS; i++) {
    const cx = pocketX(i);
    plates.push(k.planOutline({ x: cx - 8, y: 36.5, w: 16, d: 6.5, r: 0.6 }, DECK_Z, P, 4));
    plateScrews.push([cx - 6.4, 38, DECK_Z], [cx + 6.4, 38, DECK_Z]);
  }
  back.push(
    S(k.slabOf(DECK, DECK_Z - 1, 1, P, 6, 0.4), {
      tone: "mid",
      inner: [L(plates.join(""), { tone: "lo" }), L(rulerBase, { tone: "lo" }), L(ruler.minor, { tone: "faint" }), L(ruler.major, { tone: "lo" })].join(""),
    }),
  );
  back.push(D(k.corners(DECK, 3.5).map((p) => at([p[0], p[1], DECK_Z])), { size: 0.5, tone: "hi" }));
  back.push(D(plateScrews.map(at), { size: 0.4, tone: "mid" }));
  // A kicker behind the track at each pocket: a solenoid housing whose rod pushes a card forward, off the rails and
  // over the deck's front edge into the pocket below. Only the rod and pad move (`kicker`).
  for (let i = 0; i < POCKETS; i++) {
    const cx = pocketX(i);
    const housing: Plan = { x: cx - 3, y: KICK_ROD_Y - 6, w: 6, d: 6, r: 0.6 };
    // its power lead first: out of the housing's side and down into a grommet in the deck (the housing covers where it starts)
    back.push(k.wireSvg(at([cx + 6.5, KICK_ROD_Y - 3, DECK_Z]), at([cx, KICK_ROD_Y - 3, DECK_Z + 1.6]), { tone: "lo", via: [at([cx + 4.4, KICK_ROD_Y - 3, DECK_Z + 1.5])], size: 0.45 }));
    back.push(S(k.slabOf(housing, DECK_Z, 4.4, P, 3, 0.3), { tone: "mid", inner: L(k.sideSeam(housing, DECK_Z + 2.2, P, 3), { tone: "faint" }) }));
    back.push(D([at([cx - 1.8, KICK_ROD_Y - 4.8, DECK_Z + 4.4]), at([cx + 1.8, KICK_ROD_Y - 1.2, DECK_Z + 4.4])], { size: 0.4, tone: "hi" }));
  }
  back.push(...rails);

  // --- the reader: a post behind the track, an arm over it, a head that reads each card ------
  const POST: Plan = { x: 157, y: 3, w: 6, d: 6, r: 0.8 };
  back.push(S(k.slabOf({ x: 155, y: 1, w: 10, d: 10, r: 1 }, DECK_Z, 1.2, P, 3, 0.3), { tone: "lo" }));
  back.push(S(k.slabOf(POST, DECK_Z + 1.2, 12.8, P, 3, 0.3), { tone: "mid" }));
  // the head's cable, down the post's front face from under the arm (the arm, drawn over, hides where it enters)
  back.push(k.wireSvg(at([158, 9, 57]), at([158, 9, 47]), { tone: "lo", via: [at([156.4, 10.5, 52])], size: 0.6 }));

  const over: string[] = [];
  over.push(S(k.slabOf({ x: 157.5, y: 4, w: 5, d: 23, r: 0.6 }, 56, 3, P, 3, 0.3), { tone: "mid" }));
  over.push(S(k.cylinder(READ_X, TRACK_Y, 3.4, 50.6, 5.4, P, 28, 0.3), { tone: "mid", inner: L(k.sideArc(READ_X, TRACK_Y, 3.4, 52.4, P), { tone: "faint" }) }));
  over.push(S(k.cylinder(READ_X, TRACK_Y, 2, 49.4, 1.2, P, 20), { tone: "lo", crease: "none" }));
  // the knob that sets the reader's height
  over.push(S(k.cylinder(160, 6, 2.6, 59, 2.6, P, 24), { tone: "mid", inner: L(k.knurl(160, 6, 2.6, 59, 61.6, 22, P, 0), { tone: "lo" }) }));

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
  back.push(S(k.cylinder(184, 24, 2.2, 63, 3, P, 24), { tone: "mid", inner: L(k.knurl(184, 24, 2.2, 63, 66, 20, P, 0), { tone: "lo" }) }));
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
    // a label holder on the lip
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
    const h = stackHeight(cards, most);
    if (h <= 0) return "";
    const cx = pocketX(i);
    // the same size as a flying card, so a landing card squares up on the stack
    const plan: Plan = { x: cx - 7, y: LAND_Y - CARD_HALF_D, w: 14, d: 2 * CARD_HALF_D, r: 0.6 };
    const seams: string[] = [];
    for (let z = POCKET_FLOOR_Z + 1.2; z < POCKET_FLOOR_Z + h - 0.4; z += 1.2) seams.push(k.sideSeam(plan, z, P, 3));
    return S(k.slabOf(plan, POCKET_FLOOR_Z, h, P, 3, 0.2), { tone: "hi", crease: "lo", inner: L(seams.join(""), { tone: "faint" }) });
  };

  const card = S(k.slabOf({ x: -7, y: -CARD_HALF_D, w: 14, d: 2 * CARD_HALF_D, r: 0.6 }, 0, 0.8, P, 3), { tone: "hi", lit: true, crease: "none", className: "iso-accent" });
  const kicker = (i: number, reach: number) => {
    const cx = pocketX(i);
    const r = Math.min(KICK_MAX, Math.max(KICK_REST, reach));
    // the rod leaves the housing at mid-height; the pad rides just clear of the rails
    const rod = S(k.slabOf({ x: cx - 0.5, y: KICK_ROD_Y, w: 1, d: r, r: 0.2 }, DECK_Z + 2.1, 1, P, 2), { tone: "lo", crease: "none" });
    const pad = S(k.slabOf({ x: cx - 4, y: KICK_ROD_Y + r, w: 8, d: KICK_PAD_D, r: 0.3 }, CARD_Z + 0.1, 2.2, P, 2, 0.15), { tone: "mid", crease: "none" });
    return rod + pad;
  };
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
    kicker,
    place,
    along: k.axisVector(P, [1, 0, 0]),
  };
}
