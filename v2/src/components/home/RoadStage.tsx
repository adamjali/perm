"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, type CSSProperties, type FocusEvent } from "react";

import { goToStep, useScrollStage, type StagePlace } from "@/components/scroll/useScrollStage";

/**
 * The road as a scroll stage (PREVIEW, Oct 21 2026). One DOM for every mode:
 *
 * - Below 1024px, and at any width when the reader asks for reduced motion: the road as it was, a list with a
 *   small document beside each stop on a phone, six across from 1024px.
 * - From 1024px with motion allowed: the section is tall and its frame pins under the header. The six stops run
 *   down an ink rail on the left, whose fill follows the reader's place; the stop being read turns its number
 *   lime. On the right, that stop's document, large in its frame; scrolling into the next stop wipes the next
 *   document up over it. The reader's scroll drives all of it, and stopping stops it.
 *
 * Each stop's picture is the stop's own <img>, moved into the right column by CSS, so every mode carries the same
 * six links, words and pictures. Hidden documents are clipped, which also takes them out of hit-testing, so a
 * click on the large document always lands on the stop being read.
 */

export interface RoadStop {
  n: number;
  name: string;
  who: string;
  /** The stage's colour class for the dot beside the agency. */
  dot: string;
  img: { src: string; alt: string; w: number; h: number };
  /** Shown whole when pinned, for a picture whose shape a 5:4 crop would cut (the card). */
  contain?: boolean;
  /** The document's name and where it comes from, shown under the large frame. */
  doc: string;
  fact: string;
  href: string;
  cta: string;
}

/** How much of a step the next document takes to wipe up over the last. */
const WIPE = 0.35;

