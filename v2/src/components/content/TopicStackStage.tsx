"use client";

import { useCallback, useRef, type CSSProperties, type FocusEvent, type ReactNode } from "react";

import { goToStep, STAGE_MEDIA, useScrollStage, type StagePlace } from "@/components/scroll/useScrollStage";

/**
 * The stage the topic cards stack in (TopicStack.tsx draws the cards). At 1024px and up, with motion allowed,
 * the frame pins under the header and each card slides up over the one before as the reader scrolls; the card
 * it covers shrinks a little and darkens under a solid overlay. Every value is the reader's scroll, written as CSS
 * variables (--stack-y and --stack-s on the card, --stack-dim on its overlay; registered non-inherited in
 * globals.css), which only the `lg:motion-safe:` classes read, so the same cards lay out as a plain grid elsewhere.
 *
 * Card s slides in over the second half of step s - 1 and is fully in when step s begins, so the middle of a step
 * (where a ribbon or a keyboard jump lands) always shows its card whole, with nothing arriving over it.
 */

const smooth = (t: number) => t * t * (3 - 2 * t);

/** How far card s has slid in at x = progress x count steps: 0 below the frame, 1 in place. */
export function arrival(x: number, s: number): number {
  if (s === 0) return 1;
  return smooth(Math.min(1, Math.max(0, (x - s + 0.5) / 0.5)));
}

export function TopicStackStage({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onPlace = useCallback(
    (place: StagePlace, el: HTMLElement) => {
      const frame = el.querySelector<HTMLElement>("[data-stage-frame]");
      const drop = (frame?.clientHeight ?? window.innerHeight) + 24;
      const x = place.progress * count;
      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-step-item]"));
      cards.forEach((card, i) => {
        const inPlace = arrival(x, i);
        const covered = i + 1 < cards.length ? arrival(x, i + 1) : 0;
        card.style.setProperty("--stack-y", `${((1 - inPlace) * drop).toFixed(1)}px`);
        card.style.setProperty("--stack-s", (1 - 0.06 * covered).toFixed(4));
        card.querySelector<HTMLElement>("[data-stage-dim]")?.style.setProperty("--stack-dim", (0.5 * covered).toFixed(3));
      });
    },
    [count],
  );
  useScrollStage(ref, count, onPlace);

  // A keyboard reader tabbing into a card still under the deck is taken to it, so focus never lands out of sight.
  const onFocus = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el || !window.matchMedia(STAGE_MEDIA).matches) return;
      const item = (e.target as HTMLElement).closest<HTMLElement>("[data-step-item]");
      const step = Number(item?.dataset.stepItem);
      if (!Number.isInteger(step) || el.dataset.step === String(step)) return;
      goToStep(el, count, step);
    },
    [count],
  );

  return (
    <div
      ref={ref}
      data-topic-stage=""
      data-step="0"
      onFocusCapture={onFocus}
      style={{ "--stage-steps": count } as CSSProperties}
      className="lg:motion-safe:h-[calc(100dvh_-_var(--site-header-h)_+_var(--stage-steps)_*_34vh)]"
    >
      {children}
    </div>
  );
}
