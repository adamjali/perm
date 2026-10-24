"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeftIcon, CaretRightIcon, PauseIcon, PlayIcon, QuotesIcon, StarIcon } from "@phosphor-icons/react";

import { DRIFT_FROM, IN_ROWS_MAX, dealRows, rowsFor } from "@/lib/reviews/rows";
import { cn } from "@/lib/utils";

/**
 * The reviews as rows of cards that drift slowly sideways (owner, Oct 23 2026: "visual driven ... carousel auto
 * soft slow scroll, can stop or scroll", then "multi layered ... grows, but capped"). The site's no-looping-motion
 * default is bent here by the owner's call, inside WCAG 2.2.2's terms: one Pause stops every row, a row stops while
 * it's pointed at, touched, scrolled or holds focus, everything stops when the tab is hidden, and nothing moves for
 * anyone who asks for reduced motion.
 *
 * - Few reviews (under DRIFT_FROM) never drift: they sit side by side, centred when they fit, swiped when they
 *   don't, so two cards never loop past each other.
 * - More reviews add rows (rowsFor: a second from 12, a third from 24, never more), dealt newest first in turn so
 *   every row opens with a recent one. Each row has its own pace and the middle one runs the other way, so they
 *   read as layers. The rows hold the newest IN_ROWS_MAX; the page lists the rest.
 * - The drift is JS, not a CSS animation: it moves a row's own scroll position, so a reader can take over by
 *   swiping or scrolling at any moment. The loop is a second, hidden copy of a row's cards (aria-hidden, inert);
 *   every review is in the HTML once for crawlers and screen readers.
 * - Each row is a named group with a tab stop, so a keyboard reaches it and the arrow keys scroll it. Back and Next
 *   move every row a card for a mouse, so a drifting row needs no scrollbar; its edges fade so a card running off
 *   them reads as more to come, not as cut off.
 */

export interface CarouselReview {
  id: string;
  rating: number;
  text: string;
  name: string;
  /** "October 23, 2026", or null when the date couldn't be read. */
  day: string | null;
}

/** The gap between cards, in pixels (gap-5). */
const GAP = 20;
/** Each row's pace in pixels a second and its direction: slow enough to read a card as it passes. */
const ROW_MOTION: { dir: 1 | -1; speed: number }[] = [
  { dir: 1, speed: 22 },
  { dir: -1, speed: 17 },
  { dir: 1, speed: 27 },
];
/** How long a row waits after the reader touched or scrolled it before drifting again. */
const RESUME_AFTER_MS = 5000;

type Stepper = (forward: 1 | -1) => void;

function Card({ r, compact, hidden = false }: { r: CarouselReview; compact: boolean; hidden?: boolean }) {
  return (
    <figure
      aria-hidden={hidden || undefined}
      className={cn(
        "flex shrink-0 snap-start flex-col border-2 border-border bg-card shadow-hard-sm",
        compact ? "w-[min(20rem,78vw)] p-5" : "w-[min(22rem,82vw)] p-6",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <StarIcon key={n} weight={n <= r.rating ? "fill" : "regular"} className={cn("size-5", n <= r.rating ? "text-primary" : "text-foreground")} />
          ))}
        </span>{" "}
        <span className="text-sm text-muted-foreground">{`${r.rating} of 5`}</span>
      </div>{" "}
      {r.text ? (
        <blockquote className={cn("relative mt-4 flex-1 leading-relaxed [overflow-wrap:anywhere]", compact ? "text-base" : "text-lg")}>
          <QuotesIcon weight="fill" className="mb-1 size-6 text-primary" aria-hidden="true" />
          <span className={cn("whitespace-pre-line", compact ? "line-clamp-[6]" : "line-clamp-[8]")}>{r.text}</span>
        </blockquote>
      ) : (
        <p className={cn("mt-4 flex-1 text-muted-foreground", compact ? "text-base" : "text-lg")}>Rated without words.</p>
      )}{" "}
      <figcaption className="mt-5 border-t-2 border-border pt-3">
        <span className="font-heading text-base font-bold">{r.name}</span>{" "}
        {r.day ? <span className="block text-sm text-muted-foreground">{r.day}</span> : null}
      </figcaption>
    </figure>
  );
}

