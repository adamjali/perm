/**
 * Social cards for the site's PAGES, built from real screenshots.
 *
 * One layout for every page, in the site's own language: the page's real
 * screenshot as the card's one object (ink edge, a hard lime offset), the
 * page's name beside it, and the site's black footer across the bottom with
 * the wordmark and the address. Every card shows its page; a drawn stand-in
 * says less than the page itself, legal pages included (their contents list
 * is the picture). Nothing on the card is a live figure in type: a static
 * image of a number that moves weekly is wrong by the second week. Each
 * card's `label` stays in the spec as the page's one-line summary; it isn't
 * drawn.
 *
 *   node scripts/make-page-cards.mjs <spec.json> <shots-dir> [--only slug]
 *
 * The spec is scripts/page-cards.json, kept in the repo so a re-render never
 * depends on a scratch folder: capture the shots with capture-card-shots.mjs
 * (which fills each card's `shot` and `crop`), then render.
 *
 * spec: [{ slug, title, label, shot, crop: [x, y, w, h] }]
 * The shot is a 1440-wide capture at device scale 2; `crop` is the region to
 * inset, in capture pixels, at the frame's own ratio (capture-card-shots.mjs
 * measures it). Output: public/og/<slug>.jpg at 1200x630.
 */
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
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
/** The site's page ground, its ink, its footer and its lime. */
const C = { bg: "#FAFAFA", ink: "#141414", footer: "#141414", onFooter: "#D4D4D4", lime: "#2ECC40" };
const esc = (s) => String(s).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]);
/** A title's words, a form code kept whole: "H-1B" never breaks after "H-". */
const titleHtml = (t) => esc(t).split(" ").map((w) => (/^[A-Z]{1,3}-\d/.test(w) ? `<span class="nb">${w}</span>` : w)).join(" ");

/**
 * The grid. 64px side margins, a 96px footer, the frame's top level with the
 * margin above it, and its lime offset ending 24px over the footer: a frame of
 * 652x446. capture-card-shots.mjs cuts every shot to that ratio (FRAME_RATIO).
 */
const M = 64;
const FOOT = 96;
const SHADOW = 12;
const FRAME = { left: 472, top: 52, width: W - M - SHADOW - 472, height: H - FOOT - 24 - SHADOW - 52 };

async function insetDataUrl(shotPath, crop) {
  const [x, y, w, h] = crop;
  // Drawn at twice the frame's size, so the card's downscale keeps type crisp;
  // cut to the frame's ratio from the top if a crop is a little long.
  const width = FRAME.width * 2;
  const height = FRAME.height * 2;
  const buf = await sharp(shotPath)
    .extract({ left: x, top: y, width: w, height: h })
    .resize({ width, height, fit: "cover", position: "top" })
    .jpeg({ quality: 92 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/**
 * A second picture in front of the frame, for a page with two sides (the
 * homepage: the case lookup for someone waiting, the case folder for whoever
 * files). `second: { file, width, left, top }` in card pixels; the picture's
 * paper ground is cut away in the page so only its object stands on the card.
 */
function secondHtml(second) {
  if (!second) return "";
  const url = `data:image/webp;base64,${readFileSync(second.file).toString("base64")}`;
  return `<canvas id="second" style="position:absolute;left:${second.left}px;top:${second.top}px;width:${second.width}px"></canvas>
<script>
(() => {
  const img = new Image();
  img.onload = () => {
    const c = document.getElementById("second");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    const px = d.data, w = c.width, h = c.height;
    const [r0, g0, b0] = [px[0], px[1], px[2]];
    const near = (i) => Math.abs(px[i] - r0) + Math.abs(px[i + 1] - g0) + Math.abs(px[i + 2] - b0) < 18;
    const seen = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const p = stack.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      if (!near(p * 4)) continue;
      px[p * 4 + 3] = 0;
      const x = p % w, y = (p - x) / w;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - w);
      if (y < h - 1) stack.push(p + w);
    }
    g.putImageData(d, 0, 0);
    document.body.dataset.second = "ready";
  };
  img.src = ${JSON.stringify(url)};
})();
</script>`;
}

function html(card, inset) {
  const f = (p) => `url(data:font/woff2;base64,${readFileSync(p).toString("base64")}) format('woff2')`;
  const n = card.title.length;
  const titlePx = n <= 12 ? 64 : n <= 20 ? 58 : n <= 30 ? 50 : 44;
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:SG;src:${f(FONTS.grotesk)};font-weight:300 700;font-display:block}
@font-face{font-family:IN;src:${f(FONTS.inter)};font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
.card{position:relative;width:${W}px;height:${H}px;background:${C.bg};color:${C.ink};overflow:hidden}
.text{position:absolute;left:${M}px;top:0;width:${FRAME.left - M - 40}px;height:${H - FOOT}px;display:flex;align-items:center}
/* With a second picture under it, the title moves to the top of its column. */
.text.top{top:${FRAME.top + 12}px;height:auto;align-items:flex-start}
.nb{white-space:nowrap}
.title{font-family:SG;font-weight:700;font-size:${titlePx}px;line-height:1.04;letter-spacing:-.02em;text-wrap:balance}
.frame{position:absolute;left:${FRAME.left}px;top:${FRAME.top}px;width:${FRAME.width}px;height:${FRAME.height}px;
  border:3px solid ${C.ink};background:#fff;box-shadow:${SHADOW}px ${SHADOW}px 0 0 ${C.lime};overflow:hidden}
.frame img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.foot{position:absolute;left:0;right:0;bottom:0;height:${FOOT}px;background:${C.footer};display:flex;align-items:center;
  justify-content:space-between;padding:0 ${M}px}
.brand{font-family:SG;font-weight:700;font-size:30px;color:#fff;letter-spacing:-.01em}
.brand b{color:${C.lime}}
.site{font-family:IN;font-weight:600;font-size:22px;color:${C.onFooter}}
</style>
<div class="card">
  <div class="text${card.second ? " top" : ""}"><div class="title">${titleHtml(card.title)}</div></div>
  <div class="frame"><img src="${inset}" alt=""></div>
  ${secondHtml(card.second)}
  <div class="foot"><div class="brand"><b>PERM</b> Tracker</div><div class="site">permtracker.app</div></div>
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
    if (!card.shot) throw new Error(`${card.slug}: no shot; capture it with capture-card-shots.mjs`);
    const inset = await insetDataUrl(join(shotsDir, card.shot), card.crop);
    await page.setContent(html(card, inset), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    if (card.second) await page.waitForFunction(() => document.body.dataset.second === "ready", null, { timeout: 30_000 });
    const fit = await page.evaluate(() => {
      const t = document.querySelector(".title").getBoundingClientRect();
      return { top: Math.round(t.top), bottom: Math.round(t.bottom), right: Math.round(t.right), lines: Math.round(t.height / (parseFloat(getComputedStyle(document.querySelector(".title")).fontSize) * 1.04)) };
    });
    // The title stays on the paper, clear of the footer and the frame.
    const floor = card.second ? card.second.top - 20 : H - 96 - 24;
    if (fit.top < 40 || fit.bottom > floor || fit.right > 472 - 24) throw new Error(`${card.slug}: the title doesn't fit its column (${JSON.stringify(fit)})`);
    const png = await page.screenshot({ type: "png" });
    const out = join(OUT, `${card.slug}.jpg`);
    await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
    console.log(`  ${card.slug}.jpg  "${card.title}"  title ${fit.lines} line(s)`);
  }
} finally {
  await browser.close();
}
console.log(`${cards.length} card(s) rendered to ${OUT}`);
