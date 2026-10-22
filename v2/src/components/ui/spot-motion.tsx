"use client";

import { useEffect } from "react";

/**
 * Something inside each small picture answers the mouse (owner, Oct 21 2026: "something happening unique within the
 * drawing pref with the colors ... if its a compass point to mouse ... whichever is highlighted which is closest to
 * mouse ... clean", after a tilt of the whole picture read as "so corny").
 *
 * Each picture is an image file (SpotPicture), drawn by scripts/spot-pictures/build.mjs with its moving parts marked.
 * With a mouse, as the pointer comes near a picture this puts the picture's own SVG in the page in place of the image
 * and moves what its root names (`data-spot-act`):
 *   near         the lime goes to the item nearest the pointer (the coin stack, the fruit, the bar, the key tag)
 *   show-near    only the item nearest the pointer shows (the calendar's marked day, the lit window, the flipping flap)
 *   toward       the lime goes to the item pointing nearest the pointer (the signpost's arm)
 *   show-toward  only the item pointing nearest the pointer shows (the compass needle, the vault wheel)
 *   lift         parts marked `data-spot-lift="dx dy"` move by up to that much as the pointer comes near
 * When the pointer leaves, the picture is its still self again. A phone, a pen, and a visitor who asks for reduced
 * motion get the still images only; nothing moves by itself.
 */

const MEDIA = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
/** Within this distance of a picture's centre, in screen pixels, the pointer moves it. */
export const REACH = 320;
/** A picture that points (the compass, the vault, the signpost) follows the pointer this much farther away. */
export const POINT_REACH = 900;

type Pt = [number, number];

