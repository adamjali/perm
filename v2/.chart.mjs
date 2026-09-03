import { chromium } from "playwright-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const b = await chromium.launch({ executablePath: CHROME });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 160)));
  await p.goto("http://localhost:3300/perm-cases", { waitUntil: "domcontentloaded", timeout: 240000 });
  const layer = p.locator('rect[role="slider"]').first();
  await layer.waitFor({ timeout: 120000 });
  await p.waitForTimeout(1500);

  // 1. POINTER: hover the middle of the plot and read what appears.
  const box = await layer.boundingBox();
  await p.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2);
  await p.waitForTimeout(400);
  const onHover = await p.locator("svg text").evaluateAll((els) =>
    els.map((e) => e.textContent.trim()).filter((t) => /decisions|Week of/.test(t)));
  console.log("HOVER readout:", JSON.stringify(onHover));

  // 2. KEYBOARD: focus the layer and step with the arrows.
  await p.mouse.move(0, 0);
  await p.waitForTimeout(300);
  await layer.focus();
  await p.waitForTimeout(300);
  const onFocus = await layer.getAttribute("aria-valuetext");
  await p.keyboard.press("End");
  await p.waitForTimeout(300);
  const atEnd = await layer.getAttribute("aria-valuetext");
  await p.keyboard.press("ArrowLeft");
  await p.keyboard.press("ArrowLeft");
  await p.waitForTimeout(300);
  const back2 = await layer.getAttribute("aria-valuetext");
  console.log("FOCUS  :", onFocus);
  console.log("End    :", atEnd);
  console.log("Back x2:", back2);
  console.log("aria-valuemax:", await layer.getAttribute("aria-valuemax"));

  await p.keyboard.press("Home");
  await p.waitForTimeout(300);
  const chart = p.locator("svg").filter({ has: p.locator('rect[role="slider"]') }).first();
  await chart.scrollIntoViewIfNeeded();
  await p.mouse.move(box.x + box.width * 0.62, box.y + box.height / 2);
  await p.waitForTimeout(400);
  await chart.screenshot({ path: process.argv[2] });
  console.log("shot ok");
} finally { await b.close(); }
