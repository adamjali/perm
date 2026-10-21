"use client";

/**
 * The ETA 9089 filing window as a measuring bench, for the guides that explain it. The carriage
 * (the last recruitment step) and its 30-day spacer sweep along the bench and pause at each end;
 * the lime strip left before the 180-day stop is the window. Scrolling the page pushes the
 * carriage the way the page moves, and the reader can drag it; a second after either stops, the
 * sweep picks up from where the carriage is. The readout's dates come from the central rule
 * (calculateFilingWindow), the drawing's day counts from its constants. An illustration: the
 * dates belong to an example case.
 *
 * The site's calm rules keep motion to what the reader starts. This figure's sweep and its
 * scroll link are the owner's call (Oct 21 2026). A device that asks for reduced motion gets it
 * still, and dragging still works. The caption states the dates in words for anyone who can't
 * drag.
 */

import { useEffect, useRef } from "react";
import "@/components/iso/iso.css";
import { longDate } from "@convex/lib/months";
import { BACK, CARRIAGE, DAY_ON_SCREEN, FRONT, HEIGHT, LAST_MAX, LAST_MIN, WIDTH, carriageAt, windowAt } from "./geometry";
import { readFilingWindow } from "./model";

interface FilingWindowFigureProps {
  /** The example case's first recruitment step, ISO. */
  first?: string;
}

const LABEL =
  "An illustration of the filing window as a measuring bench. A fixed jaw marks the first recruitment step and a tie bar holds a stop 180 days from it. A carriage marks the last recruitment step and pushes a 30-day spacer ahead of it. The lime strip between the spacer and the stop is the time left to file.";

/** Seconds for one sweep from end to end, and the pause at each end. */
const SWEEP_S = 4.5;
const PAUSE_S = 1.2;
/** How long after a drag or a scroll the sweep starts again. */
const RESUME_MS = 1000;
/** Days the carriage moves per pixel the page scrolls. */
const DAYS_PER_SCROLL_PX = 0.2;

const MID = (LAST_MIN + LAST_MAX) / 2;
const AMP = (LAST_MAX - LAST_MIN) / 2;
const clampDay = (d: number) => Math.min(LAST_MAX, Math.max(LAST_MIN, d));

/** The sweep's phase for a carriage at `day` heading `dir`: day = MID - AMP cos(phase). */
function phaseAt(day: number, dir: 1 | -1): number {
  const base = Math.acos(Math.min(1, Math.max(-1, (MID - day) / AMP)));
  return dir > 0 ? base : 2 * Math.PI - base;
}

