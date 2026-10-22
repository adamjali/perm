"use client";

/**
 * A PERM RFI as a model railway, run forward as a time-lapse. The case leaves the main line
 * (analyst review) for a siding at the RFI, waits out the response window, rejoins the line and
 * runs on to the decision gate on the date the case page gives an RFI issued today. It pauses
 * at the RFI, where it rejoins and at the gate, then starts over. Page scrolling and dragging
 * along the track move it through the days; a second after either stops, it runs on from there.
 *
 * Self-running and scroll-linked motion is the owner's call for these drawings (Oct 21 2026).
 * It carries a Pause button (WCAG 2.2.2); under reduced motion it holds still and the caption
 * says the dates in words.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/components/iso/iso.css";
import { longDate } from "@convex/lib/months";
import { HEIGHT, WIDTH, buildRfiTrack } from "./geometry";
import { LEAD_DAYS, rfiReading, type RfiRun } from "./model";
import { MotionToggle } from "../MotionToggle";
import { CAPTION_CLASS, FIGURE_CLASS, READOUT_CLASS, SUMMARY_CLASS } from "../frame";

/** Real seconds for the whole run, and the holds at the RFI, at the rejoin and at the gate. */
const RUN_S = 9;
const HOLD_RFI_S = 1;
const HOLD_LEAVE_S = 1.2;
const HOLD_END_S = 2.6;
const FADE_S = 0.4;
const RESUME_MS = 1000;
const DAYS_PER_SCROLL_PX = 0.1;

const int = (n: number) => n.toLocaleString("en-US");

