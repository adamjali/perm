#!/usr/bin/env node
/**
 * Capture the signed-in app's pages from Storybook ("Tour/App pages", drawn
 * from the sample firm's recorded data) for the attorney page, the About page,
 * the sign-up page and the guides.
 *
 *   pnpm storybook   # in another terminal, on :6006 (stop the dev server first on this Mac)
 *   node scripts/capture-tour.mjs <out-dir> [http://localhost:6006] [--only name,name]
 *   python3 scripts/tour_shots.py <out-dir>
 *
 * Each story is loaded with the clock fixed to the recording's day
 * (2026-10-01), reduced motion, device scale 2, in both themes, at the widths
 * below. The theme is Storybook's own global, set in the address
 * (`globals=theme:dark`): its decorator owns the class on <html> and removes
 * one added by hand. Writes
 * <out-dir>/<capture>-<theme>[-phone].png, and <out-dir>/crops.json: each
 * picture's crop in CSS pixels, measured from the page's own headings, so a
 * layout change moves the crop with it instead of cutting a section in half.
 * One Chrome, one page at a time (never two browsers at once on this Mac).
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TODAY = new Date("2026-10-01T15:00:00Z");
const SCALE = 2;
/** The two widths an app page is drawn at: a laptop and a large phone. */
const WIDE = 1248;
const PHONE = 398;

/**
 * Every capture: its story, the widths it's taken at, and the pictures cut
 * from it. A picture's crop names the heading its first section starts at
 * (`from`) and the heading of the section after its last (`to`, left out for
 * the page's end); `through: [selector, n]` ends it below the nth element a
 * selector matches; `pad` is the margin kept around it; `el` crops to the
 * first element a selector matches instead. No crop keeps the whole capture.
 * `phone: false` takes the wide capture only.
 */
const CAPTURES = [
  {
    name: "dashboard",
    story: "tour-app-pages--dashboard",
    pictures: {
      // The hero: the deadlines widget alone, without the page heading.
      // A phone is narrow, so its pictures stop before the "Later" group rather than run on for screens.
      hub: { wide: { from: "Deadlines", to: "Cases" }, phone: { from: "Deadlines", to: "Later" } },
      dashboard: { wide: { to: "Recent changes" }, phone: { to: "Later" } },
      "case-summary": { wide: { from: "Cases", to: "Recent changes" }, guide: true },
    },
  },
  {
    name: "cases",
    story: "tour-app-pages--cases",
    pictures: {
      cases: { wide: { through: ['[data-testid="case-card"]', 6] }, phone: { through: ['[data-testid="case-card"]', 2] } },
      // The first case card on the phone capture, where a card is drawn at a card's own width.
      "case-card": { phone: { el: '[data-testid="case-card"]', pad: 12 } },
    },
  },
  { name: "case-detail", story: "tour-app-pages--case-detail", pictures: { "case-detail": { wide: { through: [".detail-card", 1], pad: 6 }, phone: { maxHeight: 1200 } } } },
  { name: "edit-case", story: "tour-app-pages--edit-case", pictures: { "edit-case": { wide: { from: "PWD (Prevailing", to: "Sunday newspaper ads" }, phone: { from: "PWD (Prevailing", to: "Sunday newspaper ads" } } } },
  { name: "calendar", story: "tour-app-pages--calendar", pictures: { calendar: { wide: { maxHeight: 1080 }, phone: { maxHeight: 1200 } } } },
  { name: "notifications", story: "tour-app-pages--notifications", pictures: { notifications: { wide: { maxHeight: 900 }, phone: { maxHeight: 960 } } } },
  // The assistant's panel is fixed to the screen's corner, outside the story's box: capture the panel itself.
  { name: "assistant", story: "tour-app-pages--assistant", root: '[role="dialog"]', phone: false, keepFixed: true, pictures: { assistant: { wide: null } } },
  // The email is drawn inside a frame, so it's ready when the frame's body has text, and its
  // headings can't be measured from outside: the crop keeps the message and drops the footer by height.
  { name: "email", story: "tour-app-pages--reminder-email", phone: false, themes: ["light"], frame: true, pictures: { email: { wide: { maxHeight: 610, pad: 0 } } } },
  {
    name: "hero",
    story: { wide: "home-attorney-hero-timeline--hero-timeline", phone: "home-attorney-hero-timeline--hero-timeline-phone" },
    root: "#hero-capture",
    widths: { wide: 1300, phone: 700 },
    pictures: { timeline: { wide: null, phone: null } },
  },
];

const args = process.argv.slice(2);
const onlyAt = args.indexOf("--only");
const only = onlyAt >= 0 ? new Set(args.splice(onlyAt, 2)[1].split(",")) : null;
const [outDir, base = "http://localhost:6006"] = args;
if (!outDir) throw new Error("usage: capture-tour.mjs <out-dir> [storybook-url] [--only name,name]");
mkdirSync(outDir, { recursive: true });