/** The index of the point nearest p. */
export function nearestIndex(points: readonly Pt[], p: Pt): number {
  let best = -1;
  let bestD = Infinity;
  points.forEach(([x, y], i) => {
    const d = (x - p[0]) ** 2 + (y - p[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** The index of the item one of whose directions lies nearest the direction v (largest cosine). */
export function towardIndex(dirs: readonly Pt[][], v: Pt): number {
  const len = Math.hypot(v[0], v[1]);
  if (len === 0) return -1;
  let best = -1;
  let bestCos = -Infinity;
  dirs.forEach((ways, i) => {
    for (const [dx, dy] of ways) {
      const l = Math.hypot(dx, dy);
      if (l === 0) continue;
      const cos = (dx * v[0] + dy * v[1]) / (l * len);
      if (cos > bestCos) {
        bestCos = cos;
        best = i;
      }
    }
  });
  return best;
}

/** How far a lifting part has moved, 0 to 1, for a pointer `d` pixels from the picture's centre (eased). */
export function liftShare(d: number): number {
  const t = Math.min(1, Math.max(0, 1 - d / REACH));
  return t * t * (3 - 2 * t);
}

/** "x y;x y" to points. */
export function parsePoints(s: string | null | undefined): Pt[] {
  if (!s) return [];
  return s
    .split(";")
    .map((pair) => pair.trim().split(/\s+/).map(Number))
    .filter((xy): xy is [number, number] => xy.length === 2 && xy.every(Number.isFinite));
}

interface Live {
  svg: SVGSVGElement;
  img: HTMLImageElement;
  act: string;
  pivot: Pt | null;
  items: SVGGElement[];
  centres: Pt[];
  dirs: Pt[][];
  /** The still picture: which items are lime, which are shown. */
  stillLime: boolean[];
  stillShown: boolean[];
  lifts: Array<{ el: SVGGElement; d: Pt }>;
  chosen: number;
}

let counter = 0;

async function bringToLife(wrapper: HTMLElement): Promise<Live | null> {
  const img = Array.from(wrapper.querySelectorAll("img")).find((i) => i.offsetParent !== null || i.getClientRects().length > 0);
  if (!img) return null;
  // "no-cache" asks the server whether the file changed (a 304 when it hasn't): a copy the browser kept from before a
  // picture gained its moving parts would otherwise come back with none, and the picture would never react.
  const res = await fetch(img.currentSrc || img.src, { cache: "no-cache" });
  if (!res.ok) return null;
  const doc = new DOMParser().parseFromString(await res.text(), "image/svg+xml");
  const svg = doc.documentElement as unknown as SVGSVGElement;
  if (svg.nodeName !== "svg" || !svg.dataset.spotAct) return null;
  // The file's style is scoped to its root id; a page can hold the same picture twice, so each copy gets its own id.
  const oldId = svg.id;
  const newId = `${oldId}-live-${++counter}`;
  svg.id = newId;
  svg.querySelectorAll("style").forEach((st) => {
    st.textContent = (st.textContent ?? "").split(`#${oldId}`).join(`#${newId}`);
  });
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("style", "display:block;width:100%;height:auto");
  if (wrapper.getAttribute("aria-hidden") === "true" || img.alt === "") {
    svg.setAttribute("aria-hidden", "true");
    svg.removeAttribute("role");
  } else {
    svg.setAttribute("aria-label", img.alt);
  }
  const node = document.importNode(svg, true) as SVGSVGElement;
  wrapper.appendChild(node);
  img.style.display = "none";

  const items = Array.from(node.querySelectorAll<SVGGElement>("g[data-spot-item]"));
  const stillLime = items.map((g) => g.classList.contains("ac-lime"));
  const stillShown = items.map((g) => g.getAttribute("display") !== "none");
  // Centres in the picture's own units, measured with every item shown once.
  const centres = items.map((g) => {
    const hidden = g.getAttribute("display") === "none";
    if (hidden) g.removeAttribute("display");
    const b = g.getBBox();
    if (hidden) g.setAttribute("display", "none");
    return [b.x + b.width / 2, b.y + b.height / 2] as Pt;
  });
  const lifts = Array.from(node.querySelectorAll<SVGGElement>("g[data-spot-lift]")).map((el) => {
    el.style.transition = "transform 320ms cubic-bezier(.2,.7,.2,1)";
    return { el, d: parsePoints(el.dataset.spotLift)[0] ?? ([0, 0] as Pt) };
  });
  return {
    svg: node,
    img,
    act: node.dataset.spotAct ?? "",
    pivot: parsePoints(node.dataset.pivot)[0] ?? null,
    items,
    centres,
    dirs: items.map((g) => parsePoints(g.dataset.dir)),
    stillLime,
    stillShown,
    lifts,
    chosen: -2,
  };
}

function choose(live: Live, index: number) {
  if (live.chosen === index) return;
  live.chosen = index;
  const show = live.act === "show-near" || live.act === "show-toward";
  live.items.forEach((g, i) => {
    if (show) {
      const on = index < 0 ? live.stillShown[i] : i === index;
      if (on) g.removeAttribute("display");
      else g.setAttribute("display", "none");
    } else {
      g.classList.toggle("ac-lime", index < 0 ? live.stillLime[i]! : i === index);
    }
  });
}

function update(live: Live, wrapper: HTMLElement, px: number, py: number) {
  const r = wrapper.getBoundingClientRect();
  const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
  if (live.act === "lift") {
    const k = liftShare(d);
    for (const { el, d: [dx, dy] } of live.lifts) el.style.transform = `translate(${(dx * k).toFixed(2)}px, ${(dy * k).toFixed(2)}px)`;
    return;
  }
  const pointing = live.act === "toward" || live.act === "show-toward";
  if (d > (pointing ? POINT_REACH : REACH)) return choose(live, -1);
  const ctm = live.svg.getScreenCTM();
  if (!ctm) return;
  const p = new DOMPoint(px, py).matrixTransform(ctm.inverse());
  if (pointing && live.pivot) {
    choose(live, towardIndex(live.dirs, [p.x - live.pivot[0], p.y - live.pivot[1]]));
  } else {
    choose(live, nearestIndex(live.centres, [p.x, p.y]));
  }
}

function rest(live: Live) {
  choose(live, -1);
  for (const { el } of live.lifts) el.style.transform = "";
}

export function SpotMotion() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(MEDIA);
    const lives = new Map<HTMLElement, Live | "pending" | "failed">();
    let frame = 0;
    let px = -1e6;
    let py = -1e6;

    const tick = () => {
      frame = 0;
      // a page left by a client navigation takes its pictures with it
      lives.forEach((_, wrapper) => {
        if (!wrapper.isConnected) lives.delete(wrapper);
      });
      document.querySelectorAll<HTMLElement>("[data-spot]").forEach((wrapper) => {
        const r = wrapper.getBoundingClientRect();
        if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return;
        const state = lives.get(wrapper);
        if (state === undefined) {
          const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
          if (d > POINT_REACH) return;
          lives.set(wrapper, "pending");
          bringToLife(wrapper)
            .then((live) => {
              lives.set(wrapper, live ?? "failed");
              if (live) update(live, wrapper, px, py);
            })
            .catch(() => lives.set(wrapper, "failed"));
          return;
        }
        if (typeof state === "object" && wrapper.contains(state.svg)) update(state, wrapper, px, py);
      });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = window.requestAnimationFrame(tick);
    };
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      lives.forEach((live) => typeof live === "object" && rest(live));
    };
    // The site's theme swaps which file a picture shows: put the images back and bring the right one to life next time.
    const putBack = () => {
      lives.forEach((live) => {
        if (typeof live !== "object") return;
        live.svg.remove();
        live.img.style.display = "";
      });
      lives.clear();
    };
    let dark = document.documentElement.classList.contains("dark");
    const theme = new MutationObserver(() => {
      const now = document.documentElement.classList.contains("dark");
      if (now === dark) return;
      dark = now;
      putBack();
    });

    let on = false;
    const start = () => {
      if (on) return;
      on = true;
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("mouseout", onOut);
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    };
    const stop = () => {
      if (!on) return;
      on = false;
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseout", onOut);
      theme.disconnect();
      putBack();
    };
    const sync = () => (media.matches ? start() : stop());
    sync();
    media.addEventListener("change", sync);
    return () => {
      stop();
      media.removeEventListener("change", sync);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
