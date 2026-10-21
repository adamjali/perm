// The site's still pictures: small isometric objects drawn with the anatomy-asset kit (copied in
// ./kit, MIT, from ~/.claude/skills/anatomy-asset). One camera, one part vocabulary, grey with the
// site's lime as the single accent, and no motion (the site's calm rules: nothing moves by itself).
//
// Every picture is built once per page colour it sits on, because the kit fills every solid with
// the page's own colour so nearer parts hide farther ones: an <img> SVG can't read the site's
// `.dark` class, so the page swaps a light and a dark file (src/components/ui/spot-picture.tsx).
// Pictures that only ever sit on a dark band (the homepage's "Both sides", the attorney page's
// security band) are built for that band alone.
//
//   node scripts/spot-pictures/build.mjs          writes public/images/spots/*.svg and
//                                                 src/lib/spotPictures.ts (the manifest)
//   node scripts/spot-pictures/build.mjs --sheet  also writes a contact sheet page to $SHEET_DIR

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as a from "./kit/asset.mjs";
import * as G from "./kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "public", "images", "spots");
const MANIFEST = join(ROOT, "src", "lib", "spotPictures.ts");

// The site's lime (globals.css --primary), and the page colours each picture sits on.
const LIME = "#2ECC40";
const PAGE = { light: "#FAFAFA", dark: "#111111" };
const TINT = { light: "#EDF2E9", dark: "#1B211C" }; // bg-tint, where the app's empty states sit
const BAND_HOME = "#161616"; // AudienceBlocks' dark band, in both themes
const BAND_SECURITY = "#141414"; // SecuritySection's dark band, in both themes

const AZIMUTH = 55;
const ELEVATION = 35;
const SCREW = 0.55;

// ---------- drawing helpers (the projection P is set per picture) ----------
let P = null;
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const depth = ([x, y, z = 0]) => k.depthOf([x, y, z], P);
const byDepth = (items, key = (i) => i) => [...items].sort((p, q) => depth(key(p)) - depth(key(q)));
const lime = (svg) => `<g class="ac-lime">${svg}</g>`;
const rubber = (svg) => `<g class="ac-rubber">${svg}</g>`;
const wood = (svg) => `<g class="ac-wood">${svg}</g>`;
const halo = (plan, z, blur = 3) => `<path class="iso-halo" d="${k.haloOf(plan, z, 0.1, P)}" style="filter:blur(${blur}px)"/>`;
const screws = (pts, z, ring = 1.2) =>
  L(pts.map(([x, y]) => k.ring(x, y, ring, z, P, 14)).join(""), { tone: "lo" }) + D(pts.map(([x, y]) => at([x, y, z])), { size: SCREW });
// Closed outlines on vertical faces: y = const (the front, lower left on screen) or x = const (the side).
const faceY = (y, x0, x1, z0, z1) => k.pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].map(at), true);
const faceX = (x, y0, y1, z0, z1) => k.pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]].map(at), true);
const segY = (y, x0, z0, x1, z1) => k.pathOf([[x0, y, z0], [x1, y, z1]].map(at));
const segX = (x, y0, z0, y1, z1) => k.pathOf([[x, y0, z0], [x, y1, z1]].map(at));
const slab = (plan, z, h, style = {}, steps = 3, bevel = 0.3) => S(k.slabOf(plan, z, h, P, steps, bevel), style);
// A box on a vertical face that sticks out toward the viewer: plan x0..x1, y0..y1, z0..z1.
const block = (x0, x1, y0, y1, z0, z1, style = {}, r = 0.4) => slab({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, z0, z1 - z0, style, 2, 0.2);
// A ring of a rectangle turned by `deg` about its centre, for parts that don't sit square.
const turned = (cx, cy, w, d, deg) => {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
};
const prism = (ring, z, h, style = {}) => S(k.extrude(ring, z, h, P), style);
// A frame for G.prismOf and the lathe: o the origin, a the axis, u and v the polygon's plane.
const frame = (o, a2, u, v) => G.frameOf(o, a2, u, v);
const up = (o) => G.frameAlong(o, [0, 0, 1]);

// ---------- the shared base: a tray on rubber feet, with corner screws ----------
const TRAY = { x: -36, y: -36, w: 72, d: 72, r: 5 };
const TRAY_Z = -5;
const FOOT_Z = -9;
function tray(plan = TRAY) {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, -3), FOOT_Z, 4, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(plan, 9.5))) {
    out.push(rubber(S(k.cylinder(x, y, 4.6, FOOT_Z, 1.2, P, 16), { tone: "lo" })));
    out.push(S(k.cylinder(x, y, 3.4, FOOT_Z + 1.2, TRAY_Z - FOOT_Z - 1.2, P, 14), { tone: "mid" }));
  }
  out.push(S(k.slabOf(plan, TRAY_Z, -TRAY_Z, P, 5, 1.1), { tone: "mid", inner: L(k.sideSeam(plan, TRAY_Z + 1.5, P, 5), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 4), 0, P, 4), { tone: "faint" }));
  out.push(screws(k.corners(plan, 6.5), 0));
  return out.join("");
}
const trayPoints = (plan = TRAY) => k.boxCorners(k.insetPlan(plan, -3), FOOT_Z, 0);

// ======================================================================================
// Topic spots (/guides and /blog): one object per topic, on the shared tray.
// ======================================================================================

