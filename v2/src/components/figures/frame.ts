/**
 * Where a moving drawing sits in an article, shared by every figure under src/components/figures.
 *
 * Owner, Oct 21 2026: "it should be smaller on the side or something not main thing full width" and "should be
 * naked on the screen not in container looks better". So from 1024px a drawing floats beside the text at about
 * a third of the column, with no edge or ground of its own; on a phone it sits in the flow at full width. The
 * long description folds under "What this shows" (the words stay in the page). The prose rules that keep a
 * heading or a boxed block from running under it are in globals.css, under `.figure-side`.
 */

export const FIGURE_CLASS =
  "figure-side not-prose my-8 lg:float-right lg:clear-right lg:mb-6 lg:ml-10 lg:mt-1 lg:w-[25rem] xl:w-[28rem]";

/** The readout and the Pause button under the drawing. */
export const READOUT_CLASS = "mt-1 flex items-center gap-3";

export const CAPTION_CLASS = "mt-1 text-sm text-muted-foreground";

export const SUMMARY_CLASS =
  "inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-soft underline decoration-1 underline-offset-4 hover:decoration-2";
