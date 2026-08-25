"use client";

import { useEffect, useRef } from "react";

/**
 * The ambient field: three murmurations drifting behind the public pages.
 *
 * v1 was one thin flock easing toward a point; v2 gave it real boids but
 * still one flock, and a flung scrollbar snapped it because the attractor
 * teleported. This is v3 and the changes are all about how it behaves under
 * a fast scroll, which is the only time anyone actually looks at it.
 *
 * THREE FLOCKS, not one. A single flock at page scale reads as a smudge in
 * one corner; three of different sizes and depths give the field somewhere
 * to go and make the parallax legible.
 *
 * WHY IT NO LONGER GLITCHES ON SCROLL — four separate causes, all fixed:
 *   1. The attractor now follows a critically-damped spring against the
 *      scroll target instead of jumping to it, so a 4000px flick bends the
 *      flock rather than teleporting it.
 *   2. Scroll is read once per frame from a passive listener into a plain
 *      number, never inside the physics loop, so a scroll storm cannot
 *      force layout mid-tick.
 *   3. dt is CLAMPED. A dropped frame used to arrive as a huge delta and
 *      integrate the whole flock off-screen in one step; that is exactly
 *      what a fast scroll produces.
 *   4. Speed is clamped both ways every tick, so nothing can accumulate.
 *
 * Discipline unchanged: Canvas 2D, DPR capped at 2, paused when hidden,
 * one static frame under prefers-reduced-motion, aria-hidden, pointer-events
 * none, try/catch per tick with a frame counter.
 */

interface Flock {
  count: number;
  /** 0 = far (small, slow, faint), 1 = near. Drives size, speed and alpha. */
  depth: number;
  /** Where on the page this flock lives, as a scroll fraction it centres on. */
  path: [number, number][];
  limeEvery: number;
}

const FLOCKS: Flock[] = [
  // The lead flock: largest, nearest, tracks the spine of the page.
  {
    count: 130,
    depth: 1,
    path: [
      [0.76, 0.18],
      [0.26, 0.4],
      [0.72, 0.64],
      [0.3, 0.86],
    ],
    limeEvery: 3,
  },
  // A mid flock running the opposite diagonal, so the two cross.
  {
    count: 90,
    depth: 0.62,
    path: [
      [0.2, 0.3],
      [0.68, 0.46],
      [0.24, 0.7],
      [0.7, 0.9],
    ],
    limeEvery: 5,
  },
  // A far, sparse flock that barely moves. Depth cue only.
  {
    count: 60,
    depth: 0.3,
    path: [
      [0.5, 0.22],
      [0.44, 0.55],
      [0.56, 0.82],
    ],
    limeEvery: 7,
  },
];

const FPS_INTERVAL = 1000 / 30;
const NEIGHBOR_R = 0.05;
const MAX_SPEED = 0.0042;
const MIN_SPEED = 0.0008;
/** A dropped frame must not integrate as one huge step. */
const MAX_DT = 2.2;

function spline(path: [number, number][], t: number): [number, number] {
  const pts = [path[0]!, ...path, path[path.length - 1]!];
  const segs = path.length - 1;
  const seg = Math.min(segs - 1, Math.max(0, Math.floor(t * segs)));
  const u = t * segs - seg;
  const [p0, p1, p2, p3] = [pts[seg]!, pts[seg + 1]!, pts[seg + 2]!, pts[seg + 3]!];
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
  return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
}

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  lime: boolean;
  f: number;
}

