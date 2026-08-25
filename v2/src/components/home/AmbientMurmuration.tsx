"use client";

import { useEffect, useRef } from "react";

/**
 * The site's ambient field, v2: a real murmuration behind every public page.
 *
 * v1 was seventy dots easing toward a point — too few, too limp, and a fast
 * scroll teleported the attractor so the whole flock snapped. This one is a
 * proper boids system (alignment + separation + cohesion over a spatial
 * grid), 220 birds, steered by two live inputs:
 *
 * - SCROLL: the attractor rides a Catmull-Rom spline down the page, and the
 *   value it reads is SMOOTHED (critically-damped lerp), so a flung scrollbar
 *   bends the flock instead of detonating it.
 * - POINTER: the cursor carries a soft repulsion field, so the flock parts
 *   around the mouse and reforms behind it.
 *
 * Discipline unchanged: Canvas 2D, DPR capped at 2, ~30fps, paused when
 * hidden, one static frame under prefers-reduced-motion, aria-hidden,
 * pointer-events none (the pointer is read from window listeners, never the
 * canvas), try/catch per tick with a frame counter, velocity clamped both
 * ways so the system cannot explode, and LOW alpha — ground, never figure.
 */

const COUNT = 220;
const FPS_INTERVAL = 1000 / 30;
const NEIGHBOR_R = 0.055; // in normalized page units
const MAX_SPEED = 0.0042;
const MIN_SPEED = 0.0008;

const PATH: [number, number][] = [
  [0.78, 0.2],
  [0.22, 0.4],
  [0.72, 0.62],
  [0.28, 0.84],
];

function spline(t: number): [number, number] {
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

    // Deterministic scatter, golden-ratio spaced.
    const boids: Boid[] = Array.from({ length: COUNT }, (_, i) => ({
      x: (i * 0.618034) % 1,
      y: (i * 0.381966 + 0.11) % 1,
      vx: (((i * 7) % 13) / 13 - 0.5) * 0.002,
      vy: (((i * 11) % 17) / 17 - 0.5) * 0.002,
      r: 1.1 + ((i * 13) % 10) * 0.16,
      lime: i % 3 === 0,
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

    // Smoothed scroll: the raw value can jump a whole page in one frame; the
    // flock follows this damped copy, so it always BENDS toward the new spot.
    let scrollSmooth = 0;
    const scrollT = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    };

    // Pointer field, in normalized units. Parked far offscreen until it moves.
    let px = -9, py = -9;
    const onMove = (e: PointerEvent) => {
      px = e.clientX / Math.max(1, w);
      py = e.clientY / Math.max(1, h);
    };
    const onLeave = () => { px = -9; py = -9; };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });

    // Spatial grid for the neighborhood search: 220 boids stay cheap.
    const CELL = NEIGHBOR_R;
    const grid = new Map<number, number[]>();
    const cellKey = (x: number, y: number) =>
      (Math.floor(x / CELL) + 512) * 4096 + (Math.floor(y / CELL) + 512);

    const draw = () => {
      const { lime, grey } = colors();
      ctx.clearRect(0, 0, w, h);
      for (const b of boids) {
        ctx.globalAlpha = b.lime ? 0.4 : 0.24;
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
        scrollSmooth += (scrollT() - scrollSmooth) * 0.06;
        const [ax, ay] = spline(scrollSmooth);

        grid.clear();
        for (let i = 0; i < COUNT; i++) {
          const b = boids[i]!;
          const k = cellKey(b.x, b.y);
          const cell = grid.get(k);
          if (cell) cell.push(i);
          else grid.set(k, [i]);
        }

        for (let i = 0; i < COUNT; i++) {
          const b = boids[i]!;
          // Neighborhood over the 3x3 cells around the boid.
          let nx = 0, ny = 0, nvx = 0, nvy = 0, n = 0, sx = 0, sy = 0;
          const cx = Math.floor(b.x / CELL), cy = Math.floor(b.y / CELL);
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            for (let gy = cy - 1; gy <= cy + 1; gy++) {
              const cell = grid.get((gx + 512) * 4096 + (gy + 512));
              if (!cell) continue;
              for (const j of cell) {
                if (j === i) continue;
                const o = boids[j]!;
                const dx = o.x - b.x, dy = o.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > NEIGHBOR_R * NEIGHBOR_R) continue;
                nx += o.x; ny += o.y; nvx += o.vx; nvy += o.vy; n++;
                if (d2 < 0.00028) { sx -= dx; sy -= dy; }
              }
            }
          }
          if (n > 0) {
            // Cohesion toward local centre, alignment with local heading.
            b.vx += (nx / n - b.x) * 0.0035 + (nvx / n - b.vx) * 0.12 + sx * 0.05;
            b.vy += (ny / n - b.y) * 0.0035 + (nvy / n - b.vy) * 0.12 + sy * 0.05;
          }
          // The scroll-steered attractor, gentle but constant.
          b.vx += (ax - b.x) * 0.0011;
          b.vy += (ay - b.y) * 0.0011;
          // Pointer repulsion: part around the cursor, reform behind it.
          {
            const dx = b.x - px, dy = b.y - py;
            const d2 = dx * dx + dy * dy;
            if (d2 < 0.02 && d2 > 1e-6) {
              const f = 0.00035 / (d2 + 0.002);
              b.vx += dx * f;
              b.vy += dy * f;
            }
          }
          // Wander keeps it alive when everything else settles.
          b.vx += Math.sin(t * 0.00047 + b.r * 31) * 0.00016;
          b.vy += Math.cos(t * 0.00043 + b.r * 37) * 0.00016;

          // Both-ways speed clamp: no detonation, no dead air.
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > MAX_SPEED) { b.vx = (b.vx / sp) * MAX_SPEED; b.vy = (b.vy / sp) * MAX_SPEED; }
          else if (sp < MIN_SPEED && sp > 0) { b.vx = (b.vx / sp) * MIN_SPEED; b.vy = (b.vy / sp) * MIN_SPEED; }

          b.x += b.vx; b.y += b.vy;
          // Soft wrap keeps the field full at every scroll position.
          if (b.x < -0.05) b.x += 1.1; else if (b.x > 1.05) b.x -= 1.1;
          if (b.y < -0.05) b.y += 1.1; else if (b.y > 1.05) b.y -= 1.1;
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
      return () => {
        ro.disconnect();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerout", onLeave);
      };
    }
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
    };
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
