/**
 * Designed card art for every article whose card was a UI screenshot.
 *
 * WHY THESE EXIST. A screenshot of a data table is illegible at the 350px a
 * card gets on a phone, whatever the crop, and the crop was wrong too: the same
 * file is used at 16:9 on the card and 21:9 on the article hero, both
 * object-cover, so a 0.36-ratio table strip showed its middle rows and a
 * 3.96-ratio one lost half its width. Measured across 28 articles.
 *
 * So the card carries ONE real number from the article instead, and the
 * screenshots stay in the body where they are full width and readable.
 *
 * THE FRAME IS 21:9 AND THE SAFE AREA IS THE MIDDLE 16:9. The hero shows the
 * whole 1680x720; the card center-crops it to 1280x720. Everything that has to
 * be read lives inside x 200..1480, and only ground texture is allowed in the
 * 200px bands either side.
 *
 * Rendered in Chrome rather than drawn, so the type is the site's OWN Space
 * Grotesk and JetBrains Mono at the real weights, not an approximation. The
 * three woff2 files come from this repo's build output.
 *
 *   node scripts/make-article-cards.mjs <spec.json> [--only slug]
 */
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { extname, join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "public/images/content/cards";
const W = 1680;
const H = 720;
const SAFE = { x0: 200, x1: 1480 };

const FONTS = {
  grotesk: ".next/static/media/36966cca54120369-s.p.woff2",
  mono: ".next/static/media/558ca1a6aa3cb55e-s.p.woff2",
};

const GROUNDS = {
  paper: { bg: "#FAFAFA", ink: "#000000", accent: "#2ECC40", dot: "rgba(0,0,0,.10)", soft: "rgba(0,0,0,.13)" },
  ink: { bg: "#000000", ink: "#FAFAFA", accent: "#2ECC40", dot: "rgba(250,250,250,.13)", soft: "rgba(250,250,250,.20)" },
  lime: { bg: "#2ECC40", ink: "#000000", accent: "#000000", dot: "rgba(0,0,0,.13)", soft: "rgba(0,0,0,.20)" },
};

/**
 * The motifs. Each says something true about its subject rather than
 * decorating: a queue advancing, a cohort with a few marked, a span with two
 * ends. Drawn in a 440x330 box; `c.accent` is the lit part, `c.soft` the rest.
 */
function motif(kind, c) {
  const S = (d, extra = "") => `<path d="${d}" fill="none" stroke="${c.ink}" stroke-width="3" ${extra}/>`;
  const R = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${c.ink}" stroke-width="3"/>`;
  const box = (inner) => `<svg viewBox="0 0 440 330" width="440" height="330" aria-hidden="true">${inner}</svg>`;

  switch (kind) {
    case "tape": {
      // A queue advancing: cleared months solid, a frontier flag, the rest open.
      let s = "";
      for (let i = 0; i < 8; i++) s += R(10 + i * 52, 150, 48, 92, i < 5 ? c.accent : c.soft);
      s += `<line x1="270" y1="80" x2="270" y2="150" stroke="${c.ink}" stroke-width="3"/>`;
      s += R(270, 44, 120, 40, "none");
      s += `<text x="288" y="72" font-family="JBM" font-size="24" font-weight="700" fill="${c.ink}">NOW</text>`;
      return box(s);
    }
    case "levels": {
      let s = `<line x1="10" y1="278" x2="430" y2="278" stroke="${c.ink}" stroke-width="3"/>`;
      [70, 120, 176, 232].forEach((h, i) => (s += R(24 + i * 104, 278 - h, 78, h, i === 1 ? c.accent : c.soft)));
      return box(s);
    }
    case "stack": {
      let s = "";
      for (let d = 3; d >= 1; d--) s += R(10 + d * 26, 40 + d * 22, 330, 190, c.soft);
      s += R(10, 40, 330, 190, c.bg);
      [88, 124, 160].forEach((y, i) => (s += `<line x1="42" y1="${y}" x2="${i === 2 ? 220 : 306}" y2="${y}" stroke="${c.ink}" stroke-width="3" opacity=".45"/>`));
      s += R(200, 186, 128, 30, c.accent);
      return box(s);
    }
    case "record": {
      // Rows of fields with one row matched.
      let s = "";
      for (let r = 0; r < 4; r++)
        for (let f = 0; f < 3; f++)
          s += R(10 + f * 108, 60 + r * 58, 96, 40, r === 2 ? c.accent : c.soft);
      s += R(340, 60 + 2 * 58, 90, 40, "none");
      return box(s);
    }
    case "ladder": {
      let s = "";
      // SIX bars, because one card that uses this says "6 tools" and a reader
      // counts what is drawn. For the ranked cards the count is not a claim,
      // so six costs them nothing.
      [420, 342, 286, 238, 196, 158].forEach((w, i) => (s += R(10, 30 + i * 50, w, 36, i === 0 ? c.accent : c.soft)));
      return box(s);
    }
    case "steps": {
      let s = `<line x1="10" y1="290" x2="430" y2="290" stroke="${c.ink}" stroke-width="3"/>`;
      const pts = [[10, 250], [95, 250], [95, 196], [180, 196], [180, 158], [265, 158], [265, 104], [350, 104], [350, 58], [430, 58]];
      s += S(pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" "), `stroke="${c.accent}" stroke-width="10"`);
      s += R(336, 44, 28, 28, c.accent);
      return box(s);
    }
    case "window": {
      let s = `<line x1="10" y1="170" x2="430" y2="170" stroke="${c.ink}" stroke-width="3"/>`;
      s += R(96, 106, 250, 128, c.accent);
      [96, 346].forEach((x) => (s += `<line x1="${x}" y1="70" x2="${x}" y2="270" stroke="${c.ink}" stroke-width="6"/>`));
      return box(s);
    }
    case "split": {
      let s = R(10, 74, 400, 62, c.accent);
      s += R(10, 190, 128, 62, c.soft);
      return box(s);
    }
    case "grid": {
      let s = "";
      const lit = new Set([7, 8, 19, 26, 33]);
      for (let i = 0; i < 40; i++)
        s += R(12 + (i % 8) * 54, 60 + Math.floor(i / 8) * 54, 42, 42, lit.has(i) ? c.accent : c.soft);
      return box(s);
    }
    default:
      return "";
  }
}

