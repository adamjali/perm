"use client";

import { useEffect, useRef } from "react";

/**
 * The board's one moment on load (owner, Oct 15 2026: "count up on load").
 *
 * A number row counts up from zero like an odometer, its cells fixed (leading
 * zeros, the commas where they'll land), so nothing shifts; any other row (a
 * month) flips through letters and settles left to right. The server renders
 * every cell at its real value, so a page without script, a crawler and a
 * screenshot all read the figures; the board's `data-count="pending"` only
 * blanks the glyphs while this is about to run, and CSS shows them anyway
 * after 2.5 s or under reduced motion (globals.css, the board's section).
 *
 * Renders nothing: it finds its board and writes the cells' `data-c`
 * directly, so the count never re-renders the server component around it.
 */
const COUNT_MS = 1300;
const SETTLE_MS = 700;
const STAGGER_MS = 70;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function FlapBoardMotion() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const board = ref.current?.closest<HTMLElement>(".flap-board");
    if (!board) return;
    const done = () => {
      board.dataset.count = "done";
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return done();

    const rows = [...board.querySelectorAll<HTMLElement>(".flap-row")].map((row) => {
      const cells = [...row.querySelectorAll<HTMLElement>(".flap-cell[data-c]")];
      const target = cells.map((c) => c.dataset.c ?? "");
      const numeric = target.length > 0 && target.every((ch) => /[\d,]/.test(ch)) && target.some((ch) => /\d/.test(ch));
      return { cells, target, numeric, n: numeric ? Number(target.join("").replace(/,/g, "")) : 0 };
    });

    const paint = (now: number, start: number) => {
      const t = now - start;
      let running = false;
      for (const row of rows) {
        if (row.numeric) {
          const p = Math.min(1, t / COUNT_MS);
          if (p < 1) running = true;
          const digits = String(Math.round(row.n * easeOut(p))).padStart(row.target.filter((ch) => ch !== ",").length, "0");
          let k = 0;
          row.cells.forEach((cell, i) => {
            cell.dataset.c = row.target[i] === "," ? "," : (digits[k++] ?? "0");
          });
        } else {
          row.cells.forEach((cell, i) => {
            const settleAt = SETTLE_MS + i * STAGGER_MS;
            const want = row.target[i] ?? "";
            if (t >= settleAt) {
              cell.dataset.c = want;
            } else {
              running = true;
              const pool = /\d/.test(want) ? DIGITS : want === want.toLowerCase() ? LETTERS.toLowerCase() : LETTERS;
              cell.dataset.c = pool[Math.floor(Math.random() * pool.length)] ?? want;
            }
          });
        }
      }
      return running;
    };

    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) {
        start = now;
        board.dataset.count = "running";
      }
      if (paint(now, start)) frame = requestAnimationFrame(tick);
      else done();
    };
    // Once, when the board is on screen (it is at the top of the homepage).
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        frame = requestAnimationFrame(tick);
      }
    });
    io.observe(board);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      // Leaving mid-count: the real values, never a half-counted one.
      rows.forEach((row) => row.cells.forEach((cell, i) => (cell.dataset.c = row.target[i] ?? "")));
      done();
    };
  }, []);

  return <span ref={ref} hidden />;
}
