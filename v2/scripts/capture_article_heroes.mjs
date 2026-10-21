#!/usr/bin/env node
/**
 * Capture live pages as article pictures: the page itself at 4:3, with the
 * site's top bar (the one fixed element; a page's own <header> stays, since
 * many pages keep their H1 in one), breadcrumb bar, a data page's section
 * list and floating buttons hidden, so the picture shows what the article is
 * about rather than the frame around it.
 *
 *   node scripts/capture_article_heroes.mjs <base-url> <out-dir> [slug ...]
 *
 * Reads the `capture` entries of scripts/article-heroes.json and of
 * scripts/article-figures.json (the pictures inside an article's text). One headless
 * Chrome, pages one after another (never two browsers at once on this Mac).
 * scripts/make_article_heroes.py turns the PNGs into the 1600x1200 WebPs.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [base, out, ...only] = process.argv.slice(2);
if (!base || !out) {
  console.error("usage: node scripts/capture_article_heroes.mjs <base-url> <out-dir> [slug ...]");
  process.exit(2);
}
const spec = {
  ...JSON.parse(fs.readFileSync("scripts/article-heroes.json", "utf8")),
  ...JSON.parse(fs.readFileSync("scripts/article-figures.json", "utf8")),
};
const jobs = Object.entries(spec).filter(([slug, s]) => s.capture && (only.length === 0 || only.includes(slug)));
fs.mkdirSync(out, { recursive: true });

const HIDE = `
  nav[aria-label="Breadcrumb"], div:has(> nav.print\\:hidden) > nav.print\\:hidden,
  nextjs-portal, [data-nextjs-toast], button[aria-label="Back to top"], .fixed { display: none !important; }
  /* A data page's "In this section" column goes, and its page takes the width. */
  div:has(> nav.print\\:hidden) { display: block !important; }
  main { padding-top: 0 !important; }
  html { scroll-behavior: auto !important; }
