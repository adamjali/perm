/**
 * Social cards for the site's PAGES, built from real screenshots.
 *
 * WHY. Every page used to share one Open Graph image: an AI-drawn laptop whose
 * screen showed an invented "Immigration Case Tracking Dashboard" with
 * I-140, biometrics and interview steps, none of which is PERM. Google Images
 * showed that for the site, and the rival's per-page screenshots for theirs
 * (measured 2026-09-07: permtrack.app ships og-timeline, og-cases, og-map).
 *
 * Each card here is the house frame (the same grounds, dots and type as the
 * article cards in make-article-cards.mjs) with a real screenshot of the page
 * inset on the right and readable type on the left. Nothing on the card is a
 * live figure, because a static image of a number that moves weekly is a lie
 * by the second week; the label states what the page IS.
 *
 *   node scripts/make-page-cards.mjs <spec.json> <shots-dir> [--only slug]
 *
 * spec: [{ slug, ground, eyebrow, title, label, shot, crop: [x, y, w, h] }]
 * The shot is a 1440-wide browser capture; `crop` is the region to inset, in
 * capture pixels. Output: public/og/<slug>.jpg at 1200x630.
 */
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "public/og";
const W = 1200;
const H = 630;
const FONTS = {
  grotesk: ".next/static/media/36966cca54120369-s.p.woff2",
  mono: ".next/static/media/558ca1a6aa3cb55e-s.p.woff2",
};
const GROUNDS = {
  paper: { bg: "#FAFAFA", ink: "#000000", accent: "#2ECC40", dot: "rgba(0,0,0,.10)" },
  ink: { bg: "#000000", ink: "#FAFAFA", accent: "#2ECC40", dot: "rgba(250,250,250,.13)" },
  lime: { bg: "#2ECC40", ink: "#000000", accent: "#000000", dot: "rgba(0,0,0,.13)" },
};
const esc = (s) => String(s).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]);

/** A drawn motif for pages where a screenshot says nothing (indexes, legal, contact). */
function motif(kind, c) {
  const soft = c.ink === "#000000" ? "rgba(0,0,0,.13)" : "rgba(250,250,250,.20)";
  const R = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${c.ink}" stroke-width="3"/>`;
  const box = (inner) => `<svg viewBox="0 0 440 330" width="440" height="330" aria-hidden="true">${inner}</svg>`;
  let s = "";
  if (kind === "grid") {
    const lit = new Set([7, 8, 19, 26, 33]);
    for (let i = 0; i < 40; i++) s += R(12 + (i % 8) * 54, 60 + Math.floor(i / 8) * 54, 42, 42, lit.has(i) ? c.accent : soft);
  } else if (kind === "stack") {
    for (let d = 3; d >= 1; d--) s += R(10 + d * 26, 40 + d * 22, 330, 190, soft);
    s += R(10, 40, 330, 190, c.bg);
    [88, 124, 160].forEach((y, i) => (s += `<line x1="42" y1="${y}" x2="${i === 2 ? 220 : 306}" y2="${y}" stroke="${c.ink}" stroke-width="3" opacity=".45"/>`));
    s += R(200, 186, 128, 30, c.accent);
  } else if (kind === "steps") {
    s = `<line x1="10" y1="290" x2="430" y2="290" stroke="${c.ink}" stroke-width="3"/>`;
    const pts = [[10, 250], [95, 250], [95, 196], [180, 196], [180, 158], [265, 158], [265, 104], [350, 104], [350, 58], [430, 58]];
    s += `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ")}" fill="none" stroke="${c.accent}" stroke-width="10"/>`;
    s += R(336, 44, 28, 28, c.accent);
  } else if (kind === "record") {
    for (let r = 0; r < 4; r++) for (let f = 0; f < 3; f++) s += R(10 + f * 108, 60 + r * 58, 96, 40, r === 2 ? c.accent : soft);
    s += R(340, 60 + 2 * 58, 90, 40, "none");
  } else if (kind === "window") {
    s = `<line x1="10" y1="170" x2="430" y2="170" stroke="${c.ink}" stroke-width="3"/>` + R(96, 106, 250, 128, c.accent);
    [96, 346].forEach((x) => (s += `<line x1="${x}" y1="70" x2="${x}" y2="270" stroke="${c.ink}" stroke-width="6"/>`));
  }
  return box(s);
}

