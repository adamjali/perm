"use client";

/**
 * DOL's PERM wage-request line as a roller conveyor, run forward as a time-lapse counted in the
 * days DOL works. The reviewer works the front tray at DOL's measured pace a working day, oldest
 * first; when a month runs out its tray rolls off and the line moves up. The readout gives the
 * day the run has reached, and the picked month's two dates are the wage-request lookup's own
 * (PwdQueueRun). It pauses when the lime month reaches the front and again at its end, then
 * starts over from the count. Page scrolling and dragging along the line move it through the
 * days; a second after either stops, it runs on from there.
 *
 * Self-running and scroll-linked motion is the owner's call for these drawings (Oct 21 2026). A
 * Pause button stops it, and under reduced motion it holds the count still; the caption says the
 * dates in words.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/components/iso/iso.css";
import { longDate, monthYear } from "@convex/lib/months";
import { HEIGHT, WIDTH, buildConveyor } from "../dol-queue/geometry";
import { pwdFrontMonth, pwdReading, pwdRemainingAt, type PwdQueueRun } from "./model";
import { MotionToggle } from "../MotionToggle";

/** Real seconds for the whole run, and the holds at the picked month's arrival and at its end. */
const RUN_S = 11;
const HOLD_REACH_S = 1.6;
const HOLD_END_S = 2.6;
const FADE_S = 0.4;
/** Working days a tray takes to roll off once its month is done. */
const ROLL_WORK = 0.8;
const RESUME_MS = 1000;
const WORK_PER_SCROLL_PX = 0.06;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export default function PwdQueueConveyorFigure({ run }: { run: PwdQueueRun }) {
  const art = useMemo(() => buildConveyor(run), [run]);
  const n = run.months.length;
  const pickIndex = run.months.findIndex((m) => m.month === run.pick);
  // The working day each month runs out (the few older requests on the desk go first).
  const emptyAt = useMemo(() => {
    let through = run.earlier;
    return run.months.map((m) => (through += m.inLine) / run.pace);
  }, [run]);

  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const line = useRef<SVGGElement>(null);
  const trays = useRef<(SVGGElement | null)[]>([]);
  const pile = useRef<SVGGElement>(null);
  const stamp = useRef<SVGGElement>(null);
  const sign = useRef<SVGGElement>(null);
  const readout = useRef<HTMLParagraphElement>(null);
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
    const speed = run.endWork / RUN_S; // working days per real second

    let w = 0;
    let holdUntil = 0;
    let heldReach = false;
    let fading = 0;
    let held = false;
    let resumeAt = 0;
    let dragging = false;
    let dragFrom = { x: 0, y: 0, w: 0 };
    let visible = false;
    let frame = 0;
    let last = 0;
    let clock = 0;
    const shown = { heights: run.months.map(() => -1), pile: -1, text: "", shift: -1, front: pwdFrontMonth(run, 0) };

    const draw = () => {
      const left = pwdRemainingAt(run, w);
      let places = 0;
      run.months.forEach((_, i) => {
        const gone = ease((w - emptyAt[i]!) / ROLL_WORK);
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
      const front = pwdFrontMonth(run, w);
      if (front !== shown.front) {
        shown.front = front;
        board.innerHTML = art.sign(front);
      }
      const text = pwdReading(run, w);
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
          if (fading >= FADE_S && w !== 0) {
            w = 0;
            heldReach = false;
          }
          const o = fading < FADE_S ? 1 - fading / FADE_S : Math.min(1, (fading - FADE_S) / FADE_S);
          group.style.opacity = o.toFixed(2);
          desk.style.opacity = o.toFixed(2);
          if (fading >= 2 * FADE_S) fading = 0;
        } else if (now >= holdUntil) {
          const next = w + speed * dt;
          if (!heldReach && w < run.reachWork && next >= run.reachWork) {
            w = run.reachWork;
            heldReach = true;
            holdUntil = now + HOLD_REACH_S * 1000;
          } else if (next >= run.endWork) {
            if (w < run.endWork) {
              w = run.endWork;
              holdUntil = now + HOLD_END_S * 1000;
            } else {
              fading = 1e-6;
            }
          } else {
            w = next;
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
        w = 0;
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
      heldReach = w >= run.reachWork;
      run$();
    };

    // Dragging along the line moves through the days: toward the desk is later.
    const [ax, ay] = art.along;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      box.setPointerCapture(e.pointerId);
      dragFrom = { x: e.clientX, y: e.clientY, w };
      el.dataset.dragging = "";
      hold();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const unit = WIDTH / box.getBoundingClientRect().width;
      const world = ((e.clientX - dragFrom.x) * unit * ax + (e.clientY - dragFrom.y) * unit * ay) / (ax * ax + ay * ay);
      w = Math.min(run.endWork, Math.max(0, dragFrom.w + (world / art.length) * run.endWork));
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
      const next = Math.min(run.endWork, Math.max(0, w + moved * WORK_PER_SCROLL_PX));
      if (next === w) return;
      w = next;
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

  const pace = Math.round(run.pace);
  const ahead = Math.round(run.aheadReach);
  const inPick = run.months[pickIndex]?.inLine ?? 0;
  // Painter's order: the back of the line (the newest month) first, the front last.
  const order = Array.from({ length: n }, (_, j) => n - 1 - j);
  return (
    <figure className="not-prose my-8 max-w-[800px]">
      <div ref={stage} className="border-2 border-border bg-background">
        <div className="iso px-1 pt-4 sm:px-6">
          <svg
            ref={svg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="iso-svg cursor-grab touch-pan-y select-none [[data-dragging]_&]:cursor-grabbing"
            role="img"
            aria-labelledby="pwd-queue-title"
          >
            <title id="pwd-queue-title">{`An illustration of DOL's PERM wage-request line as a roller conveyor. Each tray is one filing month, stacked with that month's requests still in process. DOL's reviewer works from the front, at a desk whose sign names the month on the front tray. The lime tray is ${monthYear(run.pick)}.`}</title>
            {/* The markup is the kit's own paths, built from numbers in ../dol-queue/geometry: no outside text reaches it. */}
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
            <g ref={sign} dangerouslySetInnerHTML={{ __html: art.sign(pwdFrontMonth(run, 0)) }} />
            <g ref={stamp} dangerouslySetInnerHTML={{ __html: art.stamp }} />
          </svg>
        </div>
        <div className="flex items-center gap-3 border-t-2 border-border px-4 py-2 sm:px-6">
          <p ref={readout} className="min-h-12 flex-1 py-1 text-base tabular-nums sm:min-h-0">
            {pwdReading(run, 0)}
          </p>
          <MotionToggle paused={paused} onToggle={toggle} what="time-lapse" />
        </div>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        {`An illustration of DOL's PERM wage-request line as DOL left it on ${longDate(run.counted)}, by our count of its record, run forward. Each tray is one filing month. Its stack is that month's requests still in process, drawn to scale. The ${run.earlier.toLocaleString("en-US")} older requests still waiting sit on the desk and go first. ${run.dolAsOf ? `DOL's own published month was ${monthYear(run.dolMonth)} on ${longDate(run.dolAsOf)}. ` : ""}The reviewer works at DOL's average over the last ${run.paceDays} working days we measured: about ${pace.toLocaleString("en-US")} requests a working day, oldest first. Weekends and federal holidays don't count, because DOL doesn't work them. There are ${ahead.toLocaleString("en-US")} requests ahead of one filed on the first day of ${monthYear(run.pick)}, so the line reaches it around ${longDate(run.reachDate)}. ${monthYear(run.pick)} itself holds ${inPick.toLocaleString("en-US")}, and a request filed on its last day is decided around ${longDate(run.endDate)}. Those are the dates the wage-request lookup gives, if DOL keeps that pace. New requests joining the back aren't drawn. Drag along the line, or scroll, to move through the days.`}
      </figcaption>
    </figure>
  );
}