`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let failed = 0;
try {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  const page = await ctx.newPage();
  for (const [slug, s] of jobs) {
    const { url, scroll, wait, clip, width, height, maxHeight, fill, click, css, clock, ready, settle } = s.capture;
    try {
      await page.setViewportSize({ width: width ?? 1200, height: height ?? 900 });
      // A Storybook capture of the app runs on the day its sample firm was
      // recorded, so "due in 12 days" says what it said then.
      if (clock) await page.clock.setFixedTime(new Date(clock));
      const res = await page.goto(url.startsWith("http") ? url : base + url, { waitUntil: "load", timeout: 180000 });
      if (ready) await page.waitForSelector(ready, { timeout: 240000 });
      if (!res || res.status() !== 200) throw new Error(`status ${res?.status()}`);
      await page.addStyleTag({ content: HIDE + (css ?? "") });
      await page.waitForTimeout(wait ?? 1500);
      // Type into boxes on the page (a list's own search, a calculator's
      // dates), then let it answer.
      for (const f of fill ? [fill].flat() : []) {
        const box = page.locator(f.sel).first();
        await box.fill(f.text);
        // "press": a key to send to the box (Enter submits a search form);
        // without one the box just loses focus, which is how a date box commits.
        if (f.press) await box.press(f.press);
        else await box.blur();
        await page.waitForTimeout(f.wait ?? 600);
      }
      // "click": buttons to press after typing (a search that has no form to submit).
      for (const sel of click ? [click].flat() : []) {
        await page.locator(sel).first().click();
        await page.waitForTimeout(600);
      }
      if (fill || click) await page.waitForTimeout(3000);
      if (scroll) {
        await page.evaluate((sel) => {
          // "text:Case number" scrolls to the element whose own text is exactly that.
          const el = sel.startsWith("text:")
            ? [...document.querySelectorAll("main p, main h2, main h3")].find((e) => e.textContent?.trim() === sel.slice(5))?.parentElement
            : document.querySelector(sel);
          if (!el) throw new Error(`no element ${sel}`);
          window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24);
        }, scroll);
        await page.waitForTimeout(600);
      }
      fs.mkdirSync(`${out}/${slug}`.replace(/\/[^/]+$/, ""), { recursive: true });
      if (clip) {
        // "h:Heading" clips to the section that heading opens (its nearest
        // <section>, else its parent); "hp:Heading" to the heading's parent;
        // "fold:Title" opens a folded section and clips to it;
        // "from:Heading" from the heading down; "cap:Caption" to a table by its
        // caption and the table after it; "sel:css" to that element. A tall
        // section is cut at maxHeight so a figure stays one screen of reading.
        const box = await page.evaluate((c) => {
          let el;
          if (c.startsWith("cap:")) {
            // A table found by its caption, down through the table after it:
            // for an agency page that marks its sections with captions only.
            const t = [...document.querySelectorAll("table")].find((e) => e.caption?.textContent?.trim().startsWith(c.slice(4)));
            if (!t) throw new Error(`no element ${c}`);
            let next = t.nextElementSibling;
            while (next && next.tagName !== "TABLE") next = next.nextElementSibling;
            t.scrollIntoView({ block: "start" });
            const a = t.getBoundingClientRect();
            const b = (next ?? t).getBoundingClientRect();
            // Clipped from the screen, not the full page: an agency page can
            // reflow when the screenshot stretches it to its full height.
            return { x: a.left, y: a.top, width: a.width, height: b.bottom - a.top, onScreen: true };
          }
          if (c.startsWith("from:") || c.startsWith("fromm:")) {
            // From a heading down, as wide as its container ("fromm:" as wide as
            // the page's <main>): for a section that isn't wrapped in an
            // element of its own.
            const want = c.slice(c.indexOf(":") + 1);
            const h = [...document.querySelectorAll("main h1, main h2, main h3")].find((e) => e.textContent?.trim().startsWith(want));
            if (!h) throw new Error(`no element ${c}`);
            h.scrollIntoView({ block: "start" });
            const r = h.getBoundingClientRect();
            const p = (c.startsWith("fromm:") ? h.closest("main") ?? h.parentElement : h.parentElement).getBoundingClientRect();
            return { x: p.left + window.scrollX, y: r.top + window.scrollY - 28, width: p.width, height: 4000 };
          }
          if (c.startsWith("fold:")) {
            // A folded section (a <details> whose summary carries the title),
            // opened, so the picture shows what the fold holds.
            const want = c.slice(5);
            const h =
              [...document.querySelectorAll("main summary h2, main summary h3")].find((e) => e.textContent?.trim().startsWith(want)) ??
              [...document.querySelectorAll("main summary")].find((e) => e.textContent?.trim().startsWith(want));
            el = h?.closest("details") ?? null;
            if (el) el.open = true;
          } else if (c.startsWith("h:") || c.startsWith("hp:")) {
            // "hp:" takes the heading's own block (its parent) where a section
            // holds two side by side.
            const want = c.slice(c.indexOf(":") + 1);
            const h = [...document.querySelectorAll("main h1, main h2, main h3")].find((e) => e.textContent?.trim().startsWith(want));
            el = h ? (c.startsWith("hp:") ? h.parentElement : h.closest("section") ?? h.parentElement) : null;
          } else {
            el = document.querySelector(c.slice(4));
          }
          if (!el) throw new Error(`no element ${c}`);
          el.scrollIntoView({ block: "start" });
          const r = el.getBoundingClientRect();
          return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
        }, clip);
        // A section that mounts its contents when scrolled into view needs a moment.
        await page.waitForTimeout(settle ?? 800);
        const pad = 16;
        await page.screenshot({
          path: `${out}/${slug}.png`,
          fullPage: !box.onScreen,
          clip: {
            x: Math.max(0, box.x - pad),
            y: Math.max(0, box.y - pad),
            width: Math.min(box.width + 2 * pad, (width ?? 1200) - Math.max(0, box.x - pad)),
            height: Math.min(box.height + 2 * pad, maxHeight ?? 1000),
          },
        });
      } else {
        await page.screenshot({ path: `${out}/${slug}.png` });
      }
      console.log(`ok ${slug} ${url}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${slug} ${url} ${String(e).slice(0, 120)}`);
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