// Start here: a pocket compass, lid open behind it, the north half of its needle in lime.
function compass() {
  const C = [2, 4];
  const R = 23;
  const out = [tray()];
  out.push(halo({ x: C[0] - R, y: C[1] - R, w: 2 * R, d: 2 * R, r: R }, 0, 3));
  // the lid, standing open behind the case on its hinge
  const hinge = [C[0], C[1] - R - 1.6];
  out.push(S(G.disc(-1.4, 0, R, frame([hinge[0], hinge[1] - 1.4, 9 + R], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), { tone: "mid" }));
  out.push(S(G.disc(0, 0.6, R - 2.4, frame([hinge[0], hinge[1] - 1.4, 9 + R], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), { tone: "lo", crease: "none" }));
  // hinge knuckles
  out.push(S(G.disc(-5, 5, 1.8, frame([hinge[0], hinge[1], 8], [1, 0, 0], [0, 1, 0], [0, 0, 1]), P), { tone: "mid" }));
  // the case: base, body, bezel with ticks, glass ring
  out.push(S(k.cylinder(C[0], C[1], R, 0, 2, P, 40, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(C[0], C[1], R - 0.6, 2, 6, P, 40, 0.3), { tone: "mid", inner: L(k.ringSeam(k.circleRing(C[0], C[1], R - 0.6, 40), 4, P), { tone: "faint" }) }));
  out.push(S(k.cylinder(C[0], C[1], R - 0.4, 8, 1.6, P, 40, 0.3), { tone: "hi" }));
  out.push(S(k.cylinder(C[0], C[1], R - 3.6, 6, 2, P, 40), { tone: "lo", crease: "none" }));
  out.push(L(k.radialTicks(C[0], C[1], R - 1.8, 36, 9, 9.6, [1.2, 2.6], P), { tone: "mid" }));
  out.push(L(k.ring(C[0], C[1], R - 7, 8, P, 40), { tone: "faint" }));
  // the needle: a long diamond, north (lime) and south (grey) halves, on a pivot
  const t = (-38 * Math.PI) / 180;
  const dir = [Math.cos(t), Math.sin(t)];
  const nrm = [-dir[1], dir[0]];
  const pt = (s, w) => [C[0] + dir[0] * s + nrm[0] * w, C[1] + dir[1] * s + nrm[1] * w];
  const north = [pt(0, -2.2), pt(15, 0), pt(0, 2.2)];
  const south = [pt(0, 2.2), pt(-15, 0), pt(0, -2.2)];
  out.push(prism(south, 8.6, 0.8, { tone: "mid" }));
  out.push(lime(prism(north, 8.6, 0.8, { tone: "hi" })));
  out.push(S(k.cylinder(C[0], C[1], 1.5, 8.6, 1.6, P, 16), { tone: "hi" }));
  out.push(D([at([C[0], C[1], 10.2])], { size: 0.5 }));
  // the bow ring at the front, for a lanyard
  const bow = [C[0], C[1] + R + 2];
  out.push(S(G.ringBand(-0.8, 0.8, 2.2, 3.6, frame([bow[0], bow[1] + 1, 4], [1, 0, 0], [0, 1, 0], [0, 0, 1]), P), { tone: "mid" }));
  return out.join("");
}
const compassPoints = () => [...trayPoints(), [2, -21, 9 + 2 * 23 + 1]];

// Your case status: a rubber stamp beside its ink pad; the pad's ink in lime.
function stamp() {
  const out = [tray()];
  // the ink pad, back left: a tin with a lime pad inset, its lid leaning on it
  const PAD = { x: -31, y: -30, w: 38, d: 28, r: 2 };
  out.push(halo(PAD, 0));
  out.push(slab(PAD, 0, 5, { tone: "mid", inner: L(k.sideSeam(PAD, 2.4, P, 3), { tone: "faint" }) }, 3, 0.5));
  out.push(lime(slab(k.insetPlan(PAD, 3), 5, 0.8, { tone: "hi" }, 3, 0)));
  out.push(screws([[PAD.x + 2.2, PAD.y + 2.2], [PAD.x + PAD.w - 2.2, PAD.y + 2.2]], 5, 0.9));
  // the stamp, front right: rubber die, wooden mount with an index strip, stem, knob
  const SX = 11, SY = 11;
  const DIE = { x: SX - 13, y: SY - 9, w: 26, d: 18, r: 1 };
  out.push(halo(k.insetPlan(DIE, -2), 0, 3));
  out.push(rubber(slab(DIE, 0, 2.4, { tone: "lo" }, 2, 0.2)));
  out.push(lime(slab(k.insetPlan(DIE, 0.6), 0, 0.5, { tone: "mid", crease: "none" }, 2, 0)));
  const MOUNT = { x: DIE.x - 0.6, y: DIE.y - 0.6, w: DIE.w + 1.2, d: DIE.d + 1.2, r: 1.2 };
  out.push(wood(slab(MOUNT, 2.4, 7, { tone: "mid", inner: L(k.sideSeam(MOUNT, 5.6, P, 3), { tone: "faint" }) }, 3, 0.6)));
  out.push(L(faceY(MOUNT.y + MOUNT.d, MOUNT.x + 6, MOUNT.x + MOUNT.w - 6, 4, 7.6), { tone: "lo" }));
  out.push(S(k.cylinder(SX, SY, 4.2, 9.4, 1.4, P, 24, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(SX, SY, 2.4, 10.8, 10, P, 20), { tone: "mid", inner: L(k.ringSeam(k.circleRing(SX, SY, 2.4, 20), 14, P), { tone: "faint" }) }));
  out.push(wood(S(G.lathe([[20.8, 0], [20.8, 3.2], [23, 5.6], [27, 6.4], [30.5, 5.2], [32.4, 2.8], [33, 0]], up([SX, SY, 0]), P, { bevel: 0.6 }), { tone: "hi" })));
  return out.join("");
}
const stampPoints = () => [...trayPoints(), [12, 12, 34]];

// Timing and the queue: a short roller conveyor with three trays of files, the front one lime.
function conveyor() {
  const out = [tray()];
  const X0 = -30, X1 = 30, Y0 = -12, Y1 = 12, Z = 16;
  out.push(halo({ x: X0, y: Y0, w: X1 - X0, d: Y1 - Y0, r: 2 }, 0));
  const legs = byDepth([[X0 + 4, Y0 + 2], [X1 - 4, Y0 + 2], [X0 + 4, Y1 - 2], [X1 - 4, Y1 - 2]]);
  const rail = (y) => slab({ x: X0, y, w: X1 - X0, d: 2.6, r: 0.6 }, Z - 3.2, 3.2, { tone: "mid" }, 2, 0.3);
  const back = [], front = [];
  for (const [x, y] of legs) (y < 0 ? back : front).push([x, y]);
  for (const [x, y] of back) out.push(slab({ x: x - 1.6, y: y - 1.6, w: 3.2, d: 3.2, r: 0.5 }, 0, Z - 3.2, { tone: "mid" }, 2, 0.2));
  out.push(rail(Y0));
  // rollers between the rails
  for (let x = X0 + 3; x <= X1 - 3; x += 5) out.push(S(G.disc(Y0 + 2.6, Y1 - 2.6, 1.3, frame([x, 0, Z - 1.4], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), { tone: "lo", crease: "none" }));
  // trays, back of the line first: the line runs toward +x (screen right), the front tray last
  const trays = [X0 + 2, X0 + 22, X0 + 42];
  trays.forEach((x, i) => {
    const plan = { x, y: Y0 + 1.5, w: 16, d: Y1 - Y0 - 3, r: 1 };
    const cls = i === 2 ? lime : (s) => s;
    out.push(cls(slab(plan, Z, 2.4, { tone: "mid" }, 2, 0.3)));
    const pile = k.insetPlan(plan, 1.8);
    const h = [7, 4.5, 9][i];
    const seams = [];
    for (let z = Z + 2.4 + 1.6; z < Z + 2.4 + h - 0.6; z += 1.6) seams.push(k.sideSeam(pile, z, P, 2));
    out.push(slab(pile, Z + 2.4, h, { tone: "hi", crease: "lo", inner: L(seams.join(""), { tone: "faint" }) }, 2, 0.2));
  });
  out.push(rail(Y1 - 2.6));
  for (const [x, y] of front) out.push(slab({ x: x - 1.6, y: y - 1.6, w: 3.2, d: 3.2, r: 0.5 }, 0, Z - 3.2, { tone: "mid" }, 2, 0.2));
  out.push(screws([[X0 + 4, Y1 - 1.3], [X1 - 4, Y1 - 1.3]].map(([x, y]) => [x, y]), Z, 0.7));
  return out.join("");
}
const conveyorPoints = () => [...trayPoints(), [-30, -12, 30], [30, 12, 30]];

// Deadlines and recruitment: a desk calendar pad, ringed at the top, one day marked in lime.
function calendar() {
  const out = [tray()];
  const PADP = { x: -29, y: -26, w: 58, d: 52, r: 1.4 };
  const H = 7;
  out.push(halo(PADP, 0));
  const seams = [];
  for (let z = 1.2; z < H - 0.4; z += 1.1) seams.push(k.sideSeam(PADP, z, P, 2));
  out.push(slab(PADP, 0, H, { tone: "hi", crease: "lo", inner: L(seams.join(""), { tone: "faint" }) }, 2, 0.2));
  // the header band at the back, and its two rings
  const HEAD = { x: PADP.x - 0.4, y: PADP.y - 0.4, w: PADP.w + 0.8, d: 12, r: 1.2 };
  out.push(slab(HEAD, H, 2.6, { tone: "mid" }, 2, 0.4));
  for (const x of [PADP.x + 16, PADP.x + PADP.w - 16]) {
    out.push(S(G.ringBand(-0.9, 0.9, 3.2, 4.4, frame([x, HEAD.y + 4, H + 2.6], [1, 0, 0], [0, 1, 0], [0, 0, 1]), P), { tone: "hi" }));
  }
  // the day grid: 7 columns by 5 weeks, ruled cells, one day marked
  const gx = PADP.x + 4, gy = HEAD.y + HEAD.d + 3, cw = (PADP.w - 8) / 7, ch = (PADP.y + PADP.d - 3 - gy) / 5;
  const rules = [];
  for (let i = 0; i <= 7; i++) rules.push(k.lineOnTop([gx + i * cw, gy], [gx + i * cw, gy + 5 * ch], H, P));
  for (let j = 0; j <= 5; j++) rules.push(k.lineOnTop([gx, gy + j * ch], [gx + 7 * cw, gy + j * ch], H, P));
  out.push(L(rules.join(""), { tone: "faint" }));
  const days = [];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) days.push(at([gx + i * cw + 1.6, gy + j * ch + 1.6, H]));
  out.push(D(days, { size: 0.32, tone: "lo" }));
  const mark = { x: gx + 4 * cw + 0.7, y: gy + 3 * ch + 0.7, w: cw - 1.4, d: ch - 1.4, r: 0.4 };
  out.push(lime(slab(mark, H, 0.7, { tone: "hi" }, 2, 0)));
  return out.join("");
}
const calendarPoints = () => [...trayPoints(), [-32, -26, 16]];

// Wages, wage requests and LCAs: four stacks of coins rising like DOL's four wage levels, the
// tallest in lime, on a pay slip.
function coins() {
  const out = [tray()];
  const SLIP = { x: -31, y: -15, w: 62, d: 36, r: 0.6 };
  out.push(slab(SLIP, 0, 0.6, { tone: "hi", crease: "none" }, 2, 0));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([SLIP.x + 4, SLIP.y + SLIP.d - 4 - i * 2.4], [SLIP.x + 22 - i * 4, SLIP.y + SLIP.d - 4 - i * 2.4], 0.6, P)).join(""), { tone: "lo", free: true }));
  const stacks = [[-21, 4, 3], [-7, 2, 5], [7, 0, 8], [21, -2, 11]];
  for (const [x, y, n] of byDepth(stacks, ([x, y]) => [x, y])) {
    out.push(halo({ x: x - 7, y: y - 7, w: 14, d: 14, r: 7 }, 0.6, 2));
    const cls = n === 11 ? lime : (s) => s;
    for (let i = 0; i < n; i++) {
      const z = 0.6 + i * 2;
      const off = ((i * 37) % 5) * 0.12 - 0.24;
      out.push(cls(S(k.cylinder(x + off, y - off, 6.4, z, 2, P, 32, 0.3), { tone: i === n - 1 ? "hi" : "mid", crease: "faint" })));
    }
    const top = 0.6 + n * 2;
    out.push(cls(L(k.ring(x, y, 4.6, top, P, 32), { tone: "lo" })));
  }
  return out.join("");
}
const coinsPoints = () => [...trayPoints(), [21, -2, 24]];

// Employers and law firms: an office building with its windows, roof plant and a lime door.
function building() {
  const out = [tray()];
  const B = { x: -24, y: -22, w: 46, d: 40, r: 0.8 };
  const H = 52;
  out.push(halo(k.insetPlan(B, -4), 0));
  const PLINTH = k.insetPlan(B, -3);
  out.push(slab(PLINTH, 0, 3, { tone: "mid" }, 2, 0.4));
  const floors = [];
  for (let z = 3 + 9; z < H - 2; z += 9) floors.push(k.sideSeam(B, z, P, 2));
  out.push(slab(B, 3, H - 3, { tone: "hi", crease: "lo", inner: L(floors.join(""), { tone: "faint" }) }, 2, 0.3));
  // windows on the front (y = B.y + B.d) and the side (x = B.x + B.w)
  const fy = B.y + B.d, sx = B.x + B.w;
  const wins = [];
  for (let z = 3 + 9 + 2; z < H - 4; z += 9) {
    for (let x = B.x + 4; x + 5 <= B.x + B.w - 3; x += 7.4) wins.push(faceY(fy, x, x + 5, z, z + 5));
    for (let y = B.y + 4; y + 5 <= B.y + B.d - 3; y += 7.6) wins.push(faceX(sx, y, y + 5, z, z + 5));
  }
  out.push(L(wins.join(""), { tone: "mid" }));
  // ground floor: a lime door with a canopy over it on the front
  const DX = B.x + B.w / 2 - 4;
  out.push(lime(block(DX, DX + 8, fy - 0.2, fy + 0.6, 3, 11, { tone: "hi" })));
  out.push(L(segY(fy + 0.6, DX + 4, 3, DX + 4, 11), { tone: "lit" }));
  out.push(block(DX - 3, DX + 11, fy, fy + 5, 12, 13.4, { tone: "mid" }));
  // the roof: parapet, plant room, vents
  const ROOF = k.insetPlan(B, 1.6);
  out.push(L(k.planOutline(ROOF, H, P, 2), { tone: "lo" }));
  const PLANT = { x: B.x + 8, y: B.y + 8, w: 16, d: 14, r: 0.6 };
  out.push(slab(PLANT, H, 7, { tone: "mid" }, 2, 0.3));
  out.push(L([0, 1, 2].map((i) => faceY(PLANT.y + PLANT.d, PLANT.x + 3 + i * 4, PLANT.x + 5 + i * 4, H + 2, H + 5.4)).join(""), { tone: "lo" }));
  for (const [x, y] of byDepth([[B.x + 32, B.y + 10], [B.x + 34, B.y + 28]])) {
    out.push(S(k.cylinder(x, y, 2.4, H, 3.2, P, 18, 0.3), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, 3, H + 3.2, 0.8, P, 18), { tone: "hi" }));
  }
  return out.join("");
}
const buildingPoints = () => [...trayPoints(), [-24, -22, 60]];

