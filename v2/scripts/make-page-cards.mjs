/**
 * Social cards for the site's PAGES, built from real screenshots.
 *
 * Picture first (owner, Oct 15 2026: "visual, less text"): the page's real
 * screenshot large on the right as the site draws an object (2px ink edge,
 * hard offset), running off the card's edges; on the left only the wordmark,
 * the page's name and the address (or a drawn motif for indexes and legal
 * pages). Nothing on the card is a live figure, because a static image of a
 * number that moves weekly is wrong by the second week. Each card's `label`
 * stays in the spec as the page's one-line summary; it isn't drawn.
 *
 *   node scripts/make-page-cards.mjs <spec.json> <shots-dir> [--only slug]
 *
 * The spec is scripts/page-cards.json, kept in the repo so a re-render never
 * depends on a scratch folder: capture the shots with capture-card-shots.mjs
 * (which fills each card's `shot` and `crop`), then render.
 *
 * spec: [{ slug, title, label, shot, crop: [x, y, w, h] } | { slug, title, label, motif }]
 * The shot is a 1440-wide capture at device scale 2; `crop` is the region to
 * inset, in capture pixels (scripts/capture-card-shots.mjs writes both).
 * Output: public/og/<slug>.jpg at 1200x630.
 */
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.env.CARD_OUT ?? "public/og";
const W = 1200;
const H = 630;
// The site's own fonts. next/font writes them to the build's media folder
// under hashed names; copy the latin Space Grotesk and Inter files (the ones
// with ".p." in the name, preloaded) into a folder as space-grotesk.woff2 and
// inter.woff2 and point CARD_FONTS at it.
if (!process.env.CARD_FONTS) throw new Error("CARD_FONTS must name a folder holding space-grotesk.woff2 and inter.woff2");
const FONTS = { grotesk: join(process.env.CARD_FONTS, "space-grotesk.woff2"), inter: join(process.env.CARD_FONTS, "inter.woff2") };
/** The site's page ground and its object: ink edge, hard offset, lime for "now". */
const C = { bg: "#FAFAFA", tint: "#F0F0EE", ink: "#141414", soft: "#3D3D3D", muted: "#5E5E5E", line: "#E5E5E5", drawn: "#C8C8C8", control: "#858585", accent: "#1A7A25", fill: "#2ECC40" };
const esc = (s) => String(s).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]);

/** A drawn motif for pages where a screenshot says nothing (indexes, legal, contact). */
function motif(kind) {
  const R = (x, y, w, h, fill, stroke = C.control) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  const box = (inner) => `<svg viewBox="0 0 440 330" width="440" height="330" aria-hidden="true">${inner}</svg>`;
  let s = "";
  if (kind === "grid") {
    const lit = new Set([7, 8, 19, 26, 33]);
    for (let i = 0; i < 40; i++) s += R(12 + (i % 8) * 54, 60 + Math.floor(i / 8) * 54, 42, 42, lit.has(i) ? C.fill : "#FFFFFF", lit.has(i) ? C.ink : C.drawn);
  } else if (kind === "stack") {
    for (let d = 3; d >= 1; d--) s += R(10 + d * 26, 40 + d * 22, 330, 190, "#FFFFFF", C.drawn);
    s += R(10, 40, 330, 190, "#FFFFFF");
    [88, 124, 160].forEach((y, i) => (s += `<line x1="42" y1="${y}" x2="${i === 2 ? 220 : 306}" y2="${y}" stroke="${C.drawn}" stroke-width="6"/>`));
    s += R(200, 186, 128, 30, C.fill, C.ink);
  } else if (kind === "steps") {
    s = `<line x1="10" y1="290" x2="430" y2="290" stroke="${C.control}" stroke-width="1.5"/>`;
    const pts = [[10, 250], [95, 250], [95, 196], [180, 196], [180, 158], [265, 158], [265, 104], [350, 104], [350, 58], [430, 58]];
    s += `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ")}" fill="none" stroke="${C.accent}" stroke-width="4"/>`;
  } else if (kind === "record") {
    for (let r = 0; r < 4; r++) for (let f = 0; f < 3; f++) s += R(10 + f * 108, 60 + r * 58, 96, 40, r === 2 ? C.fill : "#FFFFFF", r === 2 ? C.ink : C.drawn);
  } else if (kind === "window") {
    s = `<line x1="10" y1="170" x2="430" y2="170" stroke="${C.control}" stroke-width="1.5"/>` + R(96, 106, 250, 128, C.fill, C.ink);
    [96, 346].forEach((x) => (s += `<line x1="${x}" y1="70" x2="${x}" y2="270" stroke="${C.ink}" stroke-width="2"/>`));
  }
  return box(s);
}