export function RoadStage({ stops }: { stops: RoadStop[] }) {
  const ref = useRef<HTMLElement>(null);
  const count = stops.length;

  const onPlace = useCallback(
    (place: StagePlace, el: HTMLElement) => {
      const scaled = place.progress * count;
      el.querySelectorAll<HTMLElement>("[data-reveal]").forEach((pic) => {
        const i = Number(pic.dataset.reveal);
        const r = i === 0 ? 1 : Math.min(1, Math.max(0, (scaled - i + WIPE) / WIPE));
        pic.style.setProperty("--reveal", r.toFixed(4));
      });
      el.querySelector<HTMLElement>("[data-road-fill]")?.style.setProperty("--road-fill", place.progress.toFixed(4));
    },
    [count],
  );
  useScrollStage(ref, count, onPlace);

  // A keyboard reader tabbing down the stops moves the stage with them, so the large document is the one they're on.
  const onFocus = (step: number) => (e: FocusEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el || !e.currentTarget.matches(":focus-visible")) return;
    if (!window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches) return;
    // After the browser's own scroll to the focused link, which would otherwise undo this one.
    window.setTimeout(() => {
      if (el.dataset.step !== String(step)) goToStep(el, count, step);
    }, 0);
  };

  return (
    <section
      ref={ref}
      aria-labelledby="road-heading"
      data-step="0"
      className={`lg:motion-safe:h-[calc(100dvh-var(--site-header-h)+210vh)]`}
    >
      <div
        className={`mx-auto max-w-[1200px] px-4 py-12 sm:px-8 sm:py-16 lg:motion-safe:sticky lg:motion-safe:top-[var(--site-header-h)] lg:motion-safe:flex lg:motion-safe:h-[calc(100dvh-var(--site-header-h))] lg:motion-safe:flex-col lg:motion-safe:justify-center lg:motion-safe:py-10`}
      >
        <h2 id="road-heading" className="font-heading text-2xl font-bold sm:text-3xl">
          The road to a green card
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base text-soft">Six stops, three agencies. Each one has a calculator.</p>{" "}
        {/* THE ROAD IS DRAWN: one ink line through six numbered stops, each with its stage's real paperwork. Down
            the left edge on a phone, across the top from 1024px (reduced motion), down the left again when pinned,
            where a second line on top of it fills with the reader's place. The order is real, so the numbers are. */}
        <div className="relative mt-8">
          <ol
            aria-label="The stages, in order"
            className={[
              "relative grid grid-cols-1 gap-y-6 before:absolute before:bottom-4 before:left-[16px] before:top-4 before:w-1 before:bg-foreground before:content-['']",
              "lg:motion-reduce:grid-cols-6 lg:motion-reduce:gap-x-6 lg:motion-reduce:before:bottom-auto lg:motion-reduce:before:left-0 lg:motion-reduce:before:right-0 lg:motion-reduce:before:top-4 lg:motion-reduce:before:h-1 lg:motion-reduce:before:w-auto",
              "lg:motion-safe:gap-y-4 lg:motion-safe:before:bg-foreground/20",
            ].join(" ")}
          >
            {stops.map((s, i) => (
              <li
                key={s.n}
                data-step-item={i}
                data-on={i === 0 ? "true" : "false"}
                className={`group/stop relative lg:motion-safe:static`}
              >
                <Link
                  href={s.href}
                  onFocus={onFocus(i)}
                  // Named by its own visible words (WCAG 2.5.3, label in name), in reading order.
                  aria-labelledby={["n", "name", "who", "fact", "doc", "cta"].map((part) => `road-${i}-${part}`).join(" ")}
                  className={`group grid grid-cols-[36px_minmax(0,1fr)] gap-x-4 lg:motion-reduce:grid-cols-1 lg:motion-reduce:gap-y-4 lg:motion-safe:w-[38%]`}
                >
                  <span
                    id={`road-${i}-n`}
                    aria-hidden="true"
                    className={`relative z-10 flex size-9 items-center justify-center bg-foreground font-heading text-lg font-bold text-background ring-4 ring-background group-hover:bg-primary group-hover:text-black lg:motion-safe:group-data-[on=true]/stop:bg-primary lg:motion-safe:group-data-[on=true]/stop:text-black`}
                  >
                    {s.n}
                  </span>{" "}
                  <span className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-4 lg:grid-cols-1 lg:gap-3">
                    {/* The stop's document. Pinned, it leaves the stop and fills the right of the frame; --reveal
                        (0 to 1) wipes it up from the bottom as the reader nears its stop. Its caption shows only once
                        the stop is the one being read, so the line under the frame always names the lime stop. */}
                    <span
                      data-reveal={i}
                      style={{ "--reveal": i === 0 ? 1 : 0 } as CSSProperties}
                      className={`block lg:motion-safe:absolute lg:motion-safe:right-0 lg:motion-safe:top-0 lg:motion-safe:w-[min(56%,620px)] lg:motion-safe:[clip-path:inset(calc((1_-_var(--reveal,1))_*_100%)_0_0_0)]`}
                    >
                      <span
                        className={`block aspect-[5/4] overflow-hidden border-2 border-[var(--object-border)] bg-card transition-colors group-hover:border-primary-text`}
                      >
                        <Image
                          src={s.img.src}
                          alt={s.img.alt}
                          width={s.img.w}
                          height={s.img.h}
                          unoptimized
                          loading="lazy"
                          className={`block size-full object-cover object-top${s.contain ? " lg:motion-safe:object-contain lg:motion-safe:object-center lg:motion-safe:p-8" : ""}`}
                        />
                      </span>{" "}
                      <span
                        className={`hidden items-center justify-between gap-4 border-2 border-t-0 border-[var(--object-border)] bg-card px-4 py-3 text-sm lg:motion-safe:flex lg:motion-safe:group-data-[on=false]/stop:invisible`}
                      >
                        <span id={`road-${i}-doc`} className="min-w-0 text-soft">
                          {s.doc}
                        </span>{" "}
                        <span id={`road-${i}-cta`} className="shrink-0 font-semibold text-primary-text underline underline-offset-4">
                          {s.cta}
                        </span>
                      </span>
                    </span>{" "}
                    <span className="min-w-0">
                      <span
                        id={`road-${i}-name`}
                        className={`block font-heading text-lg font-bold leading-tight group-hover:underline lg:motion-safe:group-data-[on=false]/stop:text-muted-foreground`}
                      >
                        {s.name}
                      </span>{" "}
                      <span
                        className={`mt-1 flex items-center gap-2 text-sm font-semibold text-soft lg:motion-safe:group-data-[on=false]/stop:text-muted-foreground`}
                      >
                        <span aria-hidden="true" className={`size-2.5 shrink-0 ${s.dot}`} />
                        <span id={`road-${i}-who`}>{s.who}</span>
                      </span>{" "}
                      <span
                        id={`road-${i}-fact`}
                        className={`mt-1 block text-sm leading-snug text-soft lg:motion-safe:group-data-[on=false]/stop:text-muted-foreground`}
                      >
                        {s.fact}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>{" "}
          {/* The line that fills with the reader's place, over the road's own line; --road-fill is written here. */}
          <span
            aria-hidden="true"
            data-road-fill=""
            className="pointer-events-none bottom-4 left-[16px] top-4 hidden w-1 origin-top bg-foreground [transform:scaleY(var(--road-fill,0))] lg:motion-safe:absolute lg:motion-safe:block"
          />
        </div>
      </div>
    </section>
  );
}
