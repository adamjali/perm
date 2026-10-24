"use client";

/**
 * DOL's PERM line as a roller conveyor, run forward as a time-lapse. The reviewer works the
 * front tray at DOL's measured pace, oldest first; when a month's stack runs out its tray rolls
 * off and the line moves up. The readout gives the day the run has reached, and the picked
 * month's two dates are the site's estimate (QueueRun). It pauses when the lime month reaches the
 * front and again at its end, then starts over from today. Page scrolling and dragging along the
 * line move it through the days; a second after either stops, it runs on from there.
 *
 * Self-running and scroll-linked motion is the owner's call for these drawings (Oct 21 2026).
 * Under reduced motion it holds today's line still, and the caption says the dates in words.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/components/iso/iso.css";
import { longDate, monthYear } from "@convex/lib/months";
import { HEIGHT, WIDTH, buildConveyor } from "./geometry";
import { frontMonth, queueReading, remainingAt, type QueueRun } from "./model";
import { MotionToggle } from "../MotionToggle";
import { CAPTION_CLASS, FIGURE_CLASS, READOUT_CLASS, SUMMARY_CLASS } from "../frame";

/** Real seconds for the whole run, the hold at the picked month's arrival and at its end. */
const RUN_S = 11;
const HOLD_REACH_S = 1.6;
const HOLD_END_S = 2.6;
const FADE_S = 0.4;
/** Sim days a tray takes to roll off once its month is done. */
const ROLL_DAYS = 1.2;
const RESUME_MS = 1000;
const DAYS_PER_SCROLL_PX = 0.08;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export default function QueueConveyorFigure({ run, census }: { run: QueueRun; census: string }) {
  const art = useMemo(() => buildConveyor(run), [run]);
  const n = run.months.length;
  const pickIndex = run.months.findIndex((m) => m.month === run.pick);
  // The day each month runs out (the older cases on the desk go first).
  const emptyAt = useMemo(() => {
    const out: number[] = [];
    let through = run.earlier;
    for (const m of run.months) {
      through += m.inLine;
      out.push(through / run.pace);
    }
    return out;
  }, [run]);

  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const line = useRef<SVGGElement>(null);
  const trays = useRef<(SVGGElement | null)[]>([]);
  const pile = useRef<SVGGElement>(null);
  const stamp = useRef<SVGGElement>(null);
  const sign = useRef<SVGGElement>(null);
  const readout = useRef<HTMLParagraphElement>(null);
  // The reader's Pause: the run stops until Play. The loop reads the ref; the label reads the state.
  const [paused, setPaused] = useState(false);
  const stopped = useRef(false);
  const wake = useRef<() => void>(() => {});
  const toggle = useCallback(() => {
    stopped.current = !stopped.current;
    setPaused(stopped.current);
    wake.current();
  }, []);

  useEffect(() => {
    const el = stage.current;
    const box = svg.current;
    const group = line.current;
    const desk = pile.current;
    const hand = stamp.current;
    const out = readout.current;
    const board = sign.current;
    if (!el || !box || !group || !desk || !hand || !out || !board) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const speed = run.endDays / RUN_S; // sim days per real second

    let t = 0;
    let holdUntil = 0;
    let heldReach = false;
    let fading = 0; // 0: none; > 0: seconds into the fade out and back in
    let held = false;
    let resumeAt = 0;
    let dragging = false;
    let dragFrom = { x: 0, y: 0, t: 0 };
    let visible = false;
    let frame = 0;
    let last = 0;
    let clock = 0;
    const shown = { heights: run.months.map(() => -1), pile: -1, text: "", shift: -1, front: frontMonth(run, 0) };

    const draw = () => {
      const left = remainingAt(run, t);
      let places = 0;
      run.months.forEach((_, i) => {
        const gone = ease((t - emptyAt[i]!) / ROLL_DAYS);
        places += gone;
        const g = trays.current[i];
        if (!g) return;
        const opacity = gone >= 1 ? "0" : (1 - gone).toFixed(2);
        if (g.style.opacity !== opacity) g.style.opacity = opacity;
        const bucket = Math.round(left.months[i]! / 25);
        if (bucket !== shown.heights[i]) {
          shown.heights[i] = bucket;
          g.innerHTML = art.tray(i, left.months[i]!, i === pickIndex);
        }
      });
      if (Math.abs(places - shown.shift) > 0.002) {
        shown.shift = places;
        group.setAttribute("transform", art.shift(places));
      }
      const pileBucket = Math.round(left.earlier);
      if (pileBucket !== shown.pile) {
        shown.pile = pileBucket;
        desk.innerHTML = art.pile(left.earlier);
      }
      const front = frontMonth(run, t);
      if (front !== shown.front) {
        shown.front = front;
        board.innerHTML = art.sign(front);
      }
      const text = queueReading(run, t);
      if (text !== shown.text) {
        shown.text = text;
        out.textContent = text;
      }
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
      last = now;
      clock += dt;
      const running = !still.matches && !stopped.current;
      if (held && !dragging && now >= resumeAt) held = false;
      if (running && !held) {
        if (fading > 0) {
          fading += dt;
          if (fading >= FADE_S && t !== 0) {
            t = 0;
            heldReach = false;
          }
          const o = fading < FADE_S ? 1 - fading / FADE_S : Math.min(1, (fading - FADE_S) / FADE_S);
          group.style.opacity = o.toFixed(2);
          desk.style.opacity = o.toFixed(2);
          if (fading >= 2 * FADE_S) fading = 0;
        } else if (now >= holdUntil) {
          const next = t + speed * dt;
          if (!heldReach && t < run.reachDays && next >= run.reachDays) {
            t = run.reachDays;
            heldReach = true;
            holdUntil = now + HOLD_REACH_S * 1000;
          } else if (next >= run.endDays) {
            if (t < run.endDays) {
              t = run.endDays;
              holdUntil = now + HOLD_END_S * 1000;
            } else {
              fading = 1e-6;
            }
          } else {
            t = next;
          }
        }
        // the reviewer's stamp comes down twice a second while the line moves
        const press = now < holdUntil || fading > 0 ? 0 : Math.max(0, Math.sin(clock * Math.PI * 4)) * 2.2;
        hand.setAttribute("transform", art.press(press));
      }
      draw();
      if (visible && (held || running)) frame = requestAnimationFrame(tick);
    };

    const run$ = () => {
      if (!frame && visible) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    wake.current = () => {
      // a pause in the middle of the fade lands on the start, never on a half-faded line
      if (fading > 0) {
        t = 0;
        heldReach = false;
      }
      fading = 0;
      group.style.opacity = "";
      desk.style.opacity = "";
      holdUntil = 0;
      hand.setAttribute("transform", art.press(0));
      run$();
    };

    const hold = () => {
      held = true;
      fading = 0;
      group.style.opacity = "";
      desk.style.opacity = "";
      resumeAt = performance.now() + RESUME_MS;
      holdUntil = 0;
      heldReach = t >= run.reachDays;
      run$();
    };

    // Dragging along the line moves through the days: toward the desk is later.
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
      t = Math.min(run.endDays, Math.max(0, dragFrom.t + (world / art.length) * run.endDays));
      hold();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      delete el.dataset.dragging;
      hold();
    };

    // Scrolling the page moves through the days the way the page moves, until the run's end.
    let lastScroll = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const moved = y - lastScroll;
      lastScroll = y;
      if (!visible || dragging || still.matches || moved === 0) return;
      const next = Math.min(run.endDays, Math.max(0, t + moved * DAYS_PER_SCROLL_PX));
      if (next === t) return;
      t = next;
      hold();
    };

    const seen = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1]!.isIntersecting;
        if (visible) run$();
      },
      { rootMargin: "80px 0px" },
    );
    seen.observe(el);
    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    still.addEventListener("change", run$);
    return () => {
      seen.disconnect();
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp);
      box.removeEventListener("pointercancel", onUp);
      window.removeEventListener("scroll", onScroll);
      still.removeEventListener("change", run$);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [run, art, emptyAt, pickIndex]);

  const ahead = run.earlier + run.months.slice(0, Math.max(0, pickIndex)).reduce((sum, m) => sum + m.inLine, 0);
  const pace = Math.round(run.pace);
  // Painter's order: the back of the line (the newest month) first, the front last.
  const order = Array.from({ length: n }, (_, j) => n - 1 - j);
  return (
    <figure className={FIGURE_CLASS}>
      <div ref={stage}>
        <div className="iso">
          <svg
            ref={svg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="iso-svg cursor-grab touch-pan-y select-none [[data-dragging]_&]:cursor-grabbing"
            role="img"
            aria-labelledby="dol-queue-title"
          >
            <title id="dol-queue-title">{`An illustration of DOL's PERM line as a roller conveyor. Each tray is one filing month, stacked with that month's cases still in analyst review. DOL's reviewer works from the front, at a desk whose sign names the month on the front tray. The lime tray is ${monthYear(run.pick)}.`}</title>
            {/* The markup is the kit's own paths, built from numbers in ./geometry: no outside text reaches it. */}
            <g dangerouslySetInnerHTML={{ __html: art.back }} />
            <g ref={line}>
              {order.map((i) => (
                <g
                  key={run.months[i]!.month}
                  ref={(g) => {
                    trays.current[i] = g;
                  }}
                  dangerouslySetInnerHTML={{ __html: art.tray(i, run.months[i]!.inLine, i === pickIndex) }}
                />
              ))}
            </g>
            <g dangerouslySetInnerHTML={{ __html: art.desk }} />
            <g ref={pile} dangerouslySetInnerHTML={{ __html: art.pile(run.earlier) }} />
            <g ref={sign} dangerouslySetInnerHTML={{ __html: art.sign(frontMonth(run, 0)) }} />
            <g ref={stamp} dangerouslySetInnerHTML={{ __html: art.stamp }} />
          </svg>
        </div>
        <div className={READOUT_CLASS}>
          <p ref={readout} className="min-h-12 flex-1 py-1 text-base tabular-nums sm:min-h-0">
            {queueReading(run, 0)}
          </p>
          <MotionToggle paused={paused} onToggle={toggle} what="time-lapse" />
        </div>
      </div>
      <figcaption className={CAPTION_CLASS}>
        <details>
          <summary className={SUMMARY_CLASS}>What this shows</summary>{" "}
          <p className="mt-1 leading-relaxed">
        {`An illustration of the line on ${longDate(census)}, run forward. Each tray is one filing month. Its stack is that month's cases still in analyst review, drawn to scale. The ${run.earlier.toLocaleString("en-US")} older cases still in line sit on the desk and go first. ${run.dolAsOf ? `DOL's own published month was ${monthYear(run.dolMonth)} on ${longDate(run.dolAsOf)}. ` : ""}The reviewer works at DOL's average over the last ${run.paceDays} days we observed: about ${pace.toLocaleString("en-US")} cases a day, oldest first. There are ${ahead.toLocaleString("en-US")} cases ahead of ${monthYear(run.pick)}, so the line reaches it around ${longDate(run.reachDate)}. It reaches the month's end around ${longDate(run.endDate)}. That's the estimate the queue month pages give, if DOL keeps that pace and works strictly in filing order. New filings joining the back aren't drawn. Drag along the line, or scroll, to move through the days.`}
      </p>
        </details>
      </figcaption>
    </figure>
  );
}