// After PERM: a take-a-number dispenser on its stand, the next ticket out in lime: the wait for
// a visa number.
function dispenser() {
  const out = [tray()];
  const C = [0, 0];
  out.push(halo({ x: -14, y: -14, w: 28, d: 28, r: 14 }, 0));
  out.push(S(k.cylinder(C[0], C[1], 13, 0, 2.2, P, 40, 0.4), { tone: "mid" }));
  out.push(screws(k.circleRing(C[0], C[1], 9.5, 4).map((p) => p), 2.2, 0.8));
  out.push(S(k.cylinder(C[0], C[1], 2.3, 2.2, 22, P, 18), { tone: "mid" }));
  out.push(S(k.cylinder(C[0], C[1], 4.4, 23.4, 1.6, P, 24, 0.3), { tone: "mid" }));
  // the body: a drum with a domed cap
  const R = 15;
  out.push(S(k.cylinder(C[0], C[1], R, 25, 15, P, 48, 0.5), { tone: "hi", inner: L(k.ringSeam(k.circleRing(C[0], C[1], R, 48), 29, P), { tone: "faint" }) }));
  out.push(S(G.lathe([[40, 0], [40, R - 0.4], [41.8, R - 1.6], [43, R - 4.6], [43.6, 0]], up([C[0], C[1], 0]), P, { bevel: 0.5 }), { tone: "hi" }));
  // the ticket slot on the front, and the next ticket out of it, toward the viewer
  // the slot faces the screen's right, so the ticket reads as a strip coming out sideways
  const ang = (8 * Math.PI) / 180;
  const ex = [Math.cos(ang), Math.sin(ang)];
  const side = [-ex[1], ex[0]];
  const p = (s, w) => [C[0] + ex[0] * s + side[0] * w, C[1] + ex[1] * s + side[1] * w];
  const slotZ = 33;
  const slot = [p(R + 0.2, -5), p(R + 0.2, 5)];
  out.push(L(k.pathOf([[...slot[0], slotZ + 1.2], [...slot[1], slotZ + 1.2], [...slot[1], slotZ - 0.6], [...slot[0], slotZ - 0.6]].map(at), true), { tone: "hi" }));
  out.push(lime(prism([p(R - 1, -4.6), p(R + 15, -4.6), p(R + 15, 4.6), p(R - 1, 4.6)], slotZ, 0.6, { tone: "hi" })));
  out.push(lime(L(k.pathOf([p(R + 7, -4.6), p(R + 7, 4.6)].map(([x, y]) => at([x, y, slotZ + 0.6]))), { tone: "mid", dotted: true })));
  return out.join("");
}
const dispenserPoints = () => [...trayPoints(), [0, 0, 44]];

