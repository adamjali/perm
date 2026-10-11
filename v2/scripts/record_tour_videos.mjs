#!/usr/bin/env node
/**
 * Record the short silent clips the guides play, from the signed-in app's real
 * pages in Storybook ("Tour/App pages", answered from a sample firm's recorded
 * data, see src/components/tour/fakeConvex.tsx).
 *
 *   pnpm storybook   # in another terminal, on :6006
 *   node scripts/record_tour_videos.mjs [http://localhost:6006] [name ...]
 *
 * Each clip is a scripted walk through one page: scroll to a section, set a
 * date, let the page work out the rest. The clock is fixed to the recording's
 * day (2026-10-01), so "due in 12 days" says what it said when the sample firm
 * was recorded. One Chrome, one clip at a time (never two browsers at once on
 * this Mac). Frames come from Chrome's own screencast and are put together
 * with ffmpeg. Writes public/videos/guides/<name>.mp4 (H.264, no sound, starts
 * at once on the web) and <name>.webp, the first frame, for the poster.
 */
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = "/usr/local/Caskroom/miniconda/base/bin/ffmpeg";
const PYTHON = "/usr/local/Caskroom/miniconda/base/bin/python3";
const OUT = "public/videos/guides";
const SIZE = { width: 1280, height: 800 };
const TODAY = new Date("2026-10-01T15:00:00Z");

const [base = "http://localhost:6006", ...only] = process.argv.slice(2);
const story = (id) => `${base}/iframe.html?id=tour-app-pages--${id}&viewMode=story`;

/** Scroll by `by` pixels over `ms`, in small steps, so the recording reads as a hand on a trackpad. */
async function glide(page, by, ms = 1600) {
  const steps = Math.max(1, Math.round(ms / 40));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, by / steps);
    await page.waitForTimeout(40);
  }
}

/** Bring a heading's section to the top of the screen, gliding there. */
async function glideTo(page, heading, ms = 1800) {
  const y = await page.evaluate((h) => {
    const el = [...document.querySelectorAll("main h1, main h2, main h3, main legend, main label")].find((e) => e.textContent?.trim().startsWith(h));
    if (!el) throw new Error(`no heading ${h}`);
    return el.getBoundingClientRect().top - 24;
  }, heading);
  await glide(page, y, ms);
}

/** Set a date field the way a person would: click it, then type the date. */
async function setDate(page, id, iso) {
  const input = page.locator(`#${id}`);
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await page.waitForTimeout(300);
  await input.fill(iso);
  await input.blur();
}

