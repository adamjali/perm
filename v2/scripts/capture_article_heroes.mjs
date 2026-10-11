#!/usr/bin/env node
/**
 * Capture live pages as article pictures: the page itself at 4:3, with the
 * site's top bar (the one fixed element; a page's own <header> stays, since
 * many pages keep their H1 in one), breadcrumb bar, data menu and floating
 * buttons hidden, so the
 * picture shows what the article is about rather than the frame around it.
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
  div:has(> nav[aria-label="Breadcrumb"]), main div.contents.print\\:hidden,
  nextjs-portal, [data-nextjs-toast], button[aria-label="Back to top"], .fixed { display: none !important; }
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
    const { url, scroll, wait } = s.capture;
    try {
      const res = await page.goto(base + url, { waitUntil: "load", timeout: 180000 });
      if (!res || res.status() !== 200) throw new Error(`status ${res?.status()}`);
      await page.addStyleTag({ content: HIDE });
      await page.waitForTimeout(wait ?? 1500);
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
      await page.screenshot({ path: `${out}/${slug}.png` });
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