export function AmbientMurmuration() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.max(1, Math.min(devicePixelRatio || 1, 2));
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let frames = 0;

    // A phone gets fewer birds; the field is decoration and must never be
    // the reason a scroll drops frames.
    const narrow = innerWidth < 720;
    const scale = narrow ? 0.45 : 1;

    const boids: Boid[] = [];
    FLOCKS.forEach((flock, fi) => {
      const n = Math.round(flock.count * scale);
      for (let i = 0; i < n; i++) {
        const k = boids.length;
        boids.push({
          x: (k * 0.618034 + fi * 0.31) % 1,
          y: (k * 0.381966 + fi * 0.17) % 1,
          vx: (((k * 7) % 13) / 13 - 0.5) * 0.002,
          vy: (((k * 11) % 17) / 17 - 0.5) * 0.002,
          r: (0.9 + ((k * 13) % 10) * 0.14) * (0.5 + flock.depth * 0.7),
          lime: i % flock.limeEvery === 0,
          f: fi,
        });
      }
    });

    const colors = () => {
      const cs = getComputedStyle(cv);
      return {
        lime: cs.getPropertyValue("--primary").trim() || "#2ECC40",
        grey: cs.getPropertyValue("--muted-foreground").trim() || "#6B7280",
      };
    };

    const resize = () => {
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * DPR));
      cv.height = Math.max(1, Math.round(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    // Scroll is sampled by a passive listener into a plain number. Reading
    // scrollHeight inside the physics loop is what makes a scroll storm
    // force layout every frame.
    let scrollTarget = 0;
    const sampleScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollTarget = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    };
    sampleScroll();
    addEventListener("scroll", sampleScroll, { passive: true });
    addEventListener("resize", sampleScroll, { passive: true });

    // Critically-damped spring per flock. The far flock lags hardest, which
    // is what reads as depth.
    const springs = FLOCKS.map(() => ({ v: 0, x: scrollTarget }));

    let px = -9;
    let py = -9;
    const onMove = (e: PointerEvent) => {
      px = e.clientX / Math.max(1, w);
      py = e.clientY / Math.max(1, h);
    };
    const onLeave = () => {
      px = -9;
      py = -9;
    };
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerout", onLeave, { passive: true });

    const CELL = NEIGHBOR_R;
    const grid = new Map<number, number[]>();
    const key = (x: number, y: number, f: number) =>
      ((Math.floor(x / CELL) + 512) * 4096 + (Math.floor(y / CELL) + 512)) * 8 + f;

    const draw = () => {
      const { lime, grey } = colors();
      ctx.clearRect(0, 0, w, h);
      for (const b of boids) {
        const depth = FLOCKS[b.f]!.depth;
        ctx.globalAlpha = (b.lime ? 0.42 : 0.24) * (0.4 + depth * 0.6);
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
      const elapsed = t - last;
      if (elapsed < FPS_INTERVAL) return;
      // Clamped: a dropped frame is a slower frame, never a bigger jump.
      const dt = Math.min(MAX_DT, elapsed / FPS_INTERVAL);
      last = t;
      try {
        const attractors = FLOCKS.map((flock, i) => {
          const sp = springs[i]!;
          // Critically damped: no overshoot, no oscillation, no snap.
          const stiffness = 0.055 + flock.depth * 0.05;
          const damping = 2 * Math.sqrt(stiffness);
          sp.v += (stiffness * (scrollTarget - sp.x) - damping * sp.v) * dt;
          sp.x += sp.v * dt;
          return spline(flock.path, Math.min(1, Math.max(0, sp.x)));
        });

        grid.clear();
        for (let i = 0; i < boids.length; i++) {
          const b = boids[i]!;
          const k = key(b.x, b.y, b.f);
          const cell = grid.get(k);
          if (cell) cell.push(i);
          else grid.set(k, [i]);
        }

        for (let i = 0; i < boids.length; i++) {
          const b = boids[i]!;
          const flock = FLOCKS[b.f]!;
          const [ax, ay] = attractors[b.f]!;
          let nx = 0;
          let ny = 0;
          let nvx = 0;
          let nvy = 0;
          let n = 0;
          let sx = 0;
          let sy = 0;
          const cx = Math.floor(b.x / CELL);
          const cy = Math.floor(b.y / CELL);
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            for (let gy = cy - 1; gy <= cy + 1; gy++) {
              const cell = grid.get(((gx + 512) * 4096 + (gy + 512)) * 8 + b.f);
              if (!cell) continue;
              for (const j of cell) {
                if (j === i) continue;
                const o = boids[j]!;
                const dx = o.x - b.x;
                const dy = o.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > NEIGHBOR_R * NEIGHBOR_R) continue;
                nx += o.x;
                ny += o.y;
                nvx += o.vx;
                nvy += o.vy;
                n++;
                if (d2 < 0.00026) {
                  sx -= dx;
                  sy -= dy;
                }
              }
            }
          }
          if (n > 0) {
            b.vx += ((nx / n - b.x) * 0.0035 + (nvx / n - b.vx) * 0.12 + sx * 0.05) * dt;
            b.vy += ((ny / n - b.y) * 0.0035 + (nvy / n - b.vy) * 0.12 + sy * 0.05) * dt;
          }
          const pull = 0.0009 + flock.depth * 0.0006;
          b.vx += (ax - b.x) * pull * dt;
          b.vy += (ay - b.y) * pull * dt;
          {
            const dx = b.x - px;
            const dy = b.y - py;
            const d2 = dx * dx + dy * dy;
            if (d2 < 0.022 && d2 > 1e-6) {
              const f = (0.0004 / (d2 + 0.002)) * flock.depth;
              b.vx += dx * f * dt;
              b.vy += dy * f * dt;
            }
          }
          b.vx += Math.sin(t * 0.00047 + b.r * 31) * 0.00016 * dt;
          b.vy += Math.cos(t * 0.00043 + b.r * 37) * 0.00016 * dt;

          const top = MAX_SPEED * (0.4 + flock.depth * 0.6);
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > top) {
            b.vx = (b.vx / sp) * top;
            b.vy = (b.vy / sp) * top;
          } else if (sp < MIN_SPEED && sp > 0) {
            b.vx = (b.vx / sp) * MIN_SPEED;
            b.vy = (b.vy / sp) * MIN_SPEED;
          }

          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < -0.05) b.x += 1.1;
          else if (b.x > 1.05) b.x -= 1.1;
          if (b.y < -0.05) b.y += 1.1;
          else if (b.y > 1.05) b.y -= 1.1;
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

    const teardown = () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("scroll", sampleScroll);
      removeEventListener("resize", sampleScroll);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerout", onLeave);
    };

    if (reduced) {
      draw();
      return teardown;
    }
    raf = requestAnimationFrame(step);
    return teardown;
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