export default function RfiPathFigure({ run }: { run: RfiRun }) {
  const art = useMemo(() => buildRfiTrack(run), [run]);
  const start = -LEAD_DAYS;

  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const cart = useRef<SVGGElement>(null);
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
    const car = cart.current;
    const out = readout.current;
    if (!el || !box || !car || !out) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const end = run.decideDay;
    const speed = (end - start) / RUN_S; // sim days per real second
    const stops = [0, run.leaveDay, end];
    const holds = [HOLD_RFI_S, HOLD_LEAVE_S, HOLD_END_S];

    let t = start;
    let next = 0; // the next stop to hold at
    let holdUntil = 0;
    let fading = 0; // 0: none; > 0: seconds into the fade out and back in
    let held = false;
    let resumeAt = 0;
    let dragging = false;
    let dragFrom = { x: 0, y: 0, t: 0 };
    let visible = false;
    let frame = 0;
    let last = 0;
    let shownT = Number.NaN;
    let shownText = "";
    const nextStop = (from: number) => {
      const i = stops.findIndex((s) => s > from + 1e-6);
      return i < 0 ? stops.length : i;
    };

    const draw = () => {
      if (Math.abs(t - shownT) > 0.01) {
        shownT = t;
        car.setAttribute("transform", art.cartAt(t));
      }
      const text = rfiReading(run, t);
      if (text !== shownText) {
        shownText = text;
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
          if (fading >= FADE_S && t !== start) {
            t = start;
            next = 0;
          }
          const o = fading < FADE_S ? 1 - fading / FADE_S : Math.min(1, (fading - FADE_S) / FADE_S);
          car.style.opacity = o.toFixed(2);
          if (fading >= 2 * FADE_S) fading = 0;
        } else if (now >= holdUntil) {
          if (next >= stops.length) {
            fading = 1e-6;
          } else {
            const step = t + speed * dt;
            const stop = stops[next]!;
            if (step >= stop) {
              t = stop;
              holdUntil = now + holds[next]! * 1000;
              next++;
            } else {
              t = step;
            }
          }
        }
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
      // a pause in the middle of the fade lands on the start, never on a half-faded cart
      if (fading > 0) {
        t = start;
        next = 0;
      }
      fading = 0;
      car.style.opacity = "";
      holdUntil = 0;
      run$();
    };
    const hold = () => {
      held = true;
      fading = 0;
      car.style.opacity = "";
      resumeAt = performance.now() + RESUME_MS;
      holdUntil = 0;
      next = nextStop(t);
      run$();
    };

    // Dragging along the track moves through the days: toward the gate is later.
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
      const days = ((e.clientX - dragFrom.x) * unit * ax + (e.clientY - dragFrom.y) * unit * ay) / (ax * ax + ay * ay);
      t = Math.min(end, Math.max(start, dragFrom.t + days));
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
      const step = Math.min(end, Math.max(start, t + moved * DAYS_PER_SCROLL_PX));
      if (step === t) return;
      t = step;
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
  }, [run, art, start]);

  const after = run.afterThreeQuarters !== null
    ? `half were decided within ${run.afterHalf} days of going back to review, and 3 in 4 within ${run.afterThreeQuarters}`
    : `half were decided within ${run.afterHalf} days of going back to review`;
  return (
    <figure className={FIGURE_CLASS}>
      <div ref={stage}>
        <div className="iso">
          <svg
            ref={svg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="iso-svg cursor-grab touch-pan-y select-none [[data-dragging]_&]:cursor-grabbing"
            role="img"
            aria-labelledby="rfi-path-title"
          >
            <title id="rfi-path-title">
              {
                "An illustration of a PERM RFI as a model railway. The main line is analyst review, in filing order. At the RFI a switch sends the lime case file onto a siding, where it waits out the response window marked by the bar behind it. A second switch brings it back to the main line, and it runs on to a gate where the case is decided. A strip in front of the line marks the range of dates the case page gives."
              }
            </title>
            {/* The markup is the kit's own paths, built from numbers in ./geometry: no outside text reaches it. */}
            <g dangerouslySetInnerHTML={{ __html: art.back }} />
            <g ref={cart} transform={art.cartAt(start)} dangerouslySetInnerHTML={{ __html: art.cart }} />
            <g dangerouslySetInnerHTML={{ __html: art.front }} />
          </svg>
        </div>
        <div className={READOUT_CLASS}>
          <p ref={readout} className="min-h-12 flex-1 py-1 text-base tabular-nums sm:min-h-0">
            {rfiReading(run, start)}
          </p>
          <MotionToggle paused={paused} onToggle={toggle} what="time-lapse" />
        </div>
      </div>
      <figcaption className={CAPTION_CLASS}>
        <details>
          <summary className={SUMMARY_CLASS}>What this shows</summary>{" "}
          <p className="mt-1 leading-relaxed">
        {`An illustration of an RFI issued on ${longDate(run.rfiDay)}. The siding is the RFI: the case leaves filing order while the employer answers. DOL gives the employer ${run.dueDays} days, to ${longDate(run.dueDate)}. Our sweep has watched ${int(run.watched)} RFIs from their first day since ${longDate(run.watchedFrom)}. ${run.leaveDay === run.dueDays + 1 ? `Half had left RFI status by day ${run.leaveDay}: DOL moves the case when its ${run.dueDays} days run out, and our sweep sees it the morning after.` : `Half had left RFI status by day ${run.leaveDay}.`} Then ${after}${run.afterWatched ? `, over ${int(run.afterWatched)} decided cases` : ""}. So the case page dates an RFI like this one around ${longDate(run.decideDate)}, between ${longDate(run.earliestDate)} and ${longDate(run.latestDate)}. ${run.slowEndFrom === "measured" ? `The late end is the day by which 9 in 10 were decided after leaving RFI.` : `The late end allows ${run.slowEndDays} days after the case leaves RFI. That's an immigration attorney's estimate, used until the record can measure it.`} ${run.afterReply ? `Of the ${int(run.afterReply.decided)} RFIs decided after a reply so far, ${int(run.afterReply.certified)} were certified. ` : ""}A letter can set a different date, and an extension or a second request takes a case out of these numbers. Drag along the track, or scroll, to move through the days.`}
      </p>
        </details>
      </figcaption>
    </figure>
  );
}
