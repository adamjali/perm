"use client";

/**
 * A prevailing wage determination's validity, for the guide on filing after it expires. The
 * carriage (the first recruitment step) sweeps from before the determination to after its
 * expiry and pauses at each end. Inside the lime validity band the gate at the expiry stays
 * down and the arm runs 180 days past it; before the band the gate rises and the arm stops
 * against it; past the band there's no arm, because the determination can't be used. Scrolling
 * the page pushes the carriage, dragging moves it, and the sweep picks up a second after either.
 * The readout's dates come from the central rules (pwdBearing, calculateFilingWindow).
 *
 * Self-running and scroll-linked motion is the owner's call for these drawings (Oct 21 2026). A
 * Pause button stops the sweep, and under reduced motion it holds still. The caption states the
 * three outcomes in words for anyone who can't drag.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import "@/components/iso/iso.css";
import { longDate } from "@convex/lib/months";
import { BACK, CAR_DAYS, CARRIAGE, DAY_ON_SCREEN, GATE_DAYS, GATE_H, HEIGHT, WIDTH, armAt, carriageAt, gateAt } from "./geometry";
import { DETERMINED, EXPIRES, FIRST_MAX, FIRST_MIN, VALID_DAYS, readPwdValidity } from "./model";
import { MotionToggle } from "../MotionToggle";
import { CAPTION_CLASS, FIGURE_CLASS, READOUT_CLASS, SUMMARY_CLASS } from "../frame";

const LABEL =
  "An illustration of a prevailing wage determination's validity as a bench. A lime band on the ruler runs from the determination date to its expiry. A carriage marks the first recruitment step, and an arm runs from it to the last day to file. A gate at the expiry rises when the expiry still limits the filing.";

/** Seconds for one sweep from end to end, and the pause at each end. */
const SWEEP_S = 6;
const PAUSE_S = 1.4;
const RESUME_MS = 1000;
/** Days the carriage moves per pixel the page scrolls. */
const DAYS_PER_SCROLL_PX = 0.2;
/** Where the sweep starts on the server: inside the validity, the case the guide is about. */
const START_DAY = 47;

const MID = (FIRST_MIN + FIRST_MAX) / 2;
const AMP = (FIRST_MAX - FIRST_MIN) / 2;
const clampDay = (d: number) => Math.min(FIRST_MAX, Math.max(FIRST_MIN, d));

function phaseAt(day: number, dir: 1 | -1): number {
  const base = Math.acos(Math.min(1, Math.max(-1, (MID - day) / AMP)));
  return dir > 0 ? base : 2 * Math.PI - base;
}

/**
 * How far the gate should stand for a first step on `day`: up while the expiry limits the
 * filing, up once the whole carriage has passed it after the expiry (so the two never overlap),
 * down inside the validity.
 */
function gateTarget(day: number): number {
  if (day < 0) return GATE_H;
  if (day > VALID_DAYS + GATE_DAYS + CAR_DAYS) return GATE_H;
  return 0;
}

