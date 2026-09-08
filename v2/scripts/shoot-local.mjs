// Shoot local pages at phone (390x844) and tablet (1024x768) widths with ONE
// headless Chrome, and report any element wider than the viewport. Blink
// only: proves no regression, never an iOS fix. Usage:
//   node scripts/shoot-local.mjs http://127.0.0.1:3000 <out-dir> /a /b ...
import { chromium } from "playwright-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [base, outDir, ...pages] = process.argv.slice(2);
const sizes = [[390, 844, "m"], [1024, 768, "t"]];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const [w, h, tag] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const p of pages) {
      const slug = p.replace(/^\//, "").replace(/\//g, "_") || "home";
      await page.goto(base + p, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(800);
      const over = await page.evaluate(() => Array.from(document.querySelectorAll("body *")).filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 5).map(e => e.tagName + "." + String(e.className).slice(0, 40) + " right=" + Math.round(e.getBoundingClientRect().right)));
      console.log(`${tag} ${p}: scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)} over=${JSON.stringify(over)}`);
      await page.screenshot({ path: `${outDir}/${tag}-${slug}.png`, fullPage: false });
      if (tag === "m" && p === "/perm-cases") {
        await page.click('button[aria-controls="data-rail-panel"]');
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${outDir}/${tag}-${slug}-drawer.png`, fullPage: false });
      }
    }
    await ctx.close();
  }
} finally { await browser.close(); }
