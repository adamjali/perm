/**
 * The screenshots the page social cards inset (make-page-cards.mjs).
 *
 *   node scripts/capture-card-shots.mjs <spec.json> <out-dir> [base-url] [--only slug]
 *
 * One browser, one page at a time (parallel headless Chrome has crashed this
 * machine). Each page is loaded at 1440 wide, device scale 2, light theme;
 * the shot is framed from the page's own H1, or from the heading a card names
 * in `from` when the H1 carries a live figure (a card is never redrawn when
 * the figure moves), or from the first element a selector in `fromEl` matches
 * (a box with no heading of its own), and it ends at the right edge of the page's own column,
 * so no line is cut off. Floating controls and the dev overlay are hidden.
 * Writes <out-dir>/<slug>.png and fills each card's `shot` and `crop`.
 * Capture a dev server on production data, never production itself: bulk
 * captures of production have tripped the bot defense (Oct 11 2026).
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEW_W = 1440;
const SCALE = 2;
/** The region shot, in CSS pixels: as wide as the page's column (at most a
 *  wide page's 1200 plus a margin), 1000 high; the card draws it 700 wide
 *  and lets it run off the card's bottom edge. */
const SHOT_W_MAX = 1264;
const SHOT_H = 1000;

const [specPath, outDir, base = "http://localhost:3000"] = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--only");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const card of spec) {
    if (card.motif || (only && card.slug !== only)) continue;
    const ctx = await browser.newContext({ viewport: { width: VIEW_W, height: 900 }, deviceScaleFactor: SCALE, colorScheme: "light", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    try {
      await page.goto(base + card.path, { waitUntil: "load", timeout: 300_000 });
      await page.addStyleTag({ content: "nextjs-portal,[data-floating],.fixed{display:none!important}" });
      await page.waitForTimeout(2500);
      const box = await page.evaluate(([from, fromEl, viewW]) => {
        const start = fromEl
          ? document.querySelector(fromEl)
          : from
            ? [...document.querySelectorAll("main h1, main h2, main h3")].find((h) => (h.textContent ?? "").trim().startsWith(from))
            : document.querySelector("main h1") ?? document.querySelector("h1");
        if (!start) return null;
        // The page's own column: the widest ancestor still narrower than the screen.
        let col = start;
        for (let el = start.parentElement; el && el !== document.body; el = el.parentElement) {
          if (el.getBoundingClientRect().width < viewW - 40) col = el;
        }
        const r = start.getBoundingClientRect();
        return { x: r.left + window.scrollX, y: r.top + window.scrollY, right: col.getBoundingClientRect().right + window.scrollX };
      }, [card.from ?? null, card.fromEl ?? null, VIEW_W]);
      if (!box) throw new Error(card.fromEl ? `nothing matches ${card.fromEl}` : card.from ? `no heading starting "${card.from}"` : "no H1");
      // `above`: more room over the heading, for a hero whose side column starts higher;
      // `maxWidth`: a wider frame, for a hero that runs past the usual column.
      const x = Math.max(0, Math.round(box.x - 32));
      const y = Math.max(0, Math.round(box.y - (card.above ?? 40)));
      const w = Math.min(card.maxWidth ?? SHOT_W_MAX, Math.round(box.right + 32) - x, VIEW_W - x);
      const file = join(outDir, `${card.slug}.png`);
      await page.screenshot({ path: file, clip: { x, y, width: w, height: SHOT_H }, fullPage: true });
      card.shot = `${card.slug}.png`;
      card.crop = [0, 0, w * SCALE, SHOT_H * SCALE];
      console.log("OK", card.slug, card.path, `from ${x},${y}`);
    } catch (e) {
      console.log("FAIL", card.slug, card.path, String(e).slice(0, 120));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(specPath, JSON.stringify(spec, null, 1));
