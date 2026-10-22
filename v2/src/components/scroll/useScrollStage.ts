"use client";

import { useEffect, type RefObject } from "react";

/**
 * Sections the reader drives by scrolling (owner's direction, Oct 21 2026: image-led, one move per section,
 * scrubbed by the reader's own scroll, never run by itself). A stage is a tall section whose inner frame is
 * sticky; while the frame is pinned, the reader's place in the section picks a step.
 *
 * The place is written onto the section itself, never through React state, so a scroll re-renders nothing:
 *   data-step          the step in [0, count) the progress falls in
 *   data-on="true"     on the child marked data-step-item="<that step>", "false" on the others
 * and handed to `onPlace` (progress is 0 when the section's top reaches the sticky line, 1 when its bottom reaches
 * the viewport's bottom), which writes its CSS variables on the elements that read them. Those variables are
 * registered non-inherited (globals.css), so a write restyles one element, never the section's whole subtree.
 * The work runs once per frame, and not at all while the reader's place in the section hasn't changed (the
 * section off screen, above or below).
 *
 * Nothing runs when the pinned layout doesn't apply: below 1024px, or when the reader asks for reduced
 * motion. The CSS (Tailwind's `lg:motion-safe:` variants) lays the section out finished then, so the hook
 * and the layout always agree on when a stage is a stage.
 */

export const STAGE_MEDIA = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

export interface StagePlace {
  /** 0 to 1 through the pinned span. */
  progress: number;
  /** The step the progress falls in, 0 to count - 1. */
  step: number;
  /** Progress within the current step, 0 to 1. */
  within: number;
}

/**
 * Where the reader is in a stage, from the section's box. `stickyTop` is the line the frame pins to (the
 * header's height); the pinned span is the section's height less the room below that line.
 */
export function stagePlace(
  rectTop: number,
  rectHeight: number,
  viewportHeight: number,
  stickyTop: number,
  count: number,
): StagePlace {
  const span = rectHeight - (viewportHeight - stickyTop);
  const raw = span > 0 ? (stickyTop - rectTop) / span : rectTop <= stickyTop ? 1 : 0;
  const progress = Math.min(1, Math.max(0, raw));
  const n = Math.max(1, count);
  const scaled = progress * n;
  const step = Math.min(n - 1, Math.floor(scaled));
  return { progress, step, within: Math.min(1, scaled - step) };
}

/** The page scroll that puts the reader in the middle of a step. */
export function scrollTopForStep(
  sectionTop: number,
  rectHeight: number,
  viewportHeight: number,
  stickyTop: number,
  count: number,
  step: number,
): number {
  const span = Math.max(0, rectHeight - (viewportHeight - stickyTop));
  return Math.round(sectionTop - stickyTop + span * ((step + 0.5) / Math.max(1, count)));
}

function headerLine(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--site-header-h").trim();
  const px = Number.parseFloat(v);
  return Number.isFinite(px) ? px : 64;
}

/** Scroll the page to a step of a stage (for a ribbon's buttons). Instant: no smooth scroll on this site. */
export function goToStep(el: HTMLElement, count: number, step: number): void {
  const rect = el.getBoundingClientRect();
  const top = scrollTopForStep(rect.top + window.scrollY, rect.height, window.innerHeight, headerLine(), count, step);
  window.scrollTo({ top, behavior: "auto" });
}

export function useScrollStage(
  ref: RefObject<HTMLElement | null>,
  count: number,
  onPlace?: (place: StagePlace, el: HTMLElement) => void,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(STAGE_MEDIA);
    let line = headerLine();
    let last = -1;
    let lastProgress = -1;
    let frame = 0;

    const update = (force = false) => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const place = stagePlace(rect.top, rect.height, window.innerHeight, line, count);
      if (!force && place.progress === lastProgress) return;
      lastProgress = place.progress;
      if (place.step !== last) {
        last = place.step;
        el.dataset.step = String(place.step);
        el.querySelectorAll<HTMLElement>("[data-step-item]").forEach((item) => {
          item.dataset.on = item.dataset.stepItem === String(place.step) ? "true" : "false";
        });
      }
      onPlace?.(place, el);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(() => update());
    };
    const onResize = () => {
      line = headerLine();
      update(true);
    };

    let on = false;
    const start = () => {
      if (on) return;
      on = true;
      update(true);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize, { passive: true });
    };
    const stop = () => {
      if (!on) return;
      on = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const sync = () => (media.matches ? start() : stop());
    sync();
    media.addEventListener("change", sync);
    return () => {
      stop();
      media.removeEventListener("change", sync);
    };
  }, [ref, count, onPlace]);
}
