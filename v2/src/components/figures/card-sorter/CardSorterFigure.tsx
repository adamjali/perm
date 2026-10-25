"use client";

/**
 * The nightly sweep as a card sorter, run one batch at a time. Cards leave the hopper, pass under
 * the reader (DOL's case-status search) and run left to the pocket for the status DOL gives back,
 * at the shares tonight's record holds. Each loop is one batch of 100 cards; the stacks show the
 * batch, and the legend under the drawing gives every pocket's real total. It holds at the end of
 * the batch, clears, and starts again. Page scrolling and dragging along the track move it through
 * the batch; a second after either stops, it runs on from there.
 *
 * Self-running and scroll-linked motion is the owner's call for these drawings (Oct 21 2026).
 * Under reduced motion it holds still at the end of the batch, which is the picture the server
 * draws.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/components/iso/iso.css";
import { formatInt } from "@/lib/format";
import { CARD_Z, CHUTE_Y, HEIGHT, HOPPER_EXIT_X, LAND_Y, READ_X, TRACK_Y, WIDTH, buildSorter, pocketX } from "./geometry";
import type { SorterRun } from "./model";
import { MotionToggle } from "../MotionToggle";

/** Seconds between cards leaving the hopper, and a card's legs. */
const EMIT_S = 0.3;
const TO_READER_S = 0.22;
const READ_S = 0.18;
const SPEED = 220; // world units a second along the track
const FORWARD_S = 0.14;
const DROP_S = 0.24;
const HOLD_END_S = 2.4;
const FADE_S = 0.45;
const RESUME_MS = 1000;
const SECONDS_PER_SCROLL_PX = 0.012;
const POOL = 8;

type Point = [number, number, number];

interface Leg {
  /** When the card leaves the hopper and when it lands, in seconds into the batch. */
  start: number;
  land: number;
  pocket: number;
}

