"use client";

import { useEffect } from "react";

/**
 * On-device layout diagnostic. Renders nothing unless the URL carries
 * `?diag=1`, and then prints a measurement block at the top of the page.
 *
 * WHY THIS SHIPS TO PRODUCTION. The date fields on the calculator pages
 * overflow their card on iPhone and on iPhone only. Three fixes were built
 * from desktop inference and the user's screenshots show the defect
 * surviving all three. Nothing on the dev machine can run iOS WebKit:
 * Playwright refuses to install WebKit on macOS 12, there is no simulator
 * without Xcode, and macOS Safari takes the non-iOS branch of WebKit's UA
 * stylesheet. A LAN-served diagnostic was blocked by the machine's firewall.
 * The production site is the one page the phone can always reach, so the
 * instrument goes where the patient is.
 *
 * What it reports, in order of diagnostic power:
 *
 * 1. Viewport truth, including `visualViewport.scale`. iOS zooms the page
 *    silently (focusing a small-font input is the classic trigger) and a
 *    zoomed page shows every symptom of "overflow" while having none.
 * 2. Every element wider than the viewport, widest first. The row marked
 *    `ROOT>` is the widest element with no wide children — the true source;
 *    everything above it is merely stretched by it.
 * 3. The first date field's ancestor chain: display, min-width, measured
 *    width, grid tracks.
 *
 * Reading it from the phone: open any page with `?diag=1`, screenshot the
 * green-on-black block.
 */
export function ViewportDiag() {
  useEffect(() => {
    if (!window.location.search.includes("diag=1")) return;
    if (document.getElementById("viewport-diag")) return;

    const run = () => {
      const cw = document.documentElement.clientWidth;
      let out = "";

      const vv = window.visualViewport;
      const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
      out +=
        "VIEWPORT\n" +
        `  html.clientWidth ${cw}   innerWidth ${window.innerWidth}\n` +
        `  visualViewport ${vv ? `${Math.round(vv.width)} @ scale ${vv.scale.toFixed(3)}` : "n/a"}\n` +
        `  screen ${screen.width}  dpr ${window.devicePixelRatio}\n` +
        `  scrollWidth ${document.documentElement.scrollWidth}` +
        `  (overflow ${Math.max(0, document.documentElement.scrollWidth - cw)}px)\n` +
        `  meta: ${meta ? meta.content : "MISSING"}\n` +
        `  UA: ${(navigator.userAgent.match(/(iPhone|CriOS\/[\d.]+|Version\/[\d.]+|Safari)/g) ?? []).join(" ")}\n\n`;

      const wide: { el: Element; w: number; right: number }[] = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.id === "viewport-diag") continue;
        const r = el.getBoundingClientRect();
        if (r.width > cw + 1 || r.right > cw + 1) {
          wide.push({ el, w: Math.round(r.width), right: Math.round(r.right) });
        }
      }
      wide.sort((a, b) => b.w - a.w);
      out += `ELEMENTS WIDER THAN VIEWPORT: ${wide.length}\n`;
      for (const x of wide.slice(0, 12)) {
        const n = x.el;
        const cls = (typeof n.className === "string" ? n.className : "").slice(0, 44);
        let hasWideChild = false;
        for (const child of n.children) {
          const cr = child.getBoundingClientRect();
          if (cr.width > cw + 1 || cr.right > cw + 1) {
            hasWideChild = true;
            break;
          }
        }
        out += `  ${hasWideChild ? "     " : "ROOT>"} ${n.tagName.toLowerCase()} w=${x.w} right=${x.right} .${cls}\n`;
      }
      out += "\n";

      const input = document.querySelector('input[type="date"]');
      if (input) {
        out += "DATE FIELD CHAIN\n";
        let node: Element | null = input;
        let depth = 0;
        while (node && node !== document.body && depth < 9) {
          const cs = getComputedStyle(node);
          const rr = node.getBoundingClientRect();
          const cls = (typeof node.className === "string" ? node.className : "").slice(0, 30);
          out +=
            `  ${depth} ${node.tagName.toLowerCase()} disp=${cs.display} minw=${cs.minWidth}` +
            ` w=${Math.round(rr.width)} right=${Math.round(rr.right)}` +
            (cs.gridTemplateColumns !== "none" ? ` cols=${cs.gridTemplateColumns}` : "") +
            ` .${cls}\n`;
          node = node.parentElement;
          depth += 1;
        }
      } else {
        out += "no date input on this page\n";
      }

      const pre = document.createElement("pre");
      pre.id = "viewport-diag";
      pre.textContent = out;
      pre.style.cssText =
        "position:relative;z-index:99999;background:#111;color:#0f0;" +
        "font:12px/1.4 ui-monospace,Menlo,monospace;padding:10px;margin:0;" +
        "white-space:pre-wrap;word-break:break-all;border-bottom:4px solid #0f0";
      document.body.insertBefore(pre, document.body.firstChild);
    };

    // After load plus a beat, so lazy content and fonts have settled.
    const t = window.setTimeout(run, 800);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