async function insetDataUrl(shotPath, crop) {
  const [x, y, w, h] = crop;
  // The inset box is 560 wide; keep the crop's own ratio, cap the height.
  const buf = await sharp(shotPath).extract({ left: x, top: y, width: w, height: h }).resize({ width: 1120 }).jpeg({ quality: 92 }).toBuffer();
  const meta = await sharp(buf).metadata();
  return { url: `data:image/jpeg;base64,${buf.toString("base64")}`, ratio: meta.height / meta.width };
}

function html(card, c, inset) {
  const f = (p) => `url(data:font/woff2;base64,${readFileSync(p).toString("base64")}) format('woff2')`;
  const n = card.title.length;
  const titlePx = n <= 18 ? 74 : n <= 26 ? 62 : n <= 34 ? 52 : 44;
  const insetW = 560;
  const insetH = inset ? Math.min(430, Math.round(insetW * inset.ratio)) : 0;
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:SG;src:${f(FONTS.grotesk)};font-weight:100 900;font-display:block}
@font-face{font-family:JBM;src:${f(FONTS.mono)};font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
.card{position:relative;width:${W}px;height:${H}px;background:${c.bg};color:${c.ink};
  background-image:radial-gradient(${c.dot} 1.6px, transparent 1.6px);background-size:26px 26px;
  display:flex;align-items:center;gap:40px;padding:0 56px}
.text{flex:1;min-width:0}
.eyebrow{font-family:JBM;font-weight:700;font-size:20px;letter-spacing:.14em;text-transform:uppercase;opacity:.72}
.title{font-family:SG;font-weight:700;font-size:${titlePx}px;line-height:1.02;letter-spacing:-.03em;margin-top:18px;text-wrap:balance}
.rule{height:12px;background:${c.accent};margin-top:20px;width:min(100%,260px);border:3px solid ${c.ink}}
.label{font-family:SG;font-weight:500;font-size:26px;line-height:1.28;margin-top:20px;max-width:520px;text-wrap:balance}
.brand{position:absolute;left:56px;bottom:34px;font-family:JBM;font-weight:700;font-size:20px;letter-spacing:.06em;opacity:.8}
.shot{flex:0 0 ${insetW}px;width:${insetW}px;height:${insetH}px;border:3px solid ${c.ink};
  box-shadow:12px 12px 0 ${c.ink === "#000000" ? "#000000" : "#2ECC40"};background:#fff;overflow:hidden}
.shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:top left}
.art{flex:0 0 440px;height:330px;display:flex;align-items:center;justify-content:center}
</style>
<div class="card">
  <div class="text">
    <div class="eyebrow">${esc(card.eyebrow)}</div>
    <div class="title">${esc(card.title)}</div>
    <div class="rule"></div>
    <div class="label">${esc(card.label)}</div>
  </div>
  ${inset ? `<div class="shot"><img src="${inset.url}" alt=""></div>` : `<div class="art">${motif(card.motif, c)}</div>`}
  <div class="brand">permtracker.app</div>
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
    const c = GROUNDS[card.ground] ?? GROUNDS.paper;
    const inset = card.shot ? await insetDataUrl(join(shotsDir, card.shot), card.crop) : null;
    await page.setContent(html(card, c, inset), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => {
      const t = document.querySelector(".text"); const r = t.getBoundingClientRect();
      return { bottom: Math.round(r.bottom), lines: Math.round(document.querySelector(".label").getBoundingClientRect().height / 33) };
    });
    if (overflow.bottom > H - 70) throw new Error(`${card.slug}: text column runs into the footer (${overflow.bottom}px)`);
    const png = await page.screenshot({ type: "png" });
    const out = join(OUT, `${card.slug}.jpg`);
    await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
    console.log(`  ${card.slug}.jpg  ${card.ground}  "${card.title}"  label ${overflow.lines} line(s)`);
  }
} finally {
  await browser.close();
}
console.log(`${cards.length} card(s) rendered to ${OUT}`);
