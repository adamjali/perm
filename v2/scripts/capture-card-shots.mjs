/**
 * The screenshots the page social cards inset (make-page-cards.mjs).
 *
 *   node scripts/capture-card-shots.mjs <spec.json> <out-dir> [base-url] [--only slug]
 *
 * One browser, one page at a time (parallel headless Chrome has crashed this
 * machine). Each page is loaded at 1024 wide (CARD_VIEW_W), device scale 2, light theme;
 * the shot is framed from the page's own H1, or from the heading a card names
 * in `from` when the H1 carries a live figure (a card is never redrawn when
 * the figure moves), or from the first element a selector in `fromEl` matches
 * (a box with no heading of its own), and it ends at the right edge of the page's own column,
 * so no line is cut off, and runs down at the card frame's own ratio
 * (make-page-cards.mjs draws it 652x446). Floating controls and the dev
 * overlay are hidden.
 * Writes <out-dir>/<slug>.png and fills each card's `shot` and `crop`.
 * Capture a dev server on production data, never production itself: bulk
 * captures of production have tripped the bot defense (Oct 11 2026).
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
/** The page's width when captured. The narrowest desktop layout (lg, 1024)
 *  draws a page's own column larger in the card's 652px frame than a wide
 *  screen does, so the type stays readable. */
const VIEW_W = Number(process.env.CARD_VIEW_W ?? 1024);
const SCALE = 2;
/** The region shot, in CSS pixels: as wide as the page's column (at most a
 *  wide page's 1200 plus a margin), as tall as the card's frame is for that
 *  width. */
const SHOT_W_MAX = 1264;
const FRAME_RATIO = 446 / 652;

const [specPath, outDir, base = "http://localhost:3000"] = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--only");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const card of spec) {
    if (only && card.slug !== only) continue;
    // `viewport`: a wider page for one whose header squeezes at the narrowest desktop width.
    const viewW = card.viewport ?? VIEW_W;
    const ctx = await browser.newContext({ viewport: { width: viewW, height: 900 }, deviceScaleFactor: SCALE, colorScheme: "light", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    try {
      await page.goto(base + card.path, { waitUntil: "load", timeout: 300_000 });
      // The data pages' side list keeps its room but is hidden: its current-page marker
      // reaches into the column the frame starts at.
      await page.addStyleTag({ content: "nextjs-portal,[data-floating],.fixed{display:none!important}nav[aria-label=\"All data pages\"]{visibility:hidden!important}" });
      // `css` and `script`: what one card needs that the page as served can't give it, such as a composition
      // that leaves out words a card mustn't carry (a reviewer's name lives on in shared copies of an image).
      if (card.css) await page.addStyleTag({ content: card.css });
      await page.waitForTimeout(2500);
      if (card.script) await page.evaluate(card.script);
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
        // Framed on the column's content edges, not the heading's: a heading set
        // in from the text beside an icon would otherwise cut the text off.
        const r = start.getBoundingClientRect();
        const c = col.getBoundingClientRect();
        const cs = getComputedStyle(col);
        const left = Math.min(r.left, c.left + parseFloat(cs.paddingLeft));
        const right = c.right - parseFloat(cs.paddingRight);
        return { x: left + window.scrollX, y: r.top + window.scrollY, right: right + window.scrollX };
      }, [card.from ?? null, card.fromEl ?? null, viewW]);
      if (!box) throw new Error(card.fromEl ? `nothing matches ${card.fromEl}` : card.from ? `no heading starting "${card.from}"` : "no H1");
      // `above`: more room over the heading, for a hero whose side column starts higher;
      // `maxWidth`: a wider frame, for a hero that runs past the usual column.
      const x = Math.max(0, Math.round(box.x - 32));
      const y = Math.max(0, Math.round(box.y - (card.above ?? 40)));
      const w = Math.min(card.maxWidth ?? SHOT_W_MAX, Math.round(box.right + 32) - x, viewW - x);
      const h = Math.round(w * FRAME_RATIO);
      const file = join(outDir, `${card.slug}.png`);
      await page.screenshot({ path: file, clip: { x, y, width: w, height: h }, fullPage: true });
      card.shot = `${card.slug}.png`;
      card.crop = [0, 0, w * SCALE, h * SCALE];
      delete card.motif;
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