function legsOf(run: SorterRun): Leg[] {
  return run.sequence.map((pocket, n) => {
    const start = n * EMIT_S;
    const travel = (READ_X - pocketX(pocket)) / SPEED;
    return { start, pocket, land: start + TO_READER_S + READ_S + travel + FORWARD_S + DROP_S };
  });
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * Math.min(1, Math.max(0, f));

/** Where a card is, `age` seconds after it left the hopper, and whether it's still on the deck. */
function cardAt(leg: Leg, age: number, top: number): { p: Point; onDeck: boolean; opacity: number } {
  const xc = pocketX(leg.pocket);
  const t1 = TO_READER_S;
  const t2 = t1 + READ_S;
  const t3 = t2 + (READ_X - xc) / SPEED;
  const t4 = t3 + FORWARD_S;
  const opacity = Math.min(1, age / 0.08);
  if (age < t1) return { p: [lerp(HOPPER_EXIT_X, READ_X, age / t1), TRACK_Y, CARD_Z], onDeck: true, opacity };
  if (age < t2) return { p: [READ_X, TRACK_Y, CARD_Z], onDeck: true, opacity };
  if (age < t3) return { p: [lerp(READ_X, xc, (age - t2) / (t3 - t2)), TRACK_Y, CARD_Z], onDeck: true, opacity };
  if (age < t4) return { p: [xc, lerp(TRACK_Y, CHUTE_Y, (age - t3) / FORWARD_S), CARD_Z], onDeck: true, opacity };
  const f = Math.min(1, (age - t4) / DROP_S);
  return { p: [xc, lerp(CHUTE_Y, LAND_Y, f), lerp(CARD_Z, top, f * f)], onDeck: f < 0.25, opacity };
}

export default function CardSorterFigure({ run }: { run: SorterRun }) {
  const art = useMemo(() => buildSorter(), []);
  const legs = useMemo(() => legsOf(run), [run]);
  const perPocket = useMemo(() => run.pockets.map((_, i) => run.sequence.filter((p) => p === i).length), [run]);
  const most = Math.max(1, ...perPocket);
  const endS = legs.length ? legs[legs.length - 1]!.land + HOLD_END_S : 1;

  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const deck = useRef<SVGGElement>(null);
  const slots = useRef<(SVGGElement | null)[]>([]);
  const stacks = useRef<(SVGGElement | null)[]>([]);
  const pool = useRef<(SVGGElement | null)[]>([]);
  const readout = useRef<HTMLParagraphElement>(null);
  const [paused, setPaused] = useState(false);
  const stopped = useRef(false);
  const wake = useRef<() => void>(() => {});
  const toggle = useCallback(() => {
    stopped.current = !stopped.current;
    setPaused(stopped.current);
    wake.current();
  }, []);

  const endText = `${formatInt(run.batch)} cards sorted. ${formatInt(perPocket[0] ?? 0)} went to ${run.pockets[0]!.label.toLowerCase()}.`;

  useEffect(() => {
    const el = stage.current;
    const box = svg.current;
    const deckG = deck.current;
    const out = readout.current;
    if (!el || !box || !deckG || !out) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");

    let t = endS; // starts on the finished batch, the picture the server drew
    let fading = 0;
    let held = false;
    let resumeAt = 0;
    let dragging = false;
    let dragFrom = { x: 0, y: 0, t: 0 };
    let visible = false;
    let frame = 0;
    let last = 0;
    const shown = { landed: perPocket.slice(), text: endText };

    const landedAt = (time: number) => {
      const counts = run.pockets.map(() => 0);
      for (const leg of legs) if (leg.land <= time) counts[leg.pocket]! += 1;
      return counts;
    };

    const draw = () => {
      const landed = landedAt(t);
      landed.forEach((n, i) => {
        if (n === shown.landed[i]) return;
        shown.landed[i] = n;
        const g = stacks.current[i];
        if (g) g.innerHTML = art.stack(i, n, most);
      });
      // the cards in flight, nearest the hopper last so it paints over the one ahead of it
      const flying = legs.filter((leg) => leg.start <= t && t < leg.land).sort((a, b) => a.start - b.start).reverse();
      for (let j = 0; j < POOL; j++) {
        const g = pool.current[j];
        if (!g) continue;
        const leg = flying[j];
        if (!leg) {
          if (g.style.display !== "none") g.style.display = "none";
          continue;
        }
        const top = art.stackTop(landed[leg.pocket]!, most);
        const at = cardAt(leg, t - leg.start, top);
        const parent = at.onDeck ? deckG : slots.current[leg.pocket];
        if (parent && g.parentNode !== parent) parent.appendChild(g);
        g.style.display = "";
        g.setAttribute("transform", art.place(at.p));
        const o = at.opacity >= 1 ? "" : at.opacity.toFixed(2);
        if (g.style.opacity !== o) g.style.opacity = o;
      }
      const current = flying[flying.length - 1];
      const text =
        t >= endS - HOLD_END_S
          ? endText
          : current
            ? `Card ${formatInt(legs.indexOf(current) + 1)} of ${formatInt(run.batch)}: ${run.pockets[current.pocket]!.label.toLowerCase()}`
            : out.textContent ?? "";
      if (text !== shown.text) {
        shown.text = text;
        out.textContent = text;
      }
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
      last = now;
      const running = !still.matches && !stopped.current;
      if (held && !dragging && now >= resumeAt) held = false;
      if (running && !held) {
        if (fading > 0) {
          fading += dt;
          const o = fading < FADE_S ? 1 - fading / FADE_S : Math.min(1, (fading - FADE_S) / FADE_S);
          for (const g of stacks.current) if (g) g.style.opacity = o.toFixed(2);
          if (fading >= FADE_S && t !== 0) t = 0;
          if (fading >= 2 * FADE_S) {
            fading = 0;
            for (const g of stacks.current) if (g) g.style.opacity = "";
          }
        } else if (t >= endS) {
          fading = 1e-6;
        } else {
          t = Math.min(endS, t + dt);
        }
      }
      draw();
      if (visible && (held || running)) frame = requestAnimationFrame(tick);
    };

    const go = () => {
      if (!frame && visible) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const settle = () => {
      fading = 0;
      for (const g of stacks.current) if (g) g.style.opacity = "";
    };
    wake.current = () => {
      if (fading > 0) t = 0;
      settle();
      go();
    };
    const hold = () => {
      held = true;
      settle();
      resumeAt = performance.now() + RESUME_MS;
      go();
    };

    // Dragging along the track moves through the batch: toward the hopper is earlier.
    const [ax, ay] = art.along;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      box.setPointerCapture(e.pointerId);
      dragFrom = { x: e.clientX, y: e.clientY, t };
      el.dataset.dragging = "";
      hold();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const unit = WIDTH / box.getBoundingClientRect().width;
      const world = ((e.clientX - dragFrom.x) * unit * ax + (e.clientY - dragFrom.y) * unit * ay) / (ax * ax + ay * ay);
      t = Math.min(endS, Math.max(0, dragFrom.t - (world / 200) * (endS - HOLD_END_S)));
      hold();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      delete el.dataset.dragging;
      hold();
    };

    let lastScroll = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const moved = y - lastScroll;
      lastScroll = y;
      if (!visible || dragging || still.matches || moved === 0) return;
      const next = Math.min(endS, Math.max(0, (t >= endS ? 0 : t) + Math.abs(moved) * SECONDS_PER_SCROLL_PX));
      if (next === t) return;
      t = next;
      hold();
    };

    const seen = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1]!.isIntersecting;
        if (visible) go();
      },
      { rootMargin: "80px 0px" },
    );
    seen.observe(el);
    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    still.addEventListener("change", go);
    return () => {
      seen.disconnect();
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp);
      box.removeEventListener("pointercancel", onUp);
      window.removeEventListener("scroll", onScroll);
      still.removeEventListener("change", go);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [run, art, legs, perPocket, most, endS, endText]);

  return (
    <figure className="m-0">
      <div ref={stage}>
        <div className="iso mx-auto max-w-5xl">
          <svg
            ref={svg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="iso-svg cursor-grab touch-pan-y select-none [[data-dragging]_&]:cursor-grabbing"
            role="img"
            aria-labelledby="card-sorter-title"
          >
            <title id="card-sorter-title">{`An illustration of the nightly check as a card sorter. Case cards leave a hopper on the right, pass under a reader and drop into one of six pockets along the front, one for each place a waiting case can be: ${run.pockets.map((p) => p.label.toLowerCase()).join(", ")}. Each batch is ${run.batch} cards at tonight's shares.`}</title>
            {/* The markup is the kit's own paths, built from numbers in ./geometry: no outside text reaches it. */}
            <g dangerouslySetInnerHTML={{ __html: art.back }} />
            <g ref={deck} />
            <g dangerouslySetInnerHTML={{ __html: art.over }} />
            {run.pockets.map((p, i) => (
              <g key={p.key}>
                <g dangerouslySetInnerHTML={{ __html: art.pocketBack[i]! }} />
                <g
                  ref={(g) => {
                    stacks.current[i] = g;
                  }}
                  dangerouslySetInnerHTML={{ __html: art.stack(i, perPocket[i]!, most) }}
                />
                <g
                  ref={(g) => {
                    slots.current[i] = g;
                  }}
                />
                <g dangerouslySetInnerHTML={{ __html: art.pocketFront[i]! }} />
              </g>
            ))}
            <g dangerouslySetInnerHTML={{ __html: art.end }} />
            {/* The card pool: parked here, moved into the deck or a pocket while it flies. */}
            <g>
              {Array.from({ length: POOL }, (_, j) => (
                <g
                  key={j}
                  style={{ display: "none" }}
                  ref={(g) => {
                    pool.current[j] = g;
                  }}
                  dangerouslySetInnerHTML={{ __html: art.card }}
                />
              ))}
            </g>
          </svg>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <p ref={readout} className="min-h-12 flex-1 py-1 text-base tabular-nums sm:min-h-0">
            {endText}
          </p>
          <MotionToggle paused={paused} onToggle={toggle} what="card sorter" />
        </div>
      </div>
      <figcaption>
        <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {run.pockets.map((p, i) => (
            <Fragment key={p.key}>
              {" "}
              <li className="border-t-2 border-border pt-3">
                <span className="block text-sm font-bold text-soft">{p.label}</span>{" "}
                <span className="mt-1 block font-heading text-2xl font-bold tabular-nums">{formatInt(p.count)}</span>{" "}
                <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                  {p.gloss}.{" "}
                  {perPocket[i]! > 0 ? `${formatInt(perPocket[i]!)} of every ${formatInt(run.batch)} cards.` : `Under 1 in ${formatInt(run.batch)} cards.`}
                </span>
              </li>
            </Fragment>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
