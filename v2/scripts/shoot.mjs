/**
 * Screenshots of our own pages, for the articles.
 *
 * ONE browser, ONE page, sequentially. Running headless Chrome in parallel has
 * crashed this machine twice, so the loop is deliberately serial and the
 * browser is closed in a finally block.
 *
 * Uses the installed Google Chrome rather than a downloaded Chromium: this is
 * macOS 12 and Playwright will not install its own browsers here.
 *
 * Usage:  node scripts/shoot.mjs shots.json
 * where shots.json is [{ "name": "...", "url": "...", "clip"?: "css selector",
 *                       "width"?: 1280, "height"?: 800, "wait"?: "css selector" }]
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "public/images/content/shots";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const shots = JSON.parse(readFileSync(process.argv[2] ?? "shots.json", "utf8"));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const manifest = [];
try {
  for (const s of shots) {
    const width = s.width ?? 1280;
    const height = s.height ?? 800;
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 2, // retina, so the figure is not soft on a good screen
      colorScheme: s.dark ? "dark" : "light",
    });
    try {
      await page.goto(s.url, { waitUntil: "networkidle", timeout: 60_000 });
      if (s.wait) await page.waitForSelector(s.wait, { timeout: 30_000 });
      // Entrance animations are whileInView; give them a beat to settle so a
      // shot never catches a half-faded element.
      await page.waitForTimeout(s.settle ?? 1200);
      const file = join(OUT, `${s.name}.png`);
      const target = s.clip ? page.locator(s.clip).first() : page;
      await target.screenshot({ path: file, ...(s.clip ? {} : { fullPage: !!s.fullPage }) });
      const box = s.clip ? await target.boundingBox() : { width, height };
      manifest.push({ name: s.name, url: s.url, file, w: Math.round(box?.width ?? width), h: Math.round(box?.height ?? height) });
      console.log(`ok   ${s.name}  ${Math.round(box?.width ?? width)}x${Math.round(box?.height ?? height)}`);
    } catch (e) {
      console.log(`FAIL ${s.name}  ${String(e).slice(0, 120)}`);
      manifest.push({ name: s.name, url: s.url, error: String(e).slice(0, 200) });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
const bad = manifest.filter((m) => m.error).length;
console.log(`\n${manifest.length - bad}/${manifest.length} captured -> ${OUT}`);
process.exit(bad ? 1 : 0);
