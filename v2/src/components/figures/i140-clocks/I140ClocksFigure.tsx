"use client";

/**
 * Two of the three 180-day clocks, for the guide on them: the I-140 approval's and the I-485
 * receipt's. A gantry marks the day the reader leaves and sweeps from the approval to past both
 * clocks, pausing at each end; each lane fills up to it, and a lane's lock turns lime when its
 * 180 days have run. Scrolling the page pushes the gantry, dragging moves it, and the sweep
 * picks up a second after either. The readout comes from the central rule
 * (calculatePriorityDateRetention).
 *
 * Self-running and scroll-linked motion is the owner's call for these drawings (Oct 21 2026). A
 * Pause button stops the sweep, and under reduced motion it holds still. The caption gives both
 * dates in words for anyone who can't drag.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import "@/components/iso/iso.css";
import { longDate } from "@convex/lib/months";
import { BACK, DAY_ON_SCREEN, GANTRY, HEIGHT, LANES, LOCK_DAY, WIDTH, fillAt, gantryAt, lockAt } from "./geometry";
import { APPROVED, I485_FILED, LEAVE_MAX, LEAVE_MIN, PORTABLE_FROM, SAFE_FROM, readClocks } from "./model";
import { MotionToggle } from "../MotionToggle";

const LABEL =
  "An illustration of two 180-day clocks as lanes on a bench. The back lane starts at the I-140 approval, the front lane at the I-485 receipt, and each ends at a lock. A gantry across both lanes marks the day you leave; each lane fills up to it, and a lock turns lime once its 180 days have run.";

const SWEEP_S = 6;
const PAUSE_S = 1.4;
const RESUME_MS = 1000;
const DAYS_PER_SCROLL_PX = 0.25;
/** The guide's own example: leave on October 1 and neither clock has run yet. */
const START_DAY = 164;

const MID = (LEAVE_MIN + LEAVE_MAX) / 2;
const AMP = (LEAVE_MAX - LEAVE_MIN) / 2;
const clampDay = (d: number) => Math.min(LEAVE_MAX, Math.max(LEAVE_MIN, d));

function phaseAt(day: number, dir: 1 | -1): number {
  const base = Math.acos(Math.min(1, Math.max(-1, (MID - day) / AMP)));
  return dir > 0 ? base : 2 * Math.PI - base;
}

