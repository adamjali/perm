"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";

import { choiceVariants } from "@/components/ui/choice";
import { cn } from "@/lib/utils";

/**
 * Numbered pages for a list held in full on the page (articles, a letter of names, notices). Owner, Oct 21 2026:
 * "pagination not endless scroll ... check any and everywhere proper ... good looking good working smooth".
 *
 * - The page lives in the address (`?page=3`), so a reload, a shared link and the Back button all land on it.
 *   The server renders page 1; the browser moves to the address's page as it starts.
 * - Previous, the page numbers with gaps, Next. On a phone, Previous, "Page 3 of 8" and Next.
 * - A press brings the top of the list back into view when it has scrolled out above, as Pager does.
 * - Each control is 44px and says what it does to a screen reader; the current page is `aria-current`.
 *
 * Lists paged by the server with a cursor (the case browsers) keep Pager: a cursor can't jump to page 7.
 */

/** The page numbers to draw, 1-based, with "gap" where a run is skipped. Seven slots at most. */
export function pageItems(page: number, count: number): Array<number | "gap"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "gap", count];
  if (page >= count - 3) return [1, "gap", count - 4, count - 3, count - 2, count - 1, count];
  return [1, "gap", page - 1, page, page + 1, "gap", count];
}

/** Clamp a page number read from anywhere to 1..count. */
export function clampPage(page: number, count: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.max(1, Math.floor(page)), Math.max(1, count));
}

const CHANGE = "pt:pagechange";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/**
 * Some of the address's query (`?page=3&topic=queue`), read without useSearchParams so a prerendered page stays
 * whole. Server and first paint read nothing, so the prerendered HTML is the default view and hydration never
 * mismatches; the address's view follows at once. `update` changes several keys in one history entry (null removes).
 */
export function useQueryParam(key: string): [string, (updates: Record<string, string | null>) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(key) ?? "",
    () => "",
  );
  const update = useCallback((updates: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    if (url.href !== window.location.href) window.history.pushState(window.history.state, "", url.href);
    window.dispatchEvent(new Event(CHANGE));
  }, []);
  return [raw, update];
}

/** The page in the address, 1 when absent (see useQueryParam). */
export function usePageParam(key = "page"): [number, (page: number) => void] {
  const [raw, update] = useQueryParam(key);
  const page = Number(raw) >= 1 ? Math.floor(Number(raw)) : 1;
  const set = useCallback((next: number) => update({ [key]: next <= 1 ? null : String(next) }), [key, update]);
  return [page, set];
}

/** Bring a list's top into view if a press left it above the screen. */
export function showTop(top: HTMLElement | null | undefined) {
  if (!top || top.getBoundingClientRect().top >= 0) return;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  top.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
}

export function Pagination({
  page,
  pageCount,
  onPage,
  total,
  perPage,
  noun = "items",
  label = "Pages",
  scrollTo,
  className,
}: {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  /** How many items the list holds, for "13 to 24 of 86". */
  total?: number;
  perPage?: number;
  /** What the list holds, plural ("guides"). */
  noun?: string;
  /** The nav's accessible name, when a page has two paged lists. */
  label?: string;
  /** The top of the list; give it a `scroll-mt-*` clear of the header. */
  scrollTo?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  if (pageCount <= 1) {
    return total && total > 0 ? (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {`All ${total.toLocaleString("en-US")} ${noun}`}
      </p>
    ) : null;
  }
  const go = (next: number) => {
    if (next === page || next < 1 || next > pageCount) return;
    onPage(next);
    showTop(scrollTo?.current);
  };
  const from = total !== undefined && perPage ? (page - 1) * perPage + 1 : null;
  const to = from !== null && total !== undefined && perPage ? Math.min(total, page * perPage) : null;
  const button = (on: boolean) => cn(choiceVariants({ on }), "min-w-11 px-3 tabular-nums");
  return (
    <nav aria-label={label} className={cn("flex flex-col items-center gap-3", className)}>
      {from !== null && to !== null && total !== undefined ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {`${from.toLocaleString("en-US")} to ${to.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} ${noun}`}
        </p>
      ) : null}{" "}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={cn(button(false), "gap-1.5")}
        >
          <CaretLeftIcon aria-hidden="true" weight="bold" className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>{" "}
        <span className="text-sm font-semibold tabular-nums sm:hidden">{`Page ${page} of ${pageCount}`}</span>{" "}
        <ul className="hidden items-center gap-2 sm:flex">
          {pageItems(page, pageCount).map((item, i) =>
            item === "gap" ? (
              <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => go(item)}
                  aria-current={item === page ? "page" : undefined}
                  aria-label={item === page ? `Page ${item}, this page` : `Page ${item}`}
                  className={button(item === page)}
                >
                  {item}
                </button>
              </li>
            ),
          )}
        </ul>{" "}
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className={cn(button(false), "gap-1.5")}
        >
          <span className="hidden sm:inline">Next</span>
          <CaretRightIcon aria-hidden="true" weight="bold" className="size-4" />
        </button>
      </div>
    </nav>
  );
}
