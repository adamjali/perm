"use client";

import { useEffect, useRef } from "react";

/**
 * The queue as a living field.
 *
 * A quiet particle drift behind the hero: each dot is a case moving through
 * the line, grey while it waits, primary once it crosses the frontier. It is
 * the product's one ambient moment, and it is the product's own metaphor
 * rather than decoration — the same mental model the tape and the timeline
 * calculator draw, set in motion.
 *
 * Perf discipline, per the house 3D doctrine:
 * - Canvas 2D, zero dependencies.
 * - DPR capped at 2, loop throttled to ~30fps.
 * - IntersectionObserver-gated: no work while off-screen.
 * - document.hidden pauses the loop (the automation-tab lesson: rAF never
 *   fires there anyway, so state must not depend on it).
 * - prefers-reduced-motion renders ONE static frame and never starts.
 * - Every tick wrapped: a throw stops the loop and marks the element, so a
 *   broken frame can never spin silently.
 * - aria-hidden: it is decoration; the copy beside it carries the meaning.
 */

interface Dot {
  x: number; // 0..1 across the band
  y: number; // 0..1 down the band
  vx: number;
  vy: number;
  r: number;
}

const FRONTIER = 0.62; // where "cleared" begins, echoing the tape's geometry
const COUNT = 90;
const FPS_INTERVAL = 1000 / 30;

export function QueueFlowCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.max(1, Math.min(devicePixelRatio || 1, 2));
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let onScreen = true;
    let frames = 0;

    const dots: Dot[] = Array.from({ length: COUNT }, (_, i) => ({
      // Deterministic-ish scatter; index-seeded so SSR/CSR need not agree.
      x: (i * 0.618) % 1,
      y: ((i * 0.377) % 1) * 0.9 + 0.05,
      vx: 0.00045 + ((i * 7) % 10) * 0.00004,
      vy: 0,
      r: 1.6 + ((i * 13) % 10) * 0.14,
    }));

    const styles = () => {
      const cs = getComputedStyle(cv);
      return {
        cleared: cs.getPropertyValue("--primary").trim() || "#2ECC40",
        waiting: cs.getPropertyValue("--muted-foreground").trim() || "#6B7280",
      };
    };

    const resize = () => {
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * DPR));
      cv.height = Math.max(1, Math.round(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    const draw = () => {
      const { cleared, waiting } = styles();
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        const isCleared = d.x < FRONTIER;
        ctx.globalAlpha = isCleared ? 0.5 : 0.32;
        ctx.fillStyle = isCleared ? cleared : waiting;
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (!onScreen || document.hidden) return;
      if (t - last < FPS_INTERVAL) return;
      last = t;
      try {
        for (const d of dots) {
          // Drift right; a light flock-wander keeps it organic, never a pulse.
          d.vy += (Math.sin(t * 0.0004 + d.x * 9) * 0.00002) - d.vy * 0.02;
          d.x += d.vx;
          d.y += d.vy;
          if (d.x > 1.02) {
            d.x = -0.02;
            d.y = Math.random() * 0.9 + 0.05;
          }
          if (d.y < 0.02 || d.y > 0.98) d.vy *= -1;
        }
        frames += 1;
        cv.dataset.frames = String(frames);
        draw();
      } catch (err) {
        cancelAnimationFrame(raf);
        cv.dataset.glError = String(err);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    if (reduced) {
      // One honest still: the field, frozen.
      draw();
      return () => ro.disconnect();
    }

    const io = new IntersectionObserver(([e]) => {
      onScreen = e?.isIntersecting ?? true;
    });
    io.observe(cv);
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
