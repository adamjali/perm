import { chromium } from "playwright-core";
const [out, w, ...paths] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
for (const p of paths) {
  const ctx = await b.newContext({ viewport: { width: Number(w), height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", p, String(e).slice(0, 140)));
  try {
    await page.goto("http://localhost:3000" + p, { waitUntil: "load", timeout: 240000 });
    await page.waitForTimeout(2500);
    const name = (p.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home") + "-" + w;
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log("OK", name);
  } catch (e) { console.log("FAIL", p, String(e).slice(0, 120)); }
  await ctx.close();
}
await b.close();
