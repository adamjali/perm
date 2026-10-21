// The Chrome Web Store and Product Hunt images, made from the product itself.
//
//   node extension/store/build.mjs           every image, from the answers saved in ./data
//   node extension/store/build.mjs --fetch   first asks permtracker.app's keyless lookup again
//                                            and saves the answers (dated) in ./data
//   node extension/store/build.mjs --site    also captures permtracker.app's own pages for the
//                                            Product Hunt gallery (a few pages, one browser)
//   ... --site --base http://localhost:3000  the same pages from the dev server on production data;
//                                            the live case page answers a script with a browser
//                                            check, so its picture comes from there
//
// The panel in every screenshot is the extension's own code: src/panel.ts, src/model.ts and
// src/api.ts bundled by esbuild into the page, fed a real answer from the live lookup, so the
// picture is the product. The job posting under it is a plain page made here, labelled
// "Example job posting", that copies no job site's layout or branding. The promo art is one
// isometric drawing in the site's spot-picture family (scripts/spot-pictures/kit, grey with lime).
// One headless Chrome at a time.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright-core";
import * as k from "../../scripts/spot-pictures/kit/iso-kit.mjs";
import * as a from "../../scripts/spot-pictures/kit/asset.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = join(HERE, "..");
const DATA = join(HERE, "data");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LIME = "#2ECC40";
const PAPER = "#FAFAFA";
const INK = "#141414";
const argv = process.argv.slice(2);
const args = new Set(argv);
const BASE = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "https://permtracker.app";

// ---------- 1. the live answers ----------
const LOOKUPS = {
  exact: "Microsoft Corporation",
  possible: "Amazon",
  none: "Acme Robotics Studio",
};
mkdirSync(DATA, { recursive: true });
if (args.has("--fetch")) {
  for (const [key, name] of Object.entries(LOOKUPS)) {
    const res = await fetch(`https://permtracker.app/v1/lookup/employer?${new URLSearchParams({ name })}`, {
      headers: { "user-agent": "PERMTracker-store-images/1.0" },
    });
    if (!res.ok) throw new Error(`lookup ${name}: HTTP ${res.status}`);
    const json = await res.json();
    writeFileSync(join(DATA, `${key}.json`), JSON.stringify({ fetchedAt: new Date().toISOString(), answer: json }, null, 2));
    console.log(`fetched ${name}: ${json.data.match}`);
  }
}
const answer = (key) => {
  const f = join(DATA, `${key}.json`);
  if (!existsSync(f)) throw new Error(`no saved answer for ${key}: run with --fetch`);
  return JSON.parse(readFileSync(f, "utf8")).answer;
};

