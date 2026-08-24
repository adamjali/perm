"use client";

import { useEffect, useRef } from "react";

/**
 * The site's ambient field: a small murmuration drifting behind every public
 * page, its centre following an invisible path as you scroll.
 *
 * This replaces a hero-local particle drift with one page-wide system. The
 * flock is boids-lite — cohesion toward a scroll-driven attractor, mild
 * separation, velocity damping — because a full neighbourhood search is
 * wasted on seventy dots at field opacity. The path is a Catmull-Rom spline
 * across four control points; nothing draws the line itself, the flock's
 * centre simply lives on it, so scrolling steers the field without a visible
 * mechanism.
 *
 * Perf discipline (house 3D doctrine): Canvas 2D, DPR capped at 2, ~30fps,
 * paused under document.hidden, one static frame under
 * prefers-reduced-motion, aria-hidden, every tick in try/catch with a frame
 * counter, and LOW opacity — it is ground, never figure.
 */

const COUNT = 70;
const FPS_INTERVAL = 1000 / 30;

// Normalized control points the attractor glides through as the page scrolls.
const PATH: [number, number][] = [
  [0.78, 0.22],
  [0.24, 0.42],
  [0.7, 0.66],
  [0.3, 0.86],
];

function spline(t: number): [number, number] {
  // Catmull-Rom over PATH, clamped ends.
  const pts = [PATH[0]!, ...PATH, PATH[PATH.length - 1]!];
  const seg = Math.min(PATH.length - 1, Math.max(0, Math.floor(t * (PATH.length - 1))));
  const u = t * (PATH.length - 1) - seg;
  const [p0, p1, p2, p3] = [pts[seg]!, pts[seg + 1]!, pts[seg + 2]!, pts[seg + 3]!];
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u +
      (3 * b - a - 3 * c + d) * u * u * u);
  return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
}

interface Boid { x: number; y: number; vx: number; vy: number; r: number; lime: boolean }

export function AmbientMurmuration() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.max(1, Math.min(devicePixelRatio || 1, 2));
    let w = 0, h = 0, raf = 0, last = 0, frames = 0;

    const boids: Boid[] = Array.from({ length: COUNT }, (_, i) => ({
      x: (i * 0.618) % 1,
      y: (i * 0.377) % 1,
      vx: 0, vy: 0,
      r: 1.4 + ((i * 13) % 10) * 0.13,
      lime: i % 4 === 0,
    }));

    const colors = () => {
      const cs = getComputedStyle(cv);
      return {
        lime: cs.getPropertyValue("--primary").trim() || "#2ECC40",
        grey: cs.getPropertyValue("--muted-foreground").trim() || "#6B7280",
      };
    };

    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * DPR));
      cv.height = Math.max(1, Math.round(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    const scrollT = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    };

    const draw = () => {
      const { lime, grey } = colors();
      ctx.clearRect(0, 0, w, h);
      for (const b of boids) {
        ctx.globalAlpha = b.lime ? 0.34 : 0.22;
        ctx.fillStyle = b.lime ? lime : grey;
        ctx.beginPath();
        ctx.arc(b.x * w, b.y * h, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (document.hidden) return;
      if (t - last < FPS_INTERVAL) return;
      last = t;
      try {
        const [ax, ay] = spline(scrollT());
        // Flock centre, cheap.
        let cx = 0, cy = 0;
        for (const b of boids) { cx += b.x; cy += b.y; }
        cx /= COUNT; cy /= COUNT;
        for (const b of boids) {
          // Cohesion to the attractor + the flock, wander, damping.
          b.vx += (ax - b.x) * 0.0016 + (cx - b.x) * 0.0006 +
            Math.sin(t * 0.00037 + b.r * 17) * 0.00028;
          b.vy += (ay - b.y) * 0.0016 + (cy - b.y) * 0.0006 +
            Math.cos(t * 0.00041 + b.r * 23) * 0.00028;
          // Separation-lite from the centre so the flock never collapses.
          const dx = b.x - cx, dy = b.y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 < 0.004) { b.vx += dx * 0.004; b.vy += dy * 0.004; }
          b.vx *= 0.96; b.vy *= 0.96;
          b.x += b.vx; b.y += b.vy;
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
      draw();
      return () => ro.disconnect();
    }
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