export default function PwdValidityFigure() {
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const layer = useRef<SVGGElement>(null);
  const moving = useRef<SVGGElement>(null);
  const car = useRef<SVGGElement>(null);
  const arm = useRef<SVGGElement>(null);
  const gate = useRef<SVGGElement>(null);
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
    const group = layer.current;
    const mover = moving.current;
    const carriage = car.current;
    const armEl = arm.current;
    const gateEl = gate.current;
    const out = readout.current;
    if (!el || !box || !group || !mover || !carriage || !armEl || !gateEl || !out) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");

    let day = START_DAY;
    let dir: 1 | -1 = 1;
    let phase = phaseAt(day, dir);
    let gateH = gateTarget(day);
    let pausedUntil = 0;
    let held = false;
    let resumeAt = 0;
    let visible = false;
    let frame = 0;
    let last = 0;
    let shownDay = Math.round(day);
    let drawnDay = day;
    let drawnGate = gateH;
    let dragging = false;
    let dragFrom = { x: 0, y: 0, day: 0 };

    const draw = () => {
      const rounded = Math.round(day);
      if (Math.abs(day - drawnDay) >= 0.02) {
        drawnDay = day;
        carriage.setAttribute("transform", carriageAt(day));
      }
      if (rounded !== shownDay) {
        shownDay = rounded;
        const r = readPwdValidity(rounded);
        armEl.innerHTML = armAt(rounded, r.closeDay);
        out.textContent = r.sentence;
      }
      if (Math.abs(gateH - drawnGate) >= 0.05) {
        drawnGate = gateH;
        gateEl.innerHTML = gateAt(gateH);
      }
      // Painter's order: the gate stands in front of a carriage still short of it, behind one past it.
      const gateFirst = day > VALID_DAYS || gateH < 0.4;
      const first = group.firstElementChild;
      if (gateFirst && first !== gateEl) group.insertBefore(gateEl, mover);
      else if (!gateFirst && first !== mover) group.insertBefore(mover, gateEl);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
      last = now;
      if (held && !dragging && now >= resumeAt) {
        held = false;
        if (day >= FIRST_MAX - 0.01) dir = -1;
        else if (day <= FIRST_MIN + 0.01) dir = 1;
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
      const target = gateTarget(day);
      gateH = still.matches ? target : gateH + (target - gateH) * Math.min(1, dt * 9);
      if (Math.abs(target - gateH) < 0.05) gateH = target;
      draw();
      const settling = Math.abs(target - gateH) >= 0.05;
      if (visible && (held || settling || (!still.matches && !stopped.current))) frame = requestAnimationFrame(tick);
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

  const start = readPwdValidity(START_DAY);
  const inside = readPwdValidity(47);
  const before = readPwdValidity(-20);
  return (
    <figure className={FIGURE_CLASS}>
      <div ref={stage}>
        <div className="iso">
          <svg
            ref={svg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="iso-svg cursor-grab touch-pan-y select-none [[data-dragging]_&]:cursor-grabbing"
            role="img"
            aria-labelledby="pwd-validity-title"
          >
            <title id="pwd-validity-title">{LABEL}</title>
            {/* The markup is the kit's own paths, built from numbers in ./geometry: no outside text reaches it. */}
            <g dangerouslySetInnerHTML={{ __html: BACK }} />
            <g ref={layer}>
              <g ref={gate} dangerouslySetInnerHTML={{ __html: gateAt(gateTarget(START_DAY)) }} />
              <g ref={moving}>
                <g ref={arm} dangerouslySetInnerHTML={{ __html: armAt(START_DAY, start.closeDay) }} />
                <g ref={car} transform={carriageAt(START_DAY)} dangerouslySetInnerHTML={{ __html: CARRIAGE }} />
              </g>
            </g>
          </svg>
        </div>
        <div className={READOUT_CLASS}>
          <p ref={readout} className="min-h-12 flex-1 py-1 text-base tabular-nums sm:min-h-0">
            {start.sentence}
          </p>
          <MotionToggle paused={paused} onToggle={toggle} what="sweep" />
        </div>
      </div>
      <figcaption className={CAPTION_CLASS}>
        <details>
          <summary className={SUMMARY_CLASS}>What this shows</summary>{" "}
          <p className="mt-1 leading-relaxed">
        {`An illustration, on an example determination issued ${longDate(DETERMINED)} and valid through ${longDate(EXPIRES)}. Drag the carriage, or scroll, to move the first recruitment step. A first step on or between those dates begins recruitment inside the validity, so only the 180-day rule closes the window: a first step on ${longDate(inside.first)} means filing by ${longDate(inside.closes)}, after the determination has expired. A first step before ${longDate(DETERMINED)}, such as ${longDate(before.first)}, means filing by ${longDate(before.closes)}. A first step after ${longDate(EXPIRES)} can't use this determination. Here the job order is the first step; a notice of filing doesn't begin recruitment for this test. The dates come from the same rule the app uses on every case.`}
      </p>
        </details>
      </figcaption>
    </figure>
  );
}