// ---------- 2. the extension's own panel, bundled for a page ----------
const bundle = await build({
  stdin: {
    contents:
      'import { mountPanel } from "./src/panel.ts"; import { panelFor } from "./src/model.ts"; import { parseLookup } from "./src/api.ts";' +
      "window.__pt = { mountPanel, panelFor, parseLookup };",
    resolveDir: EXT,
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  target: "chrome120",
  write: false,
});
const PANEL_JS = bundle.outputFiles[0].text;

// A plain, generic posting: a document, not any job site's layout.
function postingPage({ company, title, location, key, width, height }) {
  const data = JSON.stringify(answer(key)).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Example job posting</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#f1f1ef;color:#1c1c1c;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.bar{height:56px;background:#ffffff;border-bottom:1px solid #d6d6d2;display:flex;align-items:center;padding:0 40px;gap:12px}
.tag{font-size:14px;font-weight:600;color:#454545;border:1px solid #9a9a96;padding:4px 10px}
.doc{width:${Math.min(720, width - 460)}px;margin:28px 0 0 40px;background:#ffffff;border:1px solid #d6d6d2;padding:28px 32px}
h1{margin:0;font-size:26px;line-height:1.25}
.co{margin:6px 0 0;font-size:17px;font-weight:600}
.loc{margin:2px 0 0;color:#555}
h2{margin:22px 0 6px;font-size:17px}
p,li{margin:0;color:#333}
ul{margin:0;padding-left:20px}
.apply{display:inline-block;margin-top:22px;padding:10px 18px;border:1px solid #1c1c1c;font-weight:600;color:#1c1c1c;background:#fff}
</style></head><body>
<div class="bar"><span class="tag">Example job posting</span></div>
<main class="doc">
<h1>${title}</h1>
<p class="co">${company}</p>
<p class="loc">${location}</p>
<h2>About the role</h2>
<p>You'll design, build and run services used every day by teams across the company, working with a small group of engineers on reliability and performance.</p>
<h2>What you'll do</h2>
<ul><li>Write and review production code</li><li>Measure, profile and improve the systems you own</li><li>Share on-call duty with your team</li></ul>
<h2>What you'll bring</h2>
<ul><li>A bachelor's degree in computer science or a related field</li><li>Three years of experience building distributed systems</li></ul>
<span class="apply">Apply</span>
</main>
<script>${PANEL_JS}</script>
<script>
const ans = __pt.parseLookup(${data});
if (!ans) throw new Error("the saved answer doesn't parse");
const h = __pt.mountPanel(document, { onClose(){}, onRetry(){}, mode: "open" });
h.show(__pt.panelFor({ kind: "answer", answer: ans }));
document.body.dataset.ready = "1";
</script></body></html>`;
}

// ---------- 3. the promo drawing: a job posting on a clipboard, the lime record card lifted beside it ----------
const AZIMUTH = 55;
const ELEVATION = 35;
let P = null;
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (pts, style) => k.dotsSvg(pts, style);
const depth = ([x, y, z = 0]) => k.depthOf([x, y, z], P);
const byDepth = (items) => [...items].sort((p, q) => depth(p) - depth(q));
const lime = (svg) => `<g class="ac-lime">${svg}</g>`;
const rubber = (svg) => `<g class="ac-rubber">${svg}</g>`;
const slab = (plan, z, h, style = {}, steps = 3, bevel = 0.3) => S(k.slabOf(plan, z, h, P, steps, bevel), style);
const screws = (pts, z, ring = 1.1) =>
  L(pts.map(([x, y]) => k.ring(x, y, ring, z, P, 14)).join(""), { tone: "lo" }) + Dt(pts.map(([x, y]) => at([x, y, z])), { size: 0.5 });

const TRAY = { x: -44, y: -38, w: 92, d: 78, r: 5 };
const BOARD = { x: -38, y: -32, w: 42, d: 62, r: 2 };
const CARD = { x: 10, y: -12, w: 32, d: 42, r: 1.2 };
const CARD_Z = 22;

function drawing() {
  const out = [];
  // the tray on rubber feet, with corner screws
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(TRAY, -3), -9, 4, P)}"/>`);
  for (const [x, y] of byDepth(k.corners(TRAY, 9.5))) {
    out.push(rubber(S(k.cylinder(x, y, 4.6, -9, 1.2, P, 16), { tone: "lo" })));
    out.push(S(k.cylinder(x, y, 3.4, -7.8, 2.8, P, 14), { tone: "mid" }));
  }
  out.push(S(k.slabOf(TRAY, -5, 5, P, 5, 1.1), { tone: "mid", inner: L(k.sideSeam(TRAY, -3.5, P, 5), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(TRAY, 4), 0, P, 4), { tone: "faint" }));
  out.push(screws(k.corners(TRAY, 6.5), 0));
  // the clipboard: board, a sheet under, the posting on top
  out.push(`<path class="iso-halo" d="${k.haloOf(BOARD, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(slab(BOARD, 0, 2.4, { tone: "mid", inner: L(k.sideSeam(BOARD, 1.2, P, 3), { tone: "faint" }) }, 3, 0.4));
  const under = { x: BOARD.x + 2.6, y: BOARD.y + 6.4, w: BOARD.w - 5.2, d: BOARD.d - 8.6, r: 0.4 };
  out.push(slab(under, 2.4, 0.4, { tone: "lo", crease: "none" }, 2, 0));
  const sheet = { x: BOARD.x + 3.4, y: BOARD.y + 5.4, w: BOARD.w - 6.8, d: BOARD.d - 8.4, r: 0.4 };
  out.push(slab(sheet, 2.8, 0.4, { tone: "hi", crease: "none" }, 2, 0));
  const top = 3.2;
  // the posting's title, then its lines of text, ending short where a paragraph does
  out.push(slab({ x: sheet.x + 3, y: sheet.y + 5, w: 22, d: 3.2, r: 0.3 }, top, 0.3, { tone: "mid", crease: "none" }, 2, 0));
  out.push(L(k.lineOnTop([sheet.x + 3, sheet.y + 11], [sheet.x + 15, sheet.y + 11], top, P), { tone: "mid", free: true }));
  const rows = [26, 26, 18, 0, 26, 24, 26, 14, 0, 22, 26, 10];
  rows.forEach((w, i) => {
    if (!w) return;
    const y = sheet.y + 16 + i * 3.2;
    out.push(L(k.lineOnTop([sheet.x + 3, y], [sheet.x + 3 + w, y], top, P), { tone: "lo", free: true }));
  });
  // the clip at the top edge: a base block, a plate over the sheet, two rivets
  const clipBase = { x: BOARD.x + 12, y: BOARD.y + 1, w: 18, d: 6, r: 0.8 };
  out.push(slab(clipBase, 2.4, 2.2, { tone: "mid" }, 3, 0.4));
  const plate = { x: BOARD.x + 13, y: BOARD.y + 4.6, w: 16, d: 6.6, r: 0.8 };
  out.push(slab(plate, 3.4, 0.9, { tone: "hi" }, 3, 0.3));
  out.push(L(k.lineOnTop([plate.x + 2, plate.y + 1.4], [plate.x + plate.w - 2, plate.y + 1.4], 4.3, P), { tone: "faint", free: true }));
  out.push(screws([[clipBase.x + 3, clipBase.y + 3], [clipBase.x + clipBase.w - 3, clipBase.y + 3]], 4.6, 0.8));
  // the record card, lifted off the tray beside the posting, with its halo below
  out.push(`<path class="iso-halo" d="${k.haloOf(CARD, 0, 0.1, P)}" style="filter:blur(4px);opacity:0.3"/>`);
  out.push(lime(slab(CARD, CARD_Z, 1.8, { tone: "hi" }, 3, 0.4)));
  const head = { x: CARD.x + 2.4, y: CARD.y + 2.4, w: CARD.w - 4.8, d: 7, r: 0.5 };
  out.push(lime(slab(head, CARD_Z + 1.8, 0.4, { tone: "mid", crease: "none" }, 2, 0)));
  // the mark square in the header, then the figures as label and value pairs
  out.push(slab({ x: head.x + 1.6, y: head.y + 1.6, w: 3.8, d: 3.8, r: 0.4 }, CARD_Z + 2.2, 0.5, { tone: "hi", crease: "none" }, 2, 0));
  out.push(L(k.lineOnTop([head.x + 7, head.y + 3.5], [head.x + 17, head.y + 3.5], CARD_Z + 2.2, P), { tone: "lit", free: true }));
  for (let i = 0; i < 5; i++) {
    const y = CARD.y + 15 + i * 5;
    out.push(L(k.lineOnTop([CARD.x + 3, y], [CARD.x + 14, y], CARD_Z + 1.8, P), { tone: "lit", free: true }));
    out.push(L(k.lineOnTop([CARD.x + CARD.w - 10, y], [CARD.x + CARD.w - 3, y], CARD_Z + 1.8, P), { tone: "lit", free: true }));
  }
  out.push(L(k.planOutline(k.insetPlan(CARD, 1.2), CARD_Z + 1.8, P, 3), { tone: "lit" }));
  return out.join("");
}
const drawingPoints = () => [...k.boxCorners(k.insetPlan(TRAY, -3), -9, 0), [CARD.x, CARD.y, CARD_Z + 2.4], [CARD.x + CARD.w, CARD.y + CARD.d, CARD_Z + 2.4]];

function drawingSvg(width, height, id) {
  P = k.fitProjection(drawingPoints(), width, height, { pad: 6, azimuth: AZIMUTH, elevation: ELEVATION });
  return a.assetSvg({
    width,
    height,
    label: "A job posting on a clipboard, with a green record card lifted beside it.",
    body: drawing(),
    paper: PAPER,
    theme: "light",
    accents: { lime: LIME, rubber: "#3a3c44" },
    weight: width > 400 ? 0.7 : 0.5,
    motion: false,
    id,
  });
}

// ---------- 4. the brand mark, as public/icon.svg draws it ----------
const icons = readFileSync(join(EXT, "src", "icons.ts"), "utf8");
const markP = /markP:\s*"([^"]+)"/.exec(icons)[1];
const markT = /markT:\s*"([^"]+)"/.exec(icons)[1];
const mark = (size, rx = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 192 192" aria-hidden="true"><rect width="192" height="192" rx="${rx}" fill="${LIME}"/><path fill="#fff" fill-rule="evenodd" d="${markP}"/><path fill="#fff" d="${markT}"/></svg>`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Space+Grotesk:wght@700&display=block" rel="stylesheet">`;
const LINE = "An employer's green card and H-1B record, right on the job posting.";

function tilePage({ width, height, art, big, line }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>tile</title>${FONTS}<style>
*{box-sizing:border-box}html,body{margin:0;background:${PAPER}}
.tile{width:${width}px;height:${height}px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:${big ? 56 : 12}px;padding:0 ${big ? 88 : 24}px 0 ${big ? 88 : 26}px;background:${PAPER};border:${big ? 4 : 3}px solid ${INK}}
.brand{display:flex;align-items:center;gap:${big ? 16 : 9}px;font:700 ${big ? 30 : 17}px/1 "Space Grotesk",sans-serif;color:${INK}}
h1{margin:${big ? 22 : 12}px 0 0;font:700 ${big ? 76 : 32}px/1.02 "Space Grotesk",sans-serif;color:${INK};letter-spacing:-0.01em}
p{margin:${big ? 22 : 10}px 0 0;max-width:${big ? 560 : 210}px;font:500 ${big ? 27 : 15}px/1.3 Inter,sans-serif;color:#2b2b2b}
.art svg{display:block}
</style></head><body><div class="tile"><div><div class="brand">${mark(big ? 44 : 26)}PERM Tracker</div><h1>Visa Sponsor Check</h1>${line ? `<p>${LINE}</p>` : ""}</div><div class="art">${art}</div></div></body></html>`;
}

// ---------- 5. render ----------
const OUT = HERE;
const shots = [];
const b = await chromium.launch({ executablePath: CHROME, headless: true });
async function shoot(html, file, width, height, wait = "ready") {
  const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: "light" });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.setContent(html, { waitUntil: "networkidle" });
  if (wait === "ready") await p.waitForSelector("body[data-ready]", { timeout: 10000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(OUT, file), clip: { x: 0, y: 0, width, height } });
  if (errors.length) throw new Error(`${file}: ${errors.join("; ")}`);
  await p.close();
  shots.push(file);
  console.log(`wrote ${file} ${width}x${height}`);
}

try {
  // Chrome Web Store screenshots, 1280x800
  await shoot(postingPage({ company: "Microsoft Corporation", title: "Software engineer, storage systems", location: "Redmond, WA", key: "exact", width: 1280, height: 800 }), "cws-screenshot-1-record.png", 1280, 800);
  await shoot(postingPage({ company: "Amazon", title: "Data engineer, logistics", location: "Seattle, WA", key: "possible", width: 1280, height: 800 }), "cws-screenshot-2-possible-match.png", 1280, 800);
  await shoot(postingPage({ company: "Acme Robotics Studio", title: "Robotics engineer", location: "Austin, TX", key: "none", width: 1280, height: 800 }), "cws-screenshot-3-no-record.png", 1280, 800);
  // promo tiles
  await shoot(tilePage({ width: 440, height: 280, art: drawingSvg(170, 150, "promo-small-art"), big: false, line: true }), "cws-promo-small-440x280.png", 440, 280, "none");
  await shoot(tilePage({ width: 1400, height: 560, art: drawingSvg(560, 460, "promo-marquee-art"), big: true, line: true }), "cws-promo-marquee-1400x560.png", 1400, 560, "none");
  // Product Hunt: the extension panel on a posting, at the gallery's size, and the thumbnail
  await shoot(postingPage({ company: "Microsoft Corporation", title: "Software engineer, storage systems", location: "Redmond, WA", key: "exact", width: 1270, height: 760 }), "ph-gallery-3-extension.png", 1270, 760);
  await shoot(`<!doctype html><html><head><style>html,body{margin:0}</style></head><body>${mark(240, 0)}</body></html>`, "ph-thumbnail-240.png", 240, 240, "none");

  if (args.has("--site")) {
    // permtracker.app's own pages, a few at a time; a browser check is a stop, never something to get past
    const pages = [
      // a case in DOL's ordinary queue (analyst review), the answer most visitors get
      [`${BASE}/perm-case-status?case=G-100-26226-170644`, "ph-gallery-1-case-lookup.png", "main h1"],
      [`${BASE}/perm-employers/microsoft-corporation`, "ph-gallery-2-employer.png", "main h1"],
    ];
    for (const [url, file, sel] of pages) {
      // a 1588x950 window drawn at 0.8: 1270x760 pixels with a full row of the page's figures in view
      const p = await b.newPage({ viewport: { width: 1588, height: 950 }, deviceScaleFactor: 0.8, colorScheme: "light" });
      await p.goto(url, { waitUntil: "load", timeout: 240000 });
      await p.waitForTimeout(2500);
      const title = await p.title();
      if (/just a moment|attention required/i.test(title)) {
        console.log(`skipped ${file}: the site answered with a browser check`);
        await p.close();
        continue;
      }
      await p.locator(sel).first().waitFor({ timeout: 20000 });
      await p.evaluate(() => document.fonts.ready);
      // the dev server's own badge is not part of the site
      await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await p.screenshot({ path: join(OUT, file) });
      await p.close();
      shots.push(file);
      console.log(`wrote ${file} 1270x760 from ${url}`);
    }
  }
} finally {
  await b.close();
}
console.log(`done: ${shots.length} images`);
