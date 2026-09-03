"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/**
 * Previous / Next, with the reason a control is off written down.
 *
 * WHY THIS EXISTS. Three case browsers each rendered their own pair of
 * buttons, each `disabled` at 40% opacity and each silent about why. Two of
 * them were worse than silent: `disabled={!page || page.isDone}` is true while
 * the next page is still LOADING as well as when there isn't one, so a reader
 * who pressed Next on a slow connection got a greyed button that meant "wait"
 * and read as "that's everything". Adam's report was exactly this shape:
 * "no feedback? about like can or cant i just click and nothing happens".
 *
 * THE REASON IS VISIBLE TEXT, NOT A `title`. A tooltip on a disabled button is
 * invisible to a keyboard and to a phone, and most engines suppress pointer
 * events on a disabled control so it never fires at all. This component states
 * the reason in the same line that says which page you are on, and points both
 * buttons at it with `aria-describedby` so it is announced rather than merely
 * present. It is the pattern `UnifiedCaseSearch`'s `Field` already uses for a
 * refused filter.
 *
 * LOADING IS A THIRD STATE, not a flavour of "no more pages". While a page is
 * in flight both buttons are off, the line says so, and a spinner turns beside
 * it so the wait is visibly a wait.
 */
export function Pager({
  page,
  hasPrevious,
  hasNext,
  loading = false,
  onPrevious,
  onNext,
  id,
  noun = "page",
  previousLabel = "Previous",
  nextLabel = "Next",
  buttonClassName,
  labelClassName,
  className,
  children,
}: {
  /** 1-based, for display only. */
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  /** A page is in flight. Both controls are off and the line says why. */
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Unique within the page: the reason line is referenced by it. */
  id: string;
  /** What is being paged, for the end-of-list sentence. */
  noun?: string;
  /** Two of these lists read chronologically and say "Newer"/"Older". */
  previousLabel?: string;
  nextLabel?: string;
  buttonClassName: string;
  labelClassName?: string;
  className?: string;
  /** Anything that belongs beside the status line, such as a column note. */
  children?: React.ReactNode;
}) {
  const reason = loading
    ? "Loading…"
    : !hasNext && !hasPrevious
      ? `That is every ${noun} in this list.`
      : !hasNext
        ? `${nextLabel} is off: this is the last page.`
        : !hasPrevious
          ? `${previousLabel} is off: this is the first page.`
          : null;

  return (
    <nav aria-label="Pages" className={cn("mt-4 flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <p className={cn("flex items-center gap-2", labelClassName)}>
          {loading ? (
            <CircleNotchIcon
              className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
              weight="bold"
              aria-hidden="true"
            />
          ) : null}
          <span>Page {page.toLocaleString("en-US")}</span>
        </p>{" "}
        {reason ? (
          <p id={id} role={loading ? "status" : undefined} className="mt-1 text-sm text-foreground/70">
            {reason}
          </p>
        ) : null}{" "}
        {children}
      </div>{" "}
      <div className="flex gap-2">
        <button
          type="button"
          className={buttonClassName}
          disabled={loading || !hasPrevious}
          aria-describedby={reason ? id : undefined}
          onClick={onPrevious}
        >
          {previousLabel}
        </button>{" "}
        <button
          type="button"
          className={buttonClassName}
          disabled={loading || !hasNext}
          aria-describedby={reason ? id : undefined}
          onClick={onNext}
        >
          {nextLabel}
        </button>
      </div>
    </nav>
  );
}
