"use client";

import { type CSSProperties, Fragment, type ReactNode, useRef } from "react";

import { goToStep, type StagePlace, useScrollStage } from "@/components/scroll/useScrollStage";

/**
 * The attorney page's product sections as one pinned stage (preview, Oct 21 2026). From 1024px with motion
 * allowed, the frame pins under the header: a ribbon of the six page names runs across the top with a lime
 * bar that slides under the one on screen, and each section, a full band, wipes in over the last from the
 * right edge as the reader scrolls. Below 1024px and under reduced motion every class here is inert and the
 * sections lay out one after another, as they always have.
 *
 * Every step stays in the page in every mode: the sections are the children, rendered on the server.
 */

/** The share of a step's scroll over which the next band wipes in. */
const WIPE = 1 / 3;

function place(p: StagePlace, el: HTMLElement) {
  const steps = el.querySelectorAll<HTMLElement>("[data-tour-step]");
  const n = steps.length;
  const scaled = p.progress * n;
  steps.forEach((s, k) => {
    // Step k is fully on from scaled = k; it wipes in over the last third of the step before it.
    const r = k === 0 ? 1 : Math.min(1, Math.max(0, (scaled - (k - WIPE)) / WIPE));
    s.style.setProperty("--wipe", `${((1 - r) * 100).toFixed(2)}%`);
  });
  el.querySelector<HTMLElement>("[data-tour-bar]")?.style.setProperty("--bar", Math.min(n - 1, Math.max(0, scaled - 0.5)).toFixed(4));
}

export function TourStage({ labels, children }: { labels: string[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const count = labels.length;
  useScrollStage(ref, count, place);

  return (
    <div
      ref={ref}
      data-stage="tour"
      data-step="0"
      style={{ "--steps": count } as CSSProperties}
      className="relative lg:motion-safe:h-[calc(100dvh-var(--site-header-h)+var(--steps)*36vh)]"
    >
      <div
        data-tour-frame=""
        className="lg:motion-safe:sticky lg:motion-safe:top-[var(--site-header-h)] lg:motion-safe:flex lg:motion-safe:h-[calc(100dvh-var(--site-header-h))] lg:motion-safe:flex-col lg:motion-safe:overflow-hidden lg:motion-safe:border-b-2 lg:motion-safe:border-black lg:motion-safe:bg-background"
      >
        <nav
          aria-label="The app, page by page"
          data-tour-ribbon=""
          className="hidden shrink-0 border-b-2 border-black bg-background lg:motion-safe:block"
        >
          <div className="mx-auto max-w-[1400px] px-8">
            <div className="relative grid grid-cols-[repeat(var(--steps),minmax(0,1fr))]">
              {labels.map((label, i) => (
                <Fragment key={label}>
                  {i > 0 ? " " : null}
                  <button
                    type="button"
                    data-step-item={i}
                    data-on={i === 0 ? "true" : "false"}
                    onClick={() => {
                      if (ref.current) goToStep(ref.current, count, i);
                    }}
                    className="min-h-14 px-1 text-left font-heading text-lg font-bold text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[on=true]:text-foreground"
                  >
                    {label}
                  </button>
                </Fragment>
              ))}{" "}
              {/* The bar sits under the page on screen, sliding with the reader's scroll. */}
              <span
                aria-hidden="true"
                data-tour-bar=""
                className="absolute bottom-0 left-0 h-1 w-[calc(100%/var(--steps))] translate-x-[calc(var(--bar)*100%)] bg-primary"
              />
            </div>
          </div>
        </nav>{" "}
        <div data-tour-area="" className="lg:motion-safe:relative lg:motion-safe:flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