function DriftRow({
  reviews,
  label,
  dir,
  speed,
  drifts,
  compact,
  still,
  paused,
  index,
  register,
}: {
  reviews: CarouselReview[];
  label: string;
  dir: 1 | -1;
  speed: number;
  drifts: boolean;
  compact: boolean;
  still: boolean;
  paused: boolean;
  index: number;
  register: (index: number, step: Stepper | null) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const holdUntil = useRef(0);
  const hovering = useRef(false);
  const focused = useRef(false);
  const ourScroll = useRef(false);

  const hold = useCallback(() => {
    holdUntil.current = Date.now() + RESUME_AFTER_MS;
  }, []);

  // A row that drifts rightward starts one copy in, so it has room to move.
  useEffect(() => {
    const el = row.current;
    if (!el || !drifts || dir !== -1 || el.scrollLeft > 0) return;
    ourScroll.current = true;
    el.scrollLeft = el.scrollWidth / 2;
  }, [drifts, dir]);

  useEffect(() => {
    if (!drifts || still || paused) return;
    const el = row.current;
    if (!el) return;
    let last = performance.now();
    let frame = 0;
    let carry = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      const busy = hovering.current || focused.current || document.hidden || Date.now() < holdUntil.current;
      if (!busy) {
        carry += (speed * dt) / 1000;
        const step = Math.floor(carry);
        if (step >= 1) {
          carry -= step;
          const half = el.scrollWidth / 2;
          let next = el.scrollLeft + dir * step;
          if (next >= half) next -= half;
          if (next <= 0) next += half;
          ourScroll.current = true;
          el.scrollLeft = next;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [drifts, still, paused, dir, speed]);

  // A card at a time, either way round the loop: past either end, jump by one copy first, out of sight.
  useEffect(() => {
    register(index, (forward) => {
      const el = row.current;
      const card = el?.firstElementChild as HTMLElement | null;
      if (!el || !card) return;
      hold();
      const by = (card.offsetWidth + GAP) * forward * dir;
      const half = el.scrollWidth / 2;
      if (by > 0 && el.scrollLeft + by >= half) el.scrollLeft -= half;
      if (by < 0 && el.scrollLeft + by < 0) el.scrollLeft += half;
      el.scrollBy({ left: by, behavior: still ? "auto" : "smooth" });
    });
    return () => register(index, null);
  }, [register, index, hold, dir, still]);

  return (
    <div className={drifts ? "[mask-image:linear-gradient(to_right,transparent,#000_5%,#000_95%,transparent)]" : undefined}>
      <div
        ref={row}
        role="group"
        aria-label={label}
        tabIndex={0}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") hovering.current = true;
        }}
        onPointerLeave={() => {
          hovering.current = false;
        }}
        onPointerDown={hold}
        onWheel={hold}
        onTouchStart={hold}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
        }}
        onScroll={() => {
          // A scroll the drift didn't make is the reader's: let them read.
          if (ourScroll.current) ourScroll.current = false;
          else hold();
        }}
        className={cn(
          "flex gap-5 overflow-x-auto pb-4 pt-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
          drifts ? "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "snap-x snap-mandatory [scrollbar-width:thin] sm:justify-center",
        )}
      >
        {reviews.map((r) => (
          <Card key={r.id} r={r} compact={compact} />
        ))}
        {drifts
          ? reviews.map((r) => (
              <div key={`again-${r.id}`} inert className="contents">
                <Card r={r} compact={compact} hidden />
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

export function ReviewCarousel({ reviews }: { reviews: CarouselReview[] }) {
  const shown = reviews.slice(0, IN_ROWS_MAX);
  const rows = rowsFor(shown.length);
  const drifts = shown.length >= DRIFT_FROM;
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(true);
  const steppers = useRef<(Stepper | null)[]>([]);

  // Reduced motion, read after mount (the server draws the rows still), and followed if it changes.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const set = () => setStill(Boolean(mq?.matches));
    set();
    mq?.addEventListener?.("change", set);
    return () => mq?.removeEventListener?.("change", set);
  }, []);

  // Stable, so a row's stepper effect doesn't re-run on every render.
  const register = useCallback((i: number, s: Stepper | null) => {
    steppers.current[i] = s;
  }, []);
  const step = (forward: 1 | -1) => steppers.current.forEach((s) => s?.(forward));
  const moving = drifts && !still && !paused;
  const control =
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 px-3 text-sm font-bold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground";

  return (
    <div role="region" aria-label="Reviews of PERM Tracker">
      <div className="flex flex-col gap-4">
        {dealRows(shown, rows).map((rowReviews, i) => (
          <DriftRow
            key={i}
            reviews={rowReviews}
            label={rows > 1 ? `Reviews, row ${i + 1} of ${rows}` : "Reviews, newest first"}
            dir={ROW_MOTION[i]!.dir}
            speed={ROW_MOTION[i]!.speed}
            drifts={drifts}
            compact={rows > 1}
            still={still}
            paused={paused}
            index={i}
            register={register}
          />
        ))}
      </div>{" "}
      {drifts ? (
        <div className="mt-2 flex items-center justify-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Back one review" className={control}>
            <CaretLeftIcon className="size-5" aria-hidden="true" />
          </button>{" "}
          {!still ? (
            <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} className={control}>
              {moving ? <PauseIcon className="size-4" aria-hidden="true" /> : <PlayIcon className="size-4" aria-hidden="true" />}
              {moving ? "Pause" : "Play"}
            </button>
          ) : null}{" "}
          <button type="button" onClick={() => step(1)} aria-label="Next review" className={control}>
            <CaretRightIcon className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
