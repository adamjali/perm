"use client";

import { useEffect, useRef } from "react";

/**
 * The ambient field: six murmurations drifting behind the public pages.
 *
 * v1 was one thin flock easing toward a point; v2 gave it real boids but
 * still one flock, and a flung scrollbar snapped it because the attractor
 * teleported. v3 fixed the scroll behaviour. This is v4 and it is a size
 * change: more birds, bigger birds, more flocks, on the same physics.
 *
 * SIX FLOCKS, not one and not three. A single flock at page scale reads as a
 * smudge in one corner. Three left both edges of a wide screen empty, so the
 * field read as a diagonal smear rather than a sky; the two added flocks hug
 * the left and right margins and the sixth sits furthest back, which is what
 * gives the near ones something to be measured against. 560 boids on desktop
 * against 280, and radii run 0.8px to 3.8px against 1.0px to 2.6px.
 *
 * WHY MORE AND BIGGER DID NOT COST ANYTHING. Doubling the population would
 * have doubled the per-frame draw calls, and the draw loop was the expensive
 * half: one beginPath/arc/fill per bird. Alpha and colour vary only by flock
 * and by whether a bird is lime, so there are twelve distinct paint states,
 * not 560. The loop now batches every bird sharing a state into ONE path and
 * ONE fill, which is twelve fills a frame at any population. The neighbour
 * search was already a spatial hash keyed per flock, so it is linear and each
 * flock only ever sees its own birds.
 *
 * ALPHA CAME DOWN AS SIZE WENT UP. Bigger dots at the old alpha stop being
 * ambient and start being a pattern behind the text. Lime went 0.42 to 0.34
 * and grey 0.24 to 0.19, and the depth ramp widened, so the field has more
 * presence and no more weight.
 *
 * WHY THE THEME IS READ ON A MUTATION, NOT EVERY FRAME. `draw` used to call
 * `getComputedStyle` on every frame, which is a forced style resolution 30
 * times a second for two values that change when someone toggles the theme.
 * It is read once and re-read when the root element's class or data-theme
 * attribute changes.
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
 * aria-hidden, pointer-events none, try/catch per tick with a frame counter.
 * Under prefers-reduced-motion it does not run and does not paint at all.
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
    count: 150,
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
    count: 120,
    depth: 0.72,
    path: [
      [0.2, 0.3],
      [0.68, 0.46],
      [0.24, 0.7],
      [0.7, 0.9],
    ],
    limeEvery: 5,
  },
  // A second mid flock hugging the left margin, out of phase with both.
  {
    count: 100,
    depth: 0.54,
    path: [
      [0.12, 0.14],
      [0.34, 0.38],
      [0.1, 0.62],
      [0.36, 0.92],
    ],
    limeEvery: 6,
  },
  // Its mirror on the right, so neither edge of a wide screen is empty.
  {
    count: 90,
    depth: 0.42,
    path: [
      [0.88, 0.28],
      [0.64, 0.52],
      [0.9, 0.76],
      [0.66, 0.96],
    ],
    limeEvery: 6,
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
  // The furthest: nearly still, nearly transparent, and the only thing that
  // gives the near flocks something to be measured against.
  {
    count: 60,
    depth: 0.16,
    path: [
      [0.42, 0.1],
      [0.6, 0.44],
      [0.38, 0.72],
      [0.58, 0.98],
    ],
    limeEvery: 9,
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
  const [p0, p1, p2, p3] = [
    pts[seg]!,
    pts[seg + 1]!,
    pts[seg + 2]!,
    pts[seg + 3]!,
  ];
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b +
      (c - a) * u +
      (2 * a - 5 * b + 4 * c - d) * u * u +
      (3 * b - a - 3 * c + d) * u * u * u);
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
    // the reason a scroll drops frames. The desktop population doubled in v4
    // and these two steps deliberately did not: a phone draws ~180 birds,
    // barely above v3's 126, and a tablet ~390.
    const scale = innerWidth < 720 ? 0.32 : innerWidth < 1100 ? 0.7 : 1;

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
          r: (1.35 + ((k * 13) % 10) * 0.2) * (0.45 + flock.depth * 0.72),
          lime: i % flock.limeEvery === 0,
          f: fi,
        });
      }
    });

    let lime = "#2ECC40";
    let grey = "#6B7280";
    const readColors = () => {
      const cs = getComputedStyle(cv);
      lime = cs.getPropertyValue("--primary").trim() || lime;
      grey = cs.getPropertyValue("--muted-foreground").trim() || grey;
    };
    readColors();
    // next-themes swaps a class on <html>; a plain `class` observer catches
    // the toggle without paying getComputedStyle on every one of 30 frames.
    const themeWatch = new MutationObserver(readColors);
    themeWatch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

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
      ((Math.floor(x / CELL) + 512) * 4096 + (Math.floor(y / CELL) + 512)) * 8 +
      f;

    // Twelve paint states (six flocks x lime or grey), so twelve fills a
    // frame however many birds there are. One beginPath per bird was the
    // reason the population could not go up.
    const BUCKETS = FLOCKS.length * 2;
    const bucket: Boid[][] = Array.from({ length: BUCKETS }, () => []);
    for (const b of boids) bucket[b.f * 2 + (b.lime ? 1 : 0)]!.push(b);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let k = 0; k < BUCKETS; k++) {
        const group = bucket[k]!;
        if (group.length === 0) continue;
        const isLime = k % 2 === 1;
        const depth = FLOCKS[(k - (k % 2)) / 2]!.depth;
        ctx.globalAlpha = (isLime ? 0.34 : 0.19) * (0.35 + depth * 0.65);
        ctx.fillStyle = isLime ? lime : grey;
        ctx.beginPath();
        for (const b of group) {
          const cx = b.x * w;
          const cy = b.y * h;
          // moveTo before each arc, or the arcs are joined by a line.
          ctx.moveTo(cx + b.r, cy);
          ctx.arc(cx, cy, b.r, 0, Math.PI * 2);
        }
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
            b.vx +=
              ((nx / n - b.x) * 0.0035 + (nvx / n - b.vx) * 0.12 + sx * 0.05) *
              dt;
            b.vy +=
              ((ny / n - b.y) * 0.0035 + (nvy / n - b.vy) * 0.12 + sy * 0.05) *
              dt;
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
      themeWatch.disconnect();
      removeEventListener("scroll", sampleScroll);
      removeEventListener("resize", sampleScroll);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerout", onLeave);
    };

    // Off entirely, not one static frame. A bigger, denser field is a
    // stronger visual event, and the honest reading of the preference is that
    // it does not get painted rather than that it gets painted once.
    if (reduced) return teardown;
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