// H-2A, H-2B and CW-1: a slatted harvest crate of fruit, one of them a lime.
function crate() {
  const out = [tray()];
  const CR = { x: -28, y: -22, w: 56, d: 42, r: 0.6 };
  const H = 18;
  out.push(halo(k.insetPlan(CR, -3), 0));
  // the crate floor and the back and left walls first (behind the fruit)
  out.push(wood(slab(CR, 0, 1.6, { tone: "mid" }, 2, 0.2)));
  const slatH = 4.2, gap = 1.6;
  const wallsBack = [], wallsFront = [];
  for (let z = 1.6; z + slatH <= H + 0.01; z += slatH + gap) {
    wallsBack.push(wood(slab({ x: CR.x, y: CR.y, w: CR.w, d: 1.6, r: 0.3 }, z, slatH, { tone: "mid" }, 2, 0.2)));
    wallsBack.push(wood(slab({ x: CR.x, y: CR.y, w: 1.6, d: CR.d, r: 0.3 }, z, slatH, { tone: "mid" }, 2, 0.2)));
    wallsFront.push(wood(slab({ x: CR.x, y: CR.y + CR.d - 1.6, w: CR.w, d: 1.6, r: 0.3 }, z, slatH, { tone: "mid" }, 2, 0.2)));
    wallsFront.push(wood(slab({ x: CR.x + CR.w - 1.6, y: CR.y, w: 1.6, d: CR.d, r: 0.3 }, z, slatH, { tone: "mid" }, 2, 0.2)));
  }
  out.push(...wallsBack);
  // fruit, two layers, painted back to front
  const fruit = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) fruit.push([CR.x + 8 + i * 13.3, CR.y + 8 + j * 13, 9, 6.2]);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) fruit.push([CR.x + 14.5 + i * 13.3, CR.y + 14.5 + j * 13, 17, 6.2]);
  const LIME_AT = fruit.length - 2;
  const order = byDepth(fruit.map((f, i) => ({ f, i })), ({ f }) => [f[0], f[1], f[2]]);
  for (const { f, i } of order) {
    const ball = S(G.sphereOf([f[0], f[1], f[2]], f[3], P), { tone: "hi", crease: "none" });
    out.push(i === LIME_AT ? lime(ball) : ball);
    const stem = L(k.rise([f[0] + 0.6, f[1]], f[2] + f[3] - 0.6, f[2] + f[3] + 1.8, P), { tone: "hi" });
    out.push(i === LIME_AT ? lime(stem) : stem);
  }
  out.push(...wallsFront);
  // nails at the slat ends
  const nails = [];
  for (let z = 1.6 + slatH / 2; z < H; z += slatH + gap) nails.push(at([CR.x + 2.4, CR.y + CR.d, z]), at([CR.x + CR.w - 2.4, CR.y + CR.d, z]), at([CR.x + CR.w, CR.y + CR.d - 2.4, z]));
  out.push(D(nails, { size: 0.35 }));
  return out.join("");
}
const cratePoints = () => [...trayPoints(), [0, 0, 24]];

// Data notes: a card index box, its cards standing in rows, one lime divider raised above them.
function cardIndex() {
  const out = [tray()];
  const BX = { x: -24, y: -30, w: 46, d: 60, r: 0.8 };
  const H = 16, T = 1.6;
  out.push(halo(k.insetPlan(BX, -3), 0));
  out.push(wood(slab(BX, 0, 2, { tone: "mid" }, 2, 0.3)));
  // back wall and left wall
  out.push(wood(slab({ x: BX.x, y: BX.y, w: BX.w, d: T, r: 0.3 }, 2, H - 2, { tone: "mid" }, 2, 0.2)));
  out.push(wood(slab({ x: BX.x, y: BX.y, w: T, d: BX.d, r: 0.3 }, 2, H - 2, { tone: "mid" }, 2, 0.2)));
  // cards, back to front: thin plates across the box, a tab on every fifth, the divider in lime
  const CARD = (y, h, cls) => {
    const card = slab({ x: BX.x + T + 0.6, y, w: BX.w - 2 * T - 1.2, d: 0.6, r: 0 }, 2, h, { tone: "hi", crease: "none" }, 1, 0);
    return cls ? cls(card) : card;
  };
  let n = 0;
  for (let y = BX.y + T + 1.2; y < BX.y + BX.d - T - 3; y += 1.4) {
    n++;
    const divider = n === 18;
    out.push(CARD(y, divider ? H + 5 : H - 2.4 + (n % 3) * 0.3, divider ? lime : null));
    if (divider) {
      const tab = { x: BX.x + 26, y, w: 10, d: 0.6, r: 0 };
      out.push(lime(slab(tab, H + 5, 3.4, { tone: "hi", crease: "none" }, 1, 0)));
    } else if (n % 6 === 0) {
      const tx = BX.x + 6 + ((n / 6) % 3) * 12;
      out.push(slab({ x: tx, y, w: 8, d: 0.6, r: 0 }, H - 2.4, 2.6, { tone: "hi", crease: "none" }, 1, 0));
    }
  }
  // front and right walls, a pull ring on the front
  out.push(wood(slab({ x: BX.x, y: BX.y + BX.d - T, w: BX.w, d: T, r: 0.3 }, 2, H - 2, { tone: "mid" }, 2, 0.2)));
  out.push(wood(slab({ x: BX.x + BX.w - T, y: BX.y, w: T, d: BX.d, r: 0.3 }, 2, H - 2, { tone: "mid" }, 2, 0.2)));
  const fy = BX.y + BX.d;
  out.push(block(BX.x + BX.w / 2 - 6, BX.x + BX.w / 2 + 6, fy, fy + 0.6, 8, 12, { tone: "mid" }));
  out.push(L(faceY(fy + 0.6, BX.x + BX.w / 2 - 4.4, BX.x + BX.w / 2 + 4.4, 8.8, 11.2), { tone: "lo" }));
  out.push(S(G.ringBand(-0.6, 0.6, 1.6, 2.6, frame([BX.x + BX.w / 2, fy + 1.4, 5.6], [1, 0, 0], [0, 1, 0], [0, 0, 1]), P), { tone: "mid" }));
  return out.join("");
}
const cardIndexPoints = () => [...trayPoints(), [-24, -30, 28]];

// Explainers: a stack of three books, a lime ribbon marker hanging from the top one.
function books() {
  const out = [tray()];
  const book = (cx, cy, w, d, h, deg, z) => {
    const ring = turned(cx, cy, w, d, deg);
    const pages = turned(cx + 0.9 * Math.sin((deg * Math.PI) / 180), cy - 0.9 * Math.cos((deg * Math.PI) / 180) + 0.9, w - 2.4, d - 1.6, deg);
    const parts = [];
    parts.push(prism(ring, z, 1, { tone: "mid" }));
    const seams = [];
    for (let s = 1.6; s < h - 2; s += 0.9) seams.push(k.pathOf([...pages, pages[0]].map(([x, y]) => at([x, y, z + s])), false));
    parts.push(prism(pages, z + 1, h - 2, { tone: "hi", crease: "lo", inner: L(seams.join(""), { tone: "faint" }) }));
    parts.push(prism(ring, z + h - 1, 1, { tone: "mid" }));
    return parts.join("");
  };
  out.push(halo({ x: -30, y: -24, w: 60, d: 48, r: 4 }, 0));
  out.push(book(0, 0, 58, 40, 9, -4, 0));
  out.push(book(-1, -1, 52, 36, 8, 5, 9));
  out.push(book(1, 0, 46, 32, 7, -2, 17));
  // the ribbon from the top book over its front edge
  const t = (-2 * Math.PI) / 180;
  const fx = 1 + Math.sin(-t) * 0, fy = 0 + 16 * Math.cos(t);
  const rib = (z0, z1, y) => block(fx + 6, fx + 9.6, y, y + 0.4, z0, z1, { tone: "hi" }, 0.1);
  out.push(lime(rib(9, 24, fy + 1.4)));
  out.push(lime(L(segY(fy + 1.8, fx + 6, 9, fx + 7.8, 7.4) + segY(fy + 1.8, fx + 9.6, 9, fx + 7.8, 7.4), { tone: "mid" })));
  return out.join("");
}
const booksPoints = () => [...trayPoints(), [0, 0, 26]];

