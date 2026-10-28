/**
 * The screenshots the page social cards inset (make-page-cards.mjs).
 *
 *   node scripts/capture-card-shots.mjs <spec.json> <out-dir> [base-url] [--only slug[,slug...]]
 *
 * One browser, one page at a time (parallel headless Chrome has crashed this
 * machine). Each page is loaded at 1024 wide (CARD_VIEW_W), device scale 2, light theme;
 * the shot is framed from the page's own H1, or from the heading a card names
 * in `from` when the H1 carries a live figure (a card is never redrawn when
 * the figure moves), or from the first element a selector in `fromEl` matches
 * (a box with no heading of its own), and it ends at the right edge of the page's own column,
 * so no line is cut off, and runs down at the card frame's own ratio
 * (make-page-cards.mjs draws it 652x446). Floating controls and the dev
 * overlay are hidden.
 * Writes <out-dir>/<slug>.png and fills each card's `shot` and `crop`.
 * Capture a dev server on production data, never production itself: bulk
 * captures of production have tripped the bot defense (Oct 11 2026).
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
/** The page's width when captured. The narrowest desktop layout (lg, 1024)
 *  draws a page's own column larger in the card's 652px frame than a wide
 *  screen does, so the type stays readable. */
const VIEW_W = Number(process.env.CARD_VIEW_W ?? 1024);
const SCALE = 2;
/** The region shot, in CSS pixels: as wide as the page's column (at most a
 *  wide page's 1200 plus a margin), as tall as the card's frame is for that
 *  width. */
const SHOT_W_MAX = 1264;
const FRAME_RATIO = 446 / 652;