async function insetDataUrl(shotPath, crop) {
  const [x, y, w, h] = crop;
  // The picture is drawn 700 wide; keep the crop's own ratio (the card clips it).
  const buf = await sharp(shotPath).extract({ left: x, top: y, width: w, height: h }).resize({ width: 1400 }).jpeg({ quality: 92 }).toBuffer();
  const meta = await sharp(buf).metadata();
  return { url: `data:image/jpeg;base64,${buf.toString("base64")}`, ratio: meta.height / meta.width };
}

function html(card, inset) {
  const f = (p) => `url(data:font/woff2;base64,${readFileSync(p).toString("base64")}) format('woff2')`;
  const n = card.title.length;
  const titlePx = n <= 14 ? 64 : n <= 22 ? 56 : n <= 32 ? 48 : 42;
  const shotW = 700;
  const shotH = inset ? Math.round(shotW * inset.ratio) : 0;
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:SG;src:${f(FONTS.grotesk)};font-weight:300 700;font-display:block}
@font-face{font-family:IN;src:${f(FONTS.inter)};font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
.card{position:relative;width:${W}px;height:${H}px;background:${C.bg};color:${C.ink};overflow:hidden}
.band{position:absolute;left:0;right:0;bottom:0;height:150px;background:${C.tint}}
.text{position:absolute;left:64px;top:150px;width:380px}
.brand{position:absolute;left:64px;top:52px;font-family:SG;font-weight:700;font-size:28px}
.brand b{color:${C.accent}}
.title{font-family:SG;font-weight:700;font-size:${titlePx}px;line-height:1.04;letter-spacing:-.02em;text-wrap:balance}
.site{position:absolute;left:64px;bottom:52px;font-family:IN;font-weight:600;font-size:22px;color:${C.ink}}
.shot{position:absolute;left:480px;top:74px;width:${shotW}px;height:${Math.max(shotH, 620)}px;border:3px solid ${C.ink};background:#fff;
  box-shadow:10px 10px 0 0 ${C.ink};overflow:hidden}
.shot img{display:block;width:100%;height:auto}
.art{position:absolute;left:560px;top:120px;width:560px;height:420px;display:flex;align-items:center;justify-content:center;
  background:#fff;border:3px solid ${C.ink};box-shadow:10px 10px 0 0 ${C.ink}}
</style>
<div class="card">
  <div class="band"></div>
  <div class="brand"><b>PERM</b> Tracker</div>
  <div class="text"><div class="title">${esc(card.title)}</div></div>
  ${inset ? `<div class="shot"><img src="${inset.url}" alt=""></div>` : `<div class="art">${motif(card.motif)}</div>`}
  <div class="site">permtracker.app</div>
</div>`;
}

const [specPath, shotsDir] = process.argv.slice(2);
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
let cards = JSON.parse(readFileSync(specPath, "utf8"));
if (only) cards = cards.filter((c) => c.slug === only);
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const card of cards) {
    const inset = card.shot ? await insetDataUrl(join(shotsDir, card.shot), card.crop) : null;
    await page.setContent(html(card, inset), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => {
      const t = document.querySelector(".text").getBoundingClientRect();
      return { top: Math.round(t.top), bottom: Math.round(t.bottom), lines: Math.round(t.height / 50) };
    });
    if (overflow.bottom > H - 110 || overflow.top < 110) throw new Error(`${card.slug}: the title runs into the brand or the address (${overflow.top} to ${overflow.bottom}px)`);
    const png = await page.screenshot({ type: "png" });
    const out = join(OUT, `${card.slug}.jpg`);
    await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
    console.log(`  ${card.slug}.jpg  "${card.title}"  title ${overflow.lines} line(s)`);
  }
} finally {
  await browser.close();
}
console.log(`${cards.length} card(s) rendered to ${OUT}`);