const CLIPS = {
  // The cases page: every case as a card, ordered by its next deadline.
  "cases-page": {
    url: story("cases"),
    run: async (p) => {
      await p.waitForTimeout(1500);
      await p.locator("main h3").first().hover().catch(() => {});
      await p.waitForTimeout(1200);
      await glide(p, 700, 2600);
      await p.waitForTimeout(1200);
      await glide(p, -700, 1800);
      await p.waitForTimeout(800);
    },
  },
  // The wage determination date sets the expiration; the page works it out.
  "pwd-cascade": {
    url: story("edit-case"),
    run: async (p) => {
      await p.waitForTimeout(1500);
      await glideTo(p, "PWD (Prevailing", 1400);
      await p.waitForTimeout(800);
      // A spring determination expires 90 days on (the wage year ends June
      // 30); one after July 1 runs to the next June 30. The expiration and the
      // recruitment deadline under it move with each date.
      await setDate(p, "pwdFilingDate", "2026-02-02");
      await p.waitForTimeout(900);
      await setDate(p, "pwdDeterminationDate", "2026-04-10");
      await p.waitForTimeout(2200);
      await setDate(p, "pwdDeterminationDate", "2026-07-06");
      await p.waitForTimeout(2400);
    },
  },
  // Recruitment dates in, and the filing window comes back.
  "recruitment-window": {
    url: story("edit-case"),
    run: async (p) => {
      await p.waitForTimeout(1500);
      await glideTo(p, "Recruitment", 1600);
      await p.waitForTimeout(800);
      // A first Sunday ad earlier than the job order makes it the first step,
      // so the recruitment deadline moves up with it.
      await setDate(p, "sundayAdFirstDate", "2026-07-12");
      await p.waitForTimeout(1600);
      await glide(p, 420, 1600);
      await p.waitForTimeout(1600);
    },
  },
  // Filed, then certified, and the I-140 deadline comes back 179 days later.
  "certification-cascade": {
    url: story("edit-case"),
    run: async (p) => {
      await p.waitForTimeout(1500);
      await glideTo(p, "ETA 9089 (PERM", 1800);
      await p.waitForTimeout(800);
      // Filing first: the form won't take a certification date before it.
      await setDate(p, "eta9089FilingDate", "2026-09-28");
      await p.waitForTimeout(1400);
      await setDate(p, "eta9089CertificationDate", "2026-10-01");
      await p.waitForTimeout(1800);
      await glide(p, 360, 1400);
      await p.waitForTimeout(1800);
    },
  },
  // Every deadline across the caseload, a month at a time.
  "calendar-months": {
    url: story("calendar"),
    run: async (p) => {
      await p.waitForTimeout(1800);
      for (let i = 0; i < 2; i++) {
        await p.getByRole("button", { name: /next/i }).first().click();
        await p.waitForTimeout(1800);
      }
      await p.getByRole("button", { name: /today/i }).first().click().catch(() => {});
      await p.waitForTimeout(1500);
    },
  },
};

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let failed = 0;
try {
  for (const [name, clip] of Object.entries(CLIPS)) {
    if (only.length && !only.includes(name)) continue;
    const ctx = await browser.newContext({ viewport: SIZE, colorScheme: "light" });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(TODAY);
    const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", `tour-${name}-`));
    const frames = [];
    try {
      const res = await page.goto(clip.url, { waitUntil: "load", timeout: 180000 });
      if (!res || res.status() !== 200) throw new Error(`status ${res?.status()}`);
      await page.waitForSelector("#storybook-root main", { timeout: 240000 });
      await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
      await page.waitForTimeout(1500);
      // Chrome's own screencast: a frame each time the page paints, with its
      // time, so the clip keeps the real pace without a video binary of
      // Playwright's own.
      const cdp = await ctx.newCDPSession(page);
      cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
        const file = path.join(dir, `f${String(frames.length).padStart(5, "0")}.jpg`);
        fs.writeFileSync(file, Buffer.from(data, "base64"));
        frames.push({ file, t: metadata.timestamp });
        await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
      });
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: SIZE.width, maxHeight: SIZE.height });
      await clip.run(page);
      await page.waitForTimeout(600);
      await cdp.send("Page.stopScreencast");
      if (frames.length < 5) throw new Error(`only ${frames.length} frames`);
      // A concat list with each frame held until the next one painted.
      const end = frames.at(-1).t + 0.8;
      const list = frames
        .map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(3)}`)
        .join("\n") + `\nfile '${frames.at(-1).file}'\n`;
      fs.writeFileSync(path.join(dir, "list.txt"), list);
      const mp4 = path.join(OUT, `${name}.mp4`);
      // H.264 at a constant 30 frames a second, quality that keeps small type
      // sharp, no sound, the index at the front so it starts at once.
      execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "slow", "-movflags", "+faststart", mp4]);
      // The poster through Pillow: this ffmpeg build has no WebP encoder.
      execFileSync(PYTHON, ["-c", "import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], 'WEBP', quality=82, method=6)", frames[0].file, path.join(OUT, `${name}.webp`)]);
      console.log(`ok ${name} ${frames.length} frames, ${Math.round(fs.statSync(mp4).size / 1024)} KB`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${name} ${String(e).slice(0, 160)}`);
    } finally {
      await ctx.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