function html(card) {
  const c = GROUNDS[card.ground] ?? GROUNDS.paper;
  const f = (p) => `url(data:font/woff2;base64,${readFileSync(p).toString("base64")}) format('woff2')`;
  // Longer figures step down so they never reach the safe edge.
  const n = card.figure.length;
  const figPx = n <= 6 ? 168 : n <= 9 ? 142 : n <= 12 ? 116 : 96;
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:SG;src:${f(FONTS.grotesk)};font-weight:100 900;font-display:block}
@font-face{font-family:JBM;src:${f(FONTS.mono)};font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
.card{position:relative;width:${W}px;height:${H}px;background:${c.bg};color:${c.ink};
  background-image:radial-gradient(${c.dot} 1.6px, transparent 1.6px);background-size:26px 26px}
.safe{position:absolute;left:${SAFE.x0}px;top:0;width:${SAFE.x1 - SAFE.x0}px;height:${H}px;
  display:flex;align-items:center;gap:48px;padding:0 40px}
.text{flex:1;min-width:0}
.eyebrow{font-family:JBM;font-weight:700;font-size:23px;letter-spacing:.14em;text-transform:uppercase;opacity:.72}
.figure{font-family:SG;font-weight:700;font-size:${figPx}px;line-height:.96;letter-spacing:-.03em;margin-top:26px;white-space:nowrap}
.rule{height:14px;background:${c.accent};margin-top:22px;width:min(100%,320px);border:3px solid ${c.ink}}
.label{font-family:SG;font-weight:500;font-size:35px;line-height:1.22;margin-top:26px;max-width:640px;text-wrap:balance}
.art{flex:0 0 440px;height:330px;display:flex;align-items:center;justify-content:center}
</style>
<div class="card"><div class="safe">
  <div class="text">
    <div class="eyebrow">${esc(card.eyebrow)}</div>
    <div class="figure">${esc(card.figure)}</div>
    <div class="rule"></div>
    <div class="label">${esc(card.label)}</div>
  </div>
  <div class="art">${motif(card.motif, c)}</div>
</div></div>`;
}

const esc = (s) => String(s).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]);

const specPath = process.argv[2];
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
let cards = JSON.parse(readFileSync(specPath, "utf8"));
if (only) cards = cards.filter((c) => c.slug === only);
mkdirSync(OUT, { recursive: true });

// A local origin, so the page is not a file:// document and nothing is blocked.
const pages = new Map();
const server = createServer((req, res) => {
  const body = pages.get(req.url);
  if (!body) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: CHROME });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const card of cards) {
    const name = card.slug.split("/").pop();
    const url = `/${name}`;
    pages.set(url, html(card));
    await page.goto(`http://127.0.0.1:${port}${url}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // The figure must not reach the safe edge; a clipped number is a wrong one.
    // MEASURE THE TEXT, NOT THE BOX. `.figure` is a block, so its rect is the
    // column width and every card reported an identical 712px - a guard that
    // can never see the defect it was written for. A Range over the text node
    // gives the glyphs' real extent.
    const fit = await page.evaluate(() => {
      const el = document.querySelector(".figure");
      const safe = document.querySelector(".safe").getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return {
        overflowRight: Math.round(r.right - (safe.right - 40)),
        width: Math.round(r.width),
        boxWidth: Math.round(el.getBoundingClientRect().width),
      };
    });
    if (fit.overflowRight > 0) throw new Error(`${card.slug}: figure overflows the safe area by ${fit.overflowRight}px`);
    // And vertically. A label that runs to three lines pushed its last line off
    // the bottom of the frame, which the horizontal check above cannot see.
    const vfit = await page.evaluate(() => {
      const t = document.querySelector(".text").getBoundingClientRect();
      const label = document.querySelector(".label");
      const lines = Math.round(label.getBoundingClientRect().height / parseFloat(getComputedStyle(label).lineHeight));
      return { top: Math.round(t.top), bottom: Math.round(t.bottom), lines };
    });
    if (vfit.top < 24 || vfit.bottom > H - 24) {
      throw new Error(`${card.slug}: content runs off the frame (top ${vfit.top}, bottom ${vfit.bottom} of ${H})`);
    }
    if (vfit.lines > 2) throw new Error(`${card.slug}: label wraps to ${vfit.lines} lines, shorten it`);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`  ${name}.png  ${card.ground}/${card.motif}  "${card.figure}" (text ${fit.width}px in a ${fit.boxWidth}px column)`);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${cards.length} card(s) rendered to ${OUT}`);