export default function FilingWindowFigure({ first = "2026-03-02" }: FilingWindowFigureProps) {
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const carriage = useRef<SVGGElement>(null);
  const strip = useRef<SVGGElement>(null);
  const readout = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = stage.current;
    const box = svg.current;
    const car = carriage.current;
    const win = strip.current;
    const out = readout.current;
    if (!el || !box || !car || !win || !out) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");

    let day: number = LAST_MIN;
    let dir: 1 | -1 = 1;
    let phase = phaseAt(day, dir);
    let pausedUntil = 0;
    let held = false; // a drag or a scroll is in charge
    let resumeAt = 0;
    let visible = false;
    let frame = 0;
    let last = 0;
    let shownDay = Math.round(day);
    let drawnDay = day;
    let dragging = false;
    let dragFrom = { x: 0, y: 0, day: 0 };

    const draw = () => {
      if (Math.abs(day - drawnDay) < 0.02) return;
      drawnDay = day;
      car.setAttribute("transform", carriageAt(day));
      win.innerHTML = windowAt(day);
      const rounded = Math.round(day);
      if (rounded !== shownDay) {
        shownDay = rounded;
        out.textContent = readFilingWindow(first, rounded).sentence;
      }
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
      last = now;
      if (held && !dragging && now >= resumeAt) {
        held = false;
        // carry on the way it was going, or turn back from an end
        if (day >= LAST_MAX - 0.01) dir = -1;
        else if (day <= LAST_MIN + 0.01) dir = 1;
        phase = phaseAt(day, dir);
        pausedUntil = 0;
      }
      if (!held && !still.matches && now >= pausedUntil) {
        const next = phase + (Math.PI / SWEEP_S) * dt;
        const turn = dir > 0 ? Math.PI : 2 * Math.PI;
        if (next >= turn) {
          phase = dir > 0 ? Math.PI : 0;
          dir = dir > 0 ? -1 : 1;
          pausedUntil = now + PAUSE_S * 1000;
        } else {
          phase = next;
        }
        day = MID - AMP * Math.cos(phase);
      }
      draw();
      if (visible && (held || !still.matches)) frame = requestAnimationFrame(tick);
    };

    const run = () => {
      if (!frame && visible) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    const hold = () => {
      held = true;
      resumeAt = performance.now() + RESUME_MS;
      run();
    };

    // Dragging: the pointer's move along the bench's own direction on screen, in days.
    const [ax, ay] = DAY_ON_SCREEN;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      box.setPointerCapture(e.pointerId);
      dragFrom = { x: e.clientX, y: e.clientY, day };
      el.dataset.dragging = "";
      hold();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const unit = WIDTH / box.getBoundingClientRect().width; // drawing units per screen pixel
      const dx = (e.clientX - dragFrom.x) * unit;
      const dy = (e.clientY - dragFrom.y) * unit;
      const prev = day;
      day = clampDay(dragFrom.day + (dx * ax + dy * ay) / (ax * ax + ay * ay));
      if (day !== prev) dir = day > prev ? 1 : -1;
      hold();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      delete el.dataset.dragging;
      hold();
    };

    // Scrolling the page pushes the carriage the way the page moves, until it meets an end.
    let lastScroll = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const moved = y - lastScroll;
      lastScroll = y;
      if (!visible || dragging || still.matches || moved === 0) return;
      const next = clampDay(day + moved * DAYS_PER_SCROLL_PX);
      if (next === day) return; // at an end: scrolling further does nothing
      dir = next > day ? 1 : -1;
      day = next;
      hold();
    };

    const seen = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1]!.isIntersecting;
        if (visible) run();
      },
      { rootMargin: "80px 0px" },
    );
    seen.observe(el);
    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    still.addEventListener("change", run);
    return () => {
      seen.disconnect();
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp);
      box.removeEventListener("pointercancel", onUp);
      window.removeEventListener("scroll", onScroll);
      still.removeEventListener("change", run);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [first]);

  const widest = readFilingWindow(first, LAST_MIN);
  const narrowest = readFilingWindow(first, LAST_MAX);
  return (
    <figure className="not-prose my-8 max-w-[800px]">
      <div ref={stage} className="border-2 border-border bg-background">
        <div className="iso px-1 pt-4 sm:px-6">
          <svg
            ref={svg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="iso-svg cursor-grab touch-pan-y select-none [[data-dragging]_&]:cursor-grabbing"
            role="img"
            aria-labelledby="filing-window-title"
          >
            <title id="filing-window-title">{LABEL}</title>
            {/* The markup is the kit's own paths, built from numbers in ./geometry: no outside text reaches it. */}
            <g dangerouslySetInnerHTML={{ __html: BACK }} />
            <g ref={strip} dangerouslySetInnerHTML={{ __html: windowAt(LAST_MIN) }} />
            <g ref={carriage} transform={carriageAt(LAST_MIN)} dangerouslySetInnerHTML={{ __html: CARRIAGE }} />
            <g dangerouslySetInnerHTML={{ __html: FRONT }} />
          </svg>
        </div>
        <p ref={readout} className="min-h-12 border-t-2 border-border px-4 py-3 text-base tabular-nums sm:min-h-0 sm:px-6">
          {widest.sentence}
        </p>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        {`An illustration, on an example case whose recruitment began ${longDate(first)}, inside the wage determination's validity. Drag the carriage, or scroll, to move the last step. With a last step on ${longDate(widest.last)} the window runs from ${longDate(widest.opens)} to ${longDate(widest.closes)}. Each day later shortens it by a day, and a last step on ${longDate(narrowest.last)} leaves only ${longDate(narrowest.closes)}. The dates come from the same rule the app uses on every case.`}
      </figcaption>
    </figure>
  );
}
