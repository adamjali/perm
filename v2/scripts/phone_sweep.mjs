#!/usr/bin/env node
/**
 * Measure pages at phone widths: does the page scroll sideways, and if so which
 * element does it; text under 14px; standalone tap targets under 43px.
 *
 * One headless Chrome, pages loaded one after another, closed in `finally`
 * (never run two headless browsers at once on this Mac). For when the site's
 * own frame headers (X-Frame-Options: DENY, even on `pnpm dev`) rule out the
 * same-origin iframe sweep.
 *
 *   node scripts/phone_sweep.mjs http://localhost:3010 /visa-issuances /perm-cities/appleton-wi
 *   SHOTS=/tmp/shots node scripts/phone_sweep.mjs https://permtracker.app /    # screenshots too
 *
 * Read the first run as mostly a test of this script (it was, Oct 5 2026):
 * - The phone menu drawer sits off-screen on purpose; anything inside a fixed
 *   nav is skipped.
 * - A link inside a truncated (overflow: hidden) row reaches past the edge and
 *   is clipped, not overflowing: only the page's own scroll width is a verdict.
 * - When the page does overflow, `culprit` hides each section of <main> in
 *   turn and names the ones whose removal ends it, then the innermost
 *   elements past the edge.
 * - An inline link inside a sentence is exempt from the tap size (WCAG 2.5.8).
 */
import { chromium } from "playwright-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [base, ...paths] = process.argv.slice(2);
if (!base || !paths.length) {
  console.error("usage: node scripts/phone_sweep.mjs <base-url> <path> [path ...]");
  process.exit(2);
}
const WIDTHS = [390, 320];

function measure(w) {
  const doc = document.documentElement;
  const overflow = doc.scrollWidth - doc.clientWidth;
  const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`;
  let culprit = [];
  if (overflow > 0) {
    const sections = [...document.querySelectorAll("main > *, main > * > *, main > * > * > *")];
    for (const s of sections) {
      const prev = s.style.display;
      s.style.display = "none";
      const gone = doc.scrollWidth - doc.clientWidth <= 0;
      s.style.display = prev;
      if (gone) culprit.push(label(s));
    }
    const innermost = [...document.querySelectorAll("main *")].filter((el) => {
      if (el.closest("nav.fixed")) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.right > w + 1 && ![...el.children].some((c) => c.getBoundingClientRect().right > w + 1);
    });
    culprit = [...culprit.slice(-3), ...innermost.slice(0, 4).map((el) => `${label(el)} right=${Math.round(el.getBoundingClientRect().right)} "${(el.textContent || "").trim().slice(0, 40)}"`)];
  }
  const small = [];
  for (const el of document.querySelectorAll("main p, main li, main td, main th, main dd, main dt, main span, main a, main button, main label, main summary")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (el.closest("svg") || el.getBoundingClientRect().width === 0) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 14) small.push(`${el.tagName.toLowerCase()} ${fs}px "${el.textContent.trim().slice(0, 30)}"`);
  }
  const taps = [];
  for (const el of document.querySelectorAll("main a, main button, main summary, main select, main input")) {
    const b = el.getBoundingClientRect();
    const inline = getComputedStyle(el).display === "inline" && el.closest("p, li, dd, td");
    if (b.width > 0 && b.height > 0 && b.height < 43 && !inline) taps.push(`${el.tagName.toLowerCase()} ${Math.round(b.height)}px "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`);
  }
  return { overflow, culprit, small: [...new Set(small)].slice(0, 5), smallN: small.length, taps: [...new Set(taps)].slice(0, 5), tapsN: taps.length };
}

let bad = 0;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    for (const p of paths) {
      const ok = await page.goto(base + p, { waitUntil: "networkidle", timeout: 120000 }).then(() => true, (e) => (console.log(`${width} ${p} load failed: ${String(e).slice(0, 80)}`), false));
      if (!ok) { bad++; continue; }
      const r = await page.evaluate(measure, width);
      if (r.overflow > 0 || r.smallN || r.tapsN) bad++;
      console.log(`${width} ${p}  overflow=${r.overflow}px  small=${r.smallN}  taps=${r.tapsN}`);
      for (const c of r.culprit) console.log(`    wide: ${c}`);
      for (const s of r.small) console.log(`    small: ${s}`);
      for (const t of r.taps) console.log(`    tap: ${t}`);
      if (process.env.SHOTS && width === 390) await page.screenshot({ path: `${process.env.SHOTS}/${p.replace(/\W+/g, "_") || "home"}-${width}.png` });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
process.exit(bad ? 1 : 0);