export default function I140ClocksFigure() {
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const fills = useRef<(SVGGElement | null)[]>([]);
  const order = useRef<SVGGElement>(null);
  const locks = useRef<(SVGGElement | null)[]>([]);
  const gantry = useRef<SVGGElement>(null);
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
    const layer = order.current;
    const g = gantry.current;
    const out = readout.current;
    if (!el || !box || !layer || !g || !out) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");

    let day = START_DAY;
    let dir: 1 | -1 = 1;
    let phase = phaseAt(day, dir);
    let pausedUntil = 0;
    let held = false;
    let resumeAt = 0;
    let visible = false;
    let frame = 0;
    let last = 0;
    let shownDay = Math.round(day);
    let drawnDay = day;
    let dragging = false;
    let dragFrom = { x: 0, y: 0, day: 0 };
    const done = LANES.map((_, i) => readClocks(START_DAY)[i === 0 ? "i140Holds" : "portable"]);
    let orderKey = "";

    const draw = () => {
      if (Math.abs(day - drawnDay) >= 0.02) {
        drawnDay = day;
        g.setAttribute("transform", gantryAt(day));
        LANES.forEach((_, i) => {
          const f = fills.current[i];
          if (f) f.innerHTML = fillAt(i, day);
        });
      }
      const rounded = Math.round(day);
      if (rounded !== shownDay) {
        shownDay = rounded;
        const r = readClocks(rounded);
        out.textContent = r.sentence;
        [r.i140Holds, r.portable].forEach((now, i) => {
          if (now === done[i]) return;
          done[i] = now;
          const lock = locks.current[i];
          if (lock) lock.innerHTML = lockAt(i, now);
        });
      }
      // Painter's order: whatever sits farther along the bench is nearer the viewer, so it goes last.
      const items = [...LANES.map((_, i) => ({ el: locks.current[i], x: LOCK_DAY[i]! + 4 })), { el: g, x: day }].sort((a, b) => a.x - b.x);
      const key = items.map((it) => (it.el === g ? "g" : "l")).join("");
      if (key !== orderKey) {
        orderKey = key;
        for (const it of items) if (it.el) layer.appendChild(it.el);
      }
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
      last = now;
      if (held && !dragging && now >= resumeAt) {
        held = false;
        if (day >= LEAVE_MAX - 0.01) dir = -1;
        else if (day <= LEAVE_MIN + 0.01) dir = 1;
        phase = phaseAt(day, dir);
        pausedUntil = 0;
      }
      if (!held && !still.matches && !stopped.current && now >= pausedUntil) {
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
      if (visible && (held || (!still.matches && !stopped.current))) frame = requestAnimationFrame(tick);
    };

    const run = () => {
      if (!frame && visible) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    wake.current = () => {
      pausedUntil = 0;
      phase = phaseAt(day, dir);
      run();
    };
    const hold = () => {
      held = true;
      resumeAt = performance.now() + RESUME_MS;
      run();
    };

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
      const unit = WIDTH / box.getBoundingClientRect().width;
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

    let lastScroll = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const moved = y - lastScroll;
      lastScroll = y;
      if (!visible || dragging || still.matches || moved === 0) return;
      const next = clampDay(day + moved * DAYS_PER_SCROLL_PX);
      if (next === day) return;
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
  }, []);

  const start = readClocks(START_DAY);
  const startDone = [start.i140Holds, start.portable];
  return (
    <figure className="not-prose my-8 max-w-[800px]">
      <div ref={stage} className="border-2 border-border bg-background">
        <div className="iso px-1 pt-4 sm:px-6">
          <svg
            ref={svg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="iso-svg cursor-grab touch-pan-y select-none [[data-dragging]_&]:cursor-grabbing"
            role="img"
            aria-labelledby="i140-clocks-title"
          >
            <title id="i140-clocks-title">{LABEL}</title>
            {/* The markup is the kit's own paths, built from numbers in ./geometry: no outside text reaches it. */}
            <g dangerouslySetInnerHTML={{ __html: BACK }} />
            {LANES.map((l, i) => (
              <g
                key={l.name}
                ref={(e) => {
                  fills.current[i] = e;
                }}
                dangerouslySetInnerHTML={{ __html: fillAt(i, START_DAY) }}
              />
            ))}
            <g ref={order}>
              {LANES.map((l, i) => (
                <g
                  key={l.name}
                  ref={(e) => {
                    locks.current[i] = e;
                  }}
                  dangerouslySetInnerHTML={{ __html: lockAt(i, startDone[i]!) }}
                />
              ))}
              <g ref={gantry} transform={gantryAt(START_DAY)} dangerouslySetInnerHTML={{ __html: GANTRY }} />
            </g>
          </svg>
        </div>
        <div className="flex items-center gap-3 border-t-2 border-border px-4 py-2 sm:px-6">
          <p ref={readout} className="min-h-12 flex-1 py-1 text-base tabular-nums sm:min-h-0">
            {start.sentence}
          </p>
          <MotionToggle paused={paused} onToggle={toggle} what="sweep" />
        </div>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        {`An illustration on the worked example above: an I-140 approved ${longDate(APPROVED)} and an I-485 received ${longDate(I485_FILED)}. From ${longDate(SAFE_FROM)}, an employer's withdrawal no longer revokes the I-140. From ${longDate(PORTABLE_FROM)}, the I-485 can move to a new job in the same or a similar occupation, on Supplement J. The first clock, the certification's, stopped mattering once the I-140 was filed. The priority date stays either way, unless USCIS revokes the approval for cause. Drag the gantry, or scroll, to move the day you leave. The dates come from the same rule as the retention calculator.`}
      </figcaption>
    </figure>
  );
}
