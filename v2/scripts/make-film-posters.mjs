#!/usr/bin/env node
/**
 * The two explainer films' posters, rebuilt from the films themselves.
 *
 * A poster is the film's play button (FilmPlayer draws nothing over it), so it
 * carries the title, the audience, a Play button with the running time, and a
 * real frame of the product taken from the film. The Oct 7 2026 re-cut left
 * the end card as the poster: both films showed the same logo slide and no
 * play control. Re-run this whenever a film is re-cut:
 *
 *   node scripts/make-film-posters.mjs
 *
 * Needs ffmpeg and ffprobe on the PATH and Chrome installed. Writes
 * public/videos/explainer-<slug>-thumb.webp (1280x720).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * One entry per film. `at` is the second of the frame; `crop` is
 * [width, height, x, y] in the film's 1280x720 picture, chosen clear of the
 * burned-in caption at the bottom.
 */
const FILMS = [
  {
    slug: "waiting",
    title: "When will DOL decide my PERM case?",
    audience: "For the person waiting on a case",
    at: 24.5,
    crop: [568, 312, 433, 309],
  },
  {
    slug: "attorneys",
    title: "Every PERM deadline, worked out for you",
    audience: "For attorneys, paralegals and HR teams",
    at: 37.2,
    crop: [978, 468, 153, 113],
  },
];

const dir = mkdtempSync(join(tmpdir(), "film-posters-"));

function frame(src, at, [w, h, x, y], out) {
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(at), "-i", src, "-frames:v", "1", "-vf", `crop=${w}:${h}:${x}:${y}`, out]);
  return readFileSync(out).toString("base64");
}

function runningTime(src) {
  const s = Math.round(Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).toString().trim()));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function html({ title, audience, time, shot }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@700&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{margin:0;width:1280px;height:720px;overflow:hidden;font-family:"Space Grotesk",sans-serif;color:#0a0a0a;
  background:#f7f7f5 radial-gradient(#c9c9c4 1.6px,transparent 1.7px) 0 0/28px 28px}
.brand{position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:14px;font-weight:700;font-size:30px}
.mark{width:46px;height:46px;border:3px solid #0a0a0a;background:#2ECC40;display:grid;place-items:center;font-size:21px}
.brand b{color:#1a8a2a}
h1{position:absolute;left:64px;top:150px;width:540px;margin:0;font-size:62px;line-height:1.05;letter-spacing:-0.02em;font-weight:700}
.tag{position:absolute;left:64px;top:510px;border:3px solid #0a0a0a;background:#fff;padding:9px 14px;font-size:24px;font-weight:500}
.play{position:absolute;left:64px;top:582px;display:flex;align-items:center;gap:16px;border:3px solid #0a0a0a;background:#2ECC40;
  padding:12px 26px 12px 22px;box-shadow:8px 8px 0 #0a0a0a;font-size:32px;font-weight:700}
.play i{width:0;height:0;border-left:20px solid #0a0a0a;border-top:12px solid transparent;border-bottom:12px solid transparent}
.play span{font-family:"JetBrains Mono",monospace;font-size:28px}
.shot{position:absolute;right:56px;top:50%;width:620px;transform:translateY(-50%) rotate(-2deg);
  border:3px solid #0a0a0a;background:#fff;box-shadow:16px 16px 0 #0a0a0a}
.shot img{display:block;width:100%;height:auto}
</style></head><body>
<div class="brand"><span class="mark">PT</span><span><b>PERM</b> Tracker</span></div>
<h1>${title}</h1>
<div class="tag">${audience}</div>
<div class="play"><i></i>Play <span>${time}</span></div>
<div class="shot"><img src="data:image/png;base64,${shot}" alt=""></div>
</body></html>`;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
for (const f of FILMS) {
  const src = `public/videos/explainer-${f.slug}.mp4`;
  const shot = frame(src, f.at, f.crop, join(dir, `${f.slug}.png`));
  await page.setContent(html({ ...f, time: runningTime(src), shot }), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  const out = `public/videos/explainer-${f.slug}-thumb.webp`;
  writeFileSync(out, await sharp(png).resize(1280, 720).webp({ quality: 82 }).toBuffer());
  console.log(`wrote ${out}`);
}
await browser.close();
