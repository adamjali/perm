"use client";

/**
 * A visa bulletin cutoff as a gate on a rail of priority dates, stepped through one line's real
 * bulletins. The gate slides to each month's cutoff; Current lifts it away, Unavailable rolls the
 * door shut, and a month the archive doesn't hold draws neither. It holds longer on the bulletins
 * that changed something (a step back, the line shutting or reopening, the example date passing
 * the gate), waits at the end, and starts over. Page scrolling and dragging along the rail move
 * through the bulletins; a second after either stops, it runs on from there.
 *
 * Self-running and scroll-linked motion is the owner's call for these drawings (Oct 21 2026), with
 * a Pause button for anyone who wants it still (WCAG 2.2.2). Under reduced motion it holds the
 * first bulletin still, dragging still works, and the caption says what happened in words.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "@/components/iso/iso.css";
import { lineSlug } from "@/lib/bulletinLines";
import { HEIGHT, WIDTH, buildRail } from "./geometry";
import { captionOf, frameAt, keySteps, readingAt, type BulletinRun } from "./model";
import { MotionToggle } from "../MotionToggle";

/** Real seconds to move from one bulletin to the next, to hold on one, and to hold on one that changed something. */
const MOVE_S = 0.45;
const HOLD_S = 0.5;
const HOLD_KEY_S = 1.8;
const HOLD_END_S = 2.6;
const FADE_S = 0.4;
const RESUME_MS = 1000;
/** Bulletins moved per pixel the page scrolls. */
const STEPS_PER_SCROLL_PX = 0.025;