/** A crop in CSS pixels, relative to the capture, from the spec's headings. */
function measure([spec, rootSelector]) {
  const root = document.querySelector(rootSelector);
  const r = root.getBoundingClientRect();
  const headingTop = (text) => {
    // A heading first; failing that, the smallest labelled element whose text starts so (a form's group label).
    const h =
      [...root.querySelectorAll("h1, h2, h3, h4, legend, [role=heading]")].find((e) => (e.textContent ?? "").trim().startsWith(text)) ??
      [...root.querySelectorAll("p, label, span, div")]
        .filter((e) => (e.textContent ?? "").trim().startsWith(text))
        .sort((a, b) => (a.textContent ?? "").length - (b.textContent ?? "").length)[0];
    if (!h) throw new Error(`nothing starting "${text}"`);
    // The section a heading opens: its nearest ancestor that starts where it does.
    let top = h.getBoundingClientRect().top;
    for (let el = h.parentElement; el && el !== root; el = el.parentElement) {
      const t = el.getBoundingClientRect().top;
      if (top - t > 32) break;
      top = Math.min(top, t);
    }
    return top - r.top;
  };
  const pad = spec.pad ?? 24;
  if (spec.el) {
    const el = root.querySelector(spec.el);
    if (!el) throw new Error(`nothing matches ${spec.el}`);
    const b = el.getBoundingClientRect();
    return [b.left - r.left - pad, b.top - r.top - pad, b.right - r.left + pad, b.bottom - r.top + pad].map((v) => Math.max(0, Math.round(v)));
  }
  const top = spec.from ? Math.max(0, headingTop(spec.from) - pad) : 0;
  let bottom = spec.to ? headingTop(spec.to) - pad / 2 : r.height;
  if (spec.through) {
    // End below the nth element a selector matches (a whole row of cards, never half of one).
    const [sel, n] = spec.through;
    const el = root.querySelectorAll(sel)[n - 1];
    if (!el) throw new Error(`fewer than ${n} of ${sel}`);
    bottom = el.getBoundingClientRect().bottom - r.top + pad;
  }
  if (spec.maxHeight) bottom = Math.min(bottom, top + spec.maxHeight);
  return [0, Math.round(top), Math.round(r.width), Math.round(bottom)];
}

const cropsFile = join(outDir, "crops.json");
/** Kept from an earlier run, so `--only` re-measures just what it captures. */
const crops = existsSync(cropsFile) ? JSON.parse(readFileSync(cropsFile, "utf8")) : {};
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let failed = 0;
try {
  for (const cap of CAPTURES) {
    if (only && !only.has(cap.name)) continue;
    const widths = { wide: cap.widths?.wide ?? WIDE, ...(cap.phone === false ? {} : { phone: cap.widths?.phone ?? PHONE }) };
    for (const theme of cap.themes ?? ["light", "dark"]) {
      for (const [kind, width] of Object.entries(widths)) {
        const file = `${cap.name}-${theme}${kind === "phone" ? "-phone" : ""}`;
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: SCALE, colorScheme: theme, reducedMotion: "reduce" });
        const page = await ctx.newPage();
        try {
          await page.clock.setFixedTime(TODAY);
          const story = typeof cap.story === "string" ? cap.story : cap.story[kind];
          const root = cap.root ?? "#tour-capture";
          const res = await page.goto(`${base}/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`, { waitUntil: "load", timeout: 240_000 });
          if (!res || res.status() !== 200) throw new Error(`status ${res?.status()}`);
          await page.waitForFunction(
            ([sel, frame]) => {
              const el = document.querySelector(sel);
              const text = frame ? el?.querySelector("iframe")?.contentDocument?.body?.textContent : el?.textContent;
              return (text ?? "").trim().length > 40;
            },
            [root, Boolean(cap.frame)],
            { timeout: 240_000 },
          );
          await page.waitForFunction((t) => document.documentElement.classList.contains("dark") === (t === "dark"), theme, { timeout: 60_000 });
          // Floating controls (the edit page's save bar, back-to-top) would land mid-picture in a full capture.
          if (!cap.keepFixed) await page.addStyleTag({ content: "[data-floating],.fixed{display:none!important}" });
          await page.waitForTimeout(2000);
          // A panel that focuses its input on open would show the focus ring in the picture.
          await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
          const el = page.locator(root);
          await el.screenshot({ path: join(outDir, `${file}.png`) });
          for (const [picture, specs] of Object.entries(cap.pictures)) {
            if (!(kind in specs)) continue;
            const spec = specs[kind];
            crops[`${picture}${kind === "phone" ? "-phone" : ""}-${theme}`] = {
              capture: file,
              crop: spec ? await page.evaluate(measure, [spec, root]) : null,
              guide: Boolean(specs.guide),
            };
          }
          console.log("OK", file);
        } catch (e) {
          failed += 1;
          console.log("FAIL", file, String(e).slice(0, 160));
        } finally {
          await ctx.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}
writeFileSync(cropsFile, JSON.stringify(crops, null, 1));
process.exit(failed ? 1 : 0);