// For practitioners: a briefcase standing on its feet, its two latches in lime.
function briefcase() {
  const out = [tray()];
  const B = { x: -27, y: -9, w: 54, d: 18, r: 3 };
  const H = 40;
  out.push(halo(k.insetPlan(B, -3), 0));
  for (const [x, y] of byDepth(k.corners(B, 5))) out.push(rubber(S(k.cylinder(x, y, 1.6, 0, 1.4, P, 12), { tone: "lo" })));
  out.push(S(k.slabOf(B, 1.4, H, P, 5, 1.4), { tone: "mid", inner: L(k.sideSeam(B, 1.4 + H * 0.62, P, 5), { tone: "lo" }) + L(k.sideSeam(k.insetPlan(B, -0.1), 1.4 + H - 3, P, 5), { tone: "faint" }) }));
  // stitched panel on the front
  const fy = B.y + B.d;
  out.push(L(faceY(fy, B.x + 5, B.x + B.w - 5, 5, 1.4 + H * 0.62 - 3), { tone: "faint", dashed: true }));
  // latches
  for (const x of [B.x + 13, B.x + B.w - 19]) {
    out.push(lime(block(x, x + 6, fy - 0.1, fy + 1.2, 1.4 + H * 0.62 - 2.6, 1.4 + H * 0.62 + 2.6, { tone: "hi" }, 0.3)));
    out.push(lime(D([at([x + 3, fy + 1.2, 1.4 + H * 0.62])], { size: 0.45 })));
  }
  // corner guards at the top, and the handle
  for (const x of [B.x + 0.6, B.x + B.w - 4.6]) out.push(block(x, x + 4, B.y - 0.4, B.y + B.d + 0.4, 1.4 + H - 4, 1.4 + H + 0.5, { tone: "hi" }, 0.6));
  const HZ = 1.4 + H;
  for (const x of [-9, 9]) {
    out.push(slab({ x: x - 2.4, y: -2.4, w: 4.8, d: 4.8, r: 1 }, HZ, 1.6, { tone: "lo" }, 2, 0.3));
    out.push(S(k.cylinder(x, 0, 1.2, HZ + 1.6, 4, P, 12), { tone: "mid" }));
  }
  out.push(slab({ x: -11, y: -2.2, w: 22, d: 4.4, r: 2 }, HZ + 5.6, 3.2, { tone: "hi" }, 4, 0.5));
  return out.join("");
}
const briefcasePoints = () => [...trayPoints(), [0, 0, 52]];

// ======================================================================================
// The homepage's "Both sides" pair, on the dark band
// ======================================================================================
const PLINTH = { x: -44, y: -20, w: 88, d: 40, r: 4 };

// For the person waiting: a split-flap board on its feet, one module turned to lime.
function splitFlap() {
  const out = [tray(PLINTH)];
  const B = { x: -38, y: -8, w: 76, d: 14, r: 1.4 };
  const Z0 = 10, H = 38;
  out.push(halo(k.insetPlan(B, -2), 0));
  for (const x of [B.x + 12, B.x + B.w - 16]) {
    out.push(slab({ x, y: B.y + 2, w: 4, d: B.d - 4, r: 0.6 }, 0, Z0, { tone: "mid" }, 2, 0.3));
    out.push(slab({ x: x - 3, y: B.y - 1, w: 10, d: B.d + 2, r: 1 }, 0, 1.6, { tone: "lo" }, 2, 0.3));
  }
  out.push(S(k.slabOf(B, Z0, H, P, 3, 0.8), { tone: "mid" }));
  const fy = B.y + B.d;
  // the bezel and the module grid: 3 rows by 7 modules, each split by its flap hinge
  out.push(L(faceY(fy, B.x + 2.4, B.x + B.w - 2.4, Z0 + 2.4, Z0 + H - 2.4), { tone: "lo" }));
  const cols = 7, rows = 3, mw = (B.w - 9) / cols, mh = (H - 9) / rows;
  const mods = [], hinges = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = B.x + 4.5 + c * mw + 0.5, x1 = x0 + mw - 1;
      const z1 = Z0 + H - 4.5 - r * mh - 0.5, z0 = z1 - mh + 1;
      if (r === 1 && c === 4) continue;
      mods.push(faceY(fy, x0, x1, z0, z1));
      hinges.push(segY(fy, x0, (z0 + z1) / 2, x1, (z0 + z1) / 2));
    }
  }
  out.push(L(mods.join(""), { tone: "hi" }));
  out.push(L(hinges.join(""), { tone: "mid" }));
  // the lime module: two flaps, the upper one falling toward the viewer
  const x0 = B.x + 4.5 + 4 * mw + 0.5, x1 = x0 + mw - 1;
  const z1 = Z0 + H - 4.5 - mh - 0.5, z0 = z1 - mh + 1, zm = (z0 + z1) / 2;
  out.push(lime(block(x0, x1, fy - 0.2, fy + 0.4, z0, zm - 0.2, { tone: "hi" }, 0.1)));
  out.push(lime(S(G.prismOf(frame([x0, fy, zm], [1, 0, 0], [0, 1, 0], [0, 0, 1]), [[0, 0], [3.2, 0.3], [3.8, 0.9], [0.4, (zm - z0) * 0.86]], 0, x1 - x0, P), { tone: "hi" })));
  // status lamp and screws on the top
  out.push(screws([[B.x + 4, B.y + B.d / 2], [B.x + B.w - 4, B.y + B.d / 2]], Z0 + H, 0.8));
  out.push(lime(S(k.cylinder(B.x + B.w - 12, B.y + B.d / 2, 1.6, Z0 + H, 1.2, P, 14), { tone: "hi" })));
  return out.join("");
}
const splitFlapPoints = () => [...trayPoints(PLINTH), [-38, -8, 50], [38, 6, 50]];

// For attorneys: a filing cabinet, its top drawer pulled out on runners, hanging folders inside,
// one tab in lime.
function docket() {
  const out = [tray(PLINTH)];
  const CAB = { x: -22, y: -18, w: 34, d: 30, r: 0.8 };
  const H = 46;
  out.push(halo(k.insetPlan(CAB, -2), 0));
  out.push(slab(CAB, 0, H, { tone: "mid", inner: L(k.sideSeam(CAB, 3, P, 2), { tone: "faint" }) }, 2, 0.6));
  const fy = CAB.y + CAB.d;
  // lower drawer front, closed
  out.push(L(faceY(fy, CAB.x + 2, CAB.x + CAB.w - 2, 4, 22), { tone: "lo" }));
  out.push(block(CAB.x + CAB.w / 2 - 5, CAB.x + CAB.w / 2 + 5, fy, fy + 1.4, 17, 18.6, { tone: "hi" }));
  out.push(L(faceY(fy, CAB.x + CAB.w / 2 - 4, CAB.x + CAB.w / 2 + 4, 19.6, 21), { tone: "lo" }));
  // the top drawer: pulled 22 toward the viewer, its runners, walls and folders
  const OUTD = 22;
  const DR = { x: CAB.x + 2, y: CAB.y + 4, w: CAB.w - 4, d: CAB.d - 4 + OUTD - 2, r: 0.4 };
  const z0 = 25, z1 = H - 3;
  out.push(L(faceY(fy, CAB.x + 2, CAB.x + CAB.w - 2, z0 - 1, H - 2), { tone: "hi" }));
  out.push(slab({ x: DR.x, y: DR.y, w: DR.w, d: DR.d, r: 0.4 }, z0, 1.2, { tone: "lo" }, 2, 0.2));
  out.push(slab({ x: DR.x, y: DR.y + 6, w: 1.2, d: DR.d - 6, r: 0.2 }, z0 + 1.2, z1 - z0 - 4, { tone: "mid" }, 2, 0.2));
  const folders = [];
  for (let y = DR.y + 8; y < DR.y + DR.d - 4; y += 2.4) folders.push(y);
  folders.forEach((y, i) => {
    const plan = { x: DR.x + 2, y, w: DR.w - 4, d: 0.8, r: 0 };
    const h = z1 - z0 - 3 + (i % 2) * 0.6;
    out.push(slab(plan, z0 + 1.2, h, { tone: "hi", crease: "none" }, 1, 0));
    if (i % 3 === 1) {
      const tx = DR.x + 4 + ((i / 3) % 3) * 9;
      const tall = i === 7 ? 5 : 2.6;
      const tab = slab({ x: tx, y, w: 7, d: 0.8, r: 0 }, z0 + 1.2 + h, tall, { tone: "hi", crease: "none" }, 1, 0);
      out.push(i === 7 ? lime(tab) : tab);
    }
  });
  out.push(slab({ x: DR.x + DR.w - 1.2, y: DR.y + 6, w: 1.2, d: DR.d - 6, r: 0.2 }, z0 + 1.2, z1 - z0 - 4, { tone: "mid" }, 2, 0.2));
  // drawer front with handle and a label holder
  const dfy = CAB.y + CAB.d + OUTD;
  out.push(slab({ x: CAB.x + 1, y: dfy - 1.6, w: CAB.w - 2, d: 1.6, r: 0.4 }, z0 - 1, z1 - z0 + 2, { tone: "mid" }, 2, 0.3));
  out.push(L(faceY(dfy, CAB.x + CAB.w / 2 - 4, CAB.x + CAB.w / 2 + 4, z1 - 5.4, z1 - 2.2), { tone: "lo" }));
  out.push(block(CAB.x + CAB.w / 2 - 5, CAB.x + CAB.w / 2 + 5, dfy, dfy + 1.4, z0 + 3, z0 + 4.6, { tone: "hi" }));
  return out.join("");
}
const docketPoints = () => [...trayPoints(PLINTH), [-22, -18, 50], [12, 40, 48]];