export default function BulletinCutoffFigure({ run }: { run: BulletinRun }) {
  const art = useMemo(() => buildRail(run), [run]);
  const keys = useMemo(() => keySteps(run), [run]);
  const n = run.steps.length;
  const first = frameAt(run, 0);

  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const shutter = useRef<SVGGElement>(null);
  const strip = useRef<SVGGElement>(null);
  const gateBack = useRef<SVGGElement>(null);
  const gateFront = useRef<SVGGElement>(null);
  const moving = useRef<SVGGElement>(null);
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
    const door = shutter.current;
    const open = strip.current;
    const behind = gateBack.current;
    const ahead = gateFront.current;
    const all = moving.current;
    const out = readout.current;
    if (!el || !box || !door || !open || !behind || !ahead || !all || !out) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");

    let t = 0;
    let holdUntil = 0;
    let fading = 0; // 0: none; > 0: seconds into the fade out and back in
    let held = false;
    let resumeAt = 0;
    let dragging = false;
    let dragFrom = { x: 0, y: 0, t: 0 };
    let visible = false;
    let frame = 0;
    let last = 0;
    const shown = { gate: -1, lift: -1, opacity: "", side: "", strip: -1, stripOpacity: "", shut: -1, text: "" };

    const draw = () => {
      const f = frameAt(run, t);
      const lift = 1 - f.gateShown;
      if (Math.abs(f.gate - shown.gate) > 0.0005 || Math.abs(lift - shown.lift) > 0.002) {
        shown.gate = f.gate;
        shown.lift = lift;
        const move = art.gateAt(f.gate, lift);
        behind.setAttribute("transform", move);
        ahead.setAttribute("transform", move);
      }
      const opacity = f.gateShown >= 1 ? "" : f.gateShown.toFixed(2);
      // The gate is drawn behind the example block while it stands on the older side of it.
      const side = f.gate < art.tokenAt ? "behind" : "ahead";
      if (opacity !== shown.opacity || side !== shown.side) {
        shown.opacity = opacity;
        shown.side = side;
        // one copy of the gate is drawn at a time; the other waits on the far side of the block
        behind.style.display = side === "behind" ? "" : "none";
        ahead.style.display = side === "ahead" ? "" : "none";
        behind.style.opacity = opacity;
        ahead.style.opacity = opacity;
      }
      if (Math.abs(f.strip - shown.strip) > 0.002) {
        shown.strip = f.strip;
        open.innerHTML = art.strip(f.strip);
      }
      const stripOpacity = f.stripShown >= 1 ? "" : f.stripShown.toFixed(2);
      if (stripOpacity !== shown.stripOpacity) {
        shown.stripOpacity = stripOpacity;
        open.style.opacity = stripOpacity;
      }
      if (Math.abs(f.shut - shown.shut) > 0.004) {
        shown.shut = f.shut;
        door.innerHTML = art.shutter(f.shut);
      }
      const text = readingAt(run, t);
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
          if (fading >= FADE_S && t !== 0) t = 0;
          const o = fading < FADE_S ? 1 - fading / FADE_S : Math.min(1, (fading - FADE_S) / FADE_S);
          all.style.opacity = o.toFixed(2);
          if (fading >= 2 * FADE_S) {
            fading = 0;
            all.style.opacity = "";
            holdUntil = now + HOLD_S * 1000;
          }
        } else if (now >= holdUntil) {
          if (t >= n - 1) {
            fading = 1e-6;
          } else {
            const target = Math.floor(t + 1e-6) + 1;
            const next = t + dt / MOVE_S;
            if (next >= target) {
              t = target;
              holdUntil = now + (target >= n - 1 ? HOLD_END_S : keys.has(target) ? HOLD_KEY_S : HOLD_S) * 1000;
            } else {
              t = next;
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
      // a pause in the middle of the fade lands on the start, never on a half-faded line
      if (fading > 0) t = 0;
      fading = 0;
      all.style.opacity = "";
      holdUntil = 0;
      run$();
    };
    const hold = () => {
      held = true;
      fading = 0;
      all.style.opacity = "";
      resumeAt = performance.now() + RESUME_MS;
      holdUntil = 0;
      run$();
    };

    // Dragging along the rail moves through the bulletins: toward the newer dates is later.
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
      const share = ((e.clientX - dragFrom.x) * unit * ax + (e.clientY - dragFrom.y) * unit * ay) / (ax * ax + ay * ay);
      t = Math.min(n - 1, Math.max(0, dragFrom.t + share * (n - 1)));
      hold();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      delete el.dataset.dragging;
      // settle on the bulletin nearest the release, so the readout and the drawing agree
      t = Math.round(t);
      hold();
    };

    // Scrolling the page moves through the bulletins the way the page moves, until the run's end.
    let lastScroll = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const moved = y - lastScroll;
      lastScroll = y;
      if (!visible || dragging || still.matches || moved === 0) return;
      const next = Math.min(n - 1, Math.max(0, t + moved * STEPS_PER_SCROLL_PX));
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
  }, [run, art, keys, n]);

  const firstMove = art.gateAt(first.gate, 1 - first.gateShown);
  const firstSide = first.gate < art.tokenAt ? "behind" : "ahead";
  const gateStyle = (side: "behind" | "ahead") =>
    side !== firstSide ? { display: "none" } : first.gateShown >= 1 ? undefined : { opacity: first.gateShown };
  return (
    <figure className="not-prose my-8 max-w-[800px]">
      <div ref={stage} className="border-2 border-border bg-background">
        <div className="iso px-1 pt-4 sm:px-6">
          <svg
            ref={svg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="iso-svg cursor-grab touch-pan-y select-none [[data-dragging]_&]:cursor-grabbing"
            role="img"
            aria-labelledby="bulletin-cutoff-title"
          >
            <title id="bulletin-cutoff-title">{`An illustration of a visa bulletin cutoff as a gate on a rail of priority dates. A door at the rail's oldest end is where visa numbers go out. The gate stands at the month's ${run.label} cutoff, and the dates between the door and the gate are current. The lime block is an example priority date.`}</title>
            {/* The markup is the kit's own paths, built from numbers in ./geometry: no outside text reaches it. */}
            <g dangerouslySetInnerHTML={{ __html: art.back }} />
            <g ref={shutter} dangerouslySetInnerHTML={{ __html: art.shutter(first.shut) }} />
            <g dangerouslySetInnerHTML={{ __html: art.door }} />
            <g ref={moving}>
              <g ref={strip} style={first.stripShown >= 1 ? undefined : { opacity: first.stripShown }} dangerouslySetInnerHTML={{ __html: art.strip(first.strip) }} />
              <g
                ref={gateBack}
                transform={firstMove}
                style={gateStyle("behind")}
                dangerouslySetInnerHTML={{ __html: art.gate }}
              />
              <g dangerouslySetInnerHTML={{ __html: art.token }} />
              <g
                ref={gateFront}
                transform={firstMove}
                style={gateStyle("ahead")}
                dangerouslySetInnerHTML={{ __html: art.gate }}
              />
            </g>
          </svg>
        </div>
        <div className="flex items-center gap-3 border-t-2 border-border px-4 py-2 sm:px-6">
          <p ref={readout} className="min-h-12 flex-1 py-1 text-base tabular-nums sm:min-h-0">
            {readingAt(run, 0)}
          </p>
          <MotionToggle paused={paused} onToggle={toggle} what="bulletins" />
        </div>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        {captionOf(run)}{" "}
        <Link href={`/visa-bulletin/categories/${lineSlug(run.category, run.country)}`} className="link">
          {`Every ${run.label} bulletin, month by month`}
        </Link>
        .
      </figcaption>
    </figure>
  );
}