const [specPath, outDir, base = "http://localhost:3000"] = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--only");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const card of spec) {
    if (only && !only.split(",").includes(card.slug)) continue;
    // `viewport`: a wider page for one whose header squeezes at the narrowest desktop width.
    const viewW = card.viewport ?? VIEW_W;
    const ctx = await browser.newContext({ viewport: { width: viewW, height: 900 }, deviceScaleFactor: SCALE, colorScheme: "light", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    try {
      await page.goto(base + card.path, { waitUntil: "load", timeout: 300_000 });
      // The data pages' side list keeps its room but is hidden: its current-page row
      // reaches into the column the frame starts at. Its label changed once ("All data
      // pages" to "Data sections") and the row showed on every data card, so both are named.
      // A DOL notice is news of the day, never part of a card.
      await page.addStyleTag({ content: "nextjs-portal,[data-floating],.fixed,section[aria-label=\"DOL notice on FLAG\"]{display:none!important}nav[aria-label=\"All data pages\"],nav[aria-label=\"Data sections\"]{visibility:hidden!important}" });
      // `css` and `script`: what one card needs that the page as served can't give it, such as a composition
      // that leaves out words a card mustn't carry (a reviewer's name lives on in shared copies of an image).
      if (card.css) await page.addStyleTag({ content: card.css });
      // Pictures below the fold load lazily, and a capture never scrolls: load them all.
      await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager")));
      await page.waitForTimeout(2500);
      if (card.script) await page.evaluate(card.script);
      // `fill`: sample inputs, typed into fields by their labels, so a calculator shows a
      // worked answer instead of empty boxes. A select takes an option's label.
      for (const [label, value] of card.fill ?? []) {
        const f = page.getByLabel(label, { exact: true }).first();
        if ((await f.evaluate((e) => e.tagName).catch(() => "")) === "SELECT") {
          // "#2" picks the second option, for a list loaded after an earlier choice.
          if (/^#\d+$/.test(value)) {
            await page.waitForFunction((el) => el.options.length > 1, await f.elementHandle(), { timeout: 15000 }).catch(() => {});
            await f.selectOption({ index: Number(value.slice(1)) });
          } else await f.selectOption({ label: value }).catch(() => f.selectOption(value));
          await page.waitForTimeout(800);
        } else {
          await f.fill(value);
          await f.dispatchEvent("blur").catch(() => {});
        }
      }
      // `wait`: more time for a page that loads its figures live after the inputs (DOL's wage search).
      if (card.fill || card.wait) await page.waitForTimeout(card.wait ?? 2000);
      // Pages print their own address (badge snippets, embed codes), and the dev server's is
      // localhost: a card shows the site's. After the wait, or hydration puts it back.
      await page.evaluate((origin) => {
        const own = /https?:\/\/(localhost|127\.0\.0\.1):\d+/g;
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.search(own) >= 0) n.nodeValue = n.nodeValue.replace(own, origin);
        for (const f of document.querySelectorAll("input, textarea")) if (f.value.search(own) >= 0) f.value = f.value.replace(own, origin);
      }, "https://permtracker.app");
      const box = await page.evaluate(([from, fromEl, viewW]) => {
        const start = fromEl
          ? document.querySelector(fromEl)
          : from
            ? [...document.querySelectorAll("main h1, main h2, main h3")].find((h) => (h.textContent ?? "").trim().startsWith(from))
            : document.querySelector("main h1") ?? document.querySelector("h1");
        if (!start) return null;
        // The page's own column: the widest ancestor still narrower than the screen.
        let col = start;
        for (let el = start.parentElement; el && el !== document.body; el = el.parentElement) {
          if (el.getBoundingClientRect().width < viewW - 40) col = el;
        }
        // Framed on the column's content edges, not the heading's: a heading set
        // in from the text beside an icon would otherwise cut the text off.
        const r = start.getBoundingClientRect();
        const c = col.getBoundingClientRect();
        const cs = getComputedStyle(col);
        const left = Math.min(r.left, c.left + parseFloat(cs.paddingLeft));
        const right = c.right - parseFloat(cs.paddingRight);
        return { x: left + window.scrollX, y: r.top + window.scrollY, right: right + window.scrollX };
      }, [card.from ?? null, card.fromEl ?? null, viewW]);
      if (!box) throw new Error(card.fromEl ? `nothing matches ${card.fromEl}` : card.from ? `no heading starting "${card.from}"` : "no H1");
      // `above`: more room over the heading, for a hero whose side column starts higher;
      // `maxWidth`: a wider frame, for a hero that runs past the usual column.
      const x = Math.max(0, Math.round(box.x - 32));
      // A clean top: if the line above the heading slices a picture or a box (a collage
      // reaching above the H1), start above it instead, up to 320px higher.
      const y = await page.evaluate(([y0, left, right]) => {
        let y = y0;
        for (let pass = 0; pass < 4; pass++) {
          let lift = y;
          for (const el of document.querySelectorAll("main *")) {
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2 || r.right < left || r.left > right) continue;
            const t = r.top + window.scrollY;
            const b = r.bottom + window.scrollY;
            if (!(t < y - 1 && b > y + 1)) continue;
            const cs = getComputedStyle(el);
            const media = /^(IMG|SVG|CANVAS|VIDEO|svg)$/.test(el.tagName);
            const boxed = parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== "none" || (!/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) && r.width < right - left - 4);
            if (media || boxed) lift = Math.min(lift, t - 16);
          }
          if (lift >= y || y0 - lift > 320) break;
          y = lift;
        }
        return Math.max(0, Math.round(y));
      }, [Math.max(0, Math.round(box.y - (card.above ?? 40))), x, x + Math.min(card.maxWidth ?? SHOT_W_MAX, viewW - x)]);
      const w = Math.min(card.maxWidth ?? SHOT_W_MAX, Math.round(box.right + 32) - x, viewW - x);
      const h = Math.round(w * FRAME_RATIO);
      // A clean bottom (owner, Oct 27 2026: "all borders shouldn't have cut off"): the frame
      // has a fixed shape, so its edge used to land mid-box. End the picture on the lowest
      // line inside the frame that no box, picture or line of text crosses, and paint the
      // page's own ground below it, so every card ends on whitespace.
      const cutFn = ([top, bottom, left, right, thinOk, commit]) => {
        const seen = (el) => {
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
          const painted =
            (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) ||
            cs.backgroundImage !== "none" ||
            parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 ||
            cs.boxShadow !== "none";
          const media = /^(IMG|SVG|CANVAS|VIDEO|svg|INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName);
          const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          return painted || media || text;
        };
        const docY = (r) => [r.top + window.scrollY, r.bottom + window.scrollY];
        const boxes = [];
        // Each box with what it is: a leaf (its own text, a picture, a field, or a painted
        // box with nothing inside) can't be cut; a container can be closed early.
        const items = [];
        const bandTops = [];
        for (const el of document.querySelectorAll("main *, main")) {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || r.right < left || r.left > right) continue;
          const [t, b] = docY(r);
          if (b < top || t > bottom) continue;
          // A side column that starts left of the frame and ends inside it (the data pages'
          // painted rail column) is beside the picture, not in it.
          if (r.left < left - 2 && r.right < right - 2) continue;
          // Wide wrappers with nothing painted don't count; a painted section does.
          if (!seen(el)) continue;
          // A band painted across the whole frame is page ground: cutting through it cuts no box.
          // Only its own text and pictures, counted on their own, can be cut.
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          const media = /^(IMG|SVG|CANVAS|VIDEO|svg|INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName);
          if (r.left <= left + 2 && r.right >= right - 2 && !own && !media) {
            if (t > top && t < bottom) bandTops.push(t);
            continue;
          }
          // A box as tall as the page's column is the page ground itself.
          // `main` and the shell start below a frame whose top rose over a hero, so where
          // it starts doesn't matter: a plain box as wide as the frame that runs past its
          // bottom is ground.
          if (r.width >= right - left - 4 && b >= bottom && getComputedStyle(el).boxShadow === "none" && parseFloat(getComputedStyle(el).borderBottomWidth) === 0) continue;
          const sh = getComputedStyle(el).boxShadow;
          const shadow = sh === "none" ? 0 : Math.max(0, ...(sh.match(/-?[\d.]+px/g) ?? []).slice(0, 2).map((v) => parseFloat(v))) + 2;
          // A hairline (a rail, a rule, a tick) can end anywhere; it is neither content nor a box.
          // So is a painted block laid absolutely under a box with nothing in it (an offset
          // shadow drawn as its own element): it follows the box it sits under.
          const line = r.width <= 6 || r.height <= 6 || (getComputedStyle(el).position === "absolute" && el.children.length === 0 && !own && !media);
          if (!line) boxes.push([t, b + shadow]);
          items.push({ el, t, b, sh: shadow, line, leaf: !line && (own || media || el.children.length === 0) });
        }
        const crosses = (y) => boxes.some(([t, b]) => t < y - 1 && b > y + 1);
        const clean = (share) => {
          for (let y = bottom - 12; y > top + (bottom - top) * share; y -= 4) if (!crosses(y) && !crosses(y - 8)) return y;
          return null;
        };
        // Neither the band nor the heading rule below may leave the frame under 55% full: a
        // badge page cut at its first band showed one line in a thin strip.
        const floor = top + (bottom - top) * 0.55;
        // 1. The lowest line nothing crosses, in the lower part of the frame.
        let cut = clean(0.55);
        let closed = false;
        // 2. A tool or table in one tall box starting partway down: no line clears it, and a line
        //    above it leaves the card thin. Close the box instead: find a line (in the lower part of
        //    the frame) no text, picture or field crosses, and end every box that line runs
        //    through just under it, each with its own padding, border and shadow, so the box
        //    ends whole inside the frame. A table can't be shortened, so the box around it is.
        const why = { clean: cut, noBox: 0, tooLow: 0, halfShown: 0, empty: 0, half: null, low: null };
        window.__cardWhy = why;
        // Measured always, so it can be compared with a clean line above the box.
        let plan = null;
        {
          for (let line = bottom - 20; line > floor; line -= 4) {
            const open = items.filter((i) => !i.leaf && !i.line && i.t < line - 1 && i.b > line + 1);
            if (!open.length) { why.noBox++; continue; }
            const ends = new Map();
            // A closed box keeps at most 12px of its bottom padding, so its first row fits.
            const pads = (c) => { const cs = getComputedStyle(c.el); return Math.min(12, parseFloat(cs.paddingBottom)) + parseFloat(cs.borderBottomWidth); };
            const endOf = (c) => {
              if (ends.has(c)) return ends.get(c);
              const inner = open.filter((d) => d !== c && c.el.contains(d.el) && !open.some((m) => m !== c && m !== d && c.el.contains(m.el) && m.el.contains(d.el)));
              const e = Math.max(line, ...inner.map((d) => endOf(d) + d.sh)) + pads(c);
              ends.set(c, e);
              return e;
            };
            const outer = open.filter((c) => !open.some((m) => m !== c && m.el.contains(c.el)));
            const last = Math.max(...outer.map((c) => endOf(c) + c.sh));
            if (last > bottom - 6) { why.tooLow++; why.low ??= { line: Math.round(line - top), last: Math.round(last - top), frame: Math.round(bottom - top), boxes: outer.map((c) => String(c.el.className?.baseVal ?? c.el.className).slice(0, 50)) }; continue; }
            const end = Math.min(bottom, last + 14);
            // No text, picture or field may show in part: each leaf ends above the line, or
            // starts below where the box around it is clipped (its content edge), or below the
            // frame's end when no closed box holds it.
            const halfShown = items.some((i) => {
              if (!i.leaf || i.b <= line + 1 || i.t >= end) return false;
              const holders = open.filter((c) => c.el.contains(i.el));
              const limit = holders.length ? Math.min(...holders.map((c) => endOf(c) - pads(c))) : end;
              const bad = i.t < limit;
              if (bad && !why.half) why.half = { line: Math.round(line - top), el: i.el.tagName + "." + String(i.el.className?.baseVal ?? i.el.className).slice(0, 60), t: Math.round(i.t - top), b: Math.round(i.b - top), limit: Math.round(limit - top) };
              return bad;
            });
            if (halfShown) { why.halfShown++; continue; }
            // A closed box must still show what it holds: a box closed above its fields or rows
            // reads as an empty bar.
            const tops = (c) => { const cs = getComputedStyle(c.el); return c.t + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth); };
            const shown = (c) => items.filter((i) => i.leaf && c.el.contains(i.el) && i.t >= tops(c) && i.b <= endOf(c) - pads(c));
            const spans = (c) => { const v = shown(c); return v.length ? Math.max(...v.map((i) => i.b)) - Math.min(...v.map((i) => i.t)) : 0; };
            if (outer.some((c) => endOf(c) - pads(c) - tops(c) < 56 || spans(c) < 40)) { why.empty++; continue; }
            plan = { open, ends: new Map(open.map((c) => [c, endOf(c)])), end };
            break;
          }
        }
        // Closing wins when it shows clearly more than a clean line above the box would.
        if (plan && (cut === null || plan.end > cut + 60)) {
          // Clip at the content edge, so nothing shows in the box's bottom padding.
          if (commit) {
            for (const c of plan.open) {
              c.el.style.setProperty("padding-bottom", `${Math.min(12, parseFloat(getComputedStyle(c.el).paddingBottom))}px`, "important");
              c.el.style.setProperty("max-height", `${plan.ends.get(c) - c.t}px`, "important");
              c.el.style.setProperty("overflow", "clip", "important");
              c.el.style.setProperty("overflow-clip-margin", "content-box", "important");
            }
          }
          cut = Math.round(plan.end);
          closed = true;
        }
        // 3. A clean line higher up.
        if (cut === null && thinOk) cut = clean(0.35);
        if (cut === null) return null;
        if (!closed) {
          // A cut inside a band that starts below the content would show a sliver of the next
          // section: end at the band's top edge instead.
          for (const bt of bandTops) if (bt < cut && bt > cut - 220 && bt > floor && !crosses(bt - 4)) cut = Math.min(cut, bt - 2);
          // Never end on a heading whose content was cut away: end above it instead.
          for (const hd of document.querySelectorAll("main h2, main h3")) {
            const [t, b] = docY(hd.getBoundingClientRect());
            if (b <= cut && b > cut - 140 && t - 16 > floor && !crosses(t - 16)) cut = Math.min(cut, t - 16);
          }
        }
        // The ground right above the cut, from the stack under it.
        let bg = getComputedStyle(document.body).backgroundColor;
        for (const el of document.elementsFromPoint(left + 8, cut - window.scrollY - 6)) {
          const c = getComputedStyle(el).backgroundColor;
          if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
        }
        // Tight: the frame ends a margin under the last thing drawn, never on a band of empty ground.
        const lastDrawn = Math.max(...boxes.filter(([, b]) => b <= cut).map(([, b]) => b), top);
        if (!closed && lastDrawn > top + 40) cut = Math.min(cut, Math.round(lastDrawn + 28));
        if (commit) {
          const cover = document.createElement("div");
          cover.setAttribute("data-card-cover", "");
          cover.style.cssText = `position:absolute;left:0;right:0;top:${cut}px;height:${bottom - cut + 40}px;background:${bg};z-index:2147483647;pointer-events:none`;
          document.body.appendChild(cover);
        }
        return cut;
      };
      // A frame too short for a tool's first row would end above the tool and show only its
      // heading: the frame grows (the card fits any shape) before it settles for that. Each size
      // is measured without touching the page; the first whose picture fills 70% of a standard
      // frame wins, else the fullest; only that one is applied.
      let best = null;
      for (const grow of [1, 1.15, 1.3]) {
        const fh = Math.round(h * grow);
        const c = await page.evaluate(cutFn, [y, y + fh, x, x + w, false, false]);
        if (process.env.CARD_DEBUG) console.log("TRY", card.slug, grow, c === null ? null : Math.round((c - y) / h * 100) + "%", JSON.stringify(await page.evaluate(() => window.__cardWhy)));
        if (c === null) continue;
        if (!best || c > best.c) best = { fh, c };
        if (c - y >= 0.7 * h) break;
      }
      const frameH = best ? best.fh : h;
      const cutAt = await page.evaluate(cutFn, [y, y + frameH, x, x + w, !best, true]);
      if (process.env.CARD_DEBUG) console.log("WHY", card.slug, JSON.stringify(await page.evaluate(() => window.__cardWhy)));
      const file = join(outDir, `${card.slug}.png`);
      await page.screenshot({ path: file, clip: { x, y, width: w, height: frameH }, fullPage: true });
      card.shot = `${card.slug}.png`;
      // The crop ends where the picture does: the card's frame takes this shape, so no
      // empty band is left inside it.
      card.crop = [0, 0, w * SCALE, Math.round(((cutAt ?? y + frameH) - y) * SCALE)];
      delete card.motif;
      console.log("OK", card.slug, card.path, `from ${x},${y}`);
    } catch (e) {
      console.log("FAIL", card.slug, card.path, String(e).slice(0, 120));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(specPath, JSON.stringify(spec, null, 1));