// ======================================================================================
// The attorney page's security band: a cabinet of separate safe-deposit doors, each with its
// own lock; one lock plate in lime.
// ======================================================================================
function vault() {
  const BASE = { x: -48, y: -24, w: 96, d: 48, r: 5 };
  const out = [tray(BASE)];
  const C = { x: -40, y: -14, w: 80, d: 24, r: 1 };
  const H = 56, Z0 = 3;
  out.push(halo(k.insetPlan(C, -2), 0));
  out.push(slab({ x: C.x - 2, y: C.y - 2, w: C.w + 4, d: C.d + 4, r: 1.4 }, 0, Z0, { tone: "lo" }, 2, 0.4));
  out.push(slab(C, Z0, H, { tone: "mid", inner: L(k.sideSeam(C, Z0 + H - 3, P, 2), { tone: "faint" }) }, 2, 0.6));
  const fy = C.y + C.d;
  const cols = 4, rows = 4;
  const gx = C.x + 4, gz = Z0 + 4, cw = (C.w - 8) / cols, rh = (H - 8) / rows;
  const doors = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) doors.push([c, r]);
  for (const [c, r] of doors) {
    const x0 = gx + c * cw + 0.8, x1 = gx + (c + 1) * cw - 0.8;
    const z0 = gz + r * rh + 0.8, z1 = gz + (r + 1) * rh - 0.8;
    out.push(block(x0, x1, fy - 0.1, fy + 0.8, z0, z1, { tone: "hi" }, 0.3));
    // hinge pins on the left edge, a lock plate with a keyhole on the right
    out.push(D([at([x0 + 1.2, fy + 0.8, z0 + 2]), at([x0 + 1.2, fy + 0.8, z1 - 2])], { size: 0.4 }));
    const lx = x1 - 6, lz = (z0 + z1) / 2;
    const plate = block(lx, lx + 4, fy + 0.8, fy + 1.4, lz - 2.6, lz + 2.6, { tone: "mid" }, 0.3);
    const hole = L(segY(fy + 1.4, lx + 2, lz + 0.6, lx + 2, lz - 1.2), { tone: "hi" }) + D([at([lx + 2, fy + 1.4, lz + 0.9])], { size: 0.45 });
    out.push(c === 2 && r === 1 ? lime(plate + hole) : plate + hole);
    // a number plate above the lock: a blank engraved panel, no text
    out.push(L(faceY(fy + 0.8, x0 + 3, x0 + 9, z1 - 3.4, z1 - 1.6), { tone: "lo" }));
  }
  return out.join("");
}
const vaultPoints = () => [...trayPoints({ x: -48, y: -24, w: 96, d: 48, r: 5 }), [-40, -14, 62], [40, 10, 62]];

// ======================================================================================
// The app's empty states, on the tint
// ======================================================================================

// No cases yet: an empty desk tray, a lime folder lying beside it ready to go in.
function emptyTray() {
  const out = [tray()];
  const T = { x: -30, y: -26, w: 44, d: 36, r: 1.6 };
  const H = 9;
  out.push(halo(k.insetPlan(T, -2), 0));
  // the tray: floor, then walls back and left, then front and right, a finger notch in front
  out.push(slab(T, 0, 1.4, { tone: "mid" }, 2, 0.3));
  out.push(L(k.planOutline(k.insetPlan(T, 3), 1.4, P, 2), { tone: "faint" }));
  const W = 1.6;
  out.push(slab({ x: T.x, y: T.y, w: T.w, d: W, r: 0.4 }, 1.4, H, { tone: "mid" }, 2, 0.3));
  out.push(slab({ x: T.x, y: T.y, w: W, d: T.d, r: 0.4 }, 1.4, H, { tone: "mid" }, 2, 0.3));
  out.push(slab({ x: T.x + T.w - W, y: T.y, w: W, d: T.d, r: 0.4 }, 1.4, H, { tone: "mid" }, 2, 0.3));
  const fy = T.y + T.d - W;
  out.push(slab({ x: T.x, y: fy, w: T.w / 2 - 6, d: W, r: 0.4 }, 1.4, H, { tone: "mid" }, 2, 0.3));
  out.push(slab({ x: T.x + T.w / 2 + 6, y: fy, w: T.w / 2 - 6, d: W, r: 0.4 }, 1.4, H, { tone: "mid" }, 2, 0.3));
  out.push(slab({ x: T.x + T.w / 2 - 6, y: fy, w: 12, d: W, r: 0.4 }, 1.4, H - 5, { tone: "mid" }, 2, 0.3));
  // the folder: closed, lying on the tray in front right, its tab toward the back
  const F = turned(20, 18, 30, 22, -12);
  out.push(halo({ x: 5, y: 7, w: 30, d: 22, r: 1 }, 0, 2));
  out.push(lime(prism(F, 0, 1.6, { tone: "hi" })));
  const tab = turned(20 + 6 * Math.cos(-0.21) - (-12.4) * Math.sin(-0.21), 18 + 6 * Math.sin(-0.21) + (-12.4) * Math.cos(-0.21), 10, 3, -12);
  out.push(lime(prism(tab, 0, 1.6, { tone: "hi" })));
  out.push(lime(L(k.pathOf([...F, F[0]].map(([x, y]) => at([x, y, 0.8]))), { tone: "mid" })));
  return out.join("");
}
const emptyTrayPoints = () => [...trayPoints(), [-30, -26, 12]];

// No notifications: a desk bell, quiet, its plunger in lime.
function bell() {
  const out = [tray()];
  const C = [0, 2];
  out.push(halo({ x: -20, y: -18, w: 40, d: 40, r: 20 }, 0));
  out.push(wood(S(k.cylinder(C[0], C[1], 19, 0, 5, P, 48, 0.8), { tone: "mid", inner: L(k.ringSeam(k.circleRing(C[0], C[1], 19, 48), 2.2, P), { tone: "faint" }) })));
  out.push(S(k.cylinder(C[0], C[1], 3, 5, 3, P, 20), { tone: "mid" }));
  out.push(S(G.lathe([[7, 0], [7, 16], [9.4, 15.6], [13.2, 13.8], [17.2, 10.4], [20.4, 5.8], [22.2, 2.2], [22.6, 0]], up([C[0], C[1], 0]), P, { bevel: 0.8 }), { tone: "hi" }));
  out.push(lime(S(k.cylinder(C[0], C[1], 1.4, 22.6, 4.4, P, 14), { tone: "mid" })));
  out.push(lime(S(G.lathe([[27, 0], [27, 3.4], [28.4, 3.1], [29.3, 2], [29.6, 0]], up([C[0], C[1], 0]), P), { tone: "hi" })));
  out.push(screws(k.circleRing(C[0], C[1], 15.5, 3).slice(0, 3), 5, 0.8));
  return out.join("");
}
const bellPoints = () => [...trayPoints(), [0, 2, 31]];

// ======================================================================================
// The 404: a signpost with three arms, one in lime.
// ======================================================================================
function signpost() {
  const out = [tray()];
  const C = [0, 0];
  out.push(halo({ x: -10, y: -10, w: 20, d: 20, r: 3 }, 0));
  out.push(slab({ x: -9, y: -9, w: 18, d: 18, r: 1.2 }, 0, 4, { tone: "mid" }, 2, 0.5));
  out.push(screws(k.corners({ x: -9, y: -9, w: 18, d: 18 }, 2.6), 4, 0.7));
  // arms behind the post first, the post, then arms in front: an arm's depth is its tip's
  const arms = [
    { deg: 200, z: 50, len: 30, lime: false },
    { deg: 20, z: 40, len: 32, lime: true },
    { deg: 120, z: 30, len: 26, lime: false },
  ];
  const arm = ({ deg, z, len, lime: isLime }) => {
    const t = (deg * Math.PI) / 180;
    const u = [Math.cos(t), Math.sin(t), 0];
    const n = [-Math.sin(t), Math.cos(t), 0];
    const F = G.frameOf([C[0] + u[0] * 2.4, C[1] + u[1] * 2.4, z], n, u, [0, 0, 1]);
    const H = 7;
    const poly = [[0, -H / 2], [len - 5, -H / 2], [len, 0], [len - 5, H / 2], [0, H / 2]];
    const svg = S(G.prismOf(F, poly, -0.8, 0.8, P), { tone: "hi" });
    const tip = [C[0] + u[0] * len, C[1] + u[1] * len, z];
    return { svg: isLime ? lime(svg) : svg, key: tip };
  };
  const built = arms.map(arm);
  const post = [S(k.slabOf({ x: -2.2, y: -2.2, w: 4.4, d: 4.4, r: 0.6 }, 4, 54, P, 2, 0.3), { tone: "mid" }), S(G.lathe([[58, 0], [58, 3.6], [60, 2.6], [61, 0]], up([0, 0, 0]), P), { tone: "mid" })].join("");
  const postDepth = depth([0, 0, 0]);
  for (const b of byDepth(built, (b) => b.key)) if (depth(b.key) < postDepth) out.push(b.svg);
  out.push(post);
  for (const b of byDepth(built, (b) => b.key)) if (depth(b.key) >= postDepth) out.push(b.svg);
  return out.join("");
}
const signpostPoints = () => [...trayPoints(), [0, 0, 62], [30, 10, 46], [-28, -10, 54]];

// ======================================================================================
// /developers: a wall key cabinet, its door open, keys hanging on hooks, one tag in lime.
// ======================================================================================
function keyCabinet() {
  const out = [tray()];
  const BX = { x: -24, y: -26, w: 48, d: 10, r: 0.8 };
  const H = 50, Z0 = 2;
  out.push(halo(k.insetPlan(BX, -2), 0));
  out.push(slab({ x: BX.x - 2, y: BX.y - 1, w: BX.w + 4, d: BX.d + 4, r: 1 }, 0, Z0, { tone: "lo" }, 2, 0.3));
  // the back panel and the box walls (left and top are seen from inside)
  out.push(slab({ x: BX.x, y: BX.y, w: BX.w, d: 1.6, r: 0.3 }, Z0, H, { tone: "mid" }, 2, 0.3));
  out.push(slab({ x: BX.x, y: BX.y, w: 1.6, d: BX.d, r: 0.3 }, Z0, H, { tone: "mid" }, 2, 0.3));
  out.push(slab({ x: BX.x, y: BX.y, w: BX.w, d: BX.d, r: 0.3 }, Z0, 1.6, { tone: "mid" }, 2, 0.3));
  // hooks and keys in three rows: a hook peg, the key ring, the key and its tag
  const py = BX.y + 1.6;
  const rows = [Z0 + 42, Z0 + 28, Z0 + 14];
  const keys = [];
  rows.forEach((z, r) => {
    for (let c = 0; c < 4; c++) keys.push({ x: BX.x + 6 + c * 10, z, lime: r === 1 && c === 2 });
  });
  for (const kk of keys) {
    out.push(S(G.disc(0, 3, 0.7, frame([kk.x, py, kk.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), { tone: "hi" }));
    const ky = py + 2.2;
    out.push(S(G.ringBand(-0.3, 0.3, 1.1, 1.8, frame([kk.x, ky, kk.z - 1.6], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), { tone: "mid" }));
    // key blade, then the tag on its own little ring
    out.push(block(kk.x - 2.6, kk.x - 1.2, ky - 0.3, ky + 0.3, kk.z - 9, kk.z - 3, { tone: "hi" }, 0.1));
    out.push(S(G.disc(-0.3, 0.3, 1.6, frame([kk.x - 1.9, ky, kk.z - 2.4], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), { tone: "hi" }));
    const tag = block(kk.x + 0.6, kk.x + 4.4, ky - 0.2, ky + 0.4, kk.z - 8.4, kk.z - 3.2, { tone: "hi" }, 0.4);
    out.push(kk.lime ? lime(tag) : tag);
    out.push(D([at([kk.x + 2.5, ky + 0.4, kk.z - 4.2])], { size: 0.35 }));
  }
  // the right wall and the top, then the door: hinged on the left, swung open toward the viewer,
  // so it never stands between the viewer and the keys
  out.push(slab({ x: BX.x + BX.w - 1.6, y: BX.y, w: 1.6, d: BX.d, r: 0.3 }, Z0, H, { tone: "mid" }, 2, 0.3));
  out.push(slab({ x: BX.x, y: BX.y, w: BX.w, d: BX.d, r: 0.3 }, Z0 + H - 1.6, 1.6, { tone: "mid" }, 2, 0.3));
  const hingeX = BX.x, hingeY = BX.y + BX.d;
  const ang = (104 * Math.PI) / 180;
  const du = [Math.cos(ang), Math.sin(ang), 0];
  const inward = [Math.sin(ang), -Math.cos(ang), 0]; // the door's inner face, toward the viewer's right
  const DF = G.frameOf([hingeX, hingeY, Z0], inward, du, [0, 0, 1]);
  out.push(S(G.prismOf(DF, [[0, 0], [BX.w - 1, 0], [BX.w - 1, H], [0, H]], -1.2, 0, P), { tone: "mid" }));
  // on the door's inner face: a frame line, the lock's tongue and the hinges
  const onDoor = (s, h) => at([hingeX + du[0] * s + inward[0] * 0.05, hingeY + du[1] * s + inward[1] * 0.05, Z0 + h]);
  out.push(L(k.pathOf([onDoor(3, 3), onDoor(BX.w - 4, 3), onDoor(BX.w - 4, H - 3), onDoor(3, H - 3)], true), { tone: "faint" }));
  out.push(S(G.prismOf(G.frameOf([hingeX + du[0] * (BX.w - 7), hingeY + du[1] * (BX.w - 7), Z0 + H / 2], inward, du, [0, 0, 1]), [[-1.6, -3], [1.6, -3], [1.6, 3], [-1.6, 3]], 0, 1, P), { tone: "hi" }));
  out.push(D([0.2, 0.8].map((f) => at([hingeX, hingeY, Z0 + H * f])), { size: 0.45 }));
  return out.join("");
}
const keyCabinetPoints = () => [...trayPoints(), [-24, -26, 56], [24, -16, 56], [-24 - 48 * 0.24, -16 + 48 * 0.97, 56]];

// ======================================================================================
// The pictures, their pages and their sets. A set shares one world scale.
// ======================================================================================
const BOTH = (paper) => ({ light: paper.light, dark: paper.dark });
const PICTURES = [
  // topic spots: shown at 96 px
  { name: "topic-start", set: "topics", size: [160, 160], body: compass, points: compassPoints, papers: BOTH(PAGE), label: "A pocket compass with its lid open, the north half of the needle in green." },
  { name: "topic-case-status", set: "topics", size: [160, 160], body: stamp, points: stampPoints, papers: BOTH(PAGE), label: "A rubber stamp beside a green ink pad." },
  { name: "topic-queue", set: "topics", size: [160, 160], body: conveyor, points: conveyorPoints, papers: BOTH(PAGE), label: "A short roller conveyor carrying three trays of files, the front tray green." },
  { name: "topic-deadlines", set: "topics", size: [160, 160], body: calendar, points: calendarPoints, papers: BOTH(PAGE), label: "A desk calendar pad with one day marked in green." },
  { name: "topic-wages", set: "topics", size: [160, 160], body: coins, points: coinsPoints, papers: BOTH(PAGE), label: "Four stacks of coins rising in height, the tallest green, on a pay slip." },
  { name: "topic-employers", set: "topics", size: [160, 160], body: building, points: buildingPoints, papers: BOTH(PAGE), label: "An office building with a green front door." },
  { name: "topic-green-card", set: "topics", size: [160, 160], body: dispenser, points: dispenserPoints, papers: BOTH(PAGE), label: "A take-a-number ticket dispenser with a green ticket coming out." },
  { name: "topic-seasonal", set: "topics", size: [160, 160], body: crate, points: cratePoints, papers: BOTH(PAGE), label: "A slatted harvest crate of fruit, one of them green." },
  { name: "topic-data-notes", set: "topics", size: [160, 160], body: cardIndex, points: cardIndexPoints, papers: BOTH(PAGE), label: "A card index box with a green divider card." },
  { name: "topic-explainers", set: "topics", size: [160, 160], body: books, points: booksPoints, papers: BOTH(PAGE), label: "A stack of three books with a green ribbon marker." },
  { name: "topic-practice", set: "topics", size: [160, 160], body: briefcase, points: briefcasePoints, papers: BOTH(PAGE), label: "A briefcase with green latches." },
  // the homepage pair, on the dark band: shown at 112 px
  { name: "home-waiting", set: "home", size: [200, 150], body: splitFlap, points: splitFlapPoints, papers: { dark: BAND_HOME }, label: "A split-flap board, one module flipping to green." },
  { name: "home-practice", set: "home", size: [200, 150], body: docket, points: docketPoints, papers: { dark: BAND_HOME }, label: "A filing cabinet with its top drawer open, one folder tab green." },
  // the attorney page's security band: shown up to 320 px
  { name: "security-vault", set: "security", size: [360, 300], body: vault, points: vaultPoints, papers: { dark: BAND_SECURITY }, label: "A cabinet of separate safe-deposit doors, each with its own lock, one lock plate green." },
  // the app's empty states, on the tint: shown at 128 px
  { name: "empty-cases", set: "empty", size: [180, 160], body: emptyTray, points: emptyTrayPoints, papers: BOTH(TINT), label: "An empty desk tray with a green folder beside it." },
  { name: "empty-notifications", set: "empty", size: [180, 160], body: bell, points: bellPoints, papers: BOTH(TINT), label: "A quiet desk bell with a green plunger." },
  // the 404 and /developers, on the page: shown at 144 px
  { name: "not-found", set: "page", size: [180, 180], body: signpost, points: signpostPoints, papers: BOTH(PAGE), label: "A signpost with three arms pointing different ways, one arm green." },
  { name: "developers-keys", set: "page", size: [180, 180], body: keyCabinet, points: keyCabinetPoints, papers: BOTH(PAGE), label: "A wall key cabinet with its door open, keys on hooks, one key tag green." },
];

// ---------- size: a lossless path minifier (from the anatomy-asset feature-spots example) ----------
const num = (t) => (t / 10).toString().replace(/^(-?)0\./, "$1.");
function minifyD(d) {
  if (!/^[MLZ0-9 .\-]+$/.test(d)) return d;
  const tokens = d.match(/[MLZ]|-?\d*\.?\d+/g);
  let out = "";
  let cx = 0, cy = 0, sx = 0, sy = 0, first = true, prev = "";
  for (let i = 0; i < tokens.length; ) {
    const c = tokens[i++];
    if (c === "Z") { out += "z"; cx = sx; cy = sy; prev = "z"; continue; }
    const x = Math.round(parseFloat(tokens[i++]) * 10);
    const y = Math.round(parseFloat(tokens[i++]) * 10);
    const dx = first ? x : x - cx;
    const dy = first ? y : y - cy;
    const cmd = c === "M" ? (first ? "M" : "m") : "l";
    const pair = num(dx) + (dy < 0 ? "" : " ") + num(dy);
    out += (cmd === prev && cmd === "l" ? (dx < 0 ? "" : " ") : cmd) + pair;
    prev = cmd;
    first = false;
    cx = x; cy = y;
    if (c === "M") { sx = x; sy = y; }
  }
  return out;
}
const minify = (svg) => svg.replace(/ d="([^"]*)"/g, (_, d) => ` d="${minifyD(d)}"`);

// ---------- build ----------
mkdirSync(OUT, { recursive: true });
const unit = { origin: [0, 0], scale: 1, azimuth: AZIMUTH, elevation: ELEVATION };
const scales = {};
for (const pic of PICTURES) {
  P = { ...unit };
  const fit = k.fitProjection(pic.points(), pic.size[0], pic.size[1], { pad: 8, azimuth: AZIMUTH, elevation: ELEVATION });
  scales[pic.set] = Math.min(scales[pic.set] ?? Infinity, fit.scale);
}
const written = [];
for (const pic of PICTURES) {
  P = { ...unit };
  const fit = k.fitProjection(pic.points(), pic.size[0], pic.size[1], { pad: 8, azimuth: AZIMUTH, elevation: ELEVATION });
  // the set's scale, centred on this picture's own extremes
  const s = scales[pic.set];
  P = { ...fit, scale: s };
  const pts = pic.points().map((p) => k.iso(p, { ...unit, scale: s }));
  const xs = pts.map(([x]) => x), ys = pts.map(([, y]) => y);
  P.origin = [pic.size[0] / 2 - (Math.min(...xs) + Math.max(...xs)) / 2, pic.size[1] / 2 - (Math.min(...ys) + Math.max(...ys)) / 2];
  const files = {};
  for (const [theme, paper] of Object.entries(pic.papers)) {
    const id = `${pic.name}-${theme}`;
    const svg = a.assetSvg({
      width: pic.size[0],
      height: pic.size[1],
      label: pic.label,
      body: minify(pic.body()),
      paper,
      theme,
      accents: {
        lime: LIME,
        rubber: theme === "light" ? "#3a3c44" : "#070809",
        // the plan keeps every picture grey with lime: "wood" is a mid grey, a material apart from the paper
        wood: theme === "light" ? "#bdbdb8" : "#454545",
      },
      weight: 0.5,
      motion: false,
      id,
    });
    writeFileSync(join(OUT, `${id}.svg`), svg);
    files[theme] = { file: `/images/spots/${id}.svg`, bytes: Buffer.byteLength(svg) };
  }
  written.push({ ...pic, files });
  console.log(`${pic.name}: ${Object.entries(files).map(([t, f]) => `${t} ${(f.bytes / 1024).toFixed(1)} KB`).join(", ")}`);
}

// ---------- the manifest the site reads ----------
const lines = written.map((p) => {
  const themes = Object.keys(p.files).map((t) => `${t}: "${p.files[t].file}"`).join(", ");
  return `  "${p.name}": { width: ${p.size[0]}, height: ${p.size[1]}, ${themes} },`;
});
writeFileSync(
  MANIFEST,
  `/**
 * The site's still isometric pictures (scripts/spot-pictures/build.mjs writes this file and the SVGs
 * under public/images/spots/). Each picture is drawn once per page colour it sits on: \`light\` and
 * \`dark\` swap with the site's theme class; a picture with \`dark\` alone sits on a band that is dark
 * in both themes. SpotPicture (src/components/ui/spot-picture.tsx) renders them.
 */
export interface SpotPictureFiles {
  width: number;
  height: number;
  light?: string;
  dark: string;
}

export const SPOT_PICTURES = {
${lines.join("\n")}
} as const satisfies Record<string, SpotPictureFiles>;

export type SpotPictureName = keyof typeof SPOT_PICTURES;
`,
);
console.log(`wrote ${MANIFEST}`);

// ---------- a contact sheet, for looking (not shipped) ----------
const sheetDir = process.env.SHEET_DIR;
if (process.argv.includes("--sheet") && sheetDir) {
  mkdirSync(sheetDir, { recursive: true });
  const cell = (p, theme, paper) => `<figure style="background:${paper};margin:0;padding:12px;width:${p.size[0] * 2 + 24}px"><img src="${join(OUT, `${p.name}-${theme}.svg`)}" width="${p.size[0] * 2}" height="${p.size[1] * 2}" alt=""><figcaption style="font:12px system-ui;color:#888">${p.name} ${theme}</figcaption></figure>`;
  const cells = written.flatMap((p) => Object.entries(p.papers).map(([t, paper]) => cell(p, t, paper)));
  writeFileSync(join(sheetDir, "sheet.html"), `<!doctype html><html><body style="margin:0;background:#777;display:flex;flex-wrap:wrap;gap:4px">${cells.join("")}</body></html>`);
  console.log(`wrote ${join(sheetDir, "sheet.html")}`);
}
